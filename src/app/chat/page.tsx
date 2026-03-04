"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  Heart,
  Send,
  ImagePlus,
  X,
  Trash2,
  Clock,
  Images,
  Link2,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import { extractStoragePath } from "@/lib/utils";
import { resizeImage } from "@/lib/imageUtils";
import { sendPushToPartner } from "@/lib/pushUtils";
import dayjs from "dayjs";
import Toast from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
const ImageLightbox = dynamic(() => import("@/components/ui/ImageLightbox"), {
  ssr: false,
});
import { useConfirm } from "@/hooks/useConfirm";

type Message = {
  id: string;
  code: string;
  sender_name: string;
  text: string;
  image_url: string | null;
  created_at: string;
};

export default function ChatPage() {
  const { loveCode, user, partner, isPartnerOnline } = useStore();
  const { confirm: showConfirm, ConfirmNode } = useConfirm();
  const [isMounted, setIsMounted] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { toast, showToast, hideToast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Scheduled messages
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledText, setScheduledText] = useState("");
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  // Info panel (ảnh + link)
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [infoTab, setInfoTab] = useState<"media" | "links">("media");

  const sharedImages = useMemo(
    () => messages.filter((m) => m.image_url).map((m) => m.image_url!),
    [messages],
  );

  const URL_RE = /(https?:\/\/[^\s]+)/g;
  const sharedLinks = useMemo(() => {
    const links: { url: string; sender: string; date: string }[] = [];
    for (const m of messages) {
      if (!m.text) continue;
      const found = m.text.match(URL_RE);
      if (found)
        found.forEach((url) =>
          links.push({ url, sender: m.sender_name, date: m.created_at }),
        );
    }
    return links.reverse();
  }, [messages]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isInitialLoad = useRef(true);
  const loadingMoreRef = useRef(false);

  const scrollToBottom = useCallback((instant = false) => {
    // setTimeout 0 đảm bảo render xong mới scroll
    setTimeout(() => {
      const el = scrollContainerRef.current as HTMLElement | null;
      if (el) {
        el.scrollTop = el.scrollHeight;
        return;
      }
      messagesEndRef.current?.scrollIntoView({
        behavior: instant ? "instant" : "smooth",
        block: "end",
      });
    }, 0);
  }, []);

  useEffect(() => {
    if (messages.length === 0 || loadingMoreRef.current) return;
    scrollToBottom(true);
    isInitialLoad.current = false;
  }, [messages.length, scrollToBottom]);

  // Scroll thêm lần nữa sau khi loading spinner biến mất (DOM đầy đủ)
  useEffect(() => {
    if (!isLoadingMessages && messages.length > 0) {
      // setTimeout lớn hơn để đợi animation/image
      setTimeout(() => {
        const el = scrollContainerRef.current as HTMLElement | null;
        if (el) el.scrollTop = el.scrollHeight;
        else
          messagesEndRef.current?.scrollIntoView({
            behavior: "instant",
            block: "end",
          });
      }, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingMessages]);

  // Gộp tin nhắn cùng người gửi trong vòng 2 phút (kiểu Messenger)
  const GROUP_GAP_MS = 2 * 60 * 1000;
  const processedMessages = useMemo(
    () =>
      messages.map((msg, idx) => {
        const prev = messages[idx - 1];
        const next = messages[idx + 1];
        const isFirstInGroup =
          !prev ||
          prev.sender_name !== msg.sender_name ||
          dayjs(msg.created_at).diff(dayjs(prev.created_at)) > GROUP_GAP_MS;
        const isLastInGroup =
          !next ||
          next.sender_name !== msg.sender_name ||
          dayjs(next.created_at).diff(dayjs(msg.created_at)) > GROUP_GAP_MS;
        const showDateSep =
          !prev || !dayjs(msg.created_at).isSame(dayjs(prev.created_at), "day");
        return { ...msg, isFirstInGroup, isLastInGroup, showDateSep };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages],
  );

  // Fetch initial messages & setup Realtime
  useEffect(() => {
    if (!isMounted || !loveCode) return;

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("code", loveCode)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        setMessages(data.reverse());
        setHasMore(data.length === 50);
      }
      setIsLoadingMessages(false);
    };

    fetchMessages();

    // Deliver scheduled messages that are due
    const deliverScheduled = async () => {
      if (!user) return;
      const { data: due } = await supabase
        .from("scheduled_messages")
        .select("*")
        .eq("code", loveCode)
        .eq("delivered", false)
        .lte("scheduled_at", new Date().toISOString());
      if (!due || due.length === 0) return;
      for (const sm of due) {
        const { data: msg } = await supabase
          .from("messages")
          .insert({
            code: loveCode,
            sender_name: sm.sender_name,
            text: sm.text || null,
            image_url: null,
          })
          .select()
          .single();
        await supabase
          .from("scheduled_messages")
          .update({ delivered: true })
          .eq("id", sm.id);
        if (msg && sm.sender_name === user.name) {
          setMessages((prev) => [...prev, msg as Message]);
        }
      }
    };
    deliverScheduled();

    // Subscribe to new messages with status tracking
    const channel = supabase
      .channel(`chat_${loveCode}`, {
        config: {
          broadcast: { self: false },
          presence: { key: user?.name || "anonymous" },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `code=eq.${loveCode}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg && newMsg.sender_name !== user?.name) {
            setMessages((prev) => [...prev, newMsg]);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `code=eq.${loveCode}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          if (deleted?.id)
            setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `code=eq.${loveCode}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          if (updated?.id) {
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m)),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMounted, loveCode]);

  const loadMoreMessages = async () => {
    if (!loveCode || messages.length === 0) return;
    loadingMoreRef.current = true;
    const oldest = messages[0].created_at;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("code", loveCode)
      .order("created_at", { ascending: false })
      .lt("created_at", oldest)
      .limit(50);
    if (data) {
      setMessages((prev) => [...data.reverse(), ...prev]);
      setHasMore(data.length === 50);
      setTimeout(() => {
        loadingMoreRef.current = false;
      }, 50);
    } else {
      loadingMoreRef.current = false;
    }
  };

  const handleDeleteMessage = async (id: string) => {
    const msg = messages.find((m) => m.id === id);
    setSelectedMsgId(null);
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) showToast("Không xóa được tin nhắn", "error");
    else {
      if (msg?.image_url) {
        const path = extractStoragePath(msg.image_url);
        if (path) await supabase.storage.from("chat-images").remove([path]);
      }
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleConfirmDeleteMessage = (id: string) => {
    showConfirm({
      title: "Xoá tin nhắn này?",
      message: "Tin nhắn sẽ bị xóa vĩnh viễn.",
      confirmLabel: "Xoá",
      variant: "danger",
      onConfirm: () => handleDeleteMessage(id),
    });
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditText(msg.text || "");
    setSelectedMsgId(null);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || !editingMsgId) return;

    const trimmedText = editText.trim();
    const oldMsg = messages.find((m) => m.id === editingMsgId);

    // Optimistic update for smooth UX
    setMessages((prev) =>
      prev.map((m) =>
        m.id === editingMsgId ? { ...m, text: trimmedText } : m,
      ),
    );

    setEditingMsgId(null);
    setEditText("");

    const { error } = await supabase
      .from("messages")
      .update({ text: trimmedText })
      .eq("id", editingMsgId);

    if (error) {
      showToast("Không sửa được tin nhắn", "error");
      // Rollback on error
      if (oldMsg) {
        setMessages((prev) =>
          prev.map((m) => (m.id === editingMsgId ? oldMsg : m)),
        );
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditText("");
  };

  const handleScheduleMessage = async () => {
    if (!scheduledText.trim() || !scheduleDateTime || !loveCode || !user)
      return;
    const scheduled_at = new Date(scheduleDateTime).toISOString();
    const { error } = await supabase.from("scheduled_messages").insert({
      code: loveCode,
      sender_name: user.name,
      text: scheduledText.trim(),
      scheduled_at,
    });
    if (error) {
      showToast("Không lưu được tin nhắn!", "error");
    } else {
      showToast("Đã lưu tin nhắn hẹn giờ! ⏰", "success");
      setShowScheduleModal(false);
      setScheduledText("");
      setScheduleDateTime("");
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ảnh tối đa 5MB nhé!", "error");
      return;
    }
    e.target.value = "";
    const resized = await resizeImage(file);
    setSelectedImage(resized);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(resized);
  };

  const uploadChatImage = async (file: File): Promise<string | null> => {
    const fileName = `${loveCode}-${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from("chat-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/jpeg",
      });
    if (error) {
      return null;
    }
    const { data: urlData } = supabase.storage
      .from("chat-images")
      .getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() && !selectedImage) return;
    if (!user || !loveCode) return;

    const textToSend = newMessage.trim();
    setNewMessage("");
    setIsSending(true);

    try {
      let imageUrl: string | null = null;
      if (selectedImage) {
        setIsUploading(true);
        imageUrl = await uploadChatImage(selectedImage);
        if (!imageUrl) {
          showToast("Đã lỗi khi tải ảnh, thử lại!", "error");
          setIsUploading(false);
          setIsSending(false);
          return;
        }
        setSelectedImage(null);
        setImagePreview(null);
        setIsUploading(false);
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({
          code: loveCode,
          sender_name: user.name,
          text: textToSend || null,
          image_url: imageUrl,
        })
        .select()
        .single();

      if (error) {
        showToast("Không gửi được tin nhắn", "error");
      } else if (data) {
        // Optimistic update: Thêm tin nhắn ngay vào UI
        setMessages((prev) => [...prev, data as Message]);
        // Cuộn xuống tin nhắn mới nhất ngay lập tức
        scrollToBottom(true);
        // Gửi Web Push nền cho người nhận (kể cả khi app đóng)
        if (partner?.name) {
          const pushBody = textToSend
            ? textToSend.slice(0, 100)
            : "📷 Đã gửi một ảnh";
          sendPushToPartner(
            loveCode!,
            user!.name,
            `💬 ${user!.name} vừa nhắn`,
            pushBody,
            "/chat",
          );
        }
      }
    } catch (err) {
      showToast("Không gửi được tin nhắn", "error");
    } finally {
      setIsSending(false);
    }
  };

  if (!isMounted || !user || !partner) return null;

  // Render text với link click được
  const URL_SPLIT = /(https?:\/\/[^\s]+)/g;
  function renderText(text: string, isMe: boolean) {
    const parts = text.split(URL_SPLIT);
    return parts.map((part, i) =>
      part.startsWith("http://") || part.startsWith("https://") ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`underline underline-offset-2 break-all ${
            isMe
              ? "text-white/90 hover:text-white"
              : "text-rose-500 hover:text-rose-600"
          }`}
        >
          {part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }

  return (
    <>
      {/* ── Chat fullscreen container ── */}
      {/* z-45: sits above normal content but below BottomNav (z-50) intentionally;
          input paddingBottom clears the nav visually */}
      <div
        className="fixed inset-0 flex flex-col bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40"
        style={{ zIndex: 45 }}
      >
        {/* ── Header ── */}
        <header
          className="shrink-0 bg-white/85 backdrop-blur-xl border-b border-rose-100/40 px-4 pb-3"
          style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={partner.avatar}
                alt={partner.name}
                className="w-10 h-10 rounded-full border border-rose-100 bg-rose-50 object-cover"
              />
              <div
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white transition-colors ${
                  isPartnerOnline ? "bg-green-400" : "bg-gray-300"
                }`}
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-800 leading-tight">
                {partner.name}
              </h1>
              <p
                className={`text-xs font-medium ${
                  isPartnerOnline ? "text-green-500" : "text-gray-400"
                }`}
              >
                {isPartnerOnline ? "Đang online" : "Ngoại tuyến"}
              </p>
            </div>
            <button
              onClick={() => setShowInfoPanel(true)}
              className="ml-auto w-9 h-9 flex items-center justify-center rounded-xl bg-rose-50 text-rose-400 active:scale-90 transition-transform"
            >
              <Images className="w-4.5 h-4.5" />
            </button>
          </div>
        </header>

        {/* ── Messages Area ── */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-1"
        >
          {/* Nút tải thêm */}
          {hasMore && (
            <button
              onClick={loadMoreMessages}
              className="w-full text-xs font-semibold text-gray-400 hover:text-rose-500 py-2 transition-colors"
            >
              ↑ Tải tin cũ hơn
            </button>
          )}

          {/* Loading skeleton */}
          {isLoadingMessages ? (
            <div className="space-y-3 pt-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`flex items-end gap-2 ${
                    i % 2 === 0 ? "justify-start" : "justify-end"
                  }`}
                >
                  {i % 2 === 0 && (
                    <div className="w-7 h-7 rounded-full bg-rose-100 animate-pulse shrink-0" />
                  )}
                  <div
                    className={`h-10 rounded-2xl animate-pulse bg-rose-100 ${
                      i % 2 === 0 ? "w-48" : "w-36"
                    }`}
                  />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center shadow-sm">
                <Heart className="w-9 h-9 text-rose-400" />
              </div>
              <p className="text-base font-bold text-gray-500">
                Chưa có tin nhắn nào
              </p>
              <p className="text-sm text-gray-400">
                Hãy là người đầu tiên gửi lời yêu thương 💕
              </p>
            </div>
          ) : (
            <>
              {processedMessages.map((msg) => {
                const isMe = msg.sender_name === user.name;
                const { isFirstInGroup, isLastInGroup, showDateSep } = msg;

                // Bo góc kiểu Messenger
                const bubbleRound = (() => {
                  if (isFirstInGroup && isLastInGroup) return "rounded-[20px]";
                  if (isMe) {
                    if (isFirstInGroup)
                      return "rounded-[20px] rounded-br-[5px]";
                    if (isLastInGroup) return "rounded-[20px] rounded-tr-[5px]";
                    return "rounded-[20px] rounded-r-[5px]";
                  } else {
                    if (isFirstInGroup)
                      return "rounded-[20px] rounded-bl-[5px]";
                    if (isLastInGroup) return "rounded-[20px] rounded-tl-[5px]";
                    return "rounded-[20px] rounded-l-[5px]";
                  }
                })();

                const dateLabel = (() => {
                  const d = dayjs(msg.created_at);
                  const today = dayjs();
                  if (d.isSame(today, "day")) return "Hôm nay";
                  if (d.isSame(today.subtract(1, "day"), "day"))
                    return "Hôm qua";
                  return d.format("DD/MM/YYYY");
                })();

                return (
                  <div key={msg.id}>
                    {/* Phân cách ngày */}
                    {showDateSep && (
                      <div className="flex items-center gap-2 my-4">
                        <div className="flex-1 h-px bg-rose-100/60" />
                        <span className="text-[10px] font-bold text-gray-400 px-2.5 py-0.5 bg-rose-50 rounded-full border border-rose-100/60">
                          {dateLabel}
                        </span>
                        <div className="flex-1 h-px bg-rose-100/60" />
                      </div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex items-end gap-1.5 ${
                        isMe ? "justify-end" : "justify-start"
                      } ${isFirstInGroup ? "mt-3" : "mt-[2px]"}`}
                      onClick={() => {
                        if (isMe)
                          setSelectedMsgId(
                            selectedMsgId === msg.id ? null : msg.id,
                          );
                      }}
                    >
                      {/* Avatar bên trái (partner) */}
                      {!isMe &&
                        (isLastInGroup ? (
                          <img
                            src={partner.avatar}
                            alt={partner.name}
                            loading="lazy"
                            decoding="async"
                            className="w-7 h-7 rounded-full shrink-0 mb-1 border border-white/50 shadow-sm object-cover"
                          />
                        ) : (
                          <div className="w-7 shrink-0" />
                        ))}

                      <div
                        className={`max-w-[75%] flex flex-col ${
                          isMe ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`text-sm shadow-sm overflow-hidden ${
                            isMe
                              ? `bg-gradient-to-br from-rose-400 to-rose-500 text-white ${bubbleRound}`
                              : `bg-white/90 text-gray-800 border border-white/50 ${bubbleRound}`
                          }`}
                        >
                          {msg.image_url && (
                            <img
                              src={msg.image_url}
                              alt="ảnh"
                              loading="lazy"
                              decoding="async"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxImages([msg.image_url!]);
                                setLightboxIndex(0);
                              }}
                              className="max-w-[240px] w-full object-cover rounded-[18px] block cursor-zoom-in"
                            />
                          )}
                          {msg.text && (
                            <p
                              className={`px-3.5 py-2 leading-relaxed ${
                                msg.image_url ? "pt-1.5" : ""
                              }`}
                            >
                              {renderText(msg.text, isMe)}
                            </p>
                          )}
                        </div>

                        {/* Giờ gửi — chỉ hiện cho tin cuối trong nhóm */}
                        {isLastInGroup && (
                          <span className="text-[10px] text-gray-400 mt-1 px-1 font-medium">
                            {dayjs(msg.created_at).format("HH:mm")}
                          </span>
                        )}

                        <AnimatePresence>
                          {isMe && selectedMsgId === msg.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="flex items-center gap-2 px-1 mt-0.5"
                            >
                              {msg.text && (
                                <button
                                  onClick={() => handleEditMessage(msg)}
                                  className="flex items-center gap-1 text-[10px] text-rose-500 font-semibold"
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                  Sửa
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  handleConfirmDeleteMessage(msg.id)
                                }
                                className="flex items-center gap-1 text-[10px] text-red-400 font-semibold"
                              >
                                <Trash2 className="w-3 h-3" /> Xóa
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Avatar bên phải (mình) */}
                      {isMe &&
                        (isLastInGroup ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            loading="lazy"
                            decoding="async"
                            className="w-7 h-7 rounded-full shrink-0 mb-1 border border-white/50 shadow-sm object-cover"
                          />
                        ) : (
                          <div className="w-7 shrink-0" />
                        ))}
                    </motion.div>
                  </div>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Area ── sits at bottom of flex, padding clears the fixed bottom nav */}
        <div
          className="shrink-0 bg-white/90 backdrop-blur-xl border-t border-rose-100/40 px-4 pt-2"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom) + 3.75rem)",
          }}
        >
          {/* Edit Mode Banner */}
          <AnimatePresence>
            {editingMsgId && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg
                    className="w-3.5 h-3.5 text-rose-500 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  <span className="text-xs font-semibold">
                    Đang sửa tin nhắn
                  </span>
                </div>
                <button
                  onClick={handleCancelEdit}
                  className="text-xs text-gray-400 font-semibold"
                >
                  Hủy
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Image Preview */}
          {imagePreview && (
            <div className="flex items-center gap-2 mb-2">
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="w-14 h-14 object-cover rounded-2xl border-2 border-rose-200"
                />
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {isUploading && (
                <span className="text-xs text-gray-400 animate-pulse">
                  Đang tải ảnh...
                </span>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingMsgId) handleSaveEdit();
              else handleSendMessage();
            }}
            className="flex items-center gap-2 h-11 bg-white border border-rose-100/80 rounded-full pl-3 pr-1 shadow-sm focus-within:border-rose-300 transition-colors"
          >
            {!editingMsgId && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 active:text-rose-400 transition-colors shrink-0"
                >
                  <ImagePlus className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(true)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 active:text-rose-400 transition-colors shrink-0"
                >
                  <Clock className="w-5 h-5" />
                </button>
              </>
            )}
            <input
              type="text"
              value={editingMsgId ? editText : newMessage}
              onChange={(e) =>
                editingMsgId
                  ? setEditText(e.target.value)
                  : setNewMessage(e.target.value)
              }
              placeholder={editingMsgId ? "Nội dung mới..." : "Nhắn tin..."}
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400 min-w-0"
            />
            <button
              type="submit"
              disabled={
                editingMsgId
                  ? !editText.trim()
                  : (!newMessage.trim() && !selectedImage) ||
                    isSending ||
                    isUploading
              }
              className="w-9 h-9 rounded-full flex items-center justify-center bg-rose-500 text-white disabled:bg-rose-100 disabled:text-rose-300 transition-all active:scale-90 shrink-0 my-0.5"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Toast */}
        <Toast toast={toast} onClose={hideToast} />
      </div>
      {/* ── End fixed chat container ── */}

      {/* ── Lightbox ── */}
      {lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          onClose={() => {
            setLightboxImages([]);
            setLightboxIndex(0);
          }}
        />
      )}

      {/* ── Info Panel (ảnh + link) ── */}
      <AnimatePresence>
        {showInfoPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
              onClick={() => setShowInfoPanel(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white z-[61] flex flex-col shadow-2xl"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              {/* Panel header */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-rose-100/50">
                <button
                  onClick={() => setShowInfoPanel(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 active:scale-90 transition-transform"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <h2 className="text-base font-bold text-gray-800">
                  Nội dung đã chia sẻ
                </h2>
              </div>

              {/* Tabs */}
              <div className="flex px-4 pt-3 pb-2 gap-2">
                {(["media", "links"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setInfoTab(tab)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      infoTab === tab
                        ? "bg-rose-500 text-white shadow-sm"
                        : "bg-rose-50 text-rose-400"
                    }`}
                  >
                    {tab === "media" ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Images className="w-3.5 h-3.5" /> Ảnh (
                        {sharedImages.length})
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5" /> Link (
                        {sharedLinks.length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 pb-8">
                {infoTab === "media" ? (
                  sharedImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Images className="w-10 h-10 text-rose-200 mb-3" />
                      <p className="text-sm font-bold text-gray-400">
                        Chưa có ảnh nào
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1 pt-2">
                      {sharedImages.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setLightboxImages(sharedImages);
                            setLightboxIndex(i);
                            setShowInfoPanel(false);
                          }}
                          className="aspect-square rounded-xl overflow-hidden bg-rose-50 active:opacity-80 transition-opacity"
                        >
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )
                ) : sharedLinks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Link2 className="w-10 h-10 text-rose-200 mb-3" />
                    <p className="text-sm font-bold text-gray-400">
                      Chưa có link nào
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pt-2">
                    {sharedLinks.map((item, i) => {
                      let display = item.url;
                      try {
                        const u = new URL(item.url);
                        display =
                          u.hostname + (u.pathname !== "/" ? u.pathname : "");
                      } catch {}
                      return (
                        <a
                          key={i}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-2xl bg-rose-50/70 border border-rose-100/60 active:scale-[0.98] transition-transform"
                        >
                          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                            <Link2 className="w-4 h-4 text-rose-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">
                              {display}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {item.sender} ·{" "}
                              {dayjs(item.date).format("DD/MM/YY HH:mm")}
                            </p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Schedule message modal — z-[55] to sit above nav (z-50) */}
      <AnimatePresence>
        {showScheduleModal && (
          <div
            className="fixed inset-0 z-[55] overflow-y-auto flex items-center justify-center px-4 py-8 bg-black/40 backdrop-blur-sm"
            onClick={(e) =>
              e.target === e.currentTarget && setShowScheduleModal(false)
            }
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] my-auto"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-rose-50 shrink-0">
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-500" /> Gửi tin hẹn giờ
                </h3>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3 overflow-y-auto flex-1">
                <textarea
                  value={scheduledText}
                  onChange={(e) => setScheduledText(e.target.value)}
                  placeholder="Nội dung tin nhắn..."
                  rows={3}
                  className="w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-300/50"
                />
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  className="w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300/50"
                />
              </div>
              <div className="flex gap-2 px-5 pb-5 shrink-0">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 py-3 rounded-2xl text-gray-500 bg-gray-50 text-sm font-semibold"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleScheduleMessage}
                  disabled={!scheduledText.trim() || !scheduleDateTime}
                  className="flex-1 py-3 rounded-2xl bg-rose-500 text-white font-bold text-sm disabled:opacity-50 transition-opacity"
                >
                  Hẹn gửi ⏰
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {ConfirmNode}
    </>
  );
}
