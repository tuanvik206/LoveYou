"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, Loader2, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

export default function Onboarding() {
  const router = useRouter();
  const {
    user,
    loveCode,
    partner,
    setUser,
    setLoveCode,
    setPartner,
    setStartDate,
    setMyBirthdate,
    setPartnerBirthdate,
    setRole,
    clear,
  } = useStore();
  // Step 2 = form nhập tên + tạo/ghép mã | Step 3 = đã ghép đôi thành công
  const STEP_SETUP = 2;
  const STEP_SUCCESS = 3;
  const [step, setStep] = useState(STEP_SETUP);
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clear();
    router.replace("/auth/login");
  };

  useEffect(() => {
    if (user && partner) {
      router.push("/");
    } else {
      const fetchAuthUser = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const name =
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "No Name";
          setNameInput(name);
        }
      };
      fetchAuthUser();
    }
  }, [user, partner, router]);

  useEffect(() => {
    if (step === STEP_SETUP && loveCode) {
      const channel = supabase
        .channel(`room_${loveCode}`)
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
            if (newRecord.user2) {
              setPartner(newRecord.user2);
              setStartDate(newRecord.start_date);
              setPartnerBirthdate(newRecord.partner_birthdate);
              setStep(STEP_SUCCESS);
              setTimeout(() => router.push("/"), 2000);
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [step, loveCode, setPartner, setStartDate, router]);

  const handleCreateUser = async () => {
    if (!nameInput.trim()) return;
    setIsLoading(true);

    try {
      // Get current auth user
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        showToast("Đăng nhập lại để tiếp tục!", "error");
        return;
      }

      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newUser = {
        name: nameInput,
        avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${nameInput}`,
      };

      const { error } = await supabase.from("couples").insert({
        code: newCode,
        user1: newUser,
      });

      if (error) {
        showToast("Lỗi tạo mã ghép đôi, hãy thử lại.", "error");
        return;
      }

      // Lưu vào user_profiles
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({
          auth_user_id: authUser.id,
          love_code: newCode,
          role: "user1",
        });

      if (profileError) {
        // Không chặn flow, vẫn cho tiếp tục
      }

      setUser(newUser);
      setRole("user1");
      setLoveCode(newCode);
      // Giữ nguyên step 2, chỉ đổi UI hiện Mã Code
    } catch (err) {
      showToast("Đã có lỗi xảy ra", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePairing = async () => {
    if (!codeInput.trim() || !nameInput) return;
    setIsLoading(true);

    try {
      const code = codeInput.toUpperCase();
      const { data, error } = await supabase
        .from("couples")
        .select("*")
        .eq("code", code)
        .single();

      if (error || !data) {
        showToast("Mã không tồn tại hoặc đã hết hạn!", "error");
        setIsLoading(false);
        return;
      }

      if (data.user2) {
        showToast("Phòng này đã ghép đôi với người khác!", "error");
        setIsLoading(false);
        return;
      }

      const startDate = new Date().toISOString();
      const myUserObj = {
        name: nameInput,
        avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${nameInput}`,
      };

      const { error: updateError } = await supabase
        .from("couples")
        .update({
          user2: myUserObj,
          start_date: startDate,
          is_connected: true,
        })
        .eq("code", code);

      if (updateError) {
        showToast("Có lỗi khi ghép đôi!", "error");
        setIsLoading(false);
        return;
      }

      // Lưu vào user_profiles
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser) {
        const { error: profileError } = await supabase
          .from("user_profiles")
          .insert({
            auth_user_id: authUser.id,
            love_code: code,
            role: "user2",
          });

        if (profileError) {
          // Không chặn flow, vẫn cho tiếp tục
        }
      }

      setUser(myUserObj);
      setLoveCode(code);
      setRole("user2");
      setPartner(data.user1);
      setStartDate(startDate);
      setMyBirthdate(data.partner_birthdate);
      setPartnerBirthdate(data.my_birthdate);
      setStep(3);

      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      showToast("Đã có lỗi xảy ra", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-love-50/50 relative">
      {/* Nút đăng xuất góc trên phải */}
      <button
        onClick={handleLogout}
        className="absolute top-5 safe-pt right-5 flex items-center gap-1.5 text-xs font-semibold text-foreground/50 hover:text-foreground/80 transition-colors bg-white/70 px-3 py-2 rounded-full border border-pure-100 shadow-sm"
      >
        <LogOut className="w-3.5 h-3.5" /> Đăng xuất
      </button>
      <AnimatePresence mode="wait">
        {step === STEP_SETUP && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex w-full max-w-sm flex-col items-center gap-6 text-center"
          >
            <div className="space-y-2 mb-2">
              <h1 className="text-2xl font-bold text-foreground">
                Xin chào, {nameInput}! 👋
              </h1>
              <p className="text-sm text-foreground/60">
                Hãy tạo mã gửi cho nửa kia, hoặc nhập mã của họ nhé.
              </p>
            </div>

            <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm w-full border border-love-100">
              {loveCode ? (
                <>
                  <h2 className="text-sm font-bold uppercase text-foreground/50">
                    Mã của bạn
                  </h2>
                  <div className="rounded-xl border border-love-200 bg-love-50/50 p-4">
                    <p className="text-4xl font-mono font-bold tracking-widest text-love-500">
                      {loveCode}
                    </p>
                  </div>
                  <p className="text-sm text-foreground/70">
                    Gửi mã này cho người ấy để ghép đôi
                    <br />
                    <span className="text-[10px] text-love-400 mt-1 block">
                      (Trang sẽ tự động cập nhật khi người ấy tham gia)
                    </span>
                  </p>
                </>
              ) : (
                <Button
                  className="w-full py-6 text-md shadow-md bg-love-100 hover:bg-love-200 text-love-600 border border-love-200"
                  onClick={handleCreateUser}
                  disabled={isLoading || !nameInput.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Heart className="w-5 h-5 fill-love-400 text-love-400 mr-2" />
                  )}
                  Tạo mã ghép đôi
                </Button>
              )}
            </div>

            <div className="flex w-full items-center gap-4">
              <div className="h-px flex-1 bg-pure-200"></div>
              <span className="text-xs text-foreground/50 uppercase font-medium">
                Hoặc
              </span>
              <div className="h-px flex-1 bg-pure-200"></div>
            </div>

            <div className="w-full space-y-4">
              <Input
                placeholder="Nhập mã của người ấy"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                maxLength={6}
                className="text-center font-mono uppercase"
                disabled={isLoading}
              />
              <Button
                className="w-full"
                onClick={handlePairing}
                disabled={isLoading || !codeInput.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Ghép đôi
              </Button>
            </div>
          </motion.div>
        )}

        {step === STEP_SUCCESS && user && partner && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <div className="relative flex items-center justify-center">
              <motion.img
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                src={user.avatar}
                className="h-20 w-20 rounded-full border-4 border-white bg-pure-50 shadow-md z-10"
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
                className="absolute z-20"
              >
                <Heart className="h-8 w-8 text-love-500" fill="currentColor" />
              </motion.div>
              <motion.img
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                src={partner.avatar}
                className="h-20 w-20 rounded-full border-4 border-white bg-pure-50 shadow-md z-10"
              />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Đã kết nối!</h2>
            <p className="text-foreground/60">
              Đang vào không gian của hai bạn...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {toast && <Toast toast={toast} onClose={hideToast} />}
    </div>
  );
}
