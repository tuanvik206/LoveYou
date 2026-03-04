import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts the storage object path from a Supabase public URL.
 * URL format: https://xxx.supabase.co/storage/v1/object/public/bucket-name/path/to/file.ext
 * Returns: "path/to/file.ext" (everything after bucket-name/)
 */
export function extractStoragePath(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const segments = urlObj.pathname.split("/public/");
    if (segments.length >= 2) {
      const parts = segments[1].split("/");
      return parts.slice(1).join("/"); // skip bucket name
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Tính tuổi từ ngày sinh
 */
export function calculateAge(
  birthdate: string | null | undefined,
): number | null {
  if (!birthdate) return null;

  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Xác định cung hoàng đạo từ ngày sinh
 */
export function getZodiacSign(
  birthdate: string | null | undefined,
): { name: string; emoji: string } | null {
  if (!birthdate) return null;

  const date = new Date(birthdate);
  const day = date.getDate();
  const month = date.getMonth() + 1; // 0-indexed

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) {
    return { name: "Bạch Dương", emoji: "♈" };
  } else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) {
    return { name: "Kim Ngưu", emoji: "♉" };
  } else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) {
    return { name: "Song Tử", emoji: "♊" };
  } else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) {
    return { name: "Cự Giải", emoji: "♋" };
  } else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) {
    return { name: "Sư Tử", emoji: "♌" };
  } else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) {
    return { name: "Xử Nữ", emoji: "♍" };
  } else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) {
    return { name: "Thiên Bình", emoji: "♎" };
  } else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) {
    return { name: "Bọ Cạp", emoji: "♏" };
  } else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) {
    return { name: "Nhân Mã", emoji: "♐" };
  } else if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
    return { name: "Ma Kết", emoji: "♑" };
  } else if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) {
    return { name: "Bảo Bình", emoji: "♒" };
  } else {
    return { name: "Song Ngư", emoji: "♓" };
  }
}
