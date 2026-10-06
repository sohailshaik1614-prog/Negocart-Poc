"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StoresRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/integrations");
  }, [router]);

  return (
    <div className="p-8 text-center text-sm text-slate-500">
      Redirecting to Storefront Integrations Console...
    </div>
  );
}
