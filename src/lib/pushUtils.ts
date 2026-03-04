import { supabase } from "@/lib/supabase";

export async function subscribeToPush(
  loveCode: string,
  userName: string,
): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;

    // Chuyển VAPID public key từ base64url sang Uint8Array
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as ArrayBuffer,
    });

    // Lưu subscription vào Supabase (upsert theo love_code + user_name)
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        love_code: loveCode,
        user_name: userName,
        subscription: subscription.toJSON(),
      },
      { onConflict: "love_code,user_name" },
    );

    return !error;
  } catch {
    return false;
  }
}

/**
 * Refresh subscription silently mỗi lần app mở.
 * Không hỏi quyền — chỉ chạy khi đã có quyền.
 * Đảm bảo DB luôn lưu endpoint mới nhất (tránh subscription hết hạn).
 */
export async function refreshPushSubscription(
  loveCode: string,
  userName: string,
): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    // Nếu không có (bị browser xóa) → tạo mới
    if (!sub) {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as unknown as ArrayBuffer,
      });
    }

    // Luôn upsert để DB có endpoint mới nhất
    await supabase
      .from("push_subscriptions")
      .upsert(
        {
          love_code: loveCode,
          user_name: userName,
          subscription: sub.toJSON(),
        },
        { onConflict: "love_code,user_name" },
      );
  } catch {
    // silent
  }
}

export async function unsubscribeFromPush(
  loveCode: string,
  userName: string,
): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("love_code", loveCode)
      .eq("user_name", userName);
  } catch {
    // silent
  }
}

export async function sendPushToPartner(
  loveCode: string,
  senderName: string,
  title: string,
  body: string,
  url = "/",
): Promise<void> {
  try {
    // keepalive: true — request hoàn thành ngay cả khi navigate sang trang khác
    fetch("/api/send-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.NEXT_PUBLIC_PUSH_SECRET
          ? { "x-push-secret": process.env.NEXT_PUBLIC_PUSH_SECRET }
          : {}),
      },
      keepalive: true,
      body: JSON.stringify({
        love_code: loveCode,
        sender_name: senderName,
        title,
        body,
        url,
      }),
    }).catch(() => {});
  } catch {
    // silent
  }
}

// Convert base64url string to Uint8Array (required for applicationServerKey)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
