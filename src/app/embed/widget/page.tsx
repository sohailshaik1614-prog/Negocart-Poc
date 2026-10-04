"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSender, PublicNegotiationSessionView } from "@/core/types/negotiation.types";
import { Bot, CheckCircle2, ChevronRight, CornerDownLeft, Sparkles, AlertCircle } from "lucide-react";

function EmbeddedWidgetContent() {
  const searchParams = useSearchParams();
  const storeKey = searchParams.get("storeKey") || "pub_live_apex_9a8b7c6d5e4f3a2b1c";
  const productId = searchParams.get("productId") || "e0000000-0000-0000-0000-000000000001";

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionView, setSessionView] = useState<PublicNegotiationSessionView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [offerInput, setOfferInput] = useState<string>("");
  const [messageInput, setMessageInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dealClaim, setDealClaim] = useState<{
    discountCode: string;
    agreedPrice: number;
    checkoutUrl?: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessionView?.messages]);

  // Initialize session on mount
  useEffect(() => {
    async function initSession() {
      try {
        setLoading(true);
        setErrorMessage(null);

        const res = await fetch("/api/v1/widget/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicStoreKey: storeKey,
            productId: productId,
            deviceFingerprint: "browser_" + Math.random().toString(36).substring(2, 9),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to initialize negotiation session");
        }

        const data = await res.json();
        setSessionToken(data.sessionToken);
        setSessionView(data.view);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Error starting session");
      } finally {
        setLoading(false);
      }
    }

    if (storeKey && productId) {
      initSession();
    }
  }, [storeKey, productId]);

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !offerInput || submitting) return;

    const numericOffer = parseFloat(offerInput.replace(/[^\d.]/g, ""));
    if (isNaN(numericOffer) || numericOffer <= 0) {
      setErrorMessage("Please enter a valid offer amount");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const res = await fetch("/api/v1/widget/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          proposedAmount: numericOffer,
          message: messageInput.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Offer submission failed");
      }

      const data = await res.json();
      setSessionView(data.view);
      setOfferInput("");
      setMessageInput("");

      if (data.dealClosed) {
        // Automatically claim or prompt claim
        await handleClaimDeal();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit offer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimDeal = async () => {
    if (!sessionToken || claiming) return;

    try {
      setClaiming(true);
      setErrorMessage(null);

      const res = await fetch("/api/v1/widget/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to finalize deal");
      }

      const data = await res.json();
      setDealClaim({
        discountCode: data.discountCode,
        agreedPrice: data.agreedPrice,
        checkoutUrl: data.checkoutUrl,
      });

      // Notify parent store window via postMessage
      if (window.parent) {
        window.parent.postMessage(
          {
            type: "NEGOZAAR_DEAL_ACCEPTED",
            discountCode: data.discountCode,
            checkoutUrl: data.checkoutUrl,
          },
          "*"
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to claim deal");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-600 p-6 text-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-medium text-sm">Connecting to NegoZaar AI Sales Assistant...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 antialiased select-none">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="font-semibold text-sm text-slate-900 leading-tight">NegoZaar AI</h1>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate max-w-[200px]">
              {sessionView?.product.title || "Live Negotiation"}
            </p>
          </div>
        </div>

        {/* Round Badge */}
        {sessionView && (
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Round {sessionView.currentRound}/{sessionView.maxRounds}
            </span>
          </div>
        )}
      </header>

      {/* Product Summary Bar */}
      <div className="bg-emerald-50/60 border-b border-emerald-100/80 px-4 py-2 flex items-center justify-between text-xs">
        <span className="text-slate-600">Listed Price:</span>
        <span className="font-semibold text-slate-900 text-sm">
          {sessionView?.currency} {sessionView?.originalPrice.toLocaleString()}
        </span>
      </div>

      {/* Chat Messages Transcript */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {sessionView?.messages.map((msg) => {
          const isAI = msg.senderRole === "AI_AGENT";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isAI ? "justify-start" : "justify-end"}`}
            >
              {isAI && (
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  isAI
                    ? "bg-white border border-slate-200/80 text-slate-800 rounded-tl-sm"
                    : "bg-emerald-600 text-white rounded-tr-sm"
                }`}
              >
                <p>{msg.messageText}</p>
              </div>
            </div>
          );
        })}

        {submitting && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>NegoZaar is evaluating your offer...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mx-4 mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Deal Claim Banner (When deal is agreed or accepted) */}
      {dealClaim ? (
        <div className="p-4 bg-emerald-50 border-t border-emerald-200 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Deal Sealed at {sessionView?.currency} {dealClaim.agreedPrice.toLocaleString()}!</span>
          </div>
          <p className="text-xs text-emerald-700 mb-3">
            Your unique coupon code has been generated. Use it at checkout:
          </p>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 bg-white border border-emerald-300 rounded px-3 py-1.5 font-mono font-bold text-center text-sm text-slate-800 tracking-wider">
              {dealClaim.discountCode}
            </div>
          </div>
          <a
            href={dealClaim.checkoutUrl || "#"}
            target="_top"
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow transition"
          >
            Apply & Proceed to Checkout <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      ) : sessionView?.status === "ACCEPTED" || sessionView?.status === "COUNTERED" && sessionView.currentRound > 0 ? (
        <div className="p-3 bg-white border-t border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Ready to accept current offer?</span>
            <button
              onClick={handleClaimDeal}
              disabled={claiming}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              {claiming ? "Generating code..." : "Lock in & Claim Deal"} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Offer Input Form */}
          {sessionView.currentRound < sessionView.maxRounds && (
            <form onSubmit={handleSendOffer} className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-medium">
                    {sessionView.currency}
                  </span>
                  <input
                    type="number"
                    placeholder="Enter counter offer..."
                    value={offerInput}
                    onChange={(e) => setOfferInput(e.target.value)}
                    disabled={submitting}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !offerInput}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition shadow-sm"
                >
                  <span>Offer</span>
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* First Round Offer Input */
        <div className="p-3 bg-white border-t border-slate-200 flex-shrink-0">
          <form onSubmit={handleSendOffer} className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-medium">
                  {sessionView?.currency}
                </span>
                <input
                  type="number"
                  placeholder="What is your offer?"
                  value={offerInput}
                  onChange={(e) => setOfferInput(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !offerInput}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition shadow-sm"
              >
                <span>Propose</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function EmbeddedWidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-600 p-6 text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-medium text-sm">Loading NegoZaar...</p>
        </div>
      }
    >
      <EmbeddedWidgetContent />
    </Suspense>
  );
}
