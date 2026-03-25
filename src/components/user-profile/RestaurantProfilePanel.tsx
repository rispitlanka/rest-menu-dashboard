"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import {
  clearAuthSession,
  getAccessTokenFromCookie,
  getRefreshTokenFromCookie,
  saveAuthSession,
} from "@/lib/auth-storage";
import { refreshAccessToken } from "@/lib/auth-api";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/common/ToastProvider";

const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

type RestaurantProfile = {
  _id?: string;
  ownerId?: string;
  name: string;
  logo: string;
  address: string;
  phone: string;
  operatingHours: string;
  qrCode?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

function persistRestaurantLogo(logo: string | undefined) {
  if (typeof window === "undefined") return;
  try {
    if (logo) localStorage.setItem("dashboard_restaurant_logo", logo);
    else localStorage.removeItem("dashboard_restaurant_logo");
  } catch {
    // ignore storage errors
  }
}

const defaultProfile: RestaurantProfile = {
  name: "",
  logo: "",
  address: "",
  phone: "",
  operatingHours: "",
  qrCode: "",
  isActive: true,
};

function to24HourTime(value: string) {
  const trimmed = value.trim();
  const hhmmPattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (hhmmPattern.test(trimmed)) {
    return trimmed;
  }

  const amPmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!amPmMatch) return "";

  let hour = Number(amPmMatch[1]);
  const minute = amPmMatch[2] ?? "00";
  const period = amPmMatch[3].toUpperCase();

  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour < 12) hour += 12;

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function parseOperatingHours(value: string) {
  if (!value) return { start: "", end: "" };
  const parts = value.split("-");
  if (parts.length < 2) return { start: "", end: "" };

  const start = to24HourTime(parts[0] ?? "");
  const end = to24HourTime(parts[1] ?? "");
  return { start, end };
}

export default function RestaurantProfilePanel() {
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<RestaurantProfile>(defaultProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

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
        ...(init?.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
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

    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T> &
      T;

    if (!response.ok) {
      throw new Error(body?.message || "Request failed. Please try again.");
    }

    return (body?.data ?? body) as T;
  };

  const loadRestaurantProfile = async () => {
    setIsLoading(true);
    try {
      const data = await requestWithAuth<RestaurantProfile>("/restaurants/me", {
        method: "GET",
      });
      setProfile({ ...defaultProfile, ...data });
      persistRestaurantLogo(data.logo);
      const parsedHours = parseOperatingHours(data.operatingHours || "");
      setStartTime(parsedHours.start);
      setEndTime(parsedHours.end);
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : "Failed to load restaurant profile.";
      showToast(messageText, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRestaurantProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange =
    (field: keyof RestaurantProfile) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value =
        field === "isActive" ? event.target.checked : event.target.value;
      setProfile((prev) => ({
        ...prev,
        [field]: value,
      }));
      if (field === "logo") {
        setLogoPreviewError(false);
      }
    };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const operatingHours =
        startTime && endTime ? `${startTime}-${endTime}` : profile.operatingHours;

      const payload = {
        name: profile.name,
        address: profile.address,
        phone: profile.phone,
        operatingHours,
        isActive: profile.isActive,
      };

      const updated = await requestWithAuth<RestaurantProfile>("/restaurants/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setProfile((prev) => ({ ...prev, ...updated }));
      const parsedHours = parseOperatingHours(updated.operatingHours || operatingHours);
      setStartTime(parsedHours.start);
      setEndTime(parsedHours.end);
      showToast("Restaurant profile updated successfully.", "success");
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : "Failed to update restaurant profile.";
      showToast(messageText, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateQr = async () => {
    setIsGeneratingQr(true);
    try {
      const updated = await requestWithAuth<RestaurantProfile>(
        "/restaurants/qr/generate",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      setProfile((prev) => ({ ...prev, ...updated }));
      showToast("QR code regenerated successfully.", "success");
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Failed to regenerate QR code.";
      showToast(messageText, "error");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const result = await requestWithAuth<{ restaurantId: string; logo: string }>(
        "/restaurants/me/logo",
        {
          method: "POST",
          body: formData,
        },
      );

      setProfile((prev) => ({
        ...prev,
        logo: result.logo,
      }));
      persistRestaurantLogo(result.logo);
      setLogoPreviewError(false);
      showToast("Restaurant logo uploaded successfully.", "success");
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Failed to upload restaurant logo.";
      showToast(messageText, "error");
    } finally {
      setIsUploadingLogo(false);
      event.target.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading restaurant profile...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Restaurant Profile
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerateQr}
          disabled={isGeneratingQr}
        >
          {isGeneratingQr ? "Generating..." : "Regenerate QR"}
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <Label>Restaurant Name</Label>
            <Input
              type="text"
              name="name"
              value={profile.name}
              onChange={handleChange("name")}
            />
          </div>
          <div>
            <Label>Restaurant Logo</Label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={isUploadingLogo}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600 disabled:opacity-50 dark:text-gray-400"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Upload one image file. This uses `POST /restaurants/me/logo`.
            </p>
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              type="text"
              name="phone"
              value={profile.phone}
              onChange={handleChange("phone")}
            />
          </div>
          <div>
            <Label>Start Time</Label>
            <Input
              type="time"
              name="startTime"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </div>
          <div>
            <Label>End Time</Label>
            <Input
              type="time"
              name="endTime"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>
          <div className="lg:col-span-2">
            <Label>Address</Label>
            <Input
              type="text"
              name="address"
              value={profile.address}
              onChange={handleChange("address")}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
            Logo Preview
          </p>
          {profile.logo ? (
            // Using img here avoids remote domain restrictions for dynamic URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <>
              {!logoPreviewError && (
                <img
                  src={profile.logo}
                  alt="Restaurant logo"
                  className="h-24 w-24 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                  onLoad={() => setLogoPreviewError(false)}
                  onError={() => setLogoPreviewError(true)}
                />
              )}
              {logoPreviewError && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Unable to load logo preview from this URL.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enter a logo URL to preview.
            </p>
          )}
        </div>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={profile.isActive}
            onChange={handleChange("isActive")}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Restaurant active
          </span>
        </label>

        {profile.qrCode && (
          <div>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
              Current QR Code
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.qrCode}
              alt="Restaurant QR code"
              className="h-40 w-40 rounded border border-gray-200 object-contain p-2 dark:border-gray-700"
            />
          </div>
        )}

        <Button size="sm" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Profile"}
        </Button>
      </form>
    </div>
  );
}
