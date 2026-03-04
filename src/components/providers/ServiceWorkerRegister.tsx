"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Tự động cập nhật SW khi có phiên bản mới
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "activated" &&
                navigator.serviceWorker.controller
              ) {
                // SW mới đã kích hoạt, reload để dùng JS mới nhất
                window.location.reload();
              }
            });
          });
        })
        .catch(() => {});
    }
  }, []);

  return null;
}
