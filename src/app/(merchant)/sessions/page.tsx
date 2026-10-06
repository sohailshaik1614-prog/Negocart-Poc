"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SessionsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/negotiations");
  }, [router]);

  return (
    <div className="p-8 text-center text-sm text-slate-500">
      Redirecting to Negotiations & Conversations Console...
    </div>
  );
}
