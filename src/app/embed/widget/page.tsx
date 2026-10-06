"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CustomerNegotiationWidget from "@/components/widget/CustomerNegotiationWidget";
import { Bot } from "lucide-react";

function EmbeddedWidgetContainer() {
  const searchParams = useSearchParams();
  const storeKey = searchParams.get("storeKey") || "pub_live_apex_9a8b7c6d5e4f3a2b1c";
  const productId = searchParams.get("productId") || "e0000000-0000-0000-0000-000000000001";

  const handleClose = () => {
    if (typeof window !== "undefined" && window.parent) {
      window.parent.postMessage({ type: "NEGOZAAR_CLOSE" }, "*");
    }
  };

  const handleDealAccepted = (deal: { discountCode: string; agreedPrice: number; checkoutUrl?: string }) => {
    if (typeof window !== "undefined" && window.parent) {
      window.parent.postMessage(
        {
          type: "NEGOZAAR_DEAL_ACCEPTED",
          discountCode: deal.discountCode,
          agreedPrice: deal.agreedPrice,
          checkoutUrl: deal.checkoutUrl,
        },
        "*"
      );
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50">
      <CustomerNegotiationWidget
        storeKey={storeKey}
        productId={productId}
        onClose={handleClose}
        onDealAccepted={handleDealAccepted}
        isModal={false}
      />
    </div>
  );
}

export default function EmbeddedWidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-600 p-6 text-center select-none">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="font-semibold text-xs text-slate-700">Connecting to NegoZaar AI...</p>
        </div>
      }
    >
      <EmbeddedWidgetContainer />
    </Suspense>
  );
}
