import CategoryManagementPanel from "@/components/categories/CategoryManagementPanel";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Category Management | Dashboard",
  description: "Manage categories for your restaurant",
};

export default function FormElements() {
  return (
    <div>
      <CategoryManagementPanel />
    </div>
  );
}
