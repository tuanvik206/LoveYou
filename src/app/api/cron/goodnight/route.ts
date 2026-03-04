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

    // 2. Lấy dữ liệu cặp đôi để xác định giới tính (user1 = Nam, user2 = Nữ)
    const { data: couples, error: couplesErr } = await supabase
      .from("couples")
      .select("code, user1_name, user2_name");

    if (couplesErr) throw couplesErr;

    // 3. Lấy dữ liệu Push Subscription
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("love_code, user_name, subscription");

    if (subsErr) throw subsErr;

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, message: "No active subscriptions" });
    }

    // Tạo Map để tra cứu nhanh cặp đôi theo code
    const couplesMap = new Map(couples?.map(c => [c.code, c]));

    // 4. Gửi hàng loạt với nội dung cá nhân hoá do Role
    const results = await Promise.allSettled(
      subs.map((row) => {
        const couple = couplesMap.get(row.love_code);
        
        // Mặc định xưng hô (fallback)
        let pronoun = "em/anh"; 
        
        // Match tên để xác định Nam/Nữ
        if (couple) {
          if (row.user_name === couple.user1_name) {
             pronoun = "anh"; // user1 = Nam
          } else if (row.user_name === couple.user2_name) {
             pronoun = "em"; // user2 = Nữ
          }
        }

        const payload = JSON.stringify({
          title: "Đã khuya rồi 🌙",
          body: `Chúc ${pronoun} ngủ ngon và có những giấc mơ thật đẹp nhé! ❤️`,
          url: "/",
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
        });

        return webpush.sendNotification(row.subscription as any, payload);
      })
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
