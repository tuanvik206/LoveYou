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
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
);

export async function GET(req: NextRequest) {
  try {
    // 1. Verify cron job trigger (auth via Vercel CRON_SECRET)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    // Nếu có CRON_SECRET trong env, tiến hành verify để không ai call lụi được
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch toàn bộ subscription từ database
    // Đây là thông báo broadcast (tất cả mọi người dùng)
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("love_code, user_name, subscription");

    if (error) {
      console.error("Cron fetch error:", error);
      return NextResponse.json({ error: "DB Error" }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, message: "No active subscriptions" });
    }

    // 3. Chuẩn bị payload Push
    // Lời chúc chung cho tất cả các cặp đôi
    const payload = JSON.stringify({
      title: "Đã khuya rồi 🌙",
      body: "Chúc em/anh ngủ ngon và có những giấc mơ thật đẹp nhé! ❤️",
      url: "/",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
    });

    // 4. Gửi hàng loạt
    const results = await Promise.allSettled(
      subs.map((row) => webpush.sendNotification(row.subscription as any, payload)),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    // 5. Cleanup Database (xoá subs đã bị block/không còn dùng)
    Promise.resolve().then(async () => {
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "rejected") {
          const err = result.reason as { statusCode?: number };
          // 410 Gone / 404 Not Found => endpoint đã bị thu hồi bởi user
          if (err?.statusCode === 410 || err?.statusCode === 404) {
             const sub = subs[i].subscription as { endpoint?: string };
             if (sub?.endpoint) {
                await supabase
                  .from("push_subscriptions")
                  .delete()
                  .filter("subscription->endpoint", "eq", sub.endpoint);
             }
          }
        }
      }
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      sent,
      failed,
      message: `Sent goodnight to ${sent} devices at 22:00.`,
    });
    
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
