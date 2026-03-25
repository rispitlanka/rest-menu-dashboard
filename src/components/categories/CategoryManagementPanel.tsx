"use client";

import { FormEvent, useEffect, useState } from "react";
import { CopyIcon, PencilIcon, TrashBinIcon } from "@/icons";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
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

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };
type Category = {
  _id: string;
  restaurantId?: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

export default function CategoryManagementPanel() {
  const router = useRouter();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryActive, setNewCategoryActive] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

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

    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & T;
    if (!response.ok) throw new Error(body?.message || "Request failed.");
    return (body?.data ?? body) as T;
  };

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const data = await requestWithAuth<Category[]>("/categories", { method: "GET" });
      setCategories([...data].sort((a, b) => a.displayOrder - b.displayOrder));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load categories.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newCategoryName.trim()) return;
    setIsCreating(true);
    try {
      await requestWithAuth<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({
          name: newCategoryName.trim(),
          isActive: newCategoryActive,
        }),
      });
      setNewCategoryName("");
      setNewCategoryActive(true);
      showToast("Category created successfully.", "success");
      await loadCategories();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to create category.",
        "error",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const moveCategoryByDrag = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setCategories((prev) => {
      const sourceIndex = prev.findIndex((c) => c._id === sourceId);
      const targetIndex = prev.findIndex((c) => c._id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const cloned = [...prev];
      const [moved] = cloned.splice(sourceIndex, 1);
      cloned.splice(targetIndex, 0, moved);
      return cloned.map((item, idx) => ({ ...item, displayOrder: idx }));
    });
  };

  const updateCategoryLocally = (
    id: string,
    field: "name" | "isActive",
    value: string | boolean,
  ) => {
    setCategories((prev) =>
      prev.map((category) =>
        category._id === id ? { ...category, [field]: value } : category,
      ),
    );
  };

  const handleUpdateCategory = async (category: Category) => {
    setSavingCategoryId(category._id);
    try {
      await requestWithAuth<Category>(`/categories/${category._id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: category.name,
          isActive: category.isActive,
        }),
      });
      showToast("Category updated successfully.", "success");
      await loadCategories();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to update category.",
        "error",
      );
    } finally {
      setSavingCategoryId(null);
    }
  };

  const handleToggleCategoryActive = async (category: Category) => {
    const nextIsActive = !category.isActive;
    setSavingCategoryId(category._id);
    updateCategoryLocally(category._id, "isActive", nextIsActive);
    try {
      await requestWithAuth<Category>(`/categories/${category._id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: category.name,
          isActive: nextIsActive,
        }),
      });
      showToast("Category status updated.", "success");
      await loadCategories();
    } catch (error) {
      updateCategoryLocally(category._id, "isActive", category.isActive);
      showToast(
        error instanceof Error ? error.message : "Failed to update category status.",
        "error",
      );
    } finally {
      setSavingCategoryId(null);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setDeletingCategoryId(id);
    try {
      await requestWithAuth(`/categories/${id}`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      showToast("Category deleted successfully.", "success");
      await loadCategories();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to delete category.",
        "error",
      );
    } finally {
      setDeletingCategoryId(null);
      setDeleteTarget(null);
    }
  };

  const handleSaveReorder = async () => {
    setIsReordering(true);
    try {
      await requestWithAuth("/categories/reorder", {
        method: "PUT",
        body: JSON.stringify({
          items: categories.map((category) => ({ id: category._id })),
        }),
      });
      showToast("Category order updated successfully.", "success");
      await loadCategories();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to reorder categories.",
        "error",
      );
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          Category Management
        </h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Label>Category Name</Label>
            <Input
              type="text"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="e.g. Starters"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={newCategoryActive}
                onChange={(event) => setNewCategoryActive(event.target.checked)}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
            </label>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isCreating || !newCategoryName.trim()}
              className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create Category"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Categories
          </h4>
          <Button size="sm" onClick={handleSaveReorder} disabled={isReordering}>
            {isReordering ? "Saving order..." : "Save Reorder"}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No categories found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr
                    key={category._id}
                    draggable
                    onDragStart={() => setDraggedCategoryId(category._id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedCategoryId) {
                        moveCategoryByDrag(draggedCategoryId, category._id);
                      }
                      setDraggedCategoryId(null);
                    }}
                    onDragEnd={() => setDraggedCategoryId(null)}
                    className="cursor-move border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={category.name}
                        onChange={(event) =>
                          updateCategoryLocally(category._id, "name", event.target.value)
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={category.isActive}
                        onClick={() => handleToggleCategoryActive(category)}
                        disabled={savingCategoryId === category._id}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          category.isActive
                            ? "bg-brand-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        } ${savingCategoryId === category._id ? "opacity-60" : ""}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            category.isActive ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title="Update category"
                          onClick={() => handleUpdateCategory(category)}
                          disabled={savingCategoryId === category._id}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Duplicate category"
                          onClick={() => {
                            setNewCategoryName(`${category.name} Copy`);
                            setNewCategoryActive(category.isActive);
                            showToast(
                              "Category copied to create form. Click Create Category.",
                              "info",
                            );
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <CopyIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete category"
                          onClick={() => setDeleteTarget(category)}
                          disabled={deletingCategoryId === category._id}
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
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete category?"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"?`
            : "Are you sure you want to delete this category?"
        }
        confirmText="Delete"
        isConfirming={Boolean(deleteTarget && deletingCategoryId === deleteTarget._id)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteCategory(deleteTarget._id)}
      />
    </div>
  );
}
