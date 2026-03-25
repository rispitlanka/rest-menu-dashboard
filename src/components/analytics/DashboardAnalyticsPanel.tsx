"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearAuthSession,
  getAccessTokenFromCookie,
  getRefreshTokenFromCookie,
  saveAuthSession,
} from "@/lib/auth-storage";
import { refreshAccessToken } from "@/lib/auth-api";
import { useToast } from "@/components/common/ToastProvider";

const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

type ViewsPoint = { _id: { y: number; m: number; d: number }; count: number };
type PopularPoint = { _id: string; views: number };
type RatingsPoint = { _id: string; avgRating: number; totalReviews: number };
type RatingsData = {
  byItem: RatingsPoint[];
  overall: { avgRating: number; totalReviews: number };
};

export default function DashboardAnalyticsPanel() {
  const router = useRouter();
  const { showToast } = useToast();

  const [views, setViews] = useState<ViewsPoint[]>([]);
  const [popular, setPopular] = useState<PopularPoint[]>([]);
  const [ratings, setRatings] = useState<RatingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

    const body = (await response.json().catch(() => ({}))) as {
      data?: T;
      message?: string;
    } & T;
    if (!response.ok) {
      throw new Error(body?.message || "Request failed.");
    }
    return (body?.data ?? body) as T;
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [viewsData, popularData, ratingsData] = await Promise.all([
        requestWithAuth<ViewsPoint[]>("/analytics/views", { method: "GET" }),
        requestWithAuth<PopularPoint[]>("/analytics/popular", { method: "GET" }),
        requestWithAuth<RatingsData>("/analytics/ratings", { method: "GET" }),
      ]);
      setViews(viewsData || []);
      setPopular(popularData || []);
      setRatings(ratingsData || null);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load dashboard analytics.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalViews = useMemo(
    () => views.reduce((sum, point) => sum + point.count, 0),
    [views],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Menu Views</p>
          <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            {isLoading ? "..." : totalViews}
          </h3>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Overall Avg Rating</p>
          <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            {isLoading ? "..." : (ratings?.overall?.avgRating ?? 0).toFixed(1)}
          </h3>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Reviews</p>
          <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            {isLoading ? "..." : ratings?.overall?.totalReviews ?? 0}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h4 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
            Views by Date
          </h4>
          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : views.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No view data.</p>
          ) : (
            <div className="space-y-2">
              {views.map((point, index) => (
                <div
                  key={`view-${index}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                >
                  <span>{`${point._id.y}-${String(point._id.m).padStart(2, "0")}-${String(point._id.d).padStart(2, "0")}`}</span>
                  <span className="font-medium">{point.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h4 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
            Most Viewed Items
          </h4>
          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : popular.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No popular item data.</p>
          ) : (
            <div className="space-y-2">
              {popular.map((row) => (
                <div
                  key={row._id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                >
                  <span>{row._id}</span>
                  <span className="font-medium">{row.views} views</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h4 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
          Ratings by Item
        </h4>
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : !ratings?.byItem?.length ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No ratings data.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left">Item ID</th>
                  <th className="px-3 py-2 text-left">Average Rating</th>
                  <th className="px-3 py-2 text-left">Total Reviews</th>
                </tr>
              </thead>
              <tbody>
                {ratings.byItem.map((row) => (
                  <tr key={row._id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2">{row._id}</td>
                    <td className="px-3 py-2">{row.avgRating.toFixed(1)}</td>
                    <td className="px-3 py-2">{row.totalReviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
