"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import { subscribeToPush, refreshPushSubscription } from "@/lib/pushUtils";

const PUBLIC_ROUTES = ["/auth/login", "/auth/register"];

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    clear,
    user,
    partner,
    loveCode,
    setUser,
    setPartner,
    setStartDate,
    setMyBirthdate,
    setPartnerBirthdate,
    setMyGender,
    setPartnerGender,
    setLoveCode,
    setRole,
    setPartnerOnline,
  } = useStore();

  // Public routes không cần spinner — chỉ cần spinner trên protected routes
  // để tránh flash content trước khi auth được xác nhận
  const [isLoading, setIsLoading] = useState(
    () => !PUBLIC_ROUTES.includes(pathname),
  );

  // Refs để tránh stale closure mà không cần recreate callback
  const pathnameRef = useRef(pathname);
  const storeRef = useRef({ user, partner, loveCode });
  const checkRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Luôn giữ refs cập nhật — chạy mỗi render, không gây re-render
  pathnameRef.current = pathname;
  storeRef.current = { user, partner, loveCode };

  // checkAuthStatus ổn định (không phụ thuộc pathname/user/partner/loveCode)
  // Đọc từ refs bên trong để luôn có giá trị mới nhất
  const checkAuthStatus = useCallback(async () => {
    // Safety timeout: nếu sau 4 giây vẫn chưa xong → ẩn spinner để tránh treo UI
    const timeout = setTimeout(() => setIsLoading(false), 4000);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      clearTimeout(timeout);

      const path = pathnameRef.current;
      const isPublicRoute = PUBLIC_ROUTES.includes(path);
      const { user, partner, loveCode } = storeRef.current;

      if (!session) {
        clear();
        setIsLoading(false);
        if (!isPublicRoute) {
          router.replace("/auth/login");
        }
        return;
      }

      // Fast path: session hợp lệ + Zustand đã có đủ data → render luôn
      if (user && partner && loveCode && !isPublicRoute) {
        setIsLoading(false);
        return;
      }

      // Restore từ database
      let hasProfile = !!(user && loveCode);
      if (!user || !loveCode) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("love_code, role")
          .eq("auth_user_id", session.user.id)
          .single();

        if (profile) {
          hasProfile = true;
          const { data: coupleData } = await supabase
            .from("couples")
            .select("*")
            .eq("code", profile.love_code)
            .single();

          if (coupleData) {
            setLoveCode(profile.love_code);
            setRole(profile.role as "user1" | "user2");

            if (profile.role === "user1") {
              if (coupleData.user1) setUser(coupleData.user1);
              if (coupleData.user2) setPartner(coupleData.user2);
              if (coupleData.my_birthdate)
                setMyBirthdate(coupleData.my_birthdate);
              if (coupleData.partner_birthdate)
                setPartnerBirthdate(coupleData.partner_birthdate);
              if (coupleData.my_gender) setMyGender(coupleData.my_gender);
              if (coupleData.partner_gender)
                setPartnerGender(coupleData.partner_gender);
            } else {
              if (coupleData.user2) setUser(coupleData.user2);
              if (coupleData.user1) setPartner(coupleData.user1);
              if (coupleData.partner_birthdate)
                setMyBirthdate(coupleData.partner_birthdate);
              if (coupleData.my_birthdate)
                setPartnerBirthdate(coupleData.my_birthdate);
              if (coupleData.partner_gender)
                setMyGender(coupleData.partner_gender);
              if (coupleData.my_gender) setPartnerGender(coupleData.my_gender);
            }

            if (coupleData.start_date) setStartDate(coupleData.start_date);
          }
        } else {
          // Chưa có profile → onboarding
          if (!isPublicRoute && path !== "/onboarding") {
            setIsLoading(false);
            router.replace("/onboarding");
            return;
          }
        }
      }

      // Redirect nếu đang ở public route
      if (isPublicRoute) {
        router.replace(hasProfile ? "/" : "/onboarding");
        return;
      }

      setIsLoading(false);
    } catch {
      clearTimeout(timeout);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    router,
    clear,
    setUser,
    setPartner,
    setLoveCode,
    setRole,
    setStartDate,
    setMyBirthdate,
    setPartnerBirthdate,
    setMyGender,
    setPartnerGender,
  ]);

  // Luôn giữ checkRef cập nhật
  useEffect(() => {
    checkRef.current = checkAuthStatus;
  });

  // Optimistic fast-path: nếu Zustand đã có đủ data (từ localStorage persist)
  // → ẩn spinner ngay lập tức, checkAuthStatus vẫn chạy ngầm để validate session
  useEffect(() => {
    const { user, partner, loveCode } = storeRef.current;
    if (
      user &&
      partner &&
      loveCode &&
      !PUBLIC_ROUTES.includes(pathnameRef.current)
    ) {
      setIsLoading(false);
    }
  }, []);

  // Subscribe onAuthStateChange 1 lần duy nhất khi mount
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clear();
        router.replace("/auth/login");
      } else if (event === "SIGNED_IN") {
        checkRef.current?.();
      }
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chạy checkAuthStatus 1 lần khi mount
  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh push subscription mỗi lần app mở — đảm bảo DB luôn có endpoint mới nhất
  useEffect(() => {
    if (!user?.name || !loveCode || isLoading) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    refreshPushSubscription(loveCode, user.name);
  }, [user?.name, loveCode, isLoading]);

  // Global presence: 1 channel duy nhất — track bản thân + lắng nghe partner
  useEffect(() => {
    if (!user || !partner || !loveCode) return;

    const ch = supabase
      .channel(`presence_${loveCode}`, {
        config: { presence: { key: user.name } },
      })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<{ name: string }>();
        const online = Object.values(state)
          .flat()
          .some((p: any) => p.name === partner.name);
        setPartnerOnline(online);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        if ((newPresences as any[]).some((p: any) => p.name === partner.name)) {
          setPartnerOnline(true);
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        if (
          (leftPresences as any[]).some((p: any) => p.name === partner.name)
        ) {
          setPartnerOnline(false);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({
            name: user.name,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      ch.untrack();
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, partner?.name, loveCode]);

  // Route guard nhẹ sau khi đã load xong — không gọi DB
  // Chỉ kiểm tra Zustand state để redirect khi navigate
  useEffect(() => {
    if (isLoading) return;
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const { user, loveCode } = storeRef.current;
    if (!isPublicRoute && !user) {
      // Mất data Zustand sau khi navigate → kiểm tra lại session
      checkRef.current?.();
    }
    if (isPublicRoute && user && loveCode) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-[9999] bg-love-50 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-love-100 border-t-love-400 rounded-full animate-spin" />
        </div>
      )}
      {children}
    </>
  );
}
