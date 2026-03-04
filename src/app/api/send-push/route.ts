import webpush from "web-push";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_CONTACT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// Dùng service_role key để bypass RLS — đây là server-side route, an toàn
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
);

// In-memory subscription cache (per serverless instance, TTL 10 min)
// Giảm DB roundtrip từ ~150ms xuống 0ms khi cùng instance còn "warm"
const subCache = new Map<string, { subs: any[]; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 phút

async function getSubscriptions(love_code: string, sender_name: string) {
  const key = `${love_code}:${sender_name}`;
  const cached = subCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.subs;

  const { data } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("love_code", love_code)
    .neq("user_name", sender_name);

  const subs = data ?? [];
  subCache.set(key, { subs, ts: Date.now() });
  return subs;
}

function invalidateCache(love_code: string) {
  for (const key of subCache.keys()) {
    if (key.startsWith(love_code)) subCache.delete(key);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth guard: verify internal secret để tránh spam từ bên ngoài
    const pushSecret = process.env.PUSH_SECRET;
    if (pushSecret) {
      const reqSecret = req.headers.get("x-push-secret");
      if (reqSecret !== pushSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { love_code, sender_name, title, body, url } = await req.json();

    if (!love_code || !sender_name || !title) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const subs = await getSubscriptions(love_code, sender_name);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, message: "No subscriptions found" });
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      url: url || "/",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
    });

    const results = await Promise.allSettled(
      subs.map((row) => webpush.sendNotification(row.subscription, payload)),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;

    // Xử lý subscription hết hạn (410) trong nền — không block response
    Promise.resolve().then(async () => {
      let needInvalidate = false;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "rejected") {
          const err = result.reason as { statusCode?: number };
          if (err?.statusCode === 410) {
            needInvalidate = true;
            const sub = subs[i].subscription as { endpoint?: string };
            if (sub?.endpoint) {
              await supabase
                .from("push_subscriptions")
                .delete()
                .eq("love_code", love_code)
                .filter("subscription->endpoint", "eq", sub.endpoint);
            }
          }
        }
      }
      if (needInvalidate) invalidateCache(love_code);
    });

    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[send-push]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
