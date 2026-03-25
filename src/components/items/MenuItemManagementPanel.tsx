"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { CopyIcon, EyeIcon, TrashBinIcon } from "@/icons";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useToast } from "@/components/common/ToastProvider";
import {
  clearAuthSession,
  getAccessTokenFromCookie,
  getRefreshTokenFromCookie,
  saveAuthSession,
} from "@/lib/auth-storage";
import { refreshAccessToken } from "@/lib/auth-api";
import { useRouter } from "next/navigation";

const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

type PanelMode = "all" | "create" | "manage";
type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: { page: number; limit: number; total: number };
};
type Category = { _id: string; name: string; isActive: boolean };
type VariantOption = { name: string; priceModifier: number };
type VariantGroup = { label: string; options: VariantOption[] };
type NutritionalInfo = { calories?: number; protein?: number; carbs?: number; fat?: number };
type MenuItem = {
  _id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  images: string[];
  variants?: VariantGroup[];
  nutritionalInfo?: NutritionalInfo;
  allergens?: string[];
  isAvailable: boolean;
  displayOrder: number;
};
type CreateVariantOption = { name: string; priceModifier: string };
type CreateVariantGroup = { label: string; options: CreateVariantOption[] };
type CreateItemForm = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  isAvailable: boolean;
  displayOrder: string;
  allergensCsv: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  imageFiles: File[];
};

const defaultCreateForm: CreateItemForm = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  isAvailable: true,
  displayOrder: "0",
  allergensCsv: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  imageFiles: [],
};

export default function MenuItemManagementPanel({ mode = "all" }: { mode?: PanelMode }) {
  const router = useRouter();
  const { showToast } = useToast();
  const showCreate = mode === "all" || mode === "create";
  const showManage = mode === "all" || mode === "manage";

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [createForm, setCreateForm] = useState<CreateItemForm>(defaultCreateForm);
  const [createVariants, setCreateVariants] = useState<CreateVariantGroup[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedAvailability, setSelectedAvailability] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [duplicatingItemId, setDuplicatingItemId] = useState<string | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const handleUnauthorized = () => {
    clearAuthSession();
    router.replace("/signin");
    router.refresh();
  };

  const requestWithAuth = async <T,>(
    endpoint: string,
    init?: RequestInit,
    retry = true,
  ): Promise<ApiEnvelope<T> & T> => {
    const accessToken = getAccessTokenFromCookie();
    if (!accessToken) {
      handleUnauthorized();
      throw new Error("Session expired. Please sign in again.");
    }

    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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

    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & T;
    if (!response.ok) throw new Error(body?.message || "Request failed. Please try again.");
    return body;
  };

  const loadCategories = async () => {
    const response = await requestWithAuth<Category[]>("/categories", { method: "GET" });
    setCategories((response.data ?? []).filter((category) => category.isActive));
  };

  const loadItems = async (nextPage = page, nextLimit = limit) => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(nextPage),
        limit: String(nextLimit),
      });
      if (selectedCategoryId) query.set("categoryId", selectedCategoryId);
      if (selectedAvailability !== "all") query.set("isAvailable", selectedAvailability);
      const response = await requestWithAuth<MenuItem[]>(`/items?${query.toString()}`, {
        method: "GET",
      });
      const data = (response.data ?? []) as MenuItem[];
      setItems(data);
      setPage(response.meta?.page ?? nextPage);
      setLimit(response.meta?.limit ?? nextLimit);
      setTotal(response.meta?.total ?? data.length);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load items.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await loadCategories();
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Failed to load categories.",
          "error",
        );
      } finally {
        await loadItems(1, limit);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.categoryId || !createForm.name.trim() || !createForm.price.trim()) {
      setErrorMessage("Category, name, and price are required.");
      showToast("Category, name, and price are required.", "error");
      return;
    }

    setIsCreating(true);
    try {
      const variants = createVariants
        .map((variant) => ({
          label: variant.label.trim(),
          options: variant.options
            .map((option) => ({
              name: option.name.trim(),
              priceModifier: Number(option.priceModifier || "0"),
            }))
            .filter((option) => option.name),
        }))
        .filter((variant) => variant.label && variant.options.length > 0);

      const nutritionalInfo = {
        calories: Number(createForm.calories || "0"),
        protein: Number(createForm.protein || "0"),
        carbs: Number(createForm.carbs || "0"),
        fat: Number(createForm.fat || "0"),
      };

      const allergens = createForm.allergensCsv
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const imageFiles = createForm.imageFiles ?? [];
      if (imageFiles.length > 0) {
        const formData = new FormData();
        formData.append("categoryId", createForm.categoryId);
        formData.append("name", createForm.name.trim());
        formData.append("description", createForm.description.trim());
        formData.append("price", String(Number(createForm.price)));
        formData.append("isAvailable", String(createForm.isAvailable));
        formData.append("displayOrder", String(Number(createForm.displayOrder || "0")));
        formData.append("variants", JSON.stringify(variants));
        formData.append("nutritionalInfo", JSON.stringify(nutritionalInfo));
        formData.append("allergens", JSON.stringify(allergens));
        imageFiles.forEach((file) => formData.append("images", file));
        await requestWithAuth<MenuItem>("/items", { method: "POST", body: formData });
      } else {
        await requestWithAuth<MenuItem>("/items", {
          method: "POST",
          body: JSON.stringify({
            categoryId: createForm.categoryId,
            name: createForm.name.trim(),
            description: createForm.description.trim(),
            price: Number(createForm.price),
            images: [],
            variants,
            nutritionalInfo,
            allergens,
            isAvailable: createForm.isAvailable,
            displayOrder: Number(createForm.displayOrder || "0"),
          }),
        });
      }

      setCreateForm(defaultCreateForm);
      setCreateVariants([]);
      showToast("Menu item created successfully.", "success");
      await loadItems(1, limit);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to create menu item.",
        "error",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const addVariant = () => setCreateVariants((prev) => [...prev, { label: "", options: [] }]);
  const removeVariant = (variantIndex: number) =>
    setCreateVariants((prev) => prev.filter((_, index) => index !== variantIndex));
  const updateVariantLabel = (variantIndex: number, value: string) =>
    setCreateVariants((prev) =>
      prev.map((variant, index) => (index === variantIndex ? { ...variant, label: value } : variant)),
    );
  const addVariantOption = (variantIndex: number) =>
    setCreateVariants((prev) =>
      prev.map((variant, index) =>
        index === variantIndex
          ? { ...variant, options: [...variant.options, { name: "", priceModifier: "0" }] }
          : variant,
      ),
    );
  const removeVariantOption = (variantIndex: number, optionIndex: number) =>
    setCreateVariants((prev) =>
      prev.map((variant, index) =>
        index === variantIndex
          ? { ...variant, options: variant.options.filter((_, idx) => idx !== optionIndex) }
          : variant,
      ),
    );
  const updateVariantOption = (
    variantIndex: number,
    optionIndex: number,
    field: "name" | "priceModifier",
    value: string,
  ) =>
    setCreateVariants((prev) =>
      prev.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              options: variant.options.map((option, idx) =>
                idx === optionIndex ? { ...option, [field]: value } : option,
              ),
            }
          : variant,
      ),
    );

  const handleToggleAvailability = async (item: MenuItem) => {
    setTogglingItemId(item._id);
    try {
      await requestWithAuth<MenuItem>(`/items/${item._id}/availability`, {
        method: "PATCH",
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      showToast("Availability updated.", "success");
      await loadItems(page, limit);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to update availability.",
        "error",
      );
    } finally {
      setTogglingItemId(null);
    }
  };

  const handleDuplicateItem = async (id: string) => {
    setDuplicatingItemId(id);
    try {
      await requestWithAuth(`/items/${id}/duplicate`, { method: "POST", body: JSON.stringify({}) });
      showToast("Menu item duplicated.", "success");
      await loadItems(page, limit);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to duplicate item.",
        "error",
      );
    } finally {
      setDuplicatingItemId(null);
    }
  };

  const handleDeleteItem = async (id: string) => {
    setDeletingItemId(id);
    try {
      await requestWithAuth(`/items/${id}`, { method: "DELETE", body: JSON.stringify({}) });
      showToast("Menu item deleted.", "success");
      await loadItems(page, limit);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete item.", "error");
    } finally {
      setDeletingItemId(null);
      setDeleteTargetId(null);
    }
  };

  const moveItemByDrag = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    setItems((prev) => {
      const sourceIndex = prev.findIndex((item) => item._id === sourceId);
      const targetIndex = prev.findIndex((item) => item._id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;

      const cloned = [...prev];
      const [moved] = cloned.splice(sourceIndex, 1);
      cloned.splice(targetIndex, 0, moved);
      return cloned.map((item, idx) => ({ ...item, displayOrder: idx }));
    });
  };

  const handleSaveReorder = async () => {
    setIsReordering(true);
    try {
      await requestWithAuth("/items/reorder", {
        method: "PUT",
        body: JSON.stringify({ items: items.map((item) => ({ id: item._id })) }),
      });
      showToast("Item order updated.", "success");
      await loadItems(page, limit);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to reorder items.", "error");
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div className="space-y-6">
      {showCreate && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            Create Menu Item
          </h3>
          <form onSubmit={handleCreateItem} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <Label>Category</Label>
              <select
                value={createForm.categoryId}
                onChange={(e) => setCreateForm((p) => ({ ...p, categoryId: e.target.value }))}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-3">
              <Label>Name</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="lg:col-span-2">
              <Label>Price</Label>
              <Input type="number" value={createForm.price} onChange={(e) => setCreateForm((p) => ({ ...p, price: e.target.value }))} />
            </div>
            <div className="lg:col-span-2">
              <Label>Display Order</Label>
              <Input type="number" value={createForm.displayOrder} onChange={(e) => setCreateForm((p) => ({ ...p, displayOrder: e.target.value }))} />
            </div>
            <div className="flex items-end lg:col-span-2">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={createForm.isAvailable} onChange={(e) => setCreateForm((p) => ({ ...p, isAvailable: e.target.checked }))} />
                <span className="text-sm text-gray-700 dark:text-gray-300">Available</span>
              </label>
            </div>

            <div className="lg:col-span-6">
              <Label>Description</Label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
                rows={3}
              />
            </div>
            <div className="lg:col-span-3">
              <Label>Allergens (comma-separated)</Label>
              <Input value={createForm.allergensCsv} onChange={(e) => setCreateForm((p) => ({ ...p, allergensCsv: e.target.value }))} placeholder="dairy,nuts" />
            </div>

            <div className="lg:col-span-12">
              <div className="mb-2 flex items-center justify-between">
                <Label>Variants</Label>
                <button type="button" onClick={addVariant} className="rounded-lg border border-gray-300 px-3 py-2 text-xs dark:border-gray-600">+ Add Variant</button>
              </div>
              {createVariants.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">Click + Add Variant to add label/options.</p>
              ) : (
                <div className="space-y-3">
                  {createVariants.map((variant, variantIndex) => (
                    <div key={`variant-${variantIndex}`} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex-1">
                          <Label>Label</Label>
                          <Input value={variant.label} onChange={(e) => updateVariantLabel(variantIndex, e.target.value)} placeholder="Size" />
                        </div>
                        <button type="button" onClick={() => removeVariant(variantIndex)} className="mt-6 rounded-lg border border-error-500 px-3 py-2 text-xs text-error-500">Remove Variant</button>
                      </div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Options</p>
                        <button type="button" onClick={() => addVariantOption(variantIndex)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs dark:border-gray-600">+ Add Option</button>
                      </div>
                      {variant.options.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Add at least one option.</p>
                      ) : (
                        <div className="space-y-2">
                          {variant.options.map((option, optionIndex) => (
                            <div key={`variant-${variantIndex}-option-${optionIndex}`} className="grid grid-cols-1 gap-2 lg:grid-cols-12">
                              <div className="lg:col-span-6">
                                <Input value={option.name} onChange={(e) => updateVariantOption(variantIndex, optionIndex, "name", e.target.value)} placeholder="Regular" />
                              </div>
                              <div className="lg:col-span-4">
                                <Input type="number" value={option.priceModifier} onChange={(e) => updateVariantOption(variantIndex, optionIndex, "priceModifier", e.target.value)} placeholder="0" />
                              </div>
                              <div className="lg:col-span-2">
                                <button type="button" onClick={() => removeVariantOption(variantIndex, optionIndex)} className="h-11 w-full rounded-lg border border-error-500 px-3 text-xs text-error-500">Remove</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2"><Label>Calories</Label><Input type="number" value={createForm.calories} onChange={(e) => setCreateForm((p) => ({ ...p, calories: e.target.value }))} /></div>
            <div className="lg:col-span-2"><Label>Protein</Label><Input type="number" value={createForm.protein} onChange={(e) => setCreateForm((p) => ({ ...p, protein: e.target.value }))} /></div>
            <div className="lg:col-span-2"><Label>Carbs</Label><Input type="number" value={createForm.carbs} onChange={(e) => setCreateForm((p) => ({ ...p, carbs: e.target.value }))} /></div>
            <div className="lg:col-span-2"><Label>Fat</Label><Input type="number" value={createForm.fat} onChange={(e) => setCreateForm((p) => ({ ...p, fat: e.target.value }))} /></div>
            <div className="lg:col-span-4">
              <Label>Images (optional, up to 5)</Label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setCreateForm((p) => ({ ...p, imageFiles: Array.from(e.target.files || []).slice(0, 5) }))}
                className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600 dark:text-gray-400"
              />
            </div>
            <div className="flex items-end lg:col-span-6">
              <button type="submit" disabled={isCreating} className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                {isCreating ? "Creating..." : "Create Item"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showManage && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h4 className="mr-auto text-lg font-semibold text-gray-800 dark:text-white/90">Manage Items</h4>
            <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select value={selectedAvailability} onChange={(e) => setSelectedAvailability(e.target.value)} className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700">
              <option value="all">All Availability</option>
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => loadItems(1, limit)}>Apply Filters</Button>
            <Button size="sm" onClick={handleSaveReorder} disabled={isReordering}>{isReordering ? "Saving order..." : "Save Reorder"}</Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading items...</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Price</th>
                    <th className="px-3 py-2 text-left">Available</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item._id}
                      draggable
                      onDragStart={() => setDraggedItemId(item._id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggedItemId) moveItemByDrag(draggedItemId, item._id);
                        setDraggedItemId(null);
                      }}
                      onDragEnd={() => setDraggedItemId(null)}
                      className="cursor-move border-t border-gray-200 dark:border-gray-700"
                    >
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2">{categories.find((c) => c._id === item.categoryId)?.name || "-"}</td>
                      <td className="px-3 py-2">{item.price}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.isAvailable}
                            onClick={() => handleToggleAvailability(item)}
                            disabled={togglingItemId === item._id}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                              item.isAvailable ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
                            } ${togglingItemId === item._id ? "opacity-60" : ""}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                item.isAvailable ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            {togglingItemId === item._id
                              ? "Updating..."
                              : item.isAvailable
                              ? "Available"
                              : "Unavailable"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Link
                            href={`/items/${item._id}`}
                            title="View item"
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            title="Duplicate item"
                            onClick={() => handleDuplicateItem(item._id)}
                            disabled={duplicatingItemId === item._id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <CopyIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete item"
                            onClick={() => setDeleteTargetId(item._id)}
                            disabled={deletingItemId === item._id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-red-400 text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                          >
                            <TrashBinIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">Page {page} of {totalPages} (Total: {total})</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => loadItems(Math.max(1, page - 1), limit)} disabled={page <= 1} className="rounded border px-3 py-2 text-xs">Prev</button>
              <select value={String(limit)} onChange={(e) => loadItems(1, Number(e.target.value))} className="rounded border px-2 py-2 text-xs">
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
              <button type="button" onClick={() => loadItems(Math.min(totalPages, page + 1), limit)} disabled={page >= totalPages} className="rounded border px-3 py-2 text-xs">Next</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Delete item?"
        description="Are you sure you want to delete this item?"
        confirmText="Delete"
        isConfirming={Boolean(deleteTargetId && deletingItemId === deleteTargetId)}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => deleteTargetId && handleDeleteItem(deleteTargetId)}
      />
    </div>
  );
}
