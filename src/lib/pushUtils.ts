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
      headers: { "Content-Type": "application/json" },
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
