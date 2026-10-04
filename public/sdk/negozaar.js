/**
 * NegoZaar Storefront Embed SDK (v0.1.0)
 *
 * Lightweight script installed by merchants into their Shopify theme or ecommerce template.
 * Automatically injects the "Negotiate Price" trigger button and handles the modal iframe.
 */
(function () {
  "use strict";

  const scriptTag = document.currentScript || document.querySelector("script[data-store-key]");
  const storeKey = scriptTag ? scriptTag.getAttribute("data-store-key") : null;
  const scriptSrc = scriptTag ? scriptTag.src : "";
  const hostUrl = scriptSrc ? new URL(scriptSrc).origin : window.location.origin;

  if (!storeKey) {
    console.warn("[NegoZaar SDK] Missing data-store-key attribute. Widget disabled.");
    return;
  }

  // Prevent double injection
  if (window.__NEGOZAAR_LOADED__) return;
  window.__NEGOZAAR_LOADED__ = true;

  // Detect current product context on Shopify / ecommerce platform
  function detectProductContext() {
    let productId = null;
    let price = null;

    // 1. Check meta tags or Shopify window object
    if (window.ShopifyAnalytics?.meta?.product?.id) {
      productId = String(window.ShopifyAnalytics.meta.product.id);
    } else if (window.meta?.product?.id) {
      productId = String(window.meta.product.id);
    } else {
      // Fallback: look for data attributes or hidden inputs
      const prodInput = document.querySelector('input[name="product-id"], [data-product-id]');
      if (prodInput) {
        productId = prodInput.getAttribute("data-product-id") || prodInput.value;
      }
    }

    // Default reference product id for sandbox/testing
    if (!productId) {
      productId = "e0000000-0000-0000-0000-000000000001";
    }

    return { productId };
  }

  function initWidget() {
    const { productId } = detectProductContext();

    // Create Floating Trigger Button
    const button = document.createElement("button");
    button.id = "negozaar-trigger-btn";
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
      Negotiate Price
    `;
    button.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999990;
      background: #16a34a;
      color: #ffffff;
      border: none;
      padding: 12px 20px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 15px;
      font-weight: 600;
      box-shadow: 0 10px 25px -5px rgba(22, 163, 74, 0.4), 0 8px 10px -6px rgba(22, 163, 74, 0.2);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    button.onmouseenter = () => {
      button.style.transform = "translateY(-2px) scale(1.02)";
      button.style.background = "#15803d";
    };
    button.onmouseleave = () => {
      button.style.transform = "translateY(0) scale(1)";
      button.style.background = "#16a34a";
    };

    // Create Modal Overlay & Iframe Container
    const modalContainer = document.createElement("div");
    modalContainer.id = "negozaar-modal-container";
    modalContainer.style.cssText = `
      position: fixed;
      bottom: 84px;
      right: 24px;
      width: 400px;
      max-width: calc(100vw - 32px);
      height: 600px;
      max-height: calc(100vh - 120px);
      background: transparent;
      z-index: 999995;
      display: none;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      border-radius: 16px;
      overflow: hidden;
    `;

    const iframe = document.createElement("iframe");
    iframe.src = `${hostUrl}/embed/widget?storeKey=${encodeURIComponent(storeKey)}&productId=${encodeURIComponent(productId)}`;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 16px;
      background: #ffffff;
    `;

    modalContainer.appendChild(iframe);
    document.body.appendChild(button);
    document.body.appendChild(modalContainer);

    let isOpen = false;

    button.onclick = () => {
      isOpen = !isOpen;
      modalContainer.style.display = isOpen ? "block" : "none";
      button.innerHTML = isOpen
        ? `✕ Close`
        : `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Negotiate Price
        `;
    };

    // Listen to iframe postMessages (e.g. deal accepted, close modal, redirect to checkout)
    window.addEventListener("message", (event) => {
      if (event.data?.type === "NEGOZAAR_DEAL_ACCEPTED") {
        if (event.data.checkoutUrl) {
          window.location.href = event.data.checkoutUrl;
        }
      }
      if (event.data?.type === "NEGOZAAR_CLOSE_MODAL") {
        isOpen = false;
        modalContainer.style.display = "none";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWidget);
  } else {
    initWidget();
  }
})();
