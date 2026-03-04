"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { ArrowLeft, CheckCircle2, CalendarHeart } from "lucide-react";
import { motion } from "framer-motion";
import { ALL_MILESTONES } from "@/constants/milestones";

export default function MilestonesPage() {
  const router = useRouter();
  const { startDate } = useStore();
  const [currentDays, setCurrentDays] = useState(0);
  const [exactTime, setExactTime] = useState({ years: 0, months: 0, days: 0 });

  useEffect(() => {
    if (startDate) {
      const start = new Date(startDate);
      const now = new Date();
      const diff = Math.floor(
        (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      setCurrentDays(diff >= 0 ? diff : 0);

      let y = now.getFullYear() - start.getFullYear();
      let m = now.getMonth() - start.getMonth();
      let d = now.getDate() - start.getDate();

      if (d < 0) {
        m -= 1;
        const previousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        d += previousMonth.getDate();
      }

      if (m < 0) {
        y -= 1;
        m += 12;
      }

      setExactTime({
        years: Math.max(0, y),
        months: Math.max(0, m),
        days: Math.max(0, d),
      });
    }
  }, [startDate]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-rose-100/40 px-5 safe-pt pb-4 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="w-10 h-10 flex items-center justify-center bg-rose-50 rounded-2xl border border-rose-100 text-rose-400 active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight flex items-center gap-1.5">
          <CalendarHeart className="w-5 h-5 text-rose-500 shrink-0" /> Hành
          trình
        </h1>
        <div className="w-10 h-10" />
      </header>

      {/* Content */}
      <section className="px-6 py-8 max-w-lg mx-auto w-full">
        {/* Overall Status */}
        <div className="bg-gradient-to-br from-rose-400 to-rose-600 rounded-3xl p-6 text-white mb-10 shadow-lg shadow-rose-200/50 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
          <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-rose-700/20 rounded-full blur-xl"></div>

          <div className="relative z-10 flex flex-col items-center">
            <span className="text-rose-50 font-medium uppercase tracking-widest text-xs mb-1">
              Hiện Tại
            </span>
            <p className="text-5xl font-black drop-shadow-md">
              {currentDays}{" "}
              <span className="text-xl font-bold opacity-80 uppercase tracking-widest">
                Ngày
              </span>
            </p>

            {(exactTime.years > 0 ||
              exactTime.months > 0 ||
              exactTime.days > 0) && (
              <div className="mt-3 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full border border-white/20 shadow-sm">
                <span className="text-xs font-bold text-white tracking-wide">
                  {exactTime.years > 0 && `${exactTime.years} năm `}
                  {exactTime.months > 0 && `${exactTime.months} tháng `}
                  {exactTime.days > 0 && `${exactTime.days} ngày`}
                  {exactTime.days === 0 &&
                    exactTime.months === 0 &&
                    exactTime.years > 0 &&
                    ` tròn`}
                  {exactTime.days === 0 &&
                    exactTime.months === 0 &&
                    exactTime.years === 0 &&
                    `Bắt đầu từ hôm nay!`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="relative border-l-2 border-rose-200 ml-6 pl-8 space-y-8">
          {ALL_MILESTONES.map((milestone, index) => {
            const isAchieved = currentDays >= milestone.days;
            const isNext =
              !isAchieved &&
              (index === 0 || currentDays >= ALL_MILESTONES[index - 1].days);

            const Icon = milestone.icon;

            return (
              <motion.div
                key={milestone.days}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.08, 0.4) }}
                className="relative"
              >
                {/* Timeline Dot/Icon */}
                <div
                  className={`absolute -left-[45px] w-10 h-10 rounded-full flex items-center justify-center shadow-sm border-4 border-white ${isAchieved ? milestone.colors : "bg-rose-100 text-gray-400"}`}
                >
                  {isAchieved ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-4 h-4 opacity-50" />
                  )}
                </div>

                {/* Milestone Card */}
                <div
                  className={`bg-white rounded-3xl p-5 border ${isAchieved ? "border-rose-100 shadow-[0_8px_20px_rgb(0,0,0,0.04)]" : isNext ? "border-rose-200 shadow-sm" : "border-rose-100 opacity-60"} transition-all`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3
                        className={`font-bold text-lg flex items-center gap-2 ${isAchieved ? "text-foreground/90" : "text-foreground/50"}`}
                      >
                        {milestone.label}
                        {isAchieved && (
                          <Icon className={`w-4 h-4 ${milestone.iconColor}`} />
                        )}
                      </h3>
                      <p
                        className={`text-xs mt-1 ${isAchieved ? "text-foreground/60" : "text-foreground/40"}`}
                      >
                        {milestone.desc}
                      </p>
                    </div>

                    <div
                      className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${isAchieved ? "bg-green-50 text-green-600" : "bg-rose-50 text-rose-500"}`}
                    >
                      {milestone.days} Ngày
                    </div>
                  </div>

                  {/* Progress Bar for the NEXT milestone */}
                  {isNext && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-foreground/50 uppercase tracking-wider mb-2">
                        <span>Đã đi được</span>
                        <span className="text-rose-500">
                          {currentDays} / {milestone.days}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-rose-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-300 to-rose-500 rounded-full"
                          style={{
                            width: `${(currentDays / milestone.days) * 100}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-xs text-center text-foreground/50 mt-3 font-medium">
                        Chỉ còn{" "}
                        <span className="text-rose-500 font-bold">
                          {milestone.days - currentDays} ngày
                        </span>{" "}
                        nữa thôi! Cố lên nhé!
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
