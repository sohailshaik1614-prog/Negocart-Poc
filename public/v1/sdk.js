/**
 * NegoZaar Storefront Embed SDK v1.0.0
 * B2B SaaS Dynamic Price Negotiation Layer for E-Commerce Merchants
 * 
 * Usage:
 * <script src="https://app.negozaar.com/v1/sdk.js" data-store-key="pub_live_apex_..." defer></script>
 */
(function (window, document) {
  "use strict";

  if (window.__NEGOZAAR_LOADED__) return;
  window.__NEGOZAAR_LOADED__ = true;

  // Determine host and script configuration
  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && (scripts[i].src.indexOf("/sdk.js") !== -1 || scripts[i].src.indexOf("/negozaar.js") !== -1)) {
        return scripts[i];
      }
    }
    return null;
  })();

  var storeKey = (currentScript && currentScript.getAttribute("data-store-key")) || window.NEGOZAAR_STORE_KEY || "pub_live_apex_9a8b7c6d5e4f3a2b1c";
  var baseUrl = (currentScript && currentScript.src) ? new URL(currentScript.src).origin : window.location.origin;

  var state = {
    isOpen: false,
    activeProductId: null,
    overlayElement: null,
    drawerElement: null,
    iframeElement: null,
  };

  function createDrawer() {
    if (document.getElementById("negozaar-root")) return;

    var root = document.createElement("div");
    root.id = "negozaar-root";
    root.style.cssText = "position:fixed;z-index:99999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

    // Overlay backdrop
    var backdrop = document.createElement("div");
    backdrop.id = "negozaar-backdrop";
    backdrop.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity 0.25s ease-in-out;z-index:1;";
    backdrop.addEventListener("click", function () {
      closeWidget();
    });

    // Modal drawer container
    var drawer = document.createElement("div");
    drawer.id = "negozaar-drawer";
    drawer.style.cssText = "position:fixed;bottom:0;right:0;width:100%;max-width:440px;height:92vh;max-height:680px;background:#ffffff;box-shadow:0 25px 50px -12px rgba(0,0,0,0.35);border-radius:20px 20px 0 0;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.16,1,0.3,1);z-index:2;overflow:hidden;display:flex;flex-direction:column;";

    // Desktop media query adjustment
    if (window.innerWidth >= 640) {
      drawer.style.bottom = "24px";
      drawer.style.right = "24px";
      drawer.style.borderRadius = "20px";
      drawer.style.height = "640px";
    }

    var iframe = document.createElement("iframe");
    iframe.id = "negozaar-iframe";
    iframe.title = "NegoZaar AI Negotiation";
    iframe.style.cssText = "width:100%;height:100%;border:none;flex:1;";
    iframe.allow = "clipboard-write";

    drawer.appendChild(iframe);
    root.appendChild(backdrop);
    root.appendChild(drawer);
    document.body.appendChild(root);

    state.overlayElement = backdrop;
    state.drawerElement = drawer;
    state.iframeElement = iframe;

    // Listen for postMessage from iframe
    window.addEventListener("message", function (event) {
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "NEGOZAAR_CLOSE") {
        closeWidget();
      } else if (event.data.type === "NEGOZAAR_DEAL_ACCEPTED") {
        var discountCode = event.data.discountCode;
        if (discountCode) {
          // Attempt to auto-fill Shopify discount field if present on page
          var discountInput = document.querySelector('input[name="discount"], input[name="checkout[reduction_code]"]');
          if (discountInput) {
            discountInput.value = discountCode;
          }
          // Dispatch DOM custom event for theme listeners
          var evt = new CustomEvent("negozaar:deal_accepted", { detail: event.data });
          document.dispatchEvent(evt);
        }
      }
    });
  }

  function openWidget(productId) {
    createDrawer();
    var targetProduct = productId || state.activeProductId || "e0000000-0000-0000-0000-000000000001";
    var embedUrl = baseUrl + "/embed/widget?storeKey=" + encodeURIComponent(storeKey) + "&productId=" + encodeURIComponent(targetProduct);

    if (state.iframeElement.src !== embedUrl) {
      state.iframeElement.src = embedUrl;
    }

    state.overlayElement.style.opacity = "1";
    state.overlayElement.style.pointerEvents = "auto";
    state.drawerElement.style.transform = "translateY(0)";
    state.isOpen = true;
  }

  function closeWidget() {
    if (!state.drawerElement || !state.overlayElement) return;
    state.overlayElement.style.opacity = "0";
    state.overlayElement.style.pointerEvents = "none";
    state.drawerElement.style.transform = "translateY(100%)";
    state.isOpen = false;
  }

  // Automatic Button Injection for Shopify / Ecommerce PDP
  function autoInjectButton() {
    var triggers = document.querySelectorAll("[data-negozaar-trigger]");
    if (triggers.length > 0) return;

    var container = document.querySelector(
      '.negozaar-container, form[action*="/cart/add"], .product-form, .product-form__buttons, .product__actions'
    );

    if (container) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "negozaar-bargain-btn";
      btn.setAttribute("data-negozaar-trigger", "true");
      btn.innerHTML = 'Negotiate Price <span style="margin-left:4px;font-size:14px;">✨</span>';
      btn.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:100%;margin-top:10px;padding:12px 20px;background:#059669;color:#ffffff;font-size:14px;font-weight:600;border:none;border-radius:8px;cursor:pointer;transition:background 0.2s;box-shadow:0 1px 2px 0 rgba(0,0,0,0.05);";

      btn.onmouseover = function () { btn.style.background = "#047857"; };
      btn.onmouseout = function () { btn.style.background = "#059669"; };

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var prodId = container.getAttribute("data-product-id") ||
          (document.querySelector('meta[property="og:product:id"]') && document.querySelector('meta[property="og:product:id"]').getAttribute("content")) ||
          "e0000000-0000-0000-0000-000000000001";
        openWidget(prodId);
      });

      container.appendChild(btn);
    }
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInjectButton);
  } else {
    autoInjectButton();
  }

  // Public SDK API
  window.NegoZaar = {
    open: openWidget,
    close: closeWidget,
    version: "1.0.0",
  };
})(window, document);
