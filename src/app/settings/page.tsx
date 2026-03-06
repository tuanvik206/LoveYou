"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Save,
  Upload,
  Settings,
  CheckCircle2,
  LogOut,
  Sparkles,
  Bell,
  BellOff,
  Unlink,
} from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import Toast from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { subscribeToPush } from "@/lib/pushUtils";

export default function SettingsPage() {
  const router = useRouter();
  const {
    user,
    partner,
    startDate,
    role,
    loveCode,
    myBirthdate,
    partnerBirthdate,
    myGender,
    partnerGender,
    setUser,
    setPartner,
    setStartDate,
    setMyBirthdate,
    setPartnerBirthdate,
    setMyGender,
    setPartnerGender,
    clear,
  } = useStore();

  const { confirm: showConfirm, ConfirmNode } = useConfirm();
  const { toast, showToast, hideToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isUploadingMyAvatar, setIsUploadingMyAvatar] = useState(false);
  const [isUploadingPartnerAvatar, setIsUploadingPartnerAvatar] =
    useState(false);
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
      // Delay để không block paint đầu tiên của trang
      if (Notification.permission === "granted" && loveCode && user?.name) {
        const t = setTimeout(() => subscribeToPush(loveCode, user.name), 300);
        return () => clearTimeout(t);
      }
    } else {
      setNotifPermission("unsupported");
    }
  }, []);

  const handleRequestNotif = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") {
      // Đăng ký Web Push để nhận thông báo khi app đóng
      if (loveCode && user?.name) {
        await subscribeToPush(loveCode, user.name);
      }
      showToast("Đã bật thông báo nền! 🔔", "success");
    } else {
      showToast("Bạn đã tắt thông báo.", "info");
    }
  };
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const partnerAvatarFileRef = useRef<HTMLInputElement>(null);

  // Format the date to YYYY-MM-DD for the date input
  const getFormattedDate = (dateString?: string | null) => {
    if (!dateString) return "";
    try {
      return dateString.split("T")[0];
    } catch {
      return "";
    }
  };

  const buildFormData = useCallback(() => ({
    name: user?.name ?? "",
    avatar: user?.avatar ?? "",
    partnerName: partner?.name ?? "",
    partnerAvatar: partner?.avatar ?? "",
    startDate: getFormattedDate(startDate),
    myBirthdate: getFormattedDate(myBirthdate),
    partnerBirthdate: getFormattedDate(partnerBirthdate),
    myGender: myGender ?? "",
    partnerGender: partnerGender ?? "",
  }), [user, partner, startDate, myBirthdate, partnerBirthdate, myGender, partnerGender]);

  const [formData, setFormData] = useState(buildFormData);

  // Đồng bộ nếu store thay đổi từ bên ngoài (ví dụ realtime cập nhật partner)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    setFormData(buildFormData());
  }, [buildFormData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setIsSuccess(false);
  };

  const doLogout = async () => {
    await supabase.auth.signOut();
    clear();
    router.replace("/auth/login");
  };

  const handleLogout = () => {
    showConfirm({
      title: "Đăng xuất?",
      message: "Bạn có chắc muốn đăng xuất không?",
      confirmLabel: "Đăng xuất",
      variant: "warning",
      onConfirm: doLogout,
    });
  };

  const doUnlink = async () => {
    if (!loveCode) return;
    setIsLoading(true);
    try {
      // Xoá toàn bộ dữ liệu theo loveCode
      // Lưu ý: messages, diary_entries, daily_checkins, scheduled_messages,
      //         wish_items, photos dùng column "code"
      //         push_subscriptions, user_profiles dùng column "love_code"
      await Promise.all([
        supabase.from("messages").delete().eq("code", loveCode),
        supabase.from("diary_entries").delete().eq("code", loveCode),
        supabase.from("daily_checkins").delete().eq("code", loveCode),
        supabase.from("scheduled_messages").delete().eq("code", loveCode),
        // User already removed love_places line
        supabase.from("wish_items").delete().eq("code", loveCode),
        supabase.from("photos").delete().eq("code", loveCode),
        supabase.from("push_subscriptions").delete().eq("love_code", loveCode),
        supabase.from("user_profiles").delete().eq("love_code", loveCode),
      ]);
      // Xoá couple cuối cùng
      await supabase.from("couples").delete().eq("code", loveCode);
      await supabase.auth.signOut();
      clear();
      router.replace("/auth/login");
    } catch {
      showToast("Có lỗi khi hủy liên kết. Thử lại nhé!", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlink = () => {
    showConfirm({
      title: "Hủy liên kết?",
      message:
        "Toàn bộ tin nhắn, nhật ký, ảnh, địa điểm và dữ liệu của cả hai sẽ bị xóa vĩnh viễn. Không thể khôi phục!",
      confirmLabel: "Xóa tất cả & Hủy liên kết",
      variant: "danger",
      onConfirm: doUnlink,
    });
  };

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isPartner = false,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ảnh tối đa 5MB nhé!", "error");
      return;
    }
    const setUploading = isPartner
      ? setIsUploadingPartnerAvatar
      : setIsUploadingMyAvatar;
    setUploading(true);
    e.target.value = "";
    try {
      // Canvas → JPEG (xử lý được HEIC, PNG, WebP...)
      const uploadBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d")!.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("canvas fail"))),
            "image/jpeg",
            0.88,
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("load fail"));
        };
        img.src = url;
      });
      const fileName = `${loveCode}-${isPartner ? "partner" : "me"}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("avatars")
        .upload(fileName, uploadBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });
      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(data.path);
        const field = isPartner ? "partnerAvatar" : "avatar";
        setFormData((prev) => ({ ...prev, [field]: urlData.publicUrl }));
      } else {
        showToast("Lỗi tải ảnh lên, thử lại!", "error");
      }
    } catch {
      showToast("Lỗi xử lý ảnh, thử lại!", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loveCode || !role) return;

    setIsLoading(true);
    try {
      // 1. Update Supabase
      const updateData: any = {
        start_date: formData.startDate,
        my_birthdate: formData.myBirthdate || null,
        partner_birthdate: formData.partnerBirthdate || null,
        my_gender: formData.myGender || null,
        partner_gender: formData.partnerGender || null,
      };

      const updatedUser = { name: formData.name, avatar: formData.avatar };
      const updatedPartner = {
        name: formData.partnerName,
        avatar: formData.partnerAvatar,
      };

      // Update the specific user's info based on role
      // user1 and user2 columns in DB are JSONB objects {name, avatar}
      if (role === "user1") {
        updateData.user1 = updatedUser;
        updateData.user2 = updatedPartner;
      } else {
        updateData.user2 = updatedUser;
        updateData.user1 = updatedPartner;
      }

      const { error } = await supabase
        .from("couples")
        .update(updateData)
        .eq("code", loveCode);

      if (error) throw error;

      // 2. Update Local Store
      if (user) {
        setUser(updatedUser);
      }
      if (partner) {
        setPartner(updatedPartner);
      }
      setStartDate(formData.startDate);
      setMyBirthdate(formData.myBirthdate);
      setPartnerBirthdate(formData.partnerBirthdate);
      setMyGender(formData.myGender as "male" | "female" | null);
      setPartnerGender(formData.partnerGender as "male" | "female" | null);

      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      showToast("Lỗi lưu thông tin, vui lòng thử lại!", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <main className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 pb-32">
        {/* Header */}
        <section className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-rose-100/40 px-5 safe-pt pb-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center bg-rose-50 rounded-2xl border border-rose-100 text-rose-400 active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-1.5 text-gray-800 tracking-tight">
            <Settings className="w-5 h-5 text-rose-400 shrink-0" /> Cài đặt
          </h1>
          <div className="w-10 h-10" />
        </section>

        {/* Content */}
        <section className="px-6 py-8 max-w-5xl mx-auto w-full">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Grid layout for desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Info - Combined */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100">
                <h2 className="text-sm font-bold text-foreground/50 uppercase tracking-widest mb-6 w-full">
                  Thông tin của bạn
                </h2>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80 pl-2">
                      Tên hiển thị
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Nhập tên của bạn"
                      className="w-full bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 border border-rose-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80 pl-2">
                      Ngày sinh
                    </label>
                    <input
                      type="date"
                      name="myBirthdate"
                      value={formData.myBirthdate}
                      onChange={handleChange}
                      className="w-full bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 border border-rose-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80 pl-2">
                      Giới tính
                    </label>
                    <select
                      name="myGender"
                      value={formData.myGender}
                      onChange={handleChange}
                      className="w-full bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 border border-rose-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                    >
                      <option value="">Chọn giới tính</option>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80 pl-2">
                      Ảnh đại diện
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md bg-rose-50 shrink-0">
                        {formData.avatar ? (
                          <img
                            src={formData.avatar}
                            alt="Avatar Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Upload className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          ref={avatarFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleAvatarUpload(e, false)}
                        />
                        <input
                          type="text"
                          name="avatar"
                          value={formData.avatar}
                          onChange={handleChange}
                          placeholder="URL ảnh"
                          className="w-full bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 border border-rose-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => avatarFileRef.current?.click()}
                        disabled={isUploadingMyAvatar}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-foreground/70 hover:bg-rose-100 transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        {isUploadingMyAvatar ? "Đang tải..." : "Tải ảnh lên"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${prev.name}`,
                          }))
                        }
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                      >
                        <Sparkles className="w-4 h-4" /> Tạo tự động
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Partner Info - Combined */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100">
                <h2 className="text-sm font-bold text-foreground/50 uppercase tracking-widest mb-6 w-full">
                  Thông tin người ấy
                </h2>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80 pl-2">
                      Tên hiển thị
                    </label>
                    <input
                      type="text"
                      name="partnerName"
                      required
                      value={formData.partnerName}
                      onChange={handleChange}
                      placeholder="Nhập tên người ấy"
                      className="w-full bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 border border-rose-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80 pl-2">
                      Ngày sinh
                    </label>
                    <input
                      type="date"
                      name="partnerBirthdate"
                      value={formData.partnerBirthdate}
                      onChange={handleChange}
                      className="w-full bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 border border-rose-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80 pl-2">
                      Giới tính
                    </label>
                    <select
                      name="partnerGender"
                      value={formData.partnerGender}
                      onChange={handleChange}
                      className="w-full bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 border border-rose-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                    >
                      <option value="">Chọn giới tính</option>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80 pl-2">
                      Ảnh đại diện
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md bg-rose-50 shrink-0">
                        {formData.partnerAvatar ? (
                          <img
                            src={formData.partnerAvatar}
                            alt="Partner Avatar Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Upload className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          ref={partnerAvatarFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleAvatarUpload(e, true)}
                        />
                        <input
                          type="text"
                          name="partnerAvatar"
                          value={formData.partnerAvatar}
                          onChange={handleChange}
                          placeholder="URL ảnh"
                          className="w-full bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 border border-rose-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => partnerAvatarFileRef.current?.click()}
                        disabled={isUploadingPartnerAvatar}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-foreground/70 hover:bg-rose-100 transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        {isUploadingPartnerAvatar
                          ? "Đang tải..."
                          : "Tải ảnh lên"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            partnerAvatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${prev.partnerName}`,
                          }))
                        }
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                      >
                        <Sparkles className="w-4 h-4" /> Tạo tự động
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Relationship Settings */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100">
              <h2 className="text-sm font-bold text-foreground/50 uppercase tracking-widest mb-6 w-full">
                Thông tin chung
              </h2>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground/80 pl-2">
                    Ngày bắt đầu yêu nhau
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    value={formData.startDate}
                    onChange={handleChange}
                    className="w-full bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 border border-rose-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-foreground/40 mt-1 pl-2">
                    Lưu ý: Thay đổi ngày này sẽ làm thay đổi số đếm và các cột
                    mốc.
                  </p>
                </div>
              </div>
            </div>

            <button
              disabled={isLoading}
              type="submit"
              className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-white shadow-md transition-all active:scale-[0.98] ${
                isSuccess
                  ? "bg-green-500 shadow-green-200"
                  : "bg-rose-500 hover:bg-rose-600 shadow-rose-200"
              } ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : isSuccess ? (
                <>
                  Đã lưu thông tin <CheckCircle2 className="w-5 h-5" />
                </>
              ) : (
                <>
                  Lưu thay đổi <Save className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Logout */}
          <div className="mt-6 pb-6 space-y-3">
            {/* Thông báo */}
            {notifPermission !== "unsupported" && (
              <div className="bg-white rounded-3xl px-5 py-4 border border-rose-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                    {notifPermission === "granted" ? (
                      <Bell className="w-5 h-5 text-rose-500" />
                    ) : (
                      <BellOff className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700">Thông báo</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {notifPermission === "granted"
                        ? "Đang bật"
                        : notifPermission === "denied"
                          ? "Bị chặn — mở cài đặt trình duyệt để bật"
                          : "Chưa bật"}
                    </p>
                  </div>
                </div>
                {notifPermission !== "denied" && (
                  <button
                    type="button"
                    onClick={handleRequestNotif}
                    disabled={notifPermission === "granted"}
                    className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all active:scale-90 ${
                      notifPermission === "granted"
                        ? "bg-emerald-50 text-emerald-500 cursor-default"
                        : "bg-rose-500 text-white"
                    }`}
                  >
                    {notifPermission === "granted" ? "Đã bật" : "Bật"}
                  </button>
                )}
              </div>
            )}
            {/* Love Code */}
            {loveCode && (
              <div className="bg-rose-50 rounded-3xl px-5 py-4 border border-rose-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-0.5">
                    Mã ghép đôi
                  </p>
                  <p className="text-lg font-black text-rose-600 tracking-widest">
                    {loveCode}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Chia sẻ mã này để ghép đôi với người ấy
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(loveCode);
                    showToast("Đã sao chép mã!", "success");
                  }}
                  className="shrink-0 px-4 py-2 rounded-2xl bg-rose-500 text-white text-xs font-bold active:scale-90 transition-transform"
                >
                  Sao chép
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-red-500 border-2 border-red-100 hover:bg-red-50 transition-all active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5" /> Đăng xuất
            </button>
            <button
              type="button"
              onClick={handleUnlink}
              disabled={isLoading}
              className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-white bg-red-500 hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Unlink className="w-5 h-5" /> Hủy liên kết & Xóa tất cả
            </button>
          </div>
        </section>
      </main>
      <Toast toast={toast} onClose={hideToast} />
      {ConfirmNode}
    </>
  );
}
