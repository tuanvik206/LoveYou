"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Mail, Lock, User, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Mật khẩu phải từ 6 ký tự trở lên nha!");
      return;
    }
    
    setError("");
    setIsLoading(true);

    try {
      // Vì MVP đơn giản, chúng ta lưu Name vào User Metadata của Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        router.push("/onboarding");
      }
    } catch (err: any) {
      setError(err?.message || "Đã có lỗi xảy ra khi tạo tài khoản");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white max-w-md w-full rounded-[2rem] p-8 shadow-xl shadow-rose-100/50"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center">
            <Heart className="w-8 h-8 fill-rose-400 text-rose-400" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-foreground mb-2">
          Bắt đầu hành trình!
        </h1>
        <p className="text-center text-foreground/60 text-sm mb-8">
          Tạo tài khoản để mở khoá không gian riêng tư ✨
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5 ml-1">Tên gọi của bạn</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-foreground/40" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-rose-50 border border-transparent rounded-2xl focus:bg-white focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition-all text-sm outline-none"
                placeholder="Gấu Mập"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5 ml-1">Email</label>
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
            <label className="block text-sm font-medium text-foreground/80 mb-1.5 ml-1">Mật khẩu</label>
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
                placeholder="Ít nhất 6 ký tự..."
              />
            </div>
          </div>

          {error && (
            <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-red-500 text-xs text-center font-medium bg-red-50 p-2 rounded-lg">
              {error === "User already registered" ? "Email này đã được đăng ký rồi" : error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-rose-400 hover:bg-rose-500 text-white font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98] mt-2 flex justify-center items-center gap-2 disabled:opacity-70 disabled:active:scale-100"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Đăng Ký Khởi Tạo"}
          </button>
        </form>

        <p className="text-center text-sm text-foreground/60 mt-8">
          Đã thiết lập Không gian trước đó?{" "}
          <Link href="/auth/login" className="text-rose-500 font-bold hover:underline">
            Đăng nhập
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
