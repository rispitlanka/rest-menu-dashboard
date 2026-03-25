import type { Metadata } from "next";
import DashboardAnalyticsPanel from "@/components/analytics/DashboardAnalyticsPanel";
import React from "react";

export const metadata: Metadata = {
  title:
    "QRDine Admin Dashboard",
  description: "This is QRDine Admin Dashboard",
};

export default function Ecommerce() {
  return <DashboardAnalyticsPanel />;
}
