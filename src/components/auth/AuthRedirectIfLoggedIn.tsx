"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAccessTokenFromCookie } from "@/lib/auth-storage";

export default function AuthRedirectIfLoggedIn({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = getAccessTokenFromCookie();
    if (token) {
      const redirectTo = searchParams.get("redirect") || "/";
      router.replace(redirectTo);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

