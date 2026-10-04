"use client";

import React, { useState, useEffect } from "react";
import { History, Search, ShieldCheck, CheckCircle2, XCircle, ArrowRight, MessageSquare, Bot, User } from "lucide-react";
import { NegotiationSession, NegotiationMessage } from "@/core/types/negotiation.types";

export default function MerchantSessionsPage() {
  const [storeId] = useState("d0000000-0000-0000-0000-000000000001");
  const [sessions, setSessions] = useState<NegotiationSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<NegotiationMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/merchant/sessions?storeId=${storeId}`);
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
          if (data.sessions?.length > 0) {
            loadSessionDetails(data.sessions[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, [storeId]);

  const loadSessionDetails = async (id: string) => {
    setSelectedSessionId(id);
    try {
      const res = await fetch(`/api/v1/merchant/sessions?storeId=${storeId}&sessionId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedMessages(data.messages || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Live Negotiation Sessions</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time session audit log with full conversational transcripts and pricing guard evaluations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active & Closed Sessions
            </span>
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {sessions.length} sessions
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                No negotiation sessions recorded yet. Launch the simulator or wait for storefront shoppers!
              </div>
            ) : (
              sessions.map((s) => {
                const isSelected = s.id === selectedSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => loadSessionDetails(s.id)}
                    className={`p-4 cursor-pointer transition ${
                      isSelected ? "bg-emerald-50/60 border-l-4 border-emerald-600" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-400">#{s.id.slice(0, 8)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                          s.status === "ACCEPTED"
                            ? "bg-emerald-100 text-emerald-800"
                            : s.status === "COUNTERED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      Listed: {s.currency} {s.originalPrice}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>Rounds: {s.currentRound}/{s.maxRounds}</span>
                      {s.finalAgreedPrice && (
                        <span className="font-semibold text-emerald-600">
                          Agreed: {s.currency} {s.finalAgreedPrice}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Transcript Details Inspector */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-900">Transcript & Guardrail Audit</span>
            </div>
            {selectedSessionId && (
              <span className="text-xs font-mono text-slate-400">Session ID: {selectedSessionId}</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {selectedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                <History className="w-8 h-8 mb-2 opacity-50" />
                <span>Select a session to view conversation and pricing guard logs.</span>
              </div>
            ) : (
              selectedMessages.map((msg) => {
                const isAI = msg.senderRole === "AI_AGENT";
                return (
                  <div key={msg.id} className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      {isAI ? (
                        <>
                          <Bot className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">NegoZaar AI Agent (Round {msg.roundNumber})</span>
                        </>
                      ) : (
                        <>
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-blue-700">Storefront Shopper</span>
                        </>
                      )}
                    </div>

                    <div
                      className={`p-3.5 rounded-xl text-sm leading-relaxed ${
                        isAI
                          ? "bg-slate-50 border border-slate-200 text-slate-800"
                          : "bg-blue-50 border border-blue-200 text-blue-900"
                      }`}
                    >
                      {msg.messageText}
                    </div>

                    {/* Internal Audit Reasoning (Merchant-Only View) */}
                    {msg.rawAiReasoning && (
                      <div className="ml-2 pl-3 border-l-2 border-emerald-400 text-xs text-slate-500 font-mono">
                        <span className="text-emerald-600 font-semibold">Guardrail Log:</span> {msg.rawAiReasoning}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
