"use client";
import { useCallback } from "react";

export function useNotification() {
  const isSupported = typeof window !== "undefined" && "Notification" in window;

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, [isSupported]);

  const showNotification = useCallback(
    async (title: string, body: string, icon = "/icon-192x192.png") => {
      if (!isSupported || Notification.permission !== "granted") return;
      try {
        // Ưu tiên Service Worker — bắt buộc cho mobile PWA (Android/iOS)
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, { body, icon });
        } else {
          new Notification(title, { body, icon });
        }
      } catch {
        // Fallback: dùng Notification API trực tiếp nếu SW không khả dụng
        try {
          new Notification(title, { body, icon });
        } catch {
          // Silently fail
        }
      }
    },
    [isSupported],
  );

  return { isSupported, requestPermission, showNotification };
}
