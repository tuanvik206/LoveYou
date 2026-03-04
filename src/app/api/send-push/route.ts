import webpush from "web-push";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_CONTACT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { love_code, sender_name, title, body, url } = await req.json();

    if (!love_code || !sender_name || !title) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Lấy subscription của người nhận (không phải người gửi)
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("love_code", love_code)
      .neq("user_name", sender_name);

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
    const failed = results.filter((r) => r.status === "rejected").length;

    // Nếu subscription hết hạn (410 Gone) → xóa khỏi DB
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "rejected") {
        const err = result.reason as { statusCode?: number };
        if (err?.statusCode === 410) {
          const sub = subs[i].subscription as { endpoint?: string };
          if (sub?.endpoint) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("love_code", love_code)
              .eq("subscription->>endpoint", sub.endpoint);
          }
        }
      }
    }

    return NextResponse.json({ sent, failed });
  } catch (err) {
    console.error("[send-push]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
