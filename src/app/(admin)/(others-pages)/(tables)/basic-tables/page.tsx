import MenuItemManagementPanel from "@/components/items/MenuItemManagementPanel";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Menu Item Management | Dashboard",
  description: "Manage menu items for your restaurant",
};

export default function BasicTables() {
  return (
    <div>
      <MenuItemManagementPanel mode="manage" />
    </div>
  );
}
