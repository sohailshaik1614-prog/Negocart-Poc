"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RulesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/products");
  }, [router]);

  return (
    <div className="p-8 text-center text-sm text-slate-500">
      Redirecting to Products & Pricing Rules Console...
    </div>
  );
}
