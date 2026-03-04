"use client";

import { useState } from "react";
import { Heart, Mail, Lock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      // Đăng nhập thành công — AuthProvider xử lý redirect qua onAuthStateChange
      // Fallback: nếu sau 8s vẫn chưa navigate được thì reset spinner
      setTimeout(() => setIsLoading(false), 8000);
    } catch (err: any) {
      setError(err?.message || "Đã có lỗi xảy ra");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white max-w-md w-full rounded-[2rem] p-8 shadow-xl shadow-rose-100/50"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center">
            <Heart className="w-8 h-8 fill-rose-400 text-rose-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-foreground mb-2">
          Chào mừng trở lại!
        </h1>
        <p className="text-center text-foreground/60 text-sm mb-8">
          Đăng nhập để vào không gian của hai bạn 💑
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5 ml-1">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-foreground/40" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-rose-50 border border-transparent rounded-2xl focus:bg-white focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition-all text-sm outline-none"
                placeholder="laptrinhvien@vippr.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5 ml-1">
              Mật khẩu
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-foreground/40" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-rose-50 border border-transparent rounded-2xl focus:bg-white focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition-all text-sm outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-500 text-xs text-center font-medium bg-red-50 p-2 rounded-lg"
            >
              {error === "Invalid login credentials"
                ? "Sai email hoặc mật khẩu"
                : error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-rose-400 hover:bg-rose-500 text-white font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98] mt-2 flex justify-center items-center gap-2 disabled:opacity-70 disabled:active:scale-100"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Đăng Nhập"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-foreground/60 mt-8">
          Người mới hả?{" "}
          <Link
            href="/auth/register"
            className="text-rose-500 font-bold hover:underline"
          >
            Tạo tài khoản ngay
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
