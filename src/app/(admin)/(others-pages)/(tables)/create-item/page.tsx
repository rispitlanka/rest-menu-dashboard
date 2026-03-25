import MenuItemManagementPanel from "@/components/items/MenuItemManagementPanel";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Create Menu Item | Dashboard",
  description: "Create a new menu item for your restaurant",
};

export default function CreateMenuItemPage() {
  return (
    <div>
      <MenuItemManagementPanel mode="create" />
    </div>
  );
}
