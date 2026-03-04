"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import dayjs from "dayjs";

export function useStreak(
  loveCode: string | null,
  userName: string | null,
  partnerName: string | null,
) {
  const [sharedStreak, setSharedStreak] = useState(0);
  // Giữ tham số ổn định trong ref để dùng bên trong callback
  const paramsRef = useRef({ loveCode, userName, partnerName });
  paramsRef.current = { loveCode, userName, partnerName };

  const fetchSharedStreak = useCallback(async (): Promise<number> => {
    const { loveCode, userName, partnerName } = paramsRef.current;
    if (!loveCode || !userName || !partnerName) return 0;

    const { data } = await supabase
      .from("daily_checkins")
      .select("checkin_date, user_name")
      .eq("code", loveCode)
      .gte("checkin_date", dayjs().subtract(60, "day").format("YYYY-MM-DD"));

    if (!data || data.length === 0) return 0;

    // Xây map: ngày → tập hợp những ai đã check-in
    const byDate = new Map<string, Set<string>>();
    for (const row of data) {
      if (!byDate.has(row.checkin_date))
        byDate.set(row.checkin_date, new Set());
      byDate.get(row.checkin_date)!.add(row.user_name);
    }

    // Đếm số ngày liên tiếp mà CẢ HAI đều check-in (tính ngược từ hôm nay)
    let streak = 0;
    let cursor = dayjs();
    while (true) {
      const dateKey = cursor.format("YYYY-MM-DD");
      const checkedIn = byDate.get(dateKey);
      if (checkedIn?.has(userName) && checkedIn?.has(partnerName)) {
        streak++;
        cursor = cursor.subtract(1, "day");
      } else {
        break;
      }
    }
    return streak;
  }, []);

  const checkIn = useCallback(async () => {
    const { loveCode, userName } = paramsRef.current;
    if (!loveCode || !userName) return;
    await supabase.from("daily_checkins").upsert(
      {
        code: loveCode,
        user_name: userName,
        checkin_date: dayjs().format("YYYY-MM-DD"),
      },
      { onConflict: "code,user_name,checkin_date" },
    );
  }, []);

  useEffect(() => {
    if (!loveCode || !userName || !partnerName) return;

    // Check-in và fetch lần đầu
    (async () => {
      await checkIn();
      const streak = await fetchSharedStreak();
      setSharedStreak(streak);
    })();

    // Realtime: khi partner check-in → refresh streak
    const channel = supabase
      .channel(`streak_${loveCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "daily_checkins",
          filter: `code=eq.${loveCode}`,
        },
        async (payload) => {
          const row = payload.new as { user_name: string };
          // Chỉ refresh khi là partner check-in (mình đã check-in rồi)
          if (row?.user_name !== paramsRef.current.userName) {
            const streak = await fetchSharedStreak();
            setSharedStreak(streak);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loveCode, userName, partnerName, checkIn, fetchSharedStreak]);

  return { sharedStreak };
}
