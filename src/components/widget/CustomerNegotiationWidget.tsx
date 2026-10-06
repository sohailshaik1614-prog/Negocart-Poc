"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  ChevronRight,
  TrendingDown,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { PublicNegotiationSessionView } from "@/core/types/negotiation.types";

export interface CustomerNegotiationWidgetProps {
  storeKey: string;
  productId: string;
  onClose?: () => void;
  onDealAccepted?: (deal: { discountCode: string; agreedPrice: number; checkoutUrl?: string }) => void;
  isModal?: boolean;
}

export default function CustomerNegotiationWidget({
  storeKey,
  productId,
  onClose,
  onDealAccepted,
  isModal = true,
}: CustomerNegotiationWidgetProps) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionView, setSessionView] = useState<PublicNegotiationSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Offer input state
  const [offerInput, setOfferInput] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Claim & Final Offer state
  const [dealClaim, setDealClaim] = useState<{
    discountCode: string;
    agreedPrice: number;
    checkoutUrl?: string;
  } | null>(null);
  const [copiedCoupon, setCopiedCoupon] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessionView?.messages, submitting]);

  // 1. Session Initialization
  useEffect(() => {
    async function initSession() {
      try {
        setLoading(true);
        setErrorMessage(null);

        // Check if there is an active session in sessionStorage for this product
        const storageKey = `negozaar_session_${storeKey}_${productId}`;
        const cachedToken = typeof window !== "undefined" ? sessionStorage.getItem(storageKey) : null;

        const res = await fetch("/api/v1/widget/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicStoreKey: storeKey,
            productId: productId,
            deviceFingerprint: "client_" + Math.random().toString(36).substring(2, 9),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to connect to NegoZaar AI");
        }

        setSessionToken(data.sessionToken);
        setSessionView(data.view);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(storageKey, data.sessionToken);
        }
      } catch (err) {
        console.error("Widget session init error:", err);
        setErrorMessage(err instanceof Error ? err.message : "Error connecting to AI negotiator");
      } finally {
        setLoading(false);
      }
    }

    if (storeKey && productId) {
      initSession();
    }
  }, [storeKey, productId]);

  // 2. Format Currency
  const formatPrice = (val: number, cur?: string) => {
    const currency = cur || sessionView?.currency || "INR";
    const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
    return `${symbol}${val.toLocaleString()}`;
  };

  // 3. Customer Offer Submission
  const handleSendOffer = async (e?: React.FormEvent, directAmount?: number) => {
    if (e) e.preventDefault();
    if (!sessionToken || submitting) return;

    const amountToSend = directAmount !== undefined ? directAmount : parseFloat(offerInput.replace(/[^\d.]/g, ""));

    if (isNaN(amountToSend) || amountToSend <= 0) {
      setErrorMessage("Please enter a valid positive offer amount.");
      return;
    }

    if (sessionView && amountToSend > sessionView.originalPrice) {
      setErrorMessage(
        `Your offer (${formatPrice(amountToSend)}) cannot exceed the retail listed price of ${formatPrice(
          sessionView.originalPrice
        )}.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const messagePayload = customMessage.trim() || undefined;

      const res = await fetch("/api/v1/widget/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          proposedAmount: amountToSend,
          message: messagePayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Offer submission failed");
      }

      setSessionView(data.view);
      setOfferInput("");
      setCustomMessage("");
      setShowNoteInput(false);

      // If deal was instantly closed on auto-accept or matching
      if (data.dealClosed) {
        await handleClaimDeal();
      }
    } catch (err) {
      console.error("Offer error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to process offer");
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Accept Current Offer
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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to finalize negotiated deal");
      }

      const claimResult = {
        discountCode: data.discountCode,
        agreedPrice: data.agreedPrice,
        checkoutUrl: data.checkoutUrl,
      };

      setDealClaim(claimResult);

      if (onDealAccepted) {
        onDealAccepted(claimResult);
      }

      // Notify parent store window via postMessage if running in iframe
      if (typeof window !== "undefined" && window.parent) {
        window.parent.postMessage(
          {
            type: "NEGOZAAR_DEAL_ACCEPTED",
            discountCode: data.discountCode,
            agreedPrice: data.agreedPrice,
            checkoutUrl: data.checkoutUrl,
          },
          "*"
        );
      }
    } catch (err) {
      console.error("Claim error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to claim deal");
    } finally {
      setClaiming(false);
    }
  };

  // 5. Reject / Leave Negotiation
  const handleDeclineOrLeave = async () => {
    if (!sessionToken || terminating) return;

    const confirmLeave = window.confirm(
      "Are you sure you want to exit the negotiation? You will forfeit this discounted counteroffer."
    );
    if (!confirmLeave) return;

    try {
      setTerminating(true);
      setErrorMessage(null);

      const res = await fetch("/api/v1/widget/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          reason: "Customer declined final offer",
        }),
      });

      const data = await res.json();
      if (data.view) {
        setSessionView(data.view);
      }

      if (typeof window !== "undefined" && window.parent) {
        window.parent.postMessage({ type: "NEGOZAAR_CLOSE" }, "*");
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error("Decline error:", err);
      if (onClose) onClose();
    } finally {
      setTerminating(false);
    }
  };

  // 6. Copy Coupon Code
  const copyCouponCode = () => {
    if (!dealClaim?.discountCode) return;
    navigator.clipboard.writeText(dealClaim.discountCode);
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };

  // Quick Offer Pill Helper
  const getQuickPills = () => {
    if (!sessionView) return [];
    const orig = sessionView.originalPrice;
    return [
      { label: "-10%", price: Math.round(orig * 0.9) },
      { label: "-15%", price: Math.round(orig * 0.85) },
      { label: "-20%", price: Math.round(orig * 0.8) },
    ];
  };

  const isFinalAttempt = sessionView
    ? sessionView.currentRound >= sessionView.maxRounds || sessionView.status === "FINAL_OFFER"
    : false;

  const isSessionClosed = sessionView
    ? ["ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"].includes(sessionView.status)
    : false;

  // Render Loading Skeleton State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[480px] bg-slate-50 text-slate-600 p-8 text-center select-none">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mb-4 animate-pulse">
          <Bot className="w-6 h-6 animate-bounce" />
        </div>
        <h3 className="font-bold text-slate-900 text-sm">Connecting to NegoZaar AI</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Checking live product pricing and initializing your private sales session...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-800 antialiased select-none overflow-hidden relative">
      {/* 1. Header */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-sm shrink-0 z-10">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-sm shadow-sm">
            N
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="font-semibold text-xs text-white leading-tight">NegoZaar AI Sales Assistant</h1>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[190px]">
              {sessionView?.product.title || "Live Negotiation"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Attempt Counter Badge */}
          {sessionView && !isSessionClosed && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-tight border ${
                isFinalAttempt
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse"
                  : "bg-slate-800 text-emerald-400 border-slate-700"
              }`}
            >
              {isFinalAttempt
                ? "Final Round ⚠️"
                : `Round ${sessionView.currentRound || 1}/${sessionView.maxRounds}`}
            </span>
          )}

          {/* Close Button */}
          {onClose && (
            <button
              onClick={handleDeclineOrLeave}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close negotiation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Product Summary Strip (Floor price is never shown here!) */}
      <div className="bg-emerald-50/70 border-b border-emerald-100/90 px-4 py-2 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Listed Price:</span>
          <span className="font-bold text-slate-900 text-sm">
            {formatPrice(sessionView?.originalPrice ?? 0)}
          </span>
        </div>

        {sessionView?.currentOffer && sessionView.currentRound > 0 && !dealClaim && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded font-medium">
            <TrendingDown className="w-3 h-3 text-emerald-600" />
            <span>Latest: {formatPrice(sessionView.currentOffer)}</span>
          </div>
        )}
      </div>

      {/* 3. Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scroll-smooth">
        {sessionView?.messages.map((msg) => {
          const isAI = msg.senderRole === "AI_AGENT";
          const isSystem = msg.senderRole === "SYSTEM";

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="text-[11px] bg-slate-200/70 text-slate-600 px-3 py-1 rounded-full text-center max-w-[90%]">
                  {msg.messageText}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isAI ? "justify-start" : "justify-end"}`}
            >
              {isAI && (
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                  isAI
                    ? "bg-white border border-slate-200 text-slate-800 rounded-tl-xs"
                    : "bg-emerald-600 text-white rounded-tr-xs"
                }`}
              >
                <p className="whitespace-pre-line">{msg.messageText}</p>
                <div
                  className={`text-[9px] mt-1 text-right font-mono ${
                    isAI ? "text-slate-400" : "text-emerald-100"
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}

        {/* AI Typing Indicator */}
        {submitting && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-xs">
              <div className="flex items-center space-x-1.5 py-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-150" />
                <span className="text-[11px] text-slate-400 font-medium pl-1">Evaluating offer...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Error Alert Banner */}
      {errorMessage && (
        <div className="mx-4 mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. ACTION PANEL / FOOTER */}
      {dealClaim ? (
        /* STATE A: DEAL ACCEPTED & CLAIM COUPON UNLOCKED */
        <div className="p-4 bg-gradient-to-b from-emerald-50 to-white border-t border-emerald-200 shrink-0 space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Deal Sealed at {formatPrice(dealClaim.agreedPrice)}!</span>
          </div>

          <p className="text-xs text-slate-600">
            Your single-use discount coupon has been created. Copy it below to checkout with your negotiated price:
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border-2 border-dashed border-emerald-400 rounded-lg px-3 py-2 font-mono font-bold text-base text-center text-slate-900 tracking-wider">
              {dealClaim.discountCode}
            </div>
            <button
              onClick={copyCouponCode}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              {copiedCoupon ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Code
                </>
              )}
            </button>
          </div>

          <div className="pt-1 flex gap-2">
            <a
              href={dealClaim.checkoutUrl || "#"}
              target="_top"
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg text-center shadow-sm flex items-center justify-center gap-1.5 transition"
            >
              <span>Apply to Checkout</span>
              <ChevronRight className="w-4 h-4" />
            </a>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition"
              >
                Close
              </button>
            )}
          </div>
        </div>
      ) : sessionView?.status === "REJECTED" || sessionView?.status === "TERMINATED" ? (
        /* STATE B: NEGOTIATION ENDED / REJECTED */
        <div className="p-4 bg-slate-100 border-t border-slate-200 shrink-0 text-center space-y-2">
          <p className="text-xs font-semibold text-slate-700">Negotiation concluded.</p>
          <p className="text-[11px] text-slate-500">
            The listed retail price of {formatPrice(sessionView.originalPrice)} remains available on the store.
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-1 px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition"
            >
              Return to Store
            </button>
          )}
        </div>
      ) : isFinalAttempt ? (
        /* STATE C: FINAL OFFER STATE (Take it or leave it) */
        <div className="p-4 bg-amber-50/60 border-t border-amber-200 shrink-0 space-y-3">
          <div className="p-2.5 rounded-lg bg-amber-100/70 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>⚠️ Final Offer:</span>
              <strong className="text-sm font-bold text-amber-950">
                {formatPrice(sessionView?.currentOffer ?? sessionView?.originalPrice ?? 0)}
              </strong>
            </span>
            <span className="text-[10px] uppercase tracking-wider bg-amber-200/80 px-2 py-0.5 rounded text-amber-900 font-bold">
              Non-Negotiable
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClaimDeal}
              disabled={claiming}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition"
            >
              {claiming ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generating Coupon...
                </>
              ) : (
                <>
                  <span>Accept Final Offer ({formatPrice(sessionView?.currentOffer ?? 0)})</span>
                  <Check className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <button
              onClick={handleDeclineOrLeave}
              disabled={terminating}
              className="py-2.5 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition"
            >
              Decline & Leave
            </button>
          </div>
        </div>
      ) : sessionView && sessionView.currentRound > 0 && sessionView.currentOffer ? (
        /* STATE D: ACTIVE COUNTEROFFER (Can accept or counter) */
        <div className="p-3.5 bg-white border-t border-slate-200 shrink-0 space-y-2.5 shadow-lg">
          {/* Counteroffer decision strip */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600">AI Counter:</span>
              <span className="font-bold text-slate-900 text-sm">
                {formatPrice(sessionView.currentOffer)}
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded">
                -
                {Math.round(
                  ((sessionView.originalPrice - sessionView.currentOffer) / sessionView.originalPrice) * 100
                )}
                %
              </span>
            </div>

            <button
              onClick={handleClaimDeal}
              disabled={claiming}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-bold transition flex items-center gap-1"
            >
              {claiming ? "Locking in..." : "Accept This Price"}
            </button>
          </div>

          {/* Customer Counter-Proposal Form */}
          <form onSubmit={(e) => handleSendOffer(e)} className="space-y-2">
            {/* Quick Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              <span className="text-slate-400 text-[10px] font-semibold shrink-0">Quick offer:</span>
              {getQuickPills().map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => setOfferInput(String(pill.price))}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-600 transition shrink-0 font-medium"
                >
                  {formatPrice(pill.price)} ({pill.label})
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">
                  {sessionView.currency === "INR" ? "₹" : sessionView.currency}
                </span>
                <input
                  type="number"
                  placeholder="Enter counter offer..."
                  value={offerInput}
                  onChange={(e) => setOfferInput(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !offerInput}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <span>Propose</span>
                <Send className="w-3 h-3" />
              </button>
            </div>

            {/* Optional note toggle */}
            {!showNoteInput ? (
              <button
                type="button"
                onClick={() => setShowNoteInput(true)}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-medium"
              >
                + Add a sales argument note
              </button>
            ) : (
              <input
                type="text"
                placeholder="e.g. Can you do ₹1,600? I'll buy right now."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            )}
          </form>
        </div>
      ) : (
        /* STATE E: FIRST ROUND (INITIAL PROPOSAL) */
        <div className="p-3.5 bg-white border-t border-slate-200 shrink-0 space-y-2.5 shadow-lg">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <span className="text-slate-400 text-[10px] font-semibold shrink-0">Quick offer:</span>
            {getQuickPills().map((pill) => (
              <button
                key={pill.label}
                type="button"
                onClick={() => setOfferInput(String(pill.price))}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-600 transition shrink-0 font-medium"
              >
                {formatPrice(pill.price)} ({pill.label})
              </button>
            ))}
          </div>

          <form onSubmit={(e) => handleSendOffer(e)} className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">
                  {sessionView?.currency === "INR" ? "₹" : sessionView?.currency || "₹"}
                </span>
                <input
                  type="number"
                  placeholder="What is your offer?"
                  value={offerInput}
                  onChange={(e) => setOfferInput(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !offerInput}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <span>Propose</span>
                <Send className="w-3 h-3" />
              </button>
            </div>

            {/* Note toggle */}
            {!showNoteInput ? (
              <button
                type="button"
                onClick={() => setShowNoteInput(true)}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-medium"
              >
                + Add message (e.g. Can you do ₹1,500?)
              </button>
            ) : (
              <input
                type="text"
                placeholder="e.g. Can you do ₹1,500?"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            )}
          </form>
        </div>
      )}
    </div>
  );
}
