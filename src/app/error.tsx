"use client";

import { useEffect } from "react";
import { Heart, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[LoveYou Error]", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-love-50/30 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 bg-love-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <Heart className="w-10 h-10 text-love-400 fill-love-300" />
      </div>
      <h2 className="text-xl font-bold text-foreground/80 mb-2">
        Ôi, có gì đó không ổn rồi 😢
      </h2>
      <p className="text-sm text-foreground/50 mb-8 max-w-xs">
        Đã xảy ra lỗi không mong muốn. Thử tải lại trang nhé!
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-6 py-3 bg-love-500 text-white font-bold rounded-2xl shadow-md hover:bg-love-600 transition-all active:scale-95"
      >
        <RefreshCw className="w-4 h-4" />
        Thử lại
      </button>
    </main>
  );
}
