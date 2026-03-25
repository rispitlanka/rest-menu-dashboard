import ReviewModerationPanel from "@/components/reviews/ReviewModerationPanel";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Review Moderation | Dashboard",
  description: "Moderate reviews for your restaurant",
};

export default function Alerts() {
  return <ReviewModerationPanel />;
}
