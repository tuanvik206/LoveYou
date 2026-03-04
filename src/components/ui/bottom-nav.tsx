"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  MapPin,
  BookHeart,
  MessageCircleHeart,
  Images,
  Star,
} from "lucide-react";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { path: "/", icon: Heart, label: "Tình yêu" },
  { path: "/map", icon: MapPin, label: "Bản đồ" },
  { path: "/diary", icon: BookHeart, label: "Nhật ký" },
  { path: "/photos", icon: Images, label: "Ảnh" },
  { path: "/wishlist", icon: Star, label: "Ước mơ" },
  { path: "/chat", icon: MessageCircleHeart, label: "Nhắn tin" },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.includes("/onboarding") || pathname.includes("/auth")) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-love-100"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)",
        paddingTop: 8,
      }}
    >
      <div className="flex justify-around items-end max-w-md mx-auto px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              href={item.path}
              prefetch={true}
              className="relative flex flex-col items-center gap-0.5 outline-none select-none"
              style={{ minWidth: 44 }}
            >
              {/* Pill background */}
              <div
                className="relative flex items-center justify-center"
                style={{ width: 40, height: 30 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-love-500 rounded-2xl shadow-md"
                    style={{ boxShadow: "0 4px 14px rgba(244,63,94,0.35)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon
                  className="relative z-10 transition-all duration-200"
                  style={{
                    width: 18,
                    height: 18,
                    color: isActive ? "#fff" : "#94a3b8",
                    fill: isActive ? "rgba(255,255,255,0.25)" : "none",
                    strokeWidth: isActive ? 2.5 : 1.8,
                  }}
                />
              </div>

              {/* Label */}
              <span
                className="font-semibold transition-all duration-200 leading-none"
                style={{
                  fontSize: 8,
                  color: isActive ? "#f43f5e" : "#94a3b8",
                  letterSpacing: "0.01em",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
