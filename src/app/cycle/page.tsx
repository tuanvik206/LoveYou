"use client";

import { useEffect, useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";
import { Loader2, Droplet, Calendar as CalendarIcon, AlertCircle, Plus, Smile, Activity, HeartPulse, ChevronDown, ChevronUp } from "lucide-react";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import dynamic from "next/dynamic";
import type { CycleRecord } from "@/components/cycle/CycleCalendar";
import { AnimatePresence, motion } from "framer-motion";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";

dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const CycleCalendar = dynamic(() => import("@/components/cycle/CycleCalendar"), {
  ssr: false,
  loading: () => <div className="h-[400px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-rose-400"/></div>
});

export default function CyclePage() {
  const { user, partner, loveCode, myGender } = useStore();
  const [isMounted, setIsMounted] = useState(false);
  const [cycles, setCycles] = useState<CycleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [showCalendar, setShowCalendar] = useState(false);
  const { confirm, ConfirmNode } = useConfirm();
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !loveCode) return;
    const fetchCycles = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("menstrual_cycles")
        .select("*")
        .eq("code", loveCode)
        .order("start_date", { ascending: false });
      
      if (data) setCycles(data as CycleRecord[]);
      setLoading(false);
    };

    fetchCycles();

    // Realtime subscription
    const channel = supabase
      .channel(`cycles_${loveCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menstrual_cycles", filter: `code=eq.${loveCode}` },
        () => fetchCycles() // Refetch on any change to keep it simple, could optimize to update local state
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMounted, loveCode]);

  const activeCycle = useMemo(() => cycles.find((c) => !c.end_date), [cycles]);
  const latestCycle = useMemo(() => cycles[0], [cycles]);

  // Summary box calculations
  const summaryContent = useMemo(() => {
    if (!latestCycle) {
      return { 
        phase: "none",
        title: "Chưa có dữ liệu", 
        desc: "Bắt đầu ghi log kỳ kinh đầu tiên",
        color: "from-gray-100 to-gray-200",
        text: "text-gray-500"
      };
    }
    
    if (activeCycle) {
      const days = dayjs().diff(dayjs(activeCycle.start_date), "day") + 1;
      return { 
        phase: "period",
        title: "Kỳ kinh nguyệt", 
        prefix: "Ngày thứ",
        desc: `${days}`,
        subdesc: "Nhớ giữ ấm cơ thể nhé nạ 🥰",
        color: "from-rose-400 to-rose-500",
        text: "text-white",
        ring: "ring-rose-200"
      };
    }

    // Predict next based on historical averages
    const allCycles = useStore.getState().user ? cycles : [];
    const sortedCycles = [...allCycles].sort((a,b) => dayjs(b.start_date).diff(dayjs(a.start_date)));
    const completedCycles = sortedCycles.filter(c => c.end_date);
    const cyclesToAverage = completedCycles.length > 0 ? completedCycles.slice(0, 6) : [latestCycle];
    
    const avgCycleLen = Math.round(
      cyclesToAverage.reduce((acc, c) => acc + (c.cycle_length || 28), 0) / cyclesToAverage.length
    );
    const avgPeriodLen = Math.round(
      cyclesToAverage.reduce((acc, c) => acc + (c.period_length || 5), 0) / cyclesToAverage.length
    );

    const s = dayjs(latestCycle.start_date);
    
    // Calculate current cycle iteration
    const daysSinceLatest = dayjs().diff(s, "day");
    const currentCycleIterations = Math.max(0, Math.floor(daysSinceLatest / avgCycleLen));
    
    const currentStart = s.add(currentCycleIterations * avgCycleLen, "day");
    const nextStart = currentStart.add(avgCycleLen, "day");
    
    const dayOfCycle = dayjs().diff(currentStart, "day") + 1; // 1-indexed
    const ovulationDay = avgCycleLen - 14;
    const fertileStart = Math.max(1, ovulationDay - 5);
    const fertileEnd = Math.min(avgCycleLen, ovulationDay + 4); // Total 10 days

    // Check if period is late (only if we are beyond the average cycle length and no active period logged for today)
    // If iterations > 0, it means we've mathematically crossed into a new predicted cycle without a log.
    if (currentCycleIterations > 0 && !activeCycle) {
       const lateStartDate = s.add(avgCycleLen, "day");
       const lateDays = dayjs().diff(lateStartDate, "day");
       if (lateDays >= 0) {
         return { 
          phase: "late",
          title: "Có thể trễ kinh", 
          desc: `Trễ ${lateDays === 0 ? "1" : lateDays} ngày`,
          subdesc: "Thư giãn tinh thần nha nhỏ",
          color: "from-orange-300 to-orange-400",
          text: "text-white",
          ring: "ring-orange-100"
        };
       }
    }

    if (dayOfCycle === ovulationDay) {
      return { 
        phase: "ovulation",
        title: "Ngày rụng trứng", 
        prefix: "",
        desc: "Dễ thụ thai",
        subdesc: `Kỳ kinh tới sau ${nextStart.diff(dayjs(), "day")} ngày`,
        color: "from-purple-400 to-violet-500",
        text: "text-white",
        ring: "ring-purple-200"
      };
    } else if (dayOfCycle >= fertileStart && dayOfCycle <= fertileEnd) {
      return { 
        phase: "fertile",
        title: "Dễ thụ thai",
        prefix: "Còn", 
        desc: `${fertileEnd - dayOfCycle} ngày`,
        subdesc: `Kỳ kinh tới sau ${nextStart.diff(dayjs(), "day")} ngày`,
        color: "from-purple-300 to-purple-400",
        text: "text-white",
        ring: "ring-purple-100"
      };
    } else {
      const diffDays = nextStart.diff(dayjs(), "day");
      if (diffDays <= 3 && diffDays > 0) {
        return { 
          phase: "upcoming",
          title: "Sắp tới kỳ kinh", 
          prefix: "Còn",
          desc: `${diffDays} ngày`,
          subdesc: "Chuẩn bị đồ đạc sẵn sàng nhé!",
          color: "from-pink-300 to-rose-400",
          text: "text-white",
          ring: "ring-pink-100"
        };
      }
      return { 
        phase: "safe",
        title: "Ngày an toàn", 
        prefix: "Ngày thứ",
        desc: `${dayOfCycle}`,
        subdesc: `Kỳ kinh tới sau ${diffDays} ngày`,
        color: "from-emerald-300 to-teal-400",
        text: "text-white",
        ring: "ring-emerald-100"
      };
    }
  }, [activeCycle, latestCycle, cycles]); // Added cycles to deps to ensure historical averages re-calc

  // Compute the current week's dates
  const weekDates = useMemo(() => {
    // Start of week (Monday)
    const today = dayjs();
    const dayOfWeek = today.day() === 0 ? 6 : today.day() - 1; // 0 = Sunday -> 6, 1 = Monday -> 0
    const startOfWeek = today.subtract(dayOfWeek, "day");
    
    return Array.from({ length: 7 }).map((_, i) => startOfWeek.add(i, "day"));
  }, []);

  // Helper to determine indicator dot on weekly view
  const getWeeklyPhaseDot = (date: dayjs.Dayjs) => {
    // Highly simplified version of getDayState for the weekly strip
    for (const c of cycles) {
      if (!c.end_date && date.isSameOrAfter(dayjs(c.start_date), "day") && date.isSameOrBefore(dayjs(), "day")) return "bg-rose-500";
      if (c.end_date && date.isBetween(dayjs(c.start_date), dayjs(c.end_date), "day", "[]")) return "bg-rose-500";
    }
    // Very rudimentary prediction just for UX UI
    if (summaryContent.phase === "fertile" || summaryContent.phase === "ovulation") {
      const diff = date.diff(dayjs(), "day");
      if (diff >= 0 && diff <= 5) return "bg-purple-400"; // rough estimation
    }
    return "";
  };

  const handleLogStart = async (dateStr: string) => {
    if (!loveCode) return;
    const { data, error } = await supabase.from("menstrual_cycles").insert({
      code: loveCode,
      start_date: dateStr,
      cycle_length: 28, // Default
      period_length: 5, // Default
    }).select().single();

    if (error) {
      alert("Đã có lỗi xảy ra");
      return;
    }
  };

  const handleLogEnd = async (cycleId: string, dateStr: string) => {
    const { error } = await supabase
      .from("menstrual_cycles")
      .update({ end_date: dateStr })
      .eq("id", cycleId);
    
    if (error) alert("Đã có lỗi xảy ra");
  };

  if (!isMounted || !user || !partner) return null;

  // Nếu cả 2 đều là nam, tính năng này có thể không phù hợp
  if (myGender === "male" && useStore.getState().partnerGender === "male") {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-rose-50 px-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Tính năng chu kỳ</h2>
        <p className="text-gray-500">
          Tính năng này được thiết kế để theo dõi chu kỳ kinh nguyệt. Giới tính của cả hai dường như không phù hợp.
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#fdfbfb] pb-32">
      {/* Sticky Header with Weekly Strip */}
      <header
        className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-rose-100/50 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <div className="flex items-center justify-between px-5 mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
              <Droplet className="w-5 h-5 text-rose-500 shrink-0" fill="currentColor" opacity={0.15} /> 
              Sức khỏe chu kỳ
            </h1>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
              {activeCycle ? "Đang trong kỳ kinh" : "Lưu giữ nhịp đập cơ thể"}
            </p>
          </div>
          <button 
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 hover:bg-rose-100 transition-all shadow-sm active:scale-90"
          >
            <CalendarIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Weekly Slider Strip */}
        <div className="flex justify-between px-4">
          {weekDates.map((d, i) => {
            const isToday = d.isSame(dayjs(), "day");
            const dotClass = getWeeklyPhaseDot(d);
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className={`text-[11px] font-bold ${isToday ? "text-rose-500" : "text-gray-400"}`}>
                  {["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i]}
                </span>
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold relative
                  ${isToday ? "bg-rose-500 text-white shadow-md shadow-rose-200" : "text-gray-700"}
                `}>
                  {d.format("D")}
                  {/* Phase Indicator Dot */}
                  {!isToday && dotClass && (
                    <div className={`absolute -bottom-1 w-1 h-1 rounded-full ${dotClass}`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </header>

      <div className="px-5 py-8 max-w-lg mx-auto flex flex-col gap-10">
        
        {/* Main Hero Circular Dashboard */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative">
            {/* The Outer Breathing Ring */}
            <div className={`absolute inset-0 bg-gradient-to-tr ${summaryContent.color} opacity-15 blur-2xl rounded-full scale-105 animate-pulse`} style={{ animationDuration: '4s' }} />
            
            <div className={`
              relative w-44 h-44 sm:w-48 sm:h-48 rounded-full flex flex-col items-center justify-center text-center shadow-2xl transition-all duration-700 ease-out hover:scale-[1.02]
              bg-gradient-to-br ${summaryContent.color} ${summaryContent.text}
              ring-[8px] ${summaryContent.ring || "ring-gray-50/50"} ring-opacity-100
            `}>
               {/* Decorative animated rings */}
               <div className="absolute inset-[-10px] rounded-full border-[1.5px] border-dashed border-white/50 animate-spin-slow pointer-events-none" style={{ animationDuration: '30s' }} />
               <div className="absolute inset-[-20px] rounded-full border-[1px] border-white/20 pointer-events-none" />
               <div className="absolute inset-[6px] rounded-full border border-white/20 pointer-events-none mix-blend-overlay" />
               
               <div className="relative z-10 flex flex-col items-center justify-center px-3 w-full gap-0">
                 <span className="text-[9px] sm:text-[10px] font-bold opacity-90 tracking-widest uppercase mb-0.5 drop-shadow-sm">{summaryContent.title}</span>
                 {summaryContent.prefix && (
                   <span className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-md mb-[-6px]">{summaryContent.prefix}</span>
                 )}
                 <span className={`${summaryContent.prefix ? "text-[48px] sm:text-[56px] leading-none" : "text-3xl sm:text-4xl my-1"} font-black tracking-tighter drop-shadow-lg`}>
                   {summaryContent.desc}
                 </span>
                 {summaryContent.subdesc && (
                   <div className="mt-1.5 w-full max-w-[140px]">
                     <span className="flex items-center justify-center text-[9px] sm:text-[10px] pb-0.5 pt-1 font-semibold opacity-95 leading-tight border border-white/40 bg-white/20 backdrop-blur-md px-2 rounded-full shadow-sm text-center">
                      {summaryContent.subdesc}
                     </span>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </div>

        {/* Monthly Calendar */}
        <div className="mt-2 w-full">
          <h3 className="text-gray-800 font-bold px-2 mb-3">Lịch chu kỳ</h3>
          {loading ? (
            <div className="h-[400px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-rose-400" />
            </div>
          ) : (
            <CycleCalendar 
              currentDate={currentDate} 
              setCurrentDate={setCurrentDate} 
              cycles={cycles}
              onLogStart={handleLogStart}
              onLogEnd={handleLogEnd}
              confirm={confirm}
              showToast={showToast}
            />
          )}
        </div>

      </div>
      {ConfirmNode}
      <Toast toast={toast} onClose={hideToast} />
    </main>
  );
}
