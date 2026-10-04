"use client";

import React, { useState } from "react";
import { Store, Copy, Check, Code, Shield, ExternalLink, RefreshCw } from "lucide-react";

export default function StoresIntegrationPage() {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const publicStoreKey = "pub_live_apex_9a8b7c6d5e4f3a2b1c";
  const embedSnippet = `<script 
  src="https://app.negozaar.com/sdk/negozaar.js" 
  data-store-key="${publicStoreKey}" 
  async>
</script>`;

  const copyToClipboard = (text: string, type: "key" | "snippet") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stores & Integration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your connected ecommerce stores and storefront embed credentials.
        </p>
      </div>

      {/* Connected Store Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Apex Luxury Lifestyle</h2>
              <span className="text-xs text-slate-500 font-mono">apex-luxury.myshopify.com</span>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            Connected via Shopify
          </span>
        </div>

        {/* Public Store Key */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Public Store Key (Storefront Widget Token)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={publicStoreKey}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 focus:outline-none"
            />
            <button
              onClick={() => copyToClipboard(publicStoreKey, "key")}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            >
              {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedKey ? "Copied" : "Copy Key"}</span>
            </button>
          </div>
        </div>

        {/* Shopify Theme Embed Snippet */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Shopify Theme Embed Code (`theme.liquid` / App Embed)
            </label>
            <button
              onClick={() => copyToClipboard(embedSnippet, "snippet")}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
            >
              {copiedSnippet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSnippet ? "Copied Snippet" : "Copy HTML Snippet"}</span>
            </button>
          </div>
          <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto leading-relaxed">
            {embedSnippet}
          </pre>
          <p className="text-xs text-slate-400 mt-2">
            Paste this snippet right before the closing &lt;/body&gt; tag in your Shopify store theme, or
            install via the NegoZaar Shopify App Bridge Theme App Extension.
          </p>
        </div>

        {/* Webhook Endpoint */}
        <div className="pt-4 border-t border-slate-100">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Shopify Webhook Attribution URL
          </label>
          <div className="text-xs font-mono text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            https://api.negozaar.com/api/v1/webhooks/shopify
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Subscribed topics: <code className="text-slate-600">orders/create</code>, <code className="text-slate-600">app/uninstalled</code>
          </p>
        </div>
      </div>
    </div>
  );
}
