// Polyfill crypto.randomUUID for non-secure (HTTP) dev contexts
if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function") {
  Object.defineProperty(crypto, "randomUUID", {
    value: () =>
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }),
  });
}

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import "./shared/graphics/alarmFlash.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Register the Rounds offline service worker.
// Only active in production builds or when explicitly opted-in via
// VITE_ENABLE_SW=true to avoid cache-related surprises during development.
if (
  "serviceWorker" in navigator &&
  (import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW === "true")
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[io] Service worker registration failed:", err);
    });
  });
}

// Prevent browser zoom. I/O is a fixed-layout HMI — browser zoom produces
// misaligned overlays, broken grid geometry, and clipped canvases.
// Ctrl+wheel and pinch-zoom are captured here; Ctrl++/−/0 keyboard shortcuts
// are also blocked. Browser UI zoom (address bar %) cannot be intercepted.
document.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener("keydown", (e) => {
  if (
    e.ctrlKey &&
    (e.key === "+" ||
      e.key === "=" ||
      e.key === "-" ||
      e.key === "_" ||
      e.key === "0")
  ) {
    e.preventDefault();
  }
});

// Prevent native browser drag-and-drop from hijacking pointer events.
// Clicking SVG text / any element and dragging fires dragstart, which cancels
// pointer capture and leaves marquee/selection handlers in a broken state.
// Elements that need real HTML5 DnD must set draggable="true" explicitly.
document.addEventListener("dragstart", (e) => {
  if (!(e.target as HTMLElement)?.closest?.('[draggable="true"]')) {
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
