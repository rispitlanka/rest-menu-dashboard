import { Metadata } from "next";
import MenuItemDetailPanel from "@/components/items/MenuItemDetailPanel";

export const metadata: Metadata = {
  title: "View Menu Item | Dashboard",
  description: "View and update a menu item",
};

export default async function MenuItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <MenuItemDetailPanel itemId={id} />
    </div>
  );
}
