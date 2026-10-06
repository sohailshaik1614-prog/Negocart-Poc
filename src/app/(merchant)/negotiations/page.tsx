"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  History,
  Search,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  MessageSquare,
  Bot,
  User,
  X,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Tag,
  DollarSign,
} from "lucide-react";
import { NegotiationSession, NegotiationMessage, NegotiationOffer } from "@/core/types/negotiation.types";
import { Product } from "@/core/types/product.types";
import { ProductNegotiationSettings } from "@/core/types/rule.types";

interface EnrichedSession extends NegotiationSession {
  productTitle?: string;
  productSku?: string;
  productImage?: string;
}

export default function MerchantNegotiationsPage() {
  const [sessions, setSessions] = useState<EnrichedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected session inspection drawer state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [inspectingSession, setInspectingSession] = useState<{
    session: NegotiationSession;
    product: Product | null;
    rule: ProductNegotiationSettings | null;
    messages: NegotiationMessage[];
    offers: NegotiationOffer[];
    transaction: any;
  } | null>(null);
  const [loadingInspection, setLoadingInspection] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/merchant/sessions");
      if (res.ok) {
        const json = await res.json();
        setSessions(json.data?.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const openInspection = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    try {
      setLoadingInspection(true);
      const res = await fetch(`/api/v1/merchant/sessions?sessionId=${sessionId}`);
      if (res.ok) {
        const json = await res.json();
        setInspectingSession(json.data);
      }
    } catch (err) {
      console.error("Failed to inspect session:", err);
    } finally {
      setLoadingInspection(false);
    }
  };

  const closeInspection = () => {
    setSelectedSessionId(null);
    setInspectingSession(null);
  };

  const copyDiscountCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.productTitle && s.productTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.productSku && s.productSku.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" ||
      s.status === statusFilter ||
      (statusFilter === "CLOSED" && ["ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"].includes(s.status));

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Negotiations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time audit log of customer negotiation sessions, offer trajectories, and complete conversation transcripts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/widget-sandbox"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Simulate Negotiation
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by session ID or product title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: "ALL", label: "All Sessions" },
            { id: "ACCEPTED", label: "Accepted Deals" },
            { id: "COUNTERED", label: "Countered" },
            { id: "ACTIVE", label: "Active" },
            { id: "REJECTED", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading customer negotiations...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">No Negotiation Sessions Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Once customers interact with NegoZaar on your store or in the Sandbox, their complete multi-round conversations will appear here.
              </p>
            </div>
            <Link
              href="/widget-sandbox"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Test First Negotiation in Sandbox
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Session / Customer</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Original Price</th>
                  <th className="py-3 px-4">Negotiated Price</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSessions.map((s) => {
                  const isAccepted = s.status === "ACCEPTED";
                  const formattedTime = new Date(s.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={s.id}
                      onClick={() => openInspection(s.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition"
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-900 font-semibold">
                          #{s.id.slice(0, 8)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Cust: {s.customerId ? s.customerId.slice(0, 8) : "Anonymous"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 max-w-[200px] truncate">
                          {s.productTitle || "Product"}
                        </div>
                        {s.productSku && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            SKU: {s.productSku}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {s.currency} {s.originalPrice.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {s.finalAgreedPrice ? (
                          <span className="font-bold text-emerald-600">
                            {s.currency} {s.finalAgreedPrice.toLocaleString()}
                          </span>
                        ) : s.currentOffer ? (
                          <span className="text-slate-700">
                            {s.currency} {s.currentOffer.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700">
                          {s.currentRound} / {s.maxRounds}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            s.status === "ACCEPTED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : s.status === "COUNTERED"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : s.status === "FINAL_OFFER"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : s.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formattedTime}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openInspection(s.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Inspection Drawer / Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-end p-0 sm:p-4 overflow-hidden">
          <div className="bg-white w-full max-w-2xl h-full sm:h-[95vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    Session #{selectedSessionId.slice(0, 8)}
                  </span>
                  {inspectingSession?.session && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        inspectingSession.session.status === "ACCEPTED"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-slate-200 text-slate-700 border-slate-300"
                      }`}
                    >
                      {inspectingSession.session.status}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {inspectingSession?.product?.title || "Negotiation Inspection"}
                </h3>
              </div>

              <button
                onClick={closeInspection}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingInspection ? (
              <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-400">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2" />
                Loading conversation transcript...
              </div>
            ) : inspectingSession ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Product & Guardrail Summary Card */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Listed Price</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {inspectingSession.session.currency}{" "}
                      {inspectingSession.session.originalPrice.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Secret Floor</span>
                    <span className="font-bold text-rose-600 text-sm">
                      {inspectingSession.session.currency}{" "}
                      {(inspectingSession.rule?.minAcceptablePrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Agreed Price</span>
                    <span className="font-bold text-emerald-600 text-sm">
                      {inspectingSession.session.finalAgreedPrice
                        ? `${inspectingSession.session.currency} ${inspectingSession.session.finalAgreedPrice.toLocaleString()}`
                        : "No deal"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Rounds Used</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {inspectingSession.session.currentRound} of {inspectingSession.session.maxRounds}
                    </span>
                  </div>
                </div>

                {/* Deal Coupon Banner (If Closed) */}
                {inspectingSession.transaction && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                        Closed Deal Claimed
                      </span>
                      <div className="font-mono text-sm font-bold text-emerald-950 mt-0.5">
                        Code: {inspectingSession.transaction.discountCode}
                      </div>
                    </div>
                    <button
                      onClick={() => copyDiscountCode(inspectingSession.transaction.discountCode)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode ? "Copied" : "Copy Code"}
                    </button>
                  </div>
                )}

                {/* Full Conversation Transcript */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <span>Conversation Transcript</span>
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Zero-Leak Protected
                    </span>
                  </div>

                  <div className="space-y-3 border-l-2 border-slate-200 pl-4 py-1">
                    {inspectingSession.messages.map((m, idx) => {
                      const isAI = m.senderRole === "AI_AGENT";
                      return (
                        <div key={m.id || idx} className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            {isAI ? (
                              <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                                <Bot className="w-3.5 h-3.5" />
                                <span>NegoZaar AI (Round {m.roundNumber})</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-slate-700 font-semibold">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span>Customer Proposal</span>
                              </div>
                            )}
                            <span className="text-[10px] text-slate-400">
                              {new Date(m.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          <div
                            className={`p-3 rounded-xl text-xs leading-relaxed ${
                              isAI
                                ? "bg-emerald-50/60 border border-emerald-100 text-slate-800"
                                : "bg-white border border-slate-200 text-slate-800"
                            }`}
                          >
                            <p>{m.messageText}</p>

                            {/* Internal AI Reasoning tag for merchant transparency */}
                            {isAI && m.rawAiReasoning && (
                              <div className="mt-2 pt-2 border-t border-emerald-100/80 text-[11px] text-emerald-800/80 italic font-sans flex items-start gap-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <span>Engine Note: {m.rawAiReasoning}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Offer History Tracker */}
                {inspectingSession.offers.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Offer Trajectory Log
                    </span>
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3">Round</th>
                            <th className="py-2 px-3">Proposed By</th>
                            <th className="py-2 px-3">Amount</th>
                            <th className="py-2 px-3">Guardrail Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {inspectingSession.offers.map((o) => (
                            <tr key={o.id}>
                              <td className="py-2 px-3 font-mono">Round {o.roundNumber}</td>
                              <td className="py-2 px-3 font-medium">
                                {o.proposedBy === "CUSTOMER" ? "Customer" : "AI Counter"}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {inspectingSession.session.currency} {o.amount.toLocaleString()}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    o.guardrailStatus === "PASSED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : o.guardrailStatus === "CLAMPED"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {o.guardrailStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
