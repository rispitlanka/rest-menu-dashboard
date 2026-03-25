"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
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

type MenuItem = {
  _id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  images: string[];
  variants: {
    label: string;
    options: { name: string; priceModifier: number }[];
  }[];
  nutritionalInfo: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  allergens: string[];
  isAvailable: boolean;
  displayOrder: number;
};

type Category = { _id: string; name: string; isActive: boolean };

export default function MenuItemDetailPanel({ itemId }: { itemId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [item, setItem] = useState<MenuItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUnauthorized = () => {
    clearAuthSession();
    router.replace("/signin");
    router.refresh();
  };

  const requestWithAuth = async <T,>(
    endpoint: string,
    init?: RequestInit,
    retry = true,
  ): Promise<{ data?: T; message?: string } & T> => {
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
    return body;
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [itemRes, categoryRes] = await Promise.all([
          requestWithAuth<MenuItem>(`/items/${itemId}`, { method: "GET" }),
          requestWithAuth<Category[]>("/categories", { method: "GET" }),
        ]);
        setItem((itemRes.data ?? itemRes) as MenuItem);
        setCategories((categoryRes.data ?? []) as Category[]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load item.";
        setErrorMessage(message);
        showToast(message, "error");
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const handleUpdate = async () => {
    if (!item) return;
    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      await requestWithAuth(`/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({
          categoryId: item.categoryId,
          name: item.name,
          description: item.description || "",
          price: Number(item.price),
          images: item.images || [],
          variants: item.variants || [],
          nutritionalInfo: item.nutritionalInfo || {},
          allergens: item.allergens || [],
          isAvailable: item.isAvailable,
          displayOrder: Number(item.displayOrder || 0),
        }),
      });
      setMessage("Item updated successfully.");
      showToast("Item updated successfully.", "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update item.";
      setErrorMessage(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <p className="text-sm text-gray-500">Loading item...</p>;
  if (!item) return <p className="text-sm text-error-500">Item not found.</p>;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
        View / Update Item
      </h3>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input value={item.name} onChange={(e) => setItem((p) => (p ? { ...p, name: e.target.value } : p))} />
        </div>
        <div>
          <Label>Category</Label>
          <select
            value={item.categoryId}
            onChange={(e) => setItem((p) => (p ? { ...p, categoryId: e.target.value } : p))}
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700"
          >
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Price</Label>
          <Input
            type="number"
            value={String(item.price)}
            onChange={(e) =>
              setItem((p) => (p ? { ...p, price: Number(e.target.value || "0") } : p))
            }
          />
        </div>
        <div>
          <Label>Display Order</Label>
          <Input
            type="number"
            value={String(item.displayOrder ?? 0)}
            onChange={(e) =>
              setItem((p) => (p ? { ...p, displayOrder: Number(e.target.value || "0") } : p))
            }
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.isAvailable}
              onChange={(e) =>
                setItem((p) => (p ? { ...p, isAvailable: e.target.checked } : p))
              }
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Available</span>
          </label>
        </div>
        <div className="lg:col-span-2">
          <Label>Description</Label>
          <textarea
            value={item.description || ""}
            onChange={(e) =>
              setItem((p) => (p ? { ...p, description: e.target.value } : p))
            }
            className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
            rows={4}
          />
        </div>
        <div className="lg:col-span-2">
          <Label>Allergens (comma-separated)</Label>
          <Input
            value={(item.allergens || []).join(",")}
            onChange={(e) =>
              setItem((p) =>
                p
                  ? {
                      ...p,
                      allergens: e.target.value
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    }
                  : p,
              )
            }
          />
        </div>
        <div className="lg:col-span-2">
          <Label>Calories</Label>
          <Input
            type="number"
            value={String(item.nutritionalInfo?.calories ?? 0)}
            onChange={(e) =>
              setItem((p) =>
                p
                  ? {
                      ...p,
                      nutritionalInfo: {
                        ...(p.nutritionalInfo || {}),
                        calories: Number(e.target.value || "0"),
                      },
                    }
                  : p,
              )
            }
          />
        </div>
        <div>
          <Label>Protein</Label>
          <Input
            type="number"
            value={String(item.nutritionalInfo?.protein ?? 0)}
            onChange={(e) =>
              setItem((p) =>
                p
                  ? {
                      ...p,
                      nutritionalInfo: {
                        ...(p.nutritionalInfo || {}),
                        protein: Number(e.target.value || "0"),
                      },
                    }
                  : p,
              )
            }
          />
        </div>
        <div>
          <Label>Carbs</Label>
          <Input
            type="number"
            value={String(item.nutritionalInfo?.carbs ?? 0)}
            onChange={(e) =>
              setItem((p) =>
                p
                  ? {
                      ...p,
                      nutritionalInfo: {
                        ...(p.nutritionalInfo || {}),
                        carbs: Number(e.target.value || "0"),
                      },
                    }
                  : p,
              )
            }
          />
        </div>
        <div>
          <Label>Fat</Label>
          <Input
            type="number"
            value={String(item.nutritionalInfo?.fat ?? 0)}
            onChange={(e) =>
              setItem((p) =>
                p
                  ? {
                      ...p,
                      nutritionalInfo: {
                        ...(p.nutritionalInfo || {}),
                        fat: Number(e.target.value || "0"),
                      },
                    }
                  : p,
              )
            }
          />
        </div>
        <div className="lg:col-span-2">
          <Label>Variants</Label>
          <div className="space-y-3">
            {(item.variants || []).map((variant, variantIndex) => (
              <div
                key={`variant-${variantIndex}`}
                className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    value={variant.label}
                    onChange={(e) =>
                      setItem((p) =>
                        p
                          ? {
                              ...p,
                              variants: p.variants.map((v, idx) =>
                                idx === variantIndex ? { ...v, label: e.target.value } : v,
                              ),
                            }
                          : p,
                      )
                    }
                    placeholder="Variant label"
                  />
                  <button
                    type="button"
                    className="rounded border border-error-500 px-2 py-2 text-xs text-error-500"
                    onClick={() =>
                      setItem((p) =>
                        p
                          ? {
                              ...p,
                              variants: p.variants.filter((_, idx) => idx !== variantIndex),
                            }
                          : p,
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-2">
                  {(variant.options || []).map((option, optionIndex) => (
                    <div key={`opt-${variantIndex}-${optionIndex}`} className="grid grid-cols-12 gap-2">
                      <div className="col-span-7">
                        <Input
                          value={option.name}
                          onChange={(e) =>
                            setItem((p) =>
                              p
                                ? {
                                    ...p,
                                    variants: p.variants.map((v, vIdx) =>
                                      vIdx === variantIndex
                                        ? {
                                            ...v,
                                            options: v.options.map((o, oIdx) =>
                                              oIdx === optionIndex
                                                ? { ...o, name: e.target.value }
                                                : o,
                                            ),
                                          }
                                        : v,
                                    ),
                                  }
                                : p,
                            )
                          }
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          type="number"
                          value={String(option.priceModifier)}
                          onChange={(e) =>
                            setItem((p) =>
                              p
                                ? {
                                    ...p,
                                    variants: p.variants.map((v, vIdx) =>
                                      vIdx === variantIndex
                                        ? {
                                            ...v,
                                            options: v.options.map((o, oIdx) =>
                                              oIdx === optionIndex
                                                ? {
                                                    ...o,
                                                    priceModifier: Number(
                                                      e.target.value || "0",
                                                    ),
                                                  }
                                                : o,
                                            ),
                                          }
                                        : v,
                                    ),
                                  }
                                : p,
                            )
                          }
                        />
                      </div>
                      <div className="col-span-1">
                        <button
                          type="button"
                          className="h-11 w-full rounded border border-error-500 text-xs text-error-500"
                          onClick={() =>
                            setItem((p) =>
                              p
                                ? {
                                    ...p,
                                    variants: p.variants.map((v, vIdx) =>
                                      vIdx === variantIndex
                                        ? {
                                            ...v,
                                            options: v.options.filter(
                                              (_, oIdx) => oIdx !== optionIndex,
                                            ),
                                          }
                                        : v,
                                    ),
                                  }
                                : p,
                            )
                          }
                        >
                          -
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 rounded border px-2 py-1 text-xs"
                  onClick={() =>
                    setItem((p) =>
                      p
                        ? {
                            ...p,
                            variants: p.variants.map((v, idx) =>
                              idx === variantIndex
                                ? {
                                    ...v,
                                    options: [...v.options, { name: "", priceModifier: 0 }],
                                  }
                                : v,
                            ),
                          }
                        : p,
                    )
                  }
                >
                  + Add Option
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 rounded border px-3 py-2 text-xs"
            onClick={() =>
              setItem((p) =>
                p
                  ? {
                      ...p,
                      variants: [...(p.variants || []), { label: "", options: [] }],
                    }
                  : p,
              )
            }
          >
            + Add Variant
          </button>
        </div>
        <div className="lg:col-span-2">
          <Label>Images</Label>
          {(item.images || []).length ? (
            <div className="flex flex-wrap gap-2">
              {(item.images || []).map((image, idx) => (
                <img
                  key={`${item._id}-img-${idx}`}
                  src={image}
                  alt={`item-${idx}`}
                  className="h-14 w-14 rounded object-cover"
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No images</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <Button size="sm" onClick={handleUpdate} disabled={isSaving}>
          {isSaving ? "Updating..." : "Update Item"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => router.push("/basic-tables")}>
          Back to Manage Items
        </Button>
      </div>

      {errorMessage && <p className="mt-3 text-sm text-error-500">{errorMessage}</p>}
      {message && <p className="mt-3 text-sm text-success-500">{message}</p>}
    </div>
  );
}
