"use client";
import { useState, useCallback, useRef, useEffect } from "react";

const COLORS = [
  "#FFB7C5",
  "#FFC0CB",
  "#FFADC5",
  "#FF9BAD",
  "#FFD1DC",
  "#FFBFCE",
  "#FFA0B4",
  "#FFB3C1",
  "#FFC8D8",
  "#FF91A4",
  "#FFD6E0",
  "#FFAAB8",
  "#FFCCD5",
  "#FFE4EC",
  "#FF8FA3",
  "#FFBAC3",
];

// Deterministic pseudo-random seeded by index
function seeded(seed: number, mul: number, mod: number): number {
  return (seed * mul + 13) % mod;
}

// Hình cánh hoa đào sakura — 2 thùy trên, nhọn dưới, có gân giữa
function Petal({ color, size }: { color: string; size: number }) {
  // Màu đậm hơn một chút cho viền & gân
  const vein = "rgba(255,255,255,0.55)";
  return (
    <svg
      width={size * 0.72}
      height={size}
      viewBox="0 0 22 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Cánh hoa: 2 thùy trên (rãnh ở đỉnh), nhọn ở đáy */}
      <path
        d="M11 28
           C5 23, 1 17, 1.5 11
           C2 5, 6 1, 8.5 1.5
           C9.5 1.7, 10.5 3.5, 11 3.5
           C11.5 3.5, 12.5 1.7, 13.5 1.5
           C16 1, 20 5, 20.5 11
           C21 17, 17 23, 11 28 Z"
        fill={color}
        fillOpacity="0.88"
      />
      {/* Rãnh nhỏ ở đỉnh (đặc trưng sakura) */}
      <path
        d="M9.5 1.8 Q11 4.5 12.5 1.8"
        stroke={vein}
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Gân giữa */}
      <path
        d="M11 5 Q11.4 16 11 27"
        stroke={vein}
        strokeWidth="0.7"
        strokeLinecap="round"
        fill="none"
      />
      {/* Gân phụ trái & phải */}
      <path
        d="M11 10 Q8 13 5 12"
        stroke={vein}
        strokeWidth="0.45"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M11 10 Q14 13 17 12"
        stroke={vein}
        strokeWidth="0.45"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M11 17 Q8 20 6 18.5"
        stroke={vein}
        strokeWidth="0.35"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M11 17 Q14 20 16 18.5"
        stroke={vein}
        strokeWidth="0.35"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const COUNT = 38;

// Pre-compute configs once — tránh re-generate mỗi render
// Dùng negative delay phân phối theo index → đảm bảo mỗi cánh ở pha khác nhau,
// không bao giờ loop lại cùng lúc (tránh bị chụm)
const PETAL_CONFIGS = Array.from({ length: COUNT }, (_, i) => {
  const dur = 10 + seeded(i, 17, 13); // 10–22s — biên độ rộng để chu kỳ không trùng
  const delay = -((i / COUNT) * dur) - seeded(i, 7, 5); // âm, trải đều + jitter nhỏ
  return {
    left: 3 + seeded(i, 47, 90), // 3–92% — tránh sát rìa
    delay,
    dur,
    size: 18 + seeded(i, 23, 16), // 18–33px
    swing: (seeded(i, 11, 70) - 35) * 1.2, // –42..41px
    rot: seeded(i, 37, 360),
    color: COLORS[i % COLORS.length],
  };
});

// Mini burst khi chạm — các tim bay tứ tung
const BURST_ICONS = ["💕", "🌸", "✨", "💖", "🌷", "💗"];

export default function FallingPetals() {
  const [bursts, setBursts] = useState<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const timerRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Dọn timer khi unmount
  useEffect(() => {
    const timers = timerRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent, i: number) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      setBursts((prev) => new Map(prev).set(i, { x, y }));

      // Xoá burst sau 900ms
      if (timerRef.current.has(i)) clearTimeout(timerRef.current.get(i)!);
      timerRef.current.set(
        i,
        setTimeout(() => {
          setBursts((prev) => {
            const next = new Map(prev);
            next.delete(i);
            return next;
          });
        }, 900),
      );
    },
    [],
  );

  return (
    <>
      {/* Cánh hoa rơi */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[45] overflow-hidden"
      >
        {PETAL_CONFIGS.map((cfg, i) => (
          <span
            key={i}
            onClick={(e) => handleClick(e, i)}
            onTouchStart={(e) => handleClick(e, i)}
            style={{
              position: "absolute",
              top: "-3rem",
              left: `${cfg.left}%`,
              display: "inline-block",
              cursor: "pointer",
              pointerEvents: "auto",
              willChange: "transform, opacity",
              animationName: "daoPetalFall",
              animationDuration: `${cfg.dur}s`,
              animationDelay: `${cfg.delay}s`,
              animationTimingFunction: "cubic-bezier(0.37,0,0.63,1)",
              animationIterationCount: "infinite",
              animationFillMode: "both",
              ["--sw" as string]: `${cfg.swing}px`,
              ["--r0" as string]: `${cfg.rot}deg`,
              opacity: 0,
            }}
          >
            <Petal color={cfg.color} size={cfg.size} />
          </span>
        ))}
      </div>

      {/* Burst overlay — fixed, trên cùng */}
      {bursts.size > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[60]"
        >
          {Array.from(bursts.entries()).map(([i, pos]) =>
            BURST_ICONS.map((icon, bi) => (
              <span
                key={`${i}-${bi}`}
                style={{
                  position: "fixed",
                  left: pos.x,
                  top: pos.y,
                  display: "inline-block",
                  fontSize: `${12 + bi * 2}px`,
                  animationName: `burst${bi}`,
                  animationDuration: "0.85s",
                  animationTimingFunction: "ease-out",
                  animationFillMode: "forwards",
                  pointerEvents: "none",
                }}
              >
                {icon}
              </span>
            )),
          )}
        </div>
      )}

      <style>{`
        /* ── Cánh hoa rơi ── */
        @keyframes daoPetalFall {
          0%   { transform: translateY(0)      translateX(0)                          rotate(var(--r0))               skewX(0deg);    opacity: 0; }
          4%   { opacity: 0.9; }
          20%  { transform: translateY(20vh)   translateX(calc(var(--sw) * .5))       rotate(calc(var(--r0) + 90deg))  skewX(7deg);  }
          40%  { transform: translateY(40vh)   translateX(var(--sw))                  rotate(calc(var(--r0) + 190deg)) skewX(-6deg); opacity: 0.82; }
          60%  { transform: translateY(61vh)   translateX(calc(var(--sw) * .6))       rotate(calc(var(--r0) + 275deg)) skewX(8deg);  }
          80%  { transform: translateY(82vh)   translateX(calc(var(--sw) * .2))       rotate(calc(var(--r0) + 340deg)) skewX(-4deg); opacity: 0.55; }
          96%  { opacity: 0.15; }
          100% { transform: translateY(110vh)  translateX(0)                          rotate(calc(var(--r0) + 420deg)) skewX(0deg);   opacity: 0; }
        }

        /* ── Burst particles — 6 hướng ── */
        @keyframes burst0 { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 100%{transform:translate(calc(-50% - 28px),calc(-50% - 32px)) scale(0.4);opacity:0} }
        @keyframes burst1 { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 100%{transform:translate(calc(-50% + 30px),calc(-50% - 26px)) scale(0.4);opacity:0} }
        @keyframes burst2 { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 100%{transform:translate(calc(-50% - 38px),calc(-50%))           scale(0.3);opacity:0} }
        @keyframes burst3 { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 100%{transform:translate(calc(-50% + 40px),calc(-50% + 8px))     scale(0.35);opacity:0} }
        @keyframes burst4 { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 100%{transform:translate(calc(-50% - 22px),calc(-50% + 34px))    scale(0.4);opacity:0} }
        @keyframes burst5 { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 100%{transform:translate(calc(-50% + 20px),calc(-50% + 30px))    scale(0.35);opacity:0} }
      `}</style>
    </>
  );
}
