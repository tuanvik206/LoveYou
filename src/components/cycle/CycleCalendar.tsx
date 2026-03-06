"use client";

import { useMemo } from "react";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { ChevronLeft, ChevronRight, Droplet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";import { useConfirm } from "@/hooks/useConfirm";

dayjs.extend(isBetween);

export interface CycleRecord {
  id: string;
  start_date: string;
  end_date: string | null;
  cycle_length: number;
  period_length: number;
}

interface CycleCalendarProps {
  currentDate: dayjs.Dayjs;
  setCurrentDate: (date: dayjs.Dayjs) => void;
  cycles: CycleRecord[];
  onLogStart: (date: string) => void;
  onLogEnd: (cycleId: string, date: string) => void;
}

const DAYS_OF_WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function CycleCalendar({
  currentDate,
  setCurrentDate,
  cycles,
  onLogStart,
  onLogEnd,
}: CycleCalendarProps) {
  const { confirm, ConfirmNode } = useConfirm();
  const daysInMonth = currentDate.daysInMonth();
  const firstDayOfMonth = currentDate.startOf("month").day(); // 0 is Sunday
  
  // Adjust so Monday is 0, Sunday is 6
  const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const monthYearStr = currentDate.format("MM/YYYY");

  const prevMonth = () => setCurrentDate(currentDate.subtract(1, "month"));
  const nextMonth = () => setCurrentDate(currentDate.add(1, "month"));
  const goToday = () => setCurrentDate(dayjs());

  // Determine state for a given date
  const getDayState = (dayDate: dayjs.Dayjs) => {
    // Check if it's during a logged period
    for (const c of cycles) {
      const s = dayjs(c.start_date);
      const e = c.end_date ? dayjs(c.end_date) : dayjs(); // If ongoing, up to today
      if (dayDate.isBetween(s, e, "day", "[]")) {
        return { type: "period", isStart: dayDate.isSame(s, "day"), isEnd: c.end_date && dayDate.isSame(e, "day"), cycle: c };
      }
    }

    // Predict based on historical averages
    if (cycles.length > 0) {
      // Sort cycles by start date descending (newest first)
      const sortedCycles = [...cycles].sort((a,b) => dayjs(b.start_date).diff(dayjs(a.start_date)));
      const latest = sortedCycles[0];
      const s = dayjs(latest.start_date);
      
      // Calculate averages from up to the last 6 completed cycles for better accuracy
      const completedCycles = sortedCycles.filter(c => c.end_date);
      const cyclesToAverage = completedCycles.length > 0 ? completedCycles.slice(0, 6) : [latest];
      
      const avgCycleLen = Math.round(
        cyclesToAverage.reduce((acc, c) => acc + (c.cycle_length || 28), 0) / cyclesToAverage.length
      );
      const avgPeriodLen = Math.round(
        cyclesToAverage.reduce((acc, c) => acc + (c.period_length || 5), 0) / cyclesToAverage.length
      );

      const daysSinceLatest = dayDate.diff(s, "day");
      
      if (daysSinceLatest > 0) {
        const cycleIterations = Math.floor(daysSinceLatest / avgCycleLen);
        const currentCycleStart = s.add(cycleIterations * avgCycleLen, "day");
        const dayOfCycle = dayDate.diff(currentCycleStart, "day") + 1; // 1-indexed

        const expectedPeriodEnd = avgPeriodLen;
        const ovulationDay = avgCycleLen - 14; // Typical luteal phase is 14 days (MeetYou model)
        const fertileStart = Math.max(1, ovulationDay - 5);    // 5 days before ovulation
        const fertileEnd = Math.min(avgCycleLen, ovulationDay + 4); // 4 days after ovulation (Total 10 day window)

        if (dayOfCycle >= 1 && dayOfCycle <= expectedPeriodEnd) {
          // If it's the current ongoing cycle and user hasn't ended it, we don't mark deep future as "period", marking as "predicted"
          return { type: cycleIterations === 0 && !latest.end_date ? "period" : "predicted" };
        } else if (dayOfCycle === ovulationDay) {
          return { type: "fertile", isOvulation: true };
        } else if (dayOfCycle >= fertileStart && dayOfCycle <= fertileEnd) {
          return { type: "fertile", isOvulation: false };
        } else {
          return { type: "safe" };
        }
      }
    }

    return { type: "safe" }; // Default to safe if no data or before first cycle
  };

  const handleDayClick = (dayDate: dayjs.Dayjs) => {
    if (dayDate.isAfter(dayjs(), "day")) return;
    
    const state = getDayState(dayDate);
    const dStr = dayDate.format("YYYY-MM-DD");

    if (state.type === "period" && state.cycle && !state.cycle.end_date) {
      confirm({
        title: "Kết thúc kỳ kinh?",
        message: `Bạn muốn xác nhận kết thúc kỳ kinh vào ngày ${dayDate.format("DD/MM/YYYY")} chứ?`,
        confirmLabel: "Chắc chắn",
        variant: "primary",
        onConfirm: () => onLogEnd(state.cycle!.id, dStr)
      });
    } else if (state.type !== "period") {
      const hasActive = cycles.some(c => !c.end_date);
      if (hasActive) {
        alert("Có một chu kỳ đang diễn ra chưa kết thúc.");
        return;
      }
      confirm({
        title: "Bắt đầu kỳ kinh mới?",
        message: `Ghi nhận chu kỳ mới bắt đầu từ ngày ${dayDate.format("DD/MM/YYYY")}?`,
        confirmLabel: "Bắt đầu",
        variant: "primary",
        onConfirm: () => onLogStart(dStr)
      });
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-rose-100/50 w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={prevMonth}
          className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={goToday} className="font-bold text-[17px] text-gray-800 hover:text-rose-500 transition-colors">
          Tháng {monthYearStr}
        </button>
        <button
          onClick={nextMonth}
          className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-center text-xs font-bold text-gray-400 capitalize">
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: startingDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const date = currentDate.date(dayNum);
          const isToday = date.isSame(dayjs(), "day");
          const state = getDayState(date);
          const isFuture = date.isAfter(dayjs(), "day");

          // Styling logic
          let bgClass = "bg-transparent";
          let textClass = "text-gray-700";
          let borderClass = "border-transparent";

          if (state.type === "period") {
            bgClass = "bg-rose-400 shadow-sm shadow-rose-200/50";
            textClass = "text-white font-bold";
            if (state.isStart && !state.isEnd) borderClass = "rounded-r-[4px]";
            else if (!state.isStart && state.isEnd) borderClass = "rounded-l-[4px]";
            else if (!state.isStart && !state.isEnd) borderClass = "rounded-[4px]";
          } else if (state.type === "predicted") {
            bgClass = "bg-pink-50";
            textClass = "text-pink-500 font-semibold";
            borderClass = "border-pink-300 border-[1.5px] border-dashed";
          } else if (state.type === "fertile") {
            bgClass = state.isOvulation ? "bg-purple-500 shadow-sm shadow-purple-200" : "bg-purple-100";
            textClass = state.isOvulation ? "text-white font-bold" : "text-purple-700 font-semibold";
            borderClass = state.isOvulation ? "border-transparent" : "border border-purple-200";
          } else if (state.type === "safe") {
            bgClass = "bg-transparent";
            textClass = "text-gray-600";
            borderClass = "border-transparent";
          }
          
          if (isToday && state.type !== "period" && !state.isOvulation) {
            bgClass = "bg-emerald-50";
            textClass = "text-emerald-700 font-bold";
            borderClass = "border-[1.5px] border-emerald-300";
          }

          return (
            <motion.button
              key={dayNum}
              whileTap={!isFuture ? { scale: 0.92 } : undefined}
              onClick={() => handleDayClick(date)}
              className={`relative aspect-square flex items-center justify-center rounded-2xl text-[15px] transition-all duration-200
                ${bgClass} ${textClass} ${borderClass}
                ${!isFuture ? "hover:scale-[1.05] hover:shadow-md hover:z-10 cursor-pointer" : "opacity-40 cursor-default"}
                ${isToday && state.type === "period" ? "ring-2 ring-rose-300 ring-offset-2" : ""}
                ${isToday && state.isOvulation ? "ring-2 ring-purple-300 ring-offset-2" : ""}`}
            >
              <span className="relative z-10">{dayNum}</span>
              {/* Overlay dot for fertile/ovulation days if we wanted, but background works well */}
            </motion.button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 pt-5 border-t border-gray-100 flex flex-wrap justify-between gap-y-3 px-1 text-xs font-semibold text-gray-500">
        <div className="flex items-center gap-1.5 w-[48%]">
          <div className="w-4 h-4 rounded-full bg-rose-400 shadow-sm" /> Hành kinh
        </div>
        <div className="flex items-center gap-1.5 w-[48%]">
          <div className="w-4 h-4 rounded-full border-[1.5px] border-dashed border-pink-300 bg-pink-50" /> Dự kiến
        </div>
        <div className="flex items-center gap-1.5 w-[48%]">
          <div className="w-4 h-4 rounded-full bg-purple-100 border border-purple-200" /> Thụ thai
        </div>
        <div className="flex items-center gap-1.5 w-[48%]">
          <div className="w-4 h-4 rounded-full bg-purple-500 shadow-sm" /> Rụng trứng
        </div>
      </div>
      {ConfirmNode}
    </div>
  );
}
