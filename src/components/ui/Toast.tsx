"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import type { ToastState } from "@/hooks/useToast";

const CONFIG: Record<string, { bg: string; Icon: React.ElementType }> = {
  success: { bg: "bg-green-500", Icon: CheckCircle2 },
  error: { bg: "bg-red-500", Icon: XCircle },
  info: { bg: "bg-love-500", Icon: Info },
};

export default function Toast({
  toast,
  onClose,
}: {
  toast: ToastState | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white text-sm font-semibold max-w-[320px] w-[calc(100%-2rem)] ${CONFIG[toast.type].bg}`}
        >
          {(() => {
            const { Icon } = CONFIG[toast.type];
            return <Icon className="w-5 h-5 shrink-0" />;
          })()}
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={onClose}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
