"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Trash2 } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** "danger" = đỏ (xóa), "warning" = vàng, "primary" = hồng (default) */
  variant?: "danger" | "warning" | "primary";
  onConfirm: () => void;
}

interface Props extends ConfirmOptions {
  open: boolean;
  onCancel: () => void;
}

const VARIANT_STYLES = {
  danger: {
    icon: <Trash2 className="w-5 h-5 text-red-500" />,
    iconBg: "bg-red-50",
    btn: "bg-red-500 hover:bg-red-600 text-white",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    iconBg: "bg-amber-50",
    btn: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  primary: {
    icon: <div className="w-5 h-5 rounded-full border-[3px] border-rose-400 opacity-80" />,
    iconBg: "bg-rose-50",
    btn: "bg-gradient-to-tr from-rose-400 to-rose-500 text-white shadow-md shadow-rose-200",
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  variant = "danger",
  onConfirm,
  onCancel,
}: Props) {
  const styles = VARIANT_STYLES[variant];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-gray-900/15 backdrop-blur-[6px] z-[9999] flex items-center justify-center p-4">
          {/* Backdrop tap to cancel */}
          <div className="absolute inset-0" onClick={onCancel} />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="relative bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-[280px] shadow-2xl overflow-hidden border border-white/50"
          >
            {/* Body */}
            <div className="p-6 flex flex-col items-center text-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl ${styles.iconBg} flex items-center justify-center`}
              >
                {styles.icon}
              </div>
              <div>
                <p className="font-bold text-gray-800 text-base leading-snug">
                  {title}
                </p>
                {message && (
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                    {message}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm font-semibold text-gray-500 active:scale-95 transition-transform"
              >
                Huỷ
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onCancel();
                }}
                className={`flex-1 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-transform ${styles.btn}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
