"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function AuthCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const authToken = localStorage.getItem("accessToken");
      const isAuthenticated = !!authToken; // True if token exists

      // Check for preferred language and apply it
      const preferredLanguage = localStorage.getItem("preferredLanguage");
      if (preferredLanguage) {
        document.documentElement.dir = preferredLanguage === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = preferredLanguage;
      }

      // Redirect if necessary
      if (!isAuthenticated && pathname !== "/login") {
        router.replace("/login"); // `replace` prevents extra history
      } else if (isAuthenticated && pathname === "/login") {
        router.replace("/dashboard");
      }

      setIsLoading(false);
    };

    // Small delay to allow tokens to be set before checking
    const timer = setTimeout(() => {
      checkAuth();
    }, 100);

    return () => clearTimeout(timer);
  }, [router, pathname]);

  if (isLoading) {
    return null;
  }

  return <>{children}</>;
}
