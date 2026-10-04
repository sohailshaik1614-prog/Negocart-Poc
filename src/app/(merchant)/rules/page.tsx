"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
  Edit3,
  Check,
  AlertTriangle,
  ExternalLink,
  X,
  Search,
  Tag,
  Percent,
} from "lucide-react";
import { ProductWithNegotiationSettings } from "@/core/types/product.types";
import { NegotiationStrategy } from "@/core/types/rule.types";

export default function PricingRulesPage() {
  const [products, setProducts] = useState<ProductWithNegotiationSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithNegotiationSettings | null>(null);

  // Form State for Add / Edit
  const [formTitle, setFormTitle] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formOriginalPrice, setFormOriginalPrice] = useState<number | "">("");
  const [formCurrency, setFormCurrency] = useState("INR");
  const [formFloorPrice, setFormFloorPrice] = useState<number | "">("");
  const [formMaxDiscountPct, setFormMaxDiscountPct] = useState<number | "">("");
  const [formAutoAcceptPrice, setFormAutoAcceptPrice] = useState<number | "">("");
  const [formMaxRounds, setFormMaxRounds] = useState<number>(3);
  const [formStrategy, setFormStrategy] = useState<NegotiationStrategy>("MODERATE");
  const [formEnabled, setFormEnabled] = useState<boolean>(true);
  const [formCustomPrompt, setFormCustomPrompt] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/merchant/products");
      if (!res.ok) {
        throw new Error("Failed to load products");
      }
      const json = await res.json();
      setProducts(json.data?.products || []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Open Add Product Modal
  const handleOpenAdd = () => {
    setFormTitle("");
    setFormSku("");
    setFormOriginalPrice("");
    setFormCurrency("INR");
    setFormFloorPrice("");
    setFormMaxDiscountPct("");
    setFormAutoAcceptPrice("");
    setFormMaxRounds(3);
    setFormStrategy("MODERATE");
    setFormEnabled(true);
    setFormCustomPrompt("");
    setErrorMessage(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Product Modal
  const handleOpenEdit = (p: ProductWithNegotiationSettings) => {
    const rule = p.negotiationSettings;
    setEditingProduct(p);
    setFormTitle(p.title);
    setFormSku(p.sku || "");
    setFormOriginalPrice(p.originalPrice);
    setFormCurrency(p.currency);
    setFormFloorPrice(rule?.minAcceptablePrice || Math.round(p.originalPrice * 0.75));
    setFormMaxDiscountPct(
      rule?.maxDiscountPercentage !== undefined
        ? rule.maxDiscountPercentage
        : Number((((p.originalPrice - (rule?.minAcceptablePrice || p.originalPrice * 0.75)) / p.originalPrice) * 100).toFixed(1))
    );
    setFormAutoAcceptPrice(rule?.autoAcceptPrice || "");
    setFormMaxRounds(rule?.maxNegotiationRounds || 3);
    setFormStrategy(rule?.strategy || "MODERATE");
    setFormEnabled(rule?.isNegotiationEnabled ?? true);
    setFormCustomPrompt(rule?.customSystemPromptAddon || "");
    setErrorMessage(null);
  };

  // Auto calculate discount percentage when floor or original price changes
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

  // Submit Add Product Form
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setErrorMessage("Product title is required");
      return;
    }
    if (typeof formOriginalPrice !== "number" || formOriginalPrice <= 0) {
      setErrorMessage("Please enter a valid positive listed retail price");
      return;
    }
    if (typeof formFloorPrice !== "number" || formFloorPrice <= 0) {
      setErrorMessage("Please enter a valid positive floor price");
      return;
    }
    if (formFloorPrice > formOriginalPrice) {
      setErrorMessage("Floor price cannot be higher than the listed price");
      return;
    }
    if (typeof formAutoAcceptPrice === "number" && formAutoAcceptPrice < formFloorPrice) {
      setErrorMessage("Auto-accept price cannot be lower than the floor price");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

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
          isNegotiationEnabled: formEnabled,
          customSystemPromptAddon: formCustomPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add product");
      }

      setIsAddModalOpen(false);
      showSuccess(`Product "${formTitle}" and negotiation rules saved successfully!`);
      await fetchProducts();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error creating product");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Product Form
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (typeof formOriginalPrice === "number" && typeof formFloorPrice === "number" && formFloorPrice > formOriginalPrice) {
      setErrorMessage("Floor price cannot be higher than the listed price");
      return;
    }
    if (typeof formAutoAcceptPrice === "number" && typeof formFloorPrice === "number" && formAutoAcceptPrice < formFloorPrice) {
      setErrorMessage("Auto-accept price cannot be lower than the floor price");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const res = await fetch(`/api/v1/merchant/products/${editingProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim() || undefined,
          sku: formSku.trim() || undefined,
          originalPrice: typeof formOriginalPrice === "number" ? formOriginalPrice : undefined,
          currency: formCurrency,
          minAcceptablePrice: typeof formFloorPrice === "number" ? formFloorPrice : undefined,
          maxDiscountPercentage: typeof formMaxDiscountPct === "number" ? formMaxDiscountPct : undefined,
          autoAcceptPrice: typeof formAutoAcceptPrice === "number" ? formAutoAcceptPrice : undefined,
          maxNegotiationRounds: formMaxRounds,
          strategy: formStrategy,
          isNegotiationEnabled: formEnabled,
          customSystemPromptAddon: formCustomPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update product");
      }

      setEditingProduct(null);
      showSuccess(`Discounts & guardrails updated for "${formTitle}"!`);
      await fetchProducts();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error updating product rules");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle active negotiation
  const handleToggleNegotiation = async (p: ProductWithNegotiationSettings) => {
    const currentEnabled = p.negotiationSettings?.isNegotiationEnabled ?? true;
    try {
      const res = await fetch(`/api/v1/merchant/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isNegotiationEnabled: !currentEnabled,
        }),
      });
      if (res.ok) {
        showSuccess(`Negotiation ${!currentEnabled ? "enabled" : "disabled"} for "${p.title}"`);
        await fetchProducts();
      }
    } catch {
      // ignore
    }
  };

  // Delete product
  const handleDeleteProduct = async (p: ProductWithNegotiationSettings) => {
    if (!window.confirm(`Are you sure you want to delete "${p.title}" and its negotiation rules?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/merchant/products/${p.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showSuccess(`Product "${p.title}" deleted.`);
        await fetchProducts();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete product");
      }
    } catch (err) {
      alert("Error deleting product");
    }
  };

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products & Negotiation Rules</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your store&apos;s products and set confidential discount limits. The AI negotiation engine enforces these guardrails in real time.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Product & Set Discounts
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by title or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {products.length} {products.length === 1 ? "Product" : "Products"} Configured
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading merchant products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Tag className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-700">No Products Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your store&apos;s products and set discount guardrails to start negotiating with customers.
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Listed Price</th>
                  <th className="py-3 px-4">Secret Floor</th>
                  <th className="py-3 px-4">Max Discount</th>
                  <th className="py-3 px-4">Strategy</th>
                  <th className="py-3 px-4">Rounds</th>
                  <th className="py-3 px-4">Negotiation</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.map((p) => {
                  const rule = p.negotiationSettings;
                  const isEnabled = rule?.isNegotiationEnabled ?? true;
                  const floor = rule?.minAcceptablePrice || 0;
                  const discountPct = rule?.maxDiscountPercentage !== undefined
                    ? rule.maxDiscountPercentage
                    : p.originalPrice > 0 && floor > 0
                    ? Number((((p.originalPrice - floor) / p.originalPrice) * 100).toFixed(1))
                    : 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 text-sm">{p.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {p.sku ? `SKU: ${p.sku}` : "No SKU"}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {p.currency} {p.originalPrice.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <ShieldCheck className="w-3 h-3 text-rose-500" />
                          {p.currency} {floor.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700">
                          {discountPct}% ({p.currency} {(p.originalPrice - floor).toLocaleString()})
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          rule?.strategy === "AGGRESSIVE"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : rule?.strategy === "FRIENDLY"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>
                          {rule?.strategy || "MODERATE"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {rule?.maxNegotiationRounds || 3} Rounds
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleNegotiation(p)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                            isEnabled
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                          }`}
                        >
                          {isEnabled ? "Active" : "Disabled"}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          href={`/widget-sandbox?productId=${p.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-medium transition"
                          title="Test in Widget Sandbox"
                        >
                          <Sparkles className="w-3 h-3" />
                          Test
                        </Link>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-medium transition"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          className="inline-flex items-center p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Delete product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal: Add Product & Configure Discounts */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Add Product & Set Discounts</h3>
                  <p className="text-xs text-slate-500">Put your product into NegoZaar and configure pricing guardrails</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-5">
              {/* Product Info Section */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  1. Product Details
                </div>
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
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

                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Listed Retail Price *
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

                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      SKU (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SNY-XM5-BLK"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Guardrails Section */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>2. Pricing Guardrails & Discounts</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Minimum Acceptable Floor Price *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="e.g. 19990"
                        value={formFloorPrice}
                        onChange={(e) => handleFloorPriceChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Absolute secret floor. AI will NEVER offer or accept below this.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Max Discount (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formMaxDiscountPct}
                        onChange={(e) => setFormMaxDiscountPct(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Auto-computed based on floor price vs listed price.
                    </p>
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
                    <p className="text-[11px] text-slate-400 mt-1">
                      Offers at or above this are accepted immediately in Round 1.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Max Negotiation Rounds
                    </label>
                    <select
                      value={formMaxRounds}
                      onChange={(e) => setFormMaxRounds(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value={2}>2 Rounds (Quick resolution)</option>
                      <option value={3}>3 Rounds (Recommended standard)</option>
                      <option value={4}>4 Rounds (Extended negotiation)</option>
                      <option value={5}>5 Rounds (Maximum rounds)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Strategy Section */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  3. Negotiation Strategy
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "AGGRESSIVE", title: "Aggressive", desc: "Firm margin protection" },
                    { id: "MODERATE", title: "Moderate", desc: "Balanced fair midpoint" },
                    { id: "FRIENDLY", title: "Friendly", desc: "High conversion focus" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormStrategy(s.id as NegotiationStrategy)}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        formStrategy === s.id
                          ? "border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-500"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">{s.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{s.desc}</div>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Brand Voice & Value Talking Points (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Highlight active noise canceling, 30-hour battery, and 1-year warranty"
                    value={formCustomPrompt}
                    onChange={(e) => setFormCustomPrompt(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Actions */}
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
                  {submitting ? "Saving Product..." : "Save Product & Set Discounts"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Product Discounts & Rules */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Edit Discounts & Rules</h3>
                  <p className="text-xs text-slate-500 truncate max-w-sm">{editingProduct.title}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-5">
              {/* Product Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Listed Retail Price ({editingProduct.currency})
                  </label>
                  <input
                    type="number"
                    value={formOriginalPrice}
                    onChange={(e) => handleOriginalPriceChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Minimum Floor Price ({editingProduct.currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formFloorPrice}
                    onChange={(e) => handleFloorPriceChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Confidential floor. AI will never accept lower.
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
                    Auto-Accept Price ({editingProduct.currency})
                  </label>
                  <input
                    type="number"
                    value={formAutoAcceptPrice}
                    onChange={(e) => setFormAutoAcceptPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Max Negotiation Rounds
                  </label>
                  <select
                    value={formMaxRounds}
                    onChange={(e) => setFormMaxRounds(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value={2}>2 Rounds</option>
                    <option value={3}>3 Rounds</option>
                    <option value={4}>4 Rounds</option>
                    <option value={5}>5 Rounds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Negotiation Enabled
                  </label>
                  <select
                    value={formEnabled ? "true" : "false"}
                    onChange={(e) => setFormEnabled(e.target.value === "true")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="true">Enabled (Shoppers can negotiate)</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>

              {/* Strategy Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Negotiation Strategy
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "AGGRESSIVE", title: "Aggressive", desc: "Firm margin protection" },
                    { id: "MODERATE", title: "Moderate", desc: "Balanced fair midpoint" },
                    { id: "FRIENDLY", title: "Friendly", desc: "High conversion focus" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormStrategy(s.id as NegotiationStrategy)}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        formStrategy === s.id
                          ? "border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-500"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">{s.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Brand Voice / Value Talking Points
                </label>
                <textarea
                  rows={2}
                  value={formCustomPrompt}
                  onChange={(e) => setFormCustomPrompt(e.target.value)}
                  placeholder="e.g. Mention 2-year warranty and free expedited shipping"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Update Discounts"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
