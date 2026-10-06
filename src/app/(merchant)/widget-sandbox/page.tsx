"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Smartphone,
  Monitor,
  Plus,
  Sliders,
  Tag,
  AlertCircle,
  X,
  Check,
  ShoppingBag,
  Store,
  Eye,
  ChevronRight,
} from "lucide-react";
import { ProductWithNegotiationSettings } from "@/core/types/product.types";
import { NegotiationStrategy } from "@/core/types/rule.types";
import CustomerNegotiationWidget from "@/components/widget/CustomerNegotiationWidget";

function WidgetSandboxContent() {
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get("productId");

  const [products, setProducts] = useState<ProductWithNegotiationSettings[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(Date.now());
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [viewMode, setViewMode] = useState<"storefront" | "chat">("storefront");
  const [isWidgetDrawerOpen, setIsWidgetDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states for quick product creation
  const [formTitle, setFormTitle] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formOriginalPrice, setFormOriginalPrice] = useState<number | "">("");
  const [formCurrency, setFormCurrency] = useState("INR");
  const [formFloorPrice, setFormFloorPrice] = useState<number | "">("");
  const [formMaxDiscountPct, setFormMaxDiscountPct] = useState<number | "">("");
  const [formAutoAcceptPrice, setFormAutoAcceptPrice] = useState<number | "">("");
  const [formMaxRounds, setFormMaxRounds] = useState<number>(3);
  const [formStrategy, setFormStrategy] = useState<NegotiationStrategy>("MODERATE");
  const [formCustomPrompt, setFormCustomPrompt] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Store connection state
  const [store, setStore] = useState<{
    id: string;
    publicStoreKey: string;
    status: string;
    storeName: string;
    platformStoreId?: string;
    currency: string;
  } | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [activatingStore, setActivatingStore] = useState(false);

  const fetchStore = async () => {
    try {
      setStoreLoading(true);
      const res = await fetch("/api/v1/merchant/store");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setStore(json.data);
      }
    } catch (err) {
      console.error("Failed to load store:", err);
    } finally {
      setStoreLoading(false);
    }
  };

  const handleActivateStore = async () => {
    try {
      setActivatingStore(true);
      const res = await fetch("/api/v1/merchant/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setStore(json.data);
        setKey(Date.now());
      }
    } catch (err) {
      console.error("Failed to activate store:", err);
    } finally {
      setActivatingStore(false);
    }
  };

  const fetchProducts = async (autoSelectId?: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/merchant/products");
      if (!res.ok) throw new Error("Failed to load products");
      const json = await res.json();
      const list: ProductWithNegotiationSettings[] = json.data?.products || [];
      setProducts(list);

      if (autoSelectId && list.some((p) => p.id === autoSelectId)) {
        setSelectedProductId(autoSelectId);
      } else if (initialProductId && list.some((p) => p.id === initialProductId)) {
        setSelectedProductId(initialProductId);
      } else if (list.length > 0 && !selectedProductId) {
        setSelectedProductId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchStore();
  }, [initialProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const restartSimulator = () => {
    setKey(Date.now());
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    setKey(Date.now());
  };

  const handleOriginalPriceChange = (val: string) => {
    const num = val === "" ? "" : Number(val);
    setFormOriginalPrice(num);
    if (typeof num === "number" && typeof formFloorPrice === "number" && num > 0) {
      const pct = Number((((num - formFloorPrice) / num) * 100).toFixed(1));
      setFormMaxDiscountPct(pct > 0 ? pct : 0);
    }
  };

  const handleFloorPriceChange = (val: string) => {
    const num = val === "" ? "" : Number(val);
    setFormFloorPrice(num);
    if (typeof formOriginalPrice === "number" && typeof num === "number" && formOriginalPrice > 0) {
      const pct = Number((((formOriginalPrice - num) / formOriginalPrice) * 100).toFixed(1));
      setFormMaxDiscountPct(pct > 0 ? pct : 0);
    }
  };

  const handleQuickAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setModalError("Product title is required");
      return;
    }
    if (typeof formOriginalPrice !== "number" || formOriginalPrice <= 0) {
      setModalError("Valid positive retail price is required");
      return;
    }
    if (typeof formFloorPrice !== "number" || formFloorPrice <= 0) {
      setModalError("Valid positive floor price is required");
      return;
    }
    if (formFloorPrice > formOriginalPrice) {
      setModalError("Floor price cannot exceed the original price");
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);

      const res = await fetch("/api/v1/merchant/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          sku: formSku.trim() || undefined,
          originalPrice: formOriginalPrice,
          currency: formCurrency,
          minAcceptablePrice: formFloorPrice,
          maxDiscountPercentage: typeof formMaxDiscountPct === "number" ? formMaxDiscountPct : undefined,
          autoAcceptPrice: typeof formAutoAcceptPrice === "number" ? formAutoAcceptPrice : undefined,
          maxNegotiationRounds: formMaxRounds,
          strategy: formStrategy,
          isNegotiationEnabled: true,
          customSystemPromptAddon: formCustomPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create product");
      }

      setIsAddModalOpen(false);
      const newId = data.data.id;
      await fetchProducts(newId);
      setSelectedProductId(newId);
      setKey(Date.now());
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error creating product");
    } finally {
      setSubmitting(false);
    }
  };

  const rule = selectedProduct?.negotiationSettings;
  const floorPrice = rule?.minAcceptablePrice || (selectedProduct ? Math.round(selectedProduct.originalPrice * 0.75) : 0);
  const maxDiscount = rule?.maxDiscountPercentage !== undefined
    ? rule.maxDiscountPercentage
    : selectedProduct && selectedProduct.originalPrice > 0
    ? Number((((selectedProduct.originalPrice - floorPrice) / selectedProduct.originalPrice) * 100).toFixed(1))
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Negotiation Sandbox</h1>
          <p className="text-sm text-slate-500 mt-1">
            Test how the AI negotiator bargains on your products under your deterministic pricing guardrails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Product Selector */}
          {products.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 hidden sm:inline">Product:</span>
              <select
                value={selectedProductId}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[260px] truncate"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.currency} {p.originalPrice.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Add Product Button */}
          <button
            onClick={() => {
              setFormTitle("");
              setFormSku("");
              setFormOriginalPrice("");
              setFormCurrency(selectedProduct?.currency || "INR");
              setFormFloorPrice("");
              setFormMaxDiscountPct("");
              setFormAutoAcceptPrice("");
              setFormMaxRounds(3);
              setFormStrategy("MODERATE");
              setFormCustomPrompt("");
              setModalError(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-lg">
            <button
              onClick={() => {
                setViewMode("storefront");
                setIsWidgetDrawerOpen(false);
              }}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === "storefront" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
              title="Preview product page with [Negotiate Price] button"
            >
              <Store className="w-3.5 h-3.5 text-emerald-600" /> Storefront Preview
            </button>
            <button
              onClick={() => {
                setViewMode("chat");
                setIsWidgetDrawerOpen(true);
              }}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === "chat" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
              title="Direct full-height chat widget frame"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Direct Chat
            </button>
          </div>

          {/* Device Toggle */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-lg">
            <button
              onClick={() => setDeviceMode("desktop")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                deviceMode === "desktop" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop
            </button>
            <button
              onClick={() => setDeviceMode("mobile")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                deviceMode === "mobile" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              restartSimulator();
              setIsWidgetDrawerOpen(viewMode === "chat");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition shadow-sm"
            title="Restart negotiation session"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Session
          </button>
        </div>
      </div>

      {/* Simulator Sandbox Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Guardrails */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Active Guardrail Parameters</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                rule?.isNegotiationEnabled ?? true
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {rule?.isNegotiationEnabled ?? true ? "Negotiation Active" : "Disabled"}
              </span>
            </div>

            {selectedProduct ? (
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex justify-between gap-2">
                  <span className="text-slate-500">Product Title:</span>
                  <span className="font-semibold text-slate-900 text-right truncate max-w-[200px]">
                    {selectedProduct.title}
                  </span>
                </div>
                {selectedProduct.sku && (
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">SKU:</span>
                    <span className="font-mono text-slate-700">{selectedProduct.sku}</span>
                  </div>
                )}
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Listed Retail Price:</span>
                  <span className="font-bold text-slate-900">
                    {selectedProduct.currency} {selectedProduct.originalPrice.toLocaleString()}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1">
                    Floor Price (Confidential):
                  </span>
                  <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {selectedProduct.currency} {floorPrice.toLocaleString()}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Max Discount Limit:</span>
                  <span className="font-semibold text-slate-800">
                    {maxDiscount}% ({selectedProduct.currency} {(selectedProduct.originalPrice - floorPrice).toLocaleString()})
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Auto-Accept Price:</span>
                  <span className="font-semibold text-slate-800">
                    {rule?.autoAcceptPrice
                      ? `${selectedProduct.currency} ${rule.autoAcceptPrice.toLocaleString()}`
                      : "None"}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Max Allowed Rounds:</span>
                  <span className="font-semibold text-slate-800">
                    {rule?.maxNegotiationRounds || 3} Rounds
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Strategy Concession:</span>
                  <span className="font-semibold text-emerald-700">
                    {rule?.strategy || "MODERATE"}
                  </span>
                </div>
                {rule?.customSystemPromptAddon && (
                  <div className="py-2.5">
                    <span className="text-slate-500 block mb-1">Brand Voice Notes:</span>
                    <p className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 italic">
                      &quot;{rule.customSystemPromptAddon}&quot;
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                No product selected. Add a product to begin testing.
              </div>
            )}
          </div>

          {/* Pricing Guard Protection Card */}
          <div className="bg-slate-900 text-slate-200 p-5 rounded-xl text-xs space-y-2.5 border border-slate-800 shadow-sm">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero Floor Leakage Guarantee</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              The AI negotiation engine negotiates dynamically with shoppers while bounded by your confidential floor price.
            </p>
            <ul className="space-y-1.5 text-slate-300">
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Floor price is strictly confidential and never stated to customers.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Deterministic pricing guard clamps all counteroffers.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Attempt limits prevent customers from probing repeatedly.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Simulated Storefront PDP or Direct Chat Frame */}
        <div className="lg:col-span-8 flex justify-center bg-slate-200/60 p-4 sm:p-6 rounded-2xl border border-slate-200">
          <div
            className={`transition-all duration-300 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-300 flex flex-col relative ${
              deviceMode === "mobile" ? "w-[380px] h-[660px]" : "w-[440px] h-[660px]"
            }`}
          >
            {selectedProduct ? (
              viewMode === "storefront" ? (
                /* STOREFRONT PDP PREVIEW MODE */
                <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
                  {/* Mock Browser URL Bar */}
                  <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-2 text-[11px] text-slate-500 font-mono shrink-0">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    </div>
                    <div className="flex-1 bg-white rounded px-2 py-0.5 border border-slate-200 truncate text-[10px]">
                      https://{store?.platformStoreId || "apex-luxury.myshopify.com"}/products/{selectedProduct.handle || "item"}
                    </div>
                  </div>

                  {/* Warning banner if store is paused / disconnected */}
                  {store && store.status !== "ACTIVE" && (
                    <div className="p-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate text-[11px] font-medium">Store is paused/disconnected</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleActivateStore}
                        disabled={activatingStore}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        {activatingStore ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Activate
                      </button>
                    </div>
                  )}

                  {/* PDP Content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Product Image Mock */}
                    <div className="w-full h-44 rounded-xl bg-slate-200 border border-slate-300/80 overflow-hidden relative flex items-center justify-center">
                      {selectedProduct.imageUrl ? (
                        <img
                          src={selectedProduct.imageUrl}
                          alt={selectedProduct.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-slate-400">
                          <ShoppingBag className="w-10 h-10 mx-auto mb-1 opacity-50" />
                          <span className="text-xs">Product Image</span>
                        </div>
                      )}
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                        Shopify Live
                      </span>
                    </div>

                    {/* Title & Listed Price */}
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        In Stock ({selectedProduct.inventoryQuantity || 15} units available)
                      </div>
                      <h3 className="font-bold text-base text-slate-900 leading-snug">
                        {selectedProduct.title}
                      </h3>
                      {selectedProduct.sku && (
                        <span className="text-[11px] text-slate-400 font-mono">SKU: {selectedProduct.sku}</span>
                      )}
                    </div>

                    {/* Price Block */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-0.5">
                      <span className="text-xs text-slate-500 block">Product price:</span>
                      <div className="text-2xl font-black text-slate-950 tracking-tight">
                        {selectedProduct.currency} {selectedProduct.originalPrice.toLocaleString()}
                      </div>
                      <p className="text-[11px] text-slate-400">Inclusive of all local taxes & shipping</p>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-1">
                      {/* Standard Store Add to Cart */}
                      <button
                        type="button"
                        onClick={() => alert("This button simulates standard Shopify Add to Cart at retail price.")}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        Add to Cart
                      </button>

                      {/* INJECTED NEGOZAAR NEGOTIATE BUTTON */}
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (store && store.status !== "ACTIVE") {
                              handleActivateStore().then(() => {
                                restartSimulator();
                                setIsWidgetDrawerOpen(true);
                              });
                            } else {
                              restartSimulator();
                              setIsWidgetDrawerOpen(true);
                            }
                          }}
                          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ring-2 ring-emerald-500/20 cursor-pointer"
                        >
                          <span>Negotiate Price</span>
                          <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse" />
                        </button>
                        <span className="text-[10px] text-slate-400 text-center block">
                          ⚡ Injected by NegoZaar Storefront Embed SDK
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SLIDE-OVER NEGOTIATION WIDGET DRAWER */}
                  {isWidgetDrawerOpen && (
                    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-slate-950/50 backdrop-blur-2xs animate-fade-in">
                      <div className="w-full h-[94%] bg-white rounded-t-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up border-t border-slate-300">
                        <CustomerNegotiationWidget
                          key={`${selectedProduct.id}-${key}-${store?.publicStoreKey || 'default'}-${store?.status}`}
                          storeKey={store?.publicStoreKey || "pub_live_apex_9a8b7c6d5e4f3a2b1c"}
                          productId={selectedProduct.id}
                          onClose={() => setIsWidgetDrawerOpen(false)}
                          isModal={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* DIRECT CHAT FRAME MODE */
                store && store.status !== "ACTIVE" ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 space-y-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="max-w-xs space-y-1">
                      <h4 className="text-sm font-bold text-slate-800">Store Paused / Disconnected</h4>
                      <p className="text-xs text-slate-500">
                        The AI negotiation engine is offline while your store is paused. Activate it to start the live interactive negotiation.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleActivateStore}
                      disabled={activatingStore}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
                    >
                      {activatingStore ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Activate Store & Start Simulation
                    </button>
                  </div>
                ) : (
                  <CustomerNegotiationWidget
                    key={`${selectedProduct.id}-${key}-${store?.publicStoreKey || 'default'}-${store?.status}`}
                    storeKey={store?.publicStoreKey || "pub_live_apex_9a8b7c6d5e4f3a2b1c"}
                    productId={selectedProduct.id}
                    isModal={false}
                  />
                )
              )
            ) : (
              <div className="h-full flex items-center justify-center p-8 text-center text-slate-400 text-sm">
                No product available to negotiate
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Quick Add Product & Set Discounts */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Add Product & Set Discounts</h3>
                  <p className="text-xs text-slate-500">Configure a product to test in the AI negotiation sandbox</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleQuickAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AUD">AUD ($)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Listed Price *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="e.g. 24990"
                    value={formOriginalPrice}
                    onChange={(e) => handleOriginalPriceChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    SKU (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SNY-001"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Minimum Floor Price *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="e.g. 19990"
                    value={formFloorPrice}
                    onChange={(e) => handleFloorPriceChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Confidential floor price. Never leaked.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Max Discount (%)
                  </label>
                  <input
                    type="number"
                    value={formMaxDiscountPct}
                    onChange={(e) => setFormMaxDiscountPct(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Auto-Accept Price (Optional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 22990"
                    value={formAutoAcceptPrice}
                    onChange={(e) => setFormAutoAcceptPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Strategy
                  </label>
                  <select
                    value={formStrategy}
                    onChange={(e) => setFormStrategy(e.target.value as NegotiationStrategy)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="MODERATE">Moderate (Balanced)</option>
                    <option value="AGGRESSIVE">Aggressive (Firm Margin)</option>
                    <option value="FRIENDLY">Friendly (High Conversion)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Brand Voice Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Highlight noise-canceling performance and premium audio"
                  value={formCustomPrompt}
                  onChange={(e) => setFormCustomPrompt(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save & Test in Sandbox"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WidgetSandboxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Sandbox...</div>}>
      <WidgetSandboxContent />
    </Suspense>
  );
}
