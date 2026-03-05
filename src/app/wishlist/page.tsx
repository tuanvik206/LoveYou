"use client";

import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Sparkles,
  X,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import dayjs from "dayjs";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";

type WishItem = {
  id: string;
  title: string;
  emoji: string;
  added_by: string;
  is_done: boolean;
  created_at: string;
};

const QUICK_EMOJIS = [
  "🌟",
  "✈️",
  "🎉",
  "🍜",
  "🎁",
  "📸",
  "🎶",
  "🛍️",
  "🌸",
  "🏖️",
  "🍰",
  "💍",
];

export default function WishlistPage() {
  const { loveCode, user, partner } = useStore();
  const { confirm: showConfirm, ConfirmNode } = useConfirm();
  const { toast, hideToast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [items, setItems] = useState<WishItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEmoji, setNewEmoji] = useState("🌟");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !loveCode) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("wish_items")
        .select("*")
        .eq("code", loveCode)
        .order("is_done", { ascending: true })
        .order("created_at", { ascending: false });
      if (data) setItems(data);
    };
    fetch();

    const channel = supabase
      .channel(`wishes_${loveCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wish_items",
          filter: `code=eq.${loveCode}`,
        },
        () => {
          fetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMounted, loveCode]);

  useEffect(() => {
    if (showModal) setTimeout(() => titleInputRef.current?.focus(), 100);
  }, [showModal]);

  const handleAdd = async () => {
    if (!newTitle.trim() || !loveCode || !user || isSubmitting) return;
    setIsSubmitting(true);
    const optimistic: WishItem = {
      id: `temp-${Date.now()}`,
      title: newTitle.trim(),
      emoji: newEmoji,
      added_by: user.name,
      is_done: false,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [optimistic, ...prev]);
    setShowModal(false);
    const { data, error } = await supabase
      .from("wish_items")
      .insert({
        code: loveCode,
        title: optimistic.title,
        emoji: optimistic.emoji,
        added_by: optimistic.added_by,
      })
      .select()
      .single();
    if (error) {
      setItems((prev) => prev.filter((i) => i.id !== optimistic.id));
    } else if (data) {
      setItems((prev) => prev.map((i) => (i.id === optimistic.id ? data : i)));
    }
    setIsSubmitting(false);
  };

  const handleToggle = async (item: WishItem) => {
    await supabase
      .from("wish_items")
      .update({ is_done: !item.is_done })
      .eq("id", item.id);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_done: !i.is_done } : i)),
    );
  };

  const doDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from("wish_items").delete().eq("id", id);
    setDeletingId(null);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleDelete = (id: string) => {
    showConfirm({
      title: "Xoá ước mơ này?",
      message: "Hành động không thể hoàn tác.",
      confirmLabel: "Xoá",
      variant: "danger",
      onConfirm: () => doDelete(id),
    });
  };

  if (!isMounted || !user || !partner) return null;

  const pending = items.filter((i) => !i.is_done);
  const done = items.filter((i) => i.is_done);

  return (
    <>
      <main className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40">
        {/* Header */}
        <header
          className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-rose-100/50 px-5 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
                <Star className="w-4.5 h-4.5 text-rose-400 shrink-0" /> Ước mơ
              </h1>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                {items.length > 0
                  ? `${pending.length} chưa làm · ${done.length} đã làm`
                  : "Những điều muốn làm cùng nhau"}
              </p>
            </div>
            <button
              onClick={() => {
                setNewTitle("");
                setNewEmoji("🌟");
                setShowModal(true);
              }}
              className="h-9 px-4 rounded-2xl bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-200 active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </div>
        </header>

        <section className="px-4 pt-5 pb-32 max-w-2xl mx-auto flex flex-col gap-2">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mb-5 shadow-sm">
                <Star className="w-9 h-9 text-rose-400" />
              </div>
              <p className="text-base font-bold text-gray-500 mb-1">
                Chưa có ước mơ nào
              </p>
              <p className="text-sm text-gray-400">
                Nhấn + để thêm điều muốn làm cùng nhau
              </p>
            </div>
          )}

          {/* Pending */}
          <AnimatePresence initial={false}>
            {pending.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-sm border border-rose-100/60 flex items-center gap-3 px-4 py-3"
              >
                <button
                  onClick={() => handleToggle(item)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 active:text-rose-500 transition-all"
                >
                  <Circle className="w-5 h-5" />
                </button>
                <span className="text-xl leading-none shrink-0">
                  {item.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-700 leading-tight truncate">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {item.added_by} ·{" "}
                    {dayjs(item.created_at).format("DD/MM/YY")}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 active:text-rose-500 active:bg-rose-50 transition-all"
                >
                  {deletingId === item.id ? (
                    <span className="w-4 h-4 border-2 border-gray-300 border-t-rose-400 rounded-full animate-spin block" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Done section */}
          {done.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-3 mb-1">
                <div className="flex-1 h-px bg-emerald-100" />
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đã làm ({done.length})
                </span>
                <div className="flex-1 h-px bg-emerald-100" />
              </div>
              <AnimatePresence initial={false}>
                {done.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 0.65, y: 0 }}
                    exit={{ opacity: 0, x: 30, height: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="bg-white/60 backdrop-blur-sm rounded-3xl border border-emerald-100/60 flex items-center gap-3 px-4 py-3"
                  >
                    <button
                      onClick={() => handleToggle(item)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-emerald-400 active:text-emerald-600 transition-all"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <span className="text-xl leading-none shrink-0 grayscale">
                      {item.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-400 leading-tight truncate line-through">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-gray-300 mt-0.5">
                        {item.added_by} ·{" "}
                        {dayjs(item.created_at).format("DD/MM/YY")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 active:text-rose-500 active:bg-rose-50 transition-all"
                    >
                      {deletingId === item.id ? (
                        <span className="w-4 h-4 border-2 border-gray-300 border-t-rose-400 rounded-full animate-spin block" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </section>

        {/* FAB removed — use header + button */}
        {/* Add Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 overflow-y-auto flex items-center justify-center px-4 py-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
                className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh] my-auto"
              >
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-rose-50 shrink-0">
                  <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-rose-500" /> Ước mơ mới
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-3 overflow-y-auto flex-1">
                  {/* Emoji picker */}
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Chọn icon
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setNewEmoji(e)}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all active:scale-85 ${
                          newEmoji === e
                            ? "bg-rose-100 ring-2 ring-rose-400 scale-110"
                            : "bg-gray-50 hover:bg-rose-50"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>

                  <input
                    ref={titleInputRef}
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="Muốn làm gì? (ví dụ: Du lịch Đà Lạt)"
                    maxLength={80}
                    className="w-full px-4 py-3 rounded-2xl border border-rose-100 bg-rose-50/60 text-sm placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-rose-300/50 leading-relaxed"
                  />
                </div>

                <div className="flex gap-2 px-5 pb-5 shrink-0">
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-2xl text-gray-500 bg-gray-50 text-sm font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!newTitle.trim() || isSubmitting}
                    className="flex-1 py-3 rounded-2xl bg-rose-500 text-white text-sm font-bold shadow-md disabled:opacity-50 transition-opacity"
                  >
                    {isSubmitting ? "Đang thêm..." : `Thêm ${newEmoji}`}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <Toast toast={toast} onClose={hideToast} />
      </main>
      {ConfirmNode}
    </>
  );
}
