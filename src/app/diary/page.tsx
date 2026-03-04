"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookHeart, Plus, X, ImagePlus, Trash2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import { extractStoragePath } from "@/lib/utils";
import { resizeImage } from "@/lib/imageUtils";
import dayjs from "dayjs";
import Toast from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
const ImageLightbox = dynamic(() => import("@/components/ui/ImageLightbox"), {
  ssr: false,
});
import { useConfirm } from "@/hooks/useConfirm";

type DiaryEntry = {
  id: string;
  content: string;
  author: string;
  image_url: string | null;
  created_at: string;
};
export default function DiaryPage() {
  const router = useRouter();
  const { loveCode, user, partner } = useStore();
  const { confirm: showConfirm, ConfirmNode } = useConfirm();
  const [isMounted, setIsMounted] = useState(false);

  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const diaryImageInputRef = useRef<HTMLInputElement>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !loveCode) return;

    const fetchDiaries = async () => {
      const { data } = await supabase
        .from("diary_entries")
        .select("*")
        .eq("code", loveCode)
        .order("created_at", { ascending: false });
      if (data) setDiaries(data);
    };
    fetchDiaries();

    const channel = supabase
      .channel(`diary_${loveCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "diary_entries",
          filter: `code=eq.${loveCode}`,
        },
        (payload) => {
          const e = payload.new as DiaryEntry;
          if (e && e.author !== user?.name) setDiaries((prev) => [e, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "diary_entries",
          filter: `code=eq.${loveCode}`,
        },
        (payload) => {
          const d = payload.old as { id: string };
          if (d?.id) setDiaries((prev) => prev.filter((x) => x.id !== d.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMounted, loveCode]);

  const handleAddDiary = async () => {
    if (!newContent.trim() && !imageFile) return;
    if (!user || !loveCode) return;
    setIsSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        setIsUploading(true);
        // Canvas-convert to JPEG (works for all formats incl. HEIC/PNG/WebP)
        const uploadBlob = await new Promise<Blob>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d")!.drawImage(img, 0, 0);
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error("canvas fail"))),
              "image/jpeg",
              0.88,
            );
          };
          img.onerror = reject;
          img.src = URL.createObjectURL(imageFile);
        });
        const fileName = `${loveCode}-${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
          .from("diary-images")
          .upload(fileName, uploadBlob, {
            cacheControl: "3600",
            upsert: false,
            contentType: "image/jpeg",
          });
        if (!error && data) {
          const { data: urlData } = supabase.storage
            .from("diary-images")
            .getPublicUrl(data.path);
          imageUrl = urlData.publicUrl;
        }
        setIsUploading(false);
        if (!imageUrl) {
          showToast("Tải ảnh lên thất bại!", "error");
          setIsSubmitting(false);
          return;
        }
      }
      const { data: newEntry, error: insertError } = await supabase
        .from("diary_entries")
        .insert({
          code: loveCode,
          content: newContent.trim(),
          author: user.name,
          image_url: imageUrl,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (newEntry) setDiaries((prev) => [newEntry as DiaryEntry, ...prev]);
      showToast("Đã lưu kỷ niệm! 💕", "success");
      setIsAdding(false);
      setNewContent("");
      setImageFile(null);
      setImagePreview(null);
    } catch {
      showToast("Đã có lỗi xảy ra!", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const doDeleteDiary = async (id: string) => {
    const entry = diaries.find((d) => d.id === id);
    const { error } = await supabase
      .from("diary_entries")
      .delete()
      .eq("id", id);
    if (error) {
      showToast("Không xóa được!", "error");
      return;
    }
    if (entry?.image_url) {
      const path = extractStoragePath(entry.image_url);
      if (path) await supabase.storage.from("diary-images").remove([path]);
    }
    setDiaries((prev) => prev.filter((d) => d.id !== id));
    showToast("Đã xóa kỷ niệm", "info");
  };

  const handleDeleteDiary = (id: string) => {
    showConfirm({
      title: "Xoá nhật ký này?",
      message: "Kỷ niệm sẽ bị xoá vĩnh viễn.",
      confirmLabel: "Xoá",
      variant: "danger",
      onConfirm: () => doDeleteDiary(id),
    });
  };

  if (!isMounted || !user || !partner) return null;

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
                <BookHeart className="w-4.5 h-4.5 text-rose-400 shrink-0" />{" "}
                Nhật ký
              </h1>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                {diaries.length > 0
                  ? `${diaries.length} kỷ niệm`
                  : "Lưu giữ từng khoảnh khắc"}
              </p>
            </div>
            <button
              onClick={() => setIsAdding(true)}
              className="h-9 px-4 rounded-2xl bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-200 active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </div>
        </header>

        {/* Feed */}
        <section className="px-4 pt-5 pb-32 space-y-4">
          {diaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mb-5 shadow-sm">
                <BookHeart className="w-9 h-9 text-rose-400" />
              </div>
              <p className="text-base font-bold text-gray-500 mb-1">
                Chưa có kỷ niệm nào
              </p>
              <p className="text-sm text-gray-400">
                Bấm + để ghi lại khoảnh khắc đầu tiên 💕
              </p>
            </div>
          ) : (
            diaries.map((item, idx) => {
              const isMe = item.author === user.name;
              const dateObj = dayjs(item.created_at);
              const isToday = dateObj.isSame(dayjs(), "day");
              const isYesterday = dateObj.isSame(
                dayjs().subtract(1, "day"),
                "day",
              );
              const dateLabel = isToday
                ? "Hôm nay"
                : isYesterday
                  ? "Hôm qua"
                  : dateObj.format("DD/MM/YYYY");

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx < 6 ? idx * 0.06 : 0 }}
                  className={`rounded-3xl shadow-sm border overflow-hidden ${
                    isMe
                      ? "bg-white border-rose-100/60"
                      : "bg-rose-50/80 border-rose-200/40"
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${isMe ? "bg-rose-500 text-white" : "bg-rose-200 text-rose-700"}`}
                      >
                        {item.author.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-700">
                          {isMe ? "Bạn" : item.author}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {dateLabel} · {dateObj.format("HH:mm")}
                        </p>
                      </div>
                    </div>

                    {isMe && (
                      <button
                        onClick={() => handleDeleteDiary(item.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 active:text-red-500 active:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {item.content && (
                    <p className="px-4 pb-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>
                  )}

                  {item.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt="diary"
                      loading="lazy"
                      decoding="async"
                      onClick={() => setLightboxImages([item.image_url!])}
                      className="w-full max-h-72 object-cover cursor-zoom-in"
                      style={{ borderTop: "1px solid rgba(244,114,182,0.1)" }}
                    />
                  )}
                </motion.div>
              );
            })
          )}
        </section>

        {/* Add Modal */}
        <AnimatePresence>
          {isAdding && (
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
                    <BookHeart className="w-4 h-4 text-rose-500" /> Kỷ niệm mới
                  </h3>
                  <button
                    onClick={() => setIsAdding(false)}
                    className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-3 overflow-y-auto flex-1">
                  <textarea
                    className="w-full h-28 p-4 bg-rose-50/60 border border-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300/50 rounded-2xl resize-none text-sm placeholder:text-gray-400 leading-relaxed"
                    placeholder="Hôm nay có gì đặc biệt không? 💕"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    disabled={isSubmitting}
                    autoFocus
                  />

                  <input
                    ref={diaryImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        showToast("Ảnh tối đa 5MB!", "error");
                        return;
                      }
                      e.target.value = "";
                      const resized = await resizeImage(file);
                      setImageFile(resized);
                      const reader = new FileReader();
                      reader.onloadend = () =>
                        setImagePreview(reader.result as string);
                      reader.readAsDataURL(resized);
                    }}
                  />

                  {imagePreview ? (
                    <div className="relative rounded-2xl overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="preview"
                        className="w-full max-h-40 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => diaryImageInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-rose-200 rounded-2xl py-4 flex items-center justify-center gap-2 text-gray-400 hover:bg-rose-50 transition-colors active:scale-[0.98]"
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span className="text-xs font-semibold">Thêm ảnh</span>
                    </button>
                  )}
                </div>

                <div className="flex gap-2 px-5 pb-5 shrink-0">
                  <button
                    onClick={() => setIsAdding(false)}
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-2xl text-gray-500 bg-gray-50 text-sm font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={handleAddDiary}
                    disabled={
                      isSubmitting ||
                      isUploading ||
                      (!newContent.trim() && !imageFile)
                    }
                    className="flex-1 py-3 rounded-2xl bg-rose-500 text-white text-sm font-bold shadow-md disabled:opacity-50 transition-opacity"
                  >
                    {isSubmitting ? "Đang lưu..." : "Lưu lại 💕"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <Toast toast={toast} onClose={hideToast} />
        {lightboxImages.length > 0 && (
          <ImageLightbox
            images={lightboxImages}
            onClose={() => setLightboxImages([])}
          />
        )}
      </main>
      {ConfirmNode}
    </>
  );
}
