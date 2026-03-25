"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/common/ToastProvider";
import {
  clearAuthSession,
  getAccessTokenFromCookie,
  getRefreshTokenFromCookie,
  saveAuthSession,
} from "@/lib/auth-storage";
import { refreshAccessToken } from "@/lib/auth-api";

const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

type Review = {
  _id: string;
  restaurantId: string;
  menuItemId:
    | string
    | {
        _id: string;
        name: string;
        description?: string;
        price?: number;
        images?: string[];
        categoryId?: string;
        isAvailable?: boolean;
      };
  customerId:
    | string
    | {
        _id: string;
        name?: string;
        deviceId?: string;
      };
  rating: number;
  comment: string;
  isFlagged: boolean;
  createdAt: string;
};

export default function ReviewModerationPanel() {
  const router = useRouter();
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUnauthorized = () => {
    clearAuthSession();
    router.replace("/signin");
    router.refresh();
  };

  const requestWithAuth = async <T,>(
    endpoint: string,
    init?: RequestInit,
    retry = true,
  ): Promise<T> => {
    const accessToken = getAccessTokenFromCookie();
    if (!accessToken) {
      handleUnauthorized();
      throw new Error("Session expired. Please sign in again.");
    }

    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers || {}),
      },
    });

    if (response.status === 401 && retry) {
      const refreshToken = getRefreshTokenFromCookie();
      if (!refreshToken) {
        handleUnauthorized();
        throw new Error("Session expired. Please sign in again.");
      }
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        saveAuthSession({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken || refreshToken,
        });
      } catch {
        handleUnauthorized();
        throw new Error("Session expired. Please sign in again.");
      }
      return requestWithAuth<T>(endpoint, init, false);
    }

    const body = (await response.json().catch(() => ({}))) as { data?: T; message?: string } & T;
    if (!response.ok) throw new Error(body?.message || "Request failed.");
    return (body?.data ?? body) as T;
  };

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const data = await requestWithAuth<Review[]>("/reviews/restaurant/me", {
        method: "GET",
      });
      setReviews(data || []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load reviews.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleFlag = async (review: Review) => {
    const nextFlag = !review.isFlagged;
    setUpdatingId(review._id);
    setReviews((prev) =>
      prev.map((item) =>
        item._id === review._id ? { ...item, isFlagged: nextFlag } : item,
      ),
    );
    try {
      await requestWithAuth(`/reviews/${review._id}/flag`, {
        method: "PATCH",
        body: JSON.stringify({ isFlagged: nextFlag }),
      });
      showToast(
        nextFlag ? "Review flagged successfully." : "Review unflagged successfully.",
        "success",
      );
    } catch (error) {
      setReviews((prev) =>
        prev.map((item) =>
          item._id === review._id ? { ...item, isFlagged: review.isFlagged } : item,
        ),
      );
      showToast(
        error instanceof Error ? error.message : "Failed to update review flag.",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Review Moderation
        </h3>
        <button
          type="button"
          onClick={loadReviews}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No reviews found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left">Rating</th>
                <th className="px-3 py-2 text-left">Comment</th>
                <th className="px-3 py-2 text-left">Menu Item</th>
                  <th className="px-3 py-2 text-left">Price</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Flag</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review._id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-3 py-2">{review.rating}</td>
                  <td className="max-w-[360px] px-3 py-2">{review.comment}</td>
                  <td className="px-3 py-2">
                    {typeof review.menuItemId === "string"
                      ? review.menuItemId
                      : review.menuItemId?.name || review.menuItemId?._id}
                  </td>
                  <td className="px-3 py-2">
                    {typeof review.menuItemId === "string"
                      ? "-"
                      : review.menuItemId?.price ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    {new Date(review.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={review.isFlagged}
                      disabled={updatingId === review._id}
                      onClick={() => handleToggleFlag(review)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        review.isFlagged ? "bg-red-500" : "bg-gray-300 dark:bg-gray-600"
                      } ${updatingId === review._id ? "opacity-60" : ""}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          review.isFlagged ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
