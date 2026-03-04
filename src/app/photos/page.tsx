"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, X, Images, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import { resizeImage } from "@/lib/imageUtils";
import { extractStoragePath } from "@/lib/utils";
import ImageLightbox from "@/components/ui/ImageLightbox";
import dayjs from "dayjs";
import Toast from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { useConfirm } from "@/hooks/useConfirm";

type Photo = {
  id: string;
  url: string;
  caption: string | null;
  added_by: string;
  created_at: string;
};

export default function PhotosPage() {
  const { loveCode, user, partner } = useStore();
  const { confirm: showConfirm, ConfirmNode } = useConfirm();
  const { toast, showToast, hideToast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !loveCode) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("photos")
        .select("*")
        .eq("code", loveCode)
        .order("created_at", { ascending: false });
      if (data) setPhotos(data);
    };
    fetch();

    const channel = supabase
      .channel(`photos_${loveCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photos",
          filter: `code=eq.${loveCode}`,
        },
        (payload) => {
          const p = payload.new as Photo;
          // Chỉ thêm ảnh của người ấy — ảnh của mình đã optimistic update rồi
          if (p && p.added_by !== user?.name) {
            setPhotos((prev) => [p, ...prev]);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "photos",
          filter: `code=eq.${loveCode}`,
        },
        (payload) => {
          const d = payload.old as { id: string };
          if (d?.id) setPhotos((prev) => prev.filter((x) => x.id !== d.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMounted, loveCode]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const resized = await resizeImage(file, 1280, 0.82);
    setImageFile(resized);
    setImagePreview(URL.createObjectURL(resized));
  };

  const handleUpload = async () => {
    if (!imageFile || !loveCode || !user || isUploading) return;
    setIsUploading(true);
    try {
      // Kiểm tra session trước khi upload
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        showToast("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại", "error");
        return;
      }

      const contentType = "image/jpeg";
      const path = `${loveCode}/${Date.now()}.jpg`;

      // Convert tất cả định dạng sang JPEG qua canvas
      const uploadBlob = await new Promise<Blob>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(imageFile);
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
              (b) => {
                URL.revokeObjectURL(url);
                resolve(b ?? imageFile);
              },
              "image/jpeg",
              0.85,
            );
          } else {
            URL.revokeObjectURL(url);
            resolve(imageFile);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(imageFile);
        };
        img.src = url;
      });

      const { error: uploadErr } = await supabase.storage
        .from("photos")
        .upload(path, uploadBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType,
        });
      if (uploadErr) {
        console.error("[photos] upload error:", uploadErr);
        throw new Error(uploadErr.message);
      }

      const { data: urlData } = supabase.storage
        .from("photos")
        .getPublicUrl(path);
      const { data: inserted, error: insertErr } = await supabase
        .from("photos")
        .insert({
          code: loveCode,
          url: urlData.publicUrl,
          caption: caption.trim() || null,
          added_by: user.name,
        })
        .select()
        .single();
      if (insertErr) throw new Error(insertErr.message);

      // Optimistic update — hiện ảnh ngay, không chờ realtime
      if (inserted) {
        setPhotos((prev) => [inserted as Photo, ...prev]);
      }
      setShowModal(false);
      setCaption("");
      setImageFile(null);
      setImagePreview(null);
    } catch (err: any) {
      const msg = err?.message ?? "Không xác định";
      console.error("[photos] handleUpload failed:", msg);
      showToast(`Lỗi: ${msg}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const doDelete = async (photo: Photo) => {
    if (deletingId) return;
    setDeletingId(photo.id);
    try {
      const storagePath = extractStoragePath(photo.url);
      if (storagePath) {
        await supabase.storage.from("photos").remove([storagePath]);
      }
      const { error } = await supabase
        .from("photos")
        .delete()
        .eq("id", photo.id);
      if (error) throw error;
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch {
      showToast("Xoá ảnh thất bại, thử lại nhé!", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (photo: Photo) => {
    showConfirm({
      title: "Xoá ảnh này?",
      message: "Hành động không thể hoàn tác.",
      confirmLabel: "Xoá",
      variant: "danger",
      onConfirm: () => doDelete(photo),
    });
  };

  const openLightbox = (index: number) => {
    setLightboxImages(photos.map((p) => p.url));
    setLightboxIndex(index);
  };

  if (!isMounted || !user || !partner) return null;

  const col1 = photos.filter((_, i) => i % 2 === 0);
  const col2 = photos.filter((_, i) => i % 2 === 1);

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
                <Images className="w-4.5 h-4.5 text-rose-400 shrink-0" /> Ảnh
                cùng nhau
              </h1>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                {photos.length > 0
                  ? `${photos.length} kỷ niệm`
                  : "Lưu giữ những khoảnh khắc đẹp"}
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="h-9 px-4 rounded-2xl bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-200 active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </div>
        </header>

        {/* Grid */}
        <section className="px-3 pt-4 pb-32 max-w-2xl mx-auto">
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mb-5 shadow-sm">
                <Images className="w-9 h-9 text-rose-400" />
              </div>
              <p className="text-base font-bold text-gray-500 mb-1">
                Chưa có ảnh nào
              </p>
              <p className="text-sm text-gray-400">
                Nhấn nút trên để thêm kỷ niệm đầu tiên
              </p>
            </div>
          ) : (
            <div className="flex gap-2">
              {/* Cột trái */}
              <div className="flex-1 flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {col1.map((photo, idx) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      myName={user.name}
                      globalIndex={idx * 2}
                      onOpen={openLightbox}
                      onDelete={handleDelete}
                      isDeleting={deletingId === photo.id}
                    />
                  ))}
                </AnimatePresence>
              </div>
              {/* Cột phải */}
              <div className="flex-1 flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {col2.map((photo, idx) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      myName={user.name}
                      globalIndex={idx * 2 + 1}
                      onOpen={openLightbox}
                      onDelete={handleDelete}
                      isDeleting={deletingId === photo.id}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </section>

        {/* Upload Modal */}
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
                    <Images className="w-4 h-4 text-rose-500" /> Ảnh kỷ niệm mới
                  </h3>
                  <button
                    onClick={() => {
                      if (!isUploading) {
                        setShowModal(false);
                        setImagePreview(null);
                        setImageFile(null);
                        setCaption("");
                      }
                    }}
                    className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-3 overflow-y-auto flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {imagePreview ? (
                    <div className="relative rounded-2xl overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="preview"
                        className="w-full max-h-40 object-cover"
                      />
                      <button
                        onClick={() => {
                          setImagePreview(null);
                          setImageFile(null);
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
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-rose-200 rounded-2xl py-4 flex items-center justify-center gap-2 text-gray-400 hover:bg-rose-50 transition-colors active:scale-[0.98]"
                    >
                      <Images className="w-4 h-4" />
                      <span className="text-xs font-semibold">Chọn ảnh</span>
                    </button>
                  )}

                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Thêm chú thích... (tùy chọn)"
                    maxLength={100}
                    className="w-full px-4 py-3 rounded-2xl border border-rose-100 bg-rose-50/60 text-sm placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-rose-300/50 leading-relaxed"
                  />
                </div>

                <div className="flex gap-2 px-5 pb-5 shrink-0">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setImagePreview(null);
                      setImageFile(null);
                      setCaption("");
                    }}
                    disabled={isUploading}
                    className="flex-1 py-3 rounded-2xl text-gray-500 bg-gray-50 text-sm font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!imageFile || isUploading}
                    className="flex-1 py-3 rounded-2xl bg-rose-500 text-white text-sm font-bold shadow-md disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
                      </>
                    ) : (
                      "Lưu ảnh 📸"
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Lightbox */}
        {lightboxImages.length > 0 && (
          <ImageLightbox
            images={lightboxImages}
            startIndex={lightboxIndex}
            onClose={() => setLightboxImages([])}
          />
        )}
        <Toast toast={toast} onClose={hideToast} />
      </main>
      {ConfirmNode}
    </>
  );
}

function PhotoCard({
  photo,
  myName,
  globalIndex,
  onOpen,
  onDelete,
  isDeleting,
}: {
  photo: Photo;
  myName: string;
  globalIndex: number;
  onOpen: (idx: number) => void;
  onDelete: (photo: Photo) => void;
  isDeleting: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="relative overflow-hidden rounded-2xl bg-gray-100"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.09)" }}
    >
      {/* Ảnh */}
      <button onClick={() => onOpen(globalIndex)} className="block w-full">
        <img
          src={photo.url}
          alt={photo.caption || ""}
          className="w-full object-cover"
          style={{ minHeight: 90 }}
          loading="lazy"
        />
      </button>

      {/* Gradient overlay — caption + meta */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-3 pt-8 pb-2 pointer-events-none">
        {photo.caption && (
          <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2 drop-shadow">
            {photo.caption}
          </p>
        )}
        <p className="text-[10px] text-white/65 mt-0.5 font-medium">
          {photo.added_by} · {dayjs(photo.created_at).format("DD/MM/YY")}
        </p>
      </div>

      {/* Nút xoá */}
      {photo.added_by === myName && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(photo);
          }}
          disabled={isDeleting}
          className="absolute bottom-2 right-2 pointer-events-auto w-7 h-7 rounded-xl bg-black/40 active:bg-rose-500 flex items-center justify-center text-white/80 transition-colors"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </motion.div>
  );
}
