"use client";
import { ALL_MILESTONES } from "@/constants/milestones";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
});
import {
  Heart,
  CheckCircle2,
  ChevronRight,
  CalendarHeart,
  Quote,
  Settings,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { calculateAge, getZodiacSign } from "@/lib/utils";
import dayjs from "dayjs";
import { useNotification } from "@/hooks/useNotification";
import { useStreak } from "@/hooks/useStreak";
import { sendPushToPartner } from "@/lib/pushUtils";

const MOODS = [
  {
    emoji: "😍",
    label: "Hạnh phúc",
    color: "bg-love-100/80 text-love-600 border-love-200",
  },
  {
    emoji: "🥰",
    label: "Yêu thương",
    color: "bg-pink-50/80 text-pink-600 border-pink-200",
  },
  {
    emoji: "🙂",
    label: "Bình thường",
    color: "bg-blue-50/80 text-blue-600 border-blue-100",
  },
  {
    emoji: "😌",
    label: "Bình yên",
    color: "bg-emerald-50/80 text-emerald-600 border-emerald-200",
  },
  {
    emoji: "😔",
    label: "Buồn",
    color: "bg-indigo-50/80 text-indigo-500 border-indigo-100",
  },
  {
    emoji: "😡",
    label: "Cáu",
    color: "bg-orange-50/80 text-orange-500 border-orange-100",
  },
];

const CUSTOM_MOOD_COLOR = "bg-purple-50/80 text-purple-600 border-purple-200";

function parseMood(label: string | null | undefined): (typeof MOODS)[0] {
  if (!label) return MOODS[0];
  const found = MOODS.find((m) => m.label === label);
  if (found) return found;
  // Custom emoji: label IS the emoji itself
  return { emoji: label, label, color: CUSTOM_MOOD_COLOR };
}

const DAILY_QUOTES = [
  "Cảm ơn vì đã đến và làm thế giới của anh/em rực rỡ hơn.",
  "Mỗi ngày bên nhau là một ngày hạnh phúc.",
  "Khoảng cách không là gì nếu chúng ta cùng nhìn về một hướng.",
  "Yêu thương là không ngừng cố gắng vì nhau.",
  "Anh/em là món quà tuyệt vời nhất mà cuộc sống ban tặng.",
  "Hãy cùng nhau tạo nên thật nhiều kỷ niệm đẹp nhé!",
  "Nụ cười của anh/em là điều đẹp nhất anh/em từng thấy.",
  "Có anh/em, mọi ngày đều trở nên đáng sống hơn.",
  "Tình yêu không phải là nhìn nhau, mà cùng nhau nhìn về một hướng.",
  "Hạnh phúc không phải ở đâu xa — chính là khoảnh khắc này, bên nhau.",
  "Anh/em yêu em/anh không vì em/anh hoàn hảo, mà vì em/anh hoàn hảo với anh/em.",
  "Mỗi tin nhắn, mỗi cái ôm, mỗi khoảnh khắc — đều là kỷ niệm anh/em muốn giữ mãi.",
  "Bên anh/em, anh/em không cần phải trở thành ai khác.",
  "Những ngày bình thường bên anh/em còn đẹp hơn những ngày đặc biệt một mình.",
  "Cứ mãi yêu nhau thật nhiều nhé 💕",
  "Giữ lấy tay nhau, dù đường có xa đến đâu.",
  "Anh/em chọn mỉm cười mỗi ngày — vì có anh/em ở đây.",
  "Tình yêu là khi anh/em muốn chia sẻ mọi điều nhỏ nhặt nhất với anh/em.",
  "Kỷ niệm đẹp nhất không mua được — chỉ được tạo ra cùng nhau.",
  "Anh/em không cần cả thế giới khi đã có anh/em.",
  "Mỗi buổi sáng thức dậy, nghĩ đến anh/em là đủ để mỉm cười rồi.",
];

// Tách riêng component đồng hồ — chỉ component này re-render mỗi giây, không lây lan sang parent
function ExactTimeDisplay({ startDate }: { startDate: string }) {
  const [t, setT] = useState({
    years: 0,
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  useEffect(() => {
    const calc = () => {
      const start = new Date(startDate);
      const now = new Date();
      let y = now.getFullYear() - start.getFullYear();
      let mo = now.getMonth() - start.getMonth();
      let d = now.getDate() - start.getDate();
      if (d < 0) {
        mo -= 1;
        d += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      }
      if (mo < 0) {
        y -= 1;
        mo += 12;
      }
      let h = now.getHours() - start.getHours();
      let min = now.getMinutes() - start.getMinutes();
      let sec = now.getSeconds() - start.getSeconds();
      if (sec < 0) {
        sec += 60;
        min -= 1;
      }
      if (min < 0) {
        min += 60;
        h -= 1;
      }
      if (h < 0) {
        h += 24;
        d -= 1;
      }
      if (d < 0) {
        mo -= 1;
        d += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      }
      if (mo < 0) {
        y -= 1;
        mo += 12;
      }
      setT({
        years: Math.max(0, y),
        months: Math.max(0, mo),
        days: Math.max(0, d),
        hours: Math.max(0, h),
        minutes: Math.max(0, min),
        seconds: Math.max(0, sec),
      });
    };
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [startDate]);

  if (!t.years && !t.months && !t.days && !t.hours && !t.minutes && !t.seconds)
    return null;
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-rose-100/60">
      <div className="flex items-center gap-2 mb-3">
        <CalendarHeart className="w-4 h-4 text-rose-400 shrink-0" />
        <h2 className="text-sm font-bold text-gray-700">Thời gian bên nhau</h2>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {[
          {
            value: t.years,
            label: "Năm",
            bg: "bg-rose-50",
            border: "border-rose-100",
            text: "text-rose-500",
            sub: "text-rose-400",
          },
          {
            value: t.months,
            label: "Tháng",
            bg: "bg-pink-50",
            border: "border-pink-100",
            text: "text-pink-500",
            sub: "text-pink-400",
          },
          {
            value: t.days,
            label: "Ngày",
            bg: "bg-purple-50",
            border: "border-purple-100",
            text: "text-purple-500",
            sub: "text-purple-400",
          },
          {
            value: t.hours,
            label: "Giờ",
            bg: "bg-orange-50",
            border: "border-orange-100",
            text: "text-orange-500",
            sub: "text-orange-400",
          },
          {
            value: t.minutes,
            label: "Phút",
            bg: "bg-amber-50",
            border: "border-amber-100",
            text: "text-amber-500",
            sub: "text-amber-400",
          },
          {
            value: t.seconds,
            label: "Giây",
            bg: "bg-sky-50",
            border: "border-sky-100",
            text: "text-sky-500",
            sub: "text-sky-400",
          },
        ].map(({ value, label, bg, border, text, sub }) => (
          <div
            key={label}
            className={`flex flex-col items-center py-2 ${bg} rounded-xl ${border} border`}
          >
            <span className={`text-base font-black ${text} tabular-nums`}>
              {String(value).padStart(2, "0")}
            </span>
            <span
              className={`text-[9px] font-bold ${sub} uppercase tracking-wide`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const {
    user,
    partner,
    startDate,
    loveCode,
    role,
    myBirthdate,
    partnerBirthdate,
    myGender,
    partnerGender,
    setUser,
    setPartner,
    setStartDate,
  } = useStore();
  const { requestPermission, showNotification } = useNotification();
  const [isMounted, setIsMounted] = useState(false);
  const [myMood, setMyMood] = useState(MOODS[0]);
  const [partnerMood, setPartnerMood] = useState(MOODS[0]);
  const [days, setDays] = useState(0);

  // Memoize expensive calculations
  const myAge = useMemo(() => calculateAge(myBirthdate), [myBirthdate]);
  const partnerAge = useMemo(
    () => calculateAge(partnerBirthdate),
    [partnerBirthdate],
  );
  const myZodiac = useMemo(() => getZodiacSign(myBirthdate), [myBirthdate]);
  const partnerZodiac = useMemo(
    () => getZodiacSign(partnerBirthdate),
    [partnerBirthdate],
  );

  const { sharedStreak } = useStreak(
    loveCode,
    user?.name ?? null,
    partner?.name ?? null,
  );

  // Chỉ hiển thị các cột mốc gần nhất — 3 đã đạt gần nhất + 7 sắp tới (tối đa 10 item)
  const visibleMilestones = useMemo(() => {
    const achieved = ALL_MILESTONES.filter((m) => days >= m.days);
    const upcoming = ALL_MILESTONES.filter((m) => days < m.days);
    return [...achieved.slice(-3), ...upcoming.slice(0, 7)];
  }, [days]);

  const [quoteOfDay, setQuoteOfDay] = useState(DAILY_QUOTES[0]);

  const resolvedQuote = useMemo(() => {
    if (!myGender) return quoteOfDay;
    const self = myGender === "male" ? "anh" : "em";
    const partner = myGender === "male" ? "em" : "anh";
    return quoteOfDay
      .replace(/anh\/em/gi, self)
      .replace(/em\/anh/gi, partner);
  }, [quoteOfDay, myGender]);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStreakTooltip, setShowStreakTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const streakBtnRef = useRef<HTMLButtonElement>(null);

  // Thinking-of-you nudge
  const userNameRef = useRef<string | null>(null);
  userNameRef.current = user?.name ?? null;
  const [nudgeSending, setNudgeSending] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [partnerNudgeAt, setPartnerNudgeAt] = useState<string | null>(null);
  const [showNudgeBanner, setShowNudgeBanner] = useState(false);
  const nudgeBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Birthday notification
  useEffect(() => {
    if (!isMounted || !partnerBirthdate || !partner) return;
    requestPermission().then((granted) => {
      if (!granted) return;
      const today = dayjs();
      const birth = dayjs(partnerBirthdate);
      if (!birth.isValid()) return;
      if (birth.month() === today.month() && birth.date() === today.date()) {
        const key = `bd-notif-${today.format("YYYY-MM-DD")}`;
        if (!localStorage.getItem(key)) {
          showNotification(
            `🎂 Sinh nhật ${partner.name}!`,
            `Hôm nay là sinh nhật của ${partner.name} 💕`,
          );
          localStorage.setItem(key, "1");
        }
      }
    });
  }, [
    isMounted,
    partnerBirthdate,
    partner,
    requestPermission,
    showNotification,
  ]);

  // Milestone reminders — notify 3, 2, 1 days before and on the day
  useEffect(() => {
    if (!isMounted || !days) return;
    requestPermission().then((granted) => {
      if (!granted) return;
      const today = dayjs().format("YYYY-MM-DD");
      for (const milestone of ALL_MILESTONES) {
        const diff = milestone.days - days;
        if (diff === 0) {
          const key = `ms-today-${milestone.days}-${today}`;
          if (!localStorage.getItem(key)) {
            showNotification(
              `🎉 Hôm nay là kỷ niệm ${milestone.label}!`,
              `${milestone.desc} — Chúc mừng hai bạn! 🥂`,
            );
            localStorage.setItem(key, "1");
          }
        } else if (diff > 0 && diff <= 3) {
          const key = `ms-upcoming-${milestone.days}-${today}`;
          if (!localStorage.getItem(key)) {
            showNotification(
              `💝 Còn ${diff} ngày nữa là kỷ niệm ${milestone.label}!`,
              `Hãy chuẩn bị điều gì đó đặc biệt nhé 🎁`,
            );
            localStorage.setItem(key, "1");
          }
        }
      }
    });
  }, [isMounted, days, requestPermission, showNotification]);

  useEffect(() => {
    if (isMounted && (!user || !partner)) {
      router.push("/onboarding");
    }
  }, [isMounted, user, partner, router]);

  useEffect(() => {
    if (!startDate) return;

    // Compute initial days count
    const start = new Date(startDate);
    const now = new Date();
    const diff = Math.floor(
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    setDays(diff >= 0 ? diff : 0);

    // Daily quote
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
        1000 /
        60 /
        60 /
        24,
    );
    setQuoteOfDay(DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]);
  }, [startDate]);

  useEffect(() => {
    if (!isMounted || !loveCode || !role) return;

    // Fetch initial moods + last nudge
    const fetchMoods = async () => {
      const { data } = await supabase
        .from("couples")
        .select("user1_mood, user2_mood, last_nudge_at, last_nudge_by")
        .eq("code", loveCode)
        .single();
      if (data) {
        if (role === "user1") {
          if (data.user1_mood) setMyMood(parseMood(data.user1_mood));
          if (data.user2_mood) setPartnerMood(parseMood(data.user2_mood));
        } else {
          if (data.user2_mood) setMyMood(parseMood(data.user2_mood));
          if (data.user1_mood) setPartnerMood(parseMood(data.user1_mood));
        }
        // Show last nudge from partner (not from self)
        if (
          data.last_nudge_at &&
          data.last_nudge_by &&
          data.last_nudge_by !== userNameRef.current
        ) {
          setPartnerNudgeAt(data.last_nudge_at);
        }
      }
    };
    fetchMoods();

    // Subscribe to realtime updates with status tracking
    const channel = supabase
      .channel(`home_${loveCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "couples",
          filter: `code=eq.${loveCode}`,
        },
        (payload) => {
          const newRecord = payload.new as any;
          if (!newRecord) return;
          // Check data property key thay vì check truthy value (payload có thể trả về null cho fields chưa set)
          if (role === "user1" && "user2_mood" in newRecord) {
            const m = newRecord.user2_mood;
            setPartnerMood(parseMood(m));
          } else if (role === "user2" && "user1_mood" in newRecord) {
            const m = newRecord.user1_mood;
            setPartnerMood(parseMood(m));
          }

          // Nhận nudge "đang nghĩ đến em/anh" từ đối phương
          if (
            "last_nudge_at" in newRecord &&
            newRecord.last_nudge_at &&
            newRecord.last_nudge_by &&
            newRecord.last_nudge_by !== userNameRef.current
          ) {
            setPartnerNudgeAt(newRecord.last_nudge_at);
            setShowNudgeBanner(true);
            if (nudgeBannerTimerRef.current)
              clearTimeout(nudgeBannerTimerRef.current);
            nudgeBannerTimerRef.current = setTimeout(
              () => setShowNudgeBanner(false),
              5000,
            );
            // Push notification (nếu app đang background)
            showNotification(
              `💓 ${newRecord.last_nudge_by} đang nghĩ đến bạn!`,
              "Một cái ôm từ xa 🤗",
            );
          }

          // Đồng bộ Tên, Ảnh, và Ngày bắt đầu yêu
          if (newRecord.start_date) setStartDate(newRecord.start_date);

          if (role === "user1") {
            if (newRecord.user1) setUser(newRecord.user1);
            if (newRecord.user2) setPartner(newRecord.user2);
          } else {
            if (newRecord.user2) setUser(newRecord.user2);
            if (newRecord.user1) setPartner(newRecord.user1);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (nudgeBannerTimerRef.current)
        clearTimeout(nudgeBannerTimerRef.current);
    };
  }, [isMounted, loveCode, role, showNotification]);

  // Tự động cập nhật bộ đếm ngày khi qua nửa đêm
  useEffect(() => {
    if (!startDate) return;

    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );
      return setTimeout(() => {
        const start = new Date(startDate);
        const n = new Date();
        const diff = Math.floor(
          (n.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        );
        setDays(diff >= 0 ? diff : 0);
        // Reschedule for next midnight
        timerId = scheduleNext();
      }, midnight.getTime() - now.getTime());
    };

    let timerId = scheduleNext();
    return () => clearTimeout(timerId);
  }, [startDate]);

  const handleMoodChange = async (mood: (typeof MOODS)[0]) => {
    setMyMood(mood);
    if (!loveCode || !role) return;

    // Update Supabase
    const updateField =
      role === "user1"
        ? { user1_mood: mood.label }
        : { user2_mood: mood.label };
    await supabase.from("couples").update(updateField).eq("code", loveCode);
  };

  const handleNudge = async () => {
    if (!loveCode || !user || nudgeSending || nudgeSent) return;
    setNudgeSending(true);
    await supabase
      .from("couples")
      .update({
        last_nudge_at: new Date().toISOString(),
        last_nudge_by: user.name,
      })
      .eq("code", loveCode);
    // Gửi Web Push nền — không cần app mở
    sendPushToPartner(
      loveCode,
      user.name,
      `💓 ${user.name} đang nghĩ đến bạn!`,
      "Một cái ôm từ xa 🤗",
      "/",
    );
    setNudgeSending(false);
    setNudgeSent(true);
    setTimeout(() => setNudgeSent(false), 3000);
  };

  const handleEmojiSelect = async (emojiData: any) => {
    const customMood = {
      emoji: emojiData.emoji,
      label: emojiData.emoji, // Dùng emoji làm label luôn
      color: "bg-purple-50/80 text-purple-600 border-purple-200",
    };

    setMyMood(customMood);
    setShowEmojiPicker(false);

    if (!loveCode || !role) return;

    // Update Supabase
    const updateField =
      role === "user1"
        ? { user1_mood: customMood.label }
        : { user2_mood: customMood.label };
    await supabase.from("couples").update(updateField).eq("code", loveCode);
  };

  if (!isMounted || !user || !partner) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 pb-32 overflow-x-hidden">
      {/* Header / Avatars */}
      <section
        className="relative w-full px-3 sm:px-4 md:px-8 pt-4 pb-8 overflow-hidden"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-rose-100/60 via-pink-50/40 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-200/60 to-transparent" />
        <div className="absolute top-[-80px] left-[-80px] w-80 h-80 bg-rose-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-purple-300/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-pink-200/20 rounded-full blur-2xl pointer-events-none" />

        {/* Settings Button — top-right inline bar, above avatars */}
        <div className="relative z-10 flex justify-end mb-2">
          <button
            onClick={() => router.push("/settings")}
            className="w-8 h-8 bg-white/60 hover:bg-white backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-white/50 text-rose-300 hover:text-rose-500 transition-all"
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>

        <div className="flex items-start justify-between relative z-10 max-w-2xl mx-auto mt-2">
          {/* My avatar */}
          <motion.div
            initial={false}
            className="flex flex-col items-center gap-0.5 w-[30%]"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-300 to-pink-400 blur-md opacity-40 scale-110" />
              <div className="relative p-[3px] rounded-full bg-gradient-to-br from-rose-400 to-pink-500 shadow-lg shadow-rose-200/60">
                <img
                  src={user.avatar}
                  alt={user.name}
                  decoding="async"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white object-cover block"
                />
              </div>
              <motion.button
                key={myMood.emoji}
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 sm:w-9 sm:h-9 bg-white rounded-full shadow-md flex items-center justify-center text-base sm:text-xl z-20 border-2 border-rose-100 active:scale-90 transition-transform"
              >
                {myMood.emoji}
              </motion.button>
            </div>
            <span className="text-xs sm:text-sm font-bold mt-2.5 text-gray-700 truncate max-w-full px-1 text-center">
              {user.name}
            </span>
            {(myAge !== null || myZodiac) && (
              <div className="flex flex-col items-center gap-1 mt-0.5 w-full px-1">
                {myAge !== null && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${
                      myGender === "male"
                        ? "bg-blue-100 text-blue-600"
                        : myGender === "female"
                          ? "bg-pink-100 text-pink-600"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {myGender === "male" && <span>♂</span>}
                    {myGender === "female" && <span>♀</span>}
                    {myAge}
                  </span>
                )}
                {myZodiac && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 text-center leading-tight max-w-full">
                    {myZodiac.emoji}{" "}
                    <span className="truncate">{myZodiac.name}</span>
                  </span>
                )}
              </div>
            )}
          </motion.div>

          {/* Center - Days counter */}
          <div className="flex flex-col items-center gap-0.5 w-[40%]">
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{
                repeat: Infinity,
                duration: 2.2,
                ease: "easeInOut",
              }}
              className="relative mb-0.5"
            >
              <div className="absolute inset-0 bg-rose-400 rounded-full blur-lg opacity-40 animate-pulse" />
              <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-rose-500 fill-rose-500 relative z-10 drop-shadow-md" />
            </motion.div>
            <span className="text-[9px] sm:text-[10px] text-rose-400 uppercase tracking-[0.2em] font-bold">
              Đã yêu
            </span>
            <p
              className="text-4xl sm:text-5xl font-black text-rose-500 leading-none drop-shadow-sm"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {days}
            </p>
            <span className="text-[9px] sm:text-[10px] text-rose-400 uppercase tracking-widest font-bold">
              Ngày
            </span>
            {sharedStreak > 0 && (
              <div className="relative mt-8">
                <button
                  ref={streakBtnRef}
                  onClick={() => {
                    if (streakBtnRef.current) {
                      const r = streakBtnRef.current.getBoundingClientRect();
                      setTooltipPos({
                        top: r.bottom + 10,
                        left: r.left + r.width / 2,
                      });
                    }
                    setShowStreakTooltip((v) => !v);
                  }}
                  className="flex items-center gap-1 active:scale-90 transition-transform"
                >
                  <span className="text-base leading-none">🔥</span>
                  <span className="text-sm font-black text-orange-500 tabular-nums leading-none">
                    {sharedStreak}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Partner avatar */}
          <motion.div
            initial={false}
            className="flex flex-col items-center gap-0.5 w-[30%]"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-300 to-pink-400 blur-md opacity-40 scale-110" />
              <div className="relative p-[3px] rounded-full bg-gradient-to-br from-purple-400 to-pink-500 shadow-lg shadow-purple-200/60">
                <img
                  src={partner.avatar}
                  alt={partner.name}
                  decoding="async"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white object-cover block"
                />
              </div>
              <AnimatePresence>
                <motion.div
                  key={partnerMood.emoji}
                  initial={{ scale: 0, rotate: 20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="absolute -bottom-1.5 -left-1.5 w-7 h-7 sm:w-9 sm:h-9 bg-white rounded-full shadow-md flex items-center justify-center text-base sm:text-xl z-20 border-2 border-purple-100"
                >
                  {partnerMood.emoji}
                </motion.div>
              </AnimatePresence>
            </div>
            <span className="text-xs sm:text-sm font-bold mt-2.5 text-gray-700 truncate max-w-full px-1 text-center">
              {partner.name}
            </span>
            {(partnerAge !== null || partnerZodiac) && (
              <div className="flex flex-col items-center gap-1 mt-0.5 w-full px-1">
                {partnerAge !== null && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${
                      partnerGender === "male"
                        ? "bg-blue-100 text-blue-600"
                        : partnerGender === "female"
                          ? "bg-pink-100 text-pink-600"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {partnerGender === "male" && <span>♂</span>}
                    {partnerGender === "female" && <span>♀</span>}
                    {partnerAge}
                  </span>
                )}
                {partnerZodiac && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 text-center leading-tight max-w-full">
                    {partnerZodiac.emoji}{" "}
                    <span className="truncate">{partnerZodiac.name}</span>
                  </span>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 md:px-6 mt-3 pb-2 flex flex-col gap-3">
        {/* Time countdown — isolated component, re-renders every second without affecting parent */}
        {startDate && <ExactTimeDisplay startDate={startDate} />}

        {/* Thinking of You */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-rose-100/60 overflow-hidden">
          {/* Banner khi đối phương gửi nudge */}
          <AnimatePresence>
            {showNudgeBanner && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="overflow-hidden"
              >
                <div className="bg-gradient-to-r from-rose-400 to-pink-500 px-4 py-2.5 flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                    className="text-lg leading-none"
                  >
                    💓
                  </motion.span>
                  <p className="text-sm font-bold text-white">
                    {partner.name} đang nghĩ đến bạn!
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-bold text-gray-700">
                  Đang nghĩ đến nhau 💓
                </p>
                {partnerNudgeAt && !showNudgeBanner && (
                  <p className="text-[11px] text-rose-400 font-medium">
                    {partner.name} nhắn lúc{" "}
                    {dayjs(partnerNudgeAt).format("HH:mm DD/MM")}
                  </p>
                )}
                {!partnerNudgeAt && (
                  <p className="text-[11px] text-gray-400">
                    Chạm nút để nhắn {partner.name}
                  </p>
                )}
              </div>

              {/* Nút gửi nudge */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleNudge}
                disabled={nudgeSent || nudgeSending}
                className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all disabled:opacity-80"
                style={{
                  background: nudgeSent
                    ? "linear-gradient(135deg, #34d399, #059669)"
                    : "linear-gradient(135deg, #fb7185, #ec4899)",
                }}
              >
                {/* Ripple khi đang gửi */}
                {nudgeSending && (
                  <motion.span
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-rose-400"
                  />
                )}
                <motion.span
                  animate={nudgeSent ? {} : { scale: [1, 1.18, 1] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.8,
                    ease: "easeInOut",
                  }}
                  className="text-2xl leading-none z-10"
                >
                  {nudgeSent ? "💕" : "💓"}
                </motion.span>
              </motion.button>
            </div>

            {nudgeSent && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-emerald-500 font-semibold text-right mt-1.5"
              >
                Đã gửi đến {partner.name} 💕
              </motion.p>
            )}
          </div>
        </div>

        {/* Daily Quote */}
        <div className="relative overflow-hidden rounded-2xl p-4 shadow-md">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-400 via-pink-500 to-purple-500" />
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -left-3 -bottom-3 w-20 h-20 bg-purple-600/20 rounded-full blur-xl" />
          <div className="relative z-10 flex items-start gap-2">
            <Quote className="w-4 h-4 text-white/50 shrink-0 mt-0.5" />
            <p className="font-medium text-sm text-white leading-relaxed">
              "{resolvedQuote}"
            </p>
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-rose-100/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <CalendarHeart className="w-4 h-4 text-rose-400 shrink-0" /> Cột
              mốc
            </h2>
            <button
              onClick={() => router.push("/milestones")}
              className="text-xs font-semibold text-rose-400 flex items-center hover:text-rose-500 transition-colors"
            >
              Tất cả <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 snap-x snap-mandatory">
            {visibleMilestones.map((milestone) => {
              const isAchieved = days >= milestone.days;
              const Icon = milestone.icon;
              const progress = Math.min((days / milestone.days) * 100, 100);
              return (
                <div
                  key={milestone.days}
                  className={`min-w-[88px] rounded-xl p-2.5 snap-center relative overflow-hidden flex flex-col items-center text-center flex-shrink-0 transition-all ${
                    isAchieved
                      ? "bg-gradient-to-b from-rose-50 to-pink-50 border border-rose-100 shadow-sm"
                      : "bg-gray-50 border border-gray-100"
                  }`}
                >
                  {isAchieved && (
                    <div className="absolute top-1.5 right-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                  )}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center mb-1.5 ${isAchieved ? milestone.colors : "bg-white"}`}
                  >
                    <Icon
                      className={`w-4 h-4 ${isAchieved ? milestone.iconColor : "text-gray-200"}`}
                    />
                  </div>
                  <h3
                    className={`font-bold text-[10px] leading-tight ${isAchieved ? "text-rose-600" : "text-gray-300"}`}
                  >
                    {milestone.label}
                  </h3>
                  <p className="text-[9px] text-gray-400 mt-0.5 font-medium truncate">
                    {milestone.desc}
                  </p>
                  {!isAchieved && (
                    <div className="w-full h-1 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-300 to-pink-400 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Emoji Picker Overlay - fixed at root to escape overflow-hidden */}
      {showEmojiPicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowEmojiPicker(false)}
          />
          <div className="fixed bottom-28 left-4 z-50 shadow-2xl rounded-2xl overflow-hidden">
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="absolute top-2 right-2 z-10 w-6 h-6 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md"
              >
                <X className="w-4 h-4 text-foreground/60" />
              </button>
              <EmojiPicker
                onEmojiClick={handleEmojiSelect}
                width={320}
                height={380}
              />
            </div>
          </div>
        </>
      )}

      {/* Streak Tooltip - fixed at root to escape overflow-hidden */}
      <AnimatePresence>
        {showStreakTooltip && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowStreakTooltip(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -8 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              style={{ top: tooltipPos.top, left: tooltipPos.left }}
              className="fixed z-50 -translate-x-1/2 w-56 bg-white rounded-2xl shadow-2xl border border-orange-100 p-4 text-center"
            >
              {/* Mũi tên trỏ lên badge */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-orange-100 rotate-45" />
              <div className="text-4xl mb-1">🔥</div>
              <p className="text-xl font-black text-orange-500 leading-none">
                {sharedStreak} ngày
              </p>
              <p className="text-[12px] font-semibold text-gray-500 mt-1.5 leading-snug">
                Cả hai cùng mở app{" "}
                <span className="text-orange-500 font-black">
                  {sharedStreak}
                </span>{" "}
                ngày liên tiếp 💕
              </p>

              <div className="my-2.5 border-t border-gray-100" />

              {(() => {
                const next = [3, 7, 14, 30, 50, 100, 200, 365].find(
                  (n) => n > sharedStreak,
                );
                return next ? (
                  <p className="text-[11px] text-gray-400 leading-snug">
                    Còn{" "}
                    <span className="font-black text-orange-400">
                      {next - sharedStreak}
                    </span>{" "}
                    ngày nữa để đạt mốc{" "}
                    <span className="font-black text-orange-400">
                      {next} ngày
                    </span>{" "}
                    🎯
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400">
                    Tuyệt vời! Không ngừng nhé 🏆
                  </p>
                );
              })()}

              <p className="text-[10px] text-gray-300 mt-2">
                Mở app mỗi ngày để duy trì chuỗi
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
