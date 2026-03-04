import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  name: string;
  avatar: string;
}

export interface AppState {
  user: User | null;
  partner: User | null;
  role: "user1" | "user2" | null;
  loveCode: string | null;
  startDate: string | null;
  myBirthdate: string | null;
  partnerBirthdate: string | null;
  myGender: "male" | "female" | null;
  partnerGender: "male" | "female" | null;
  // Runtime only — không persist
  isPartnerOnline: boolean;
  setUser: (user: User) => void;
  setPartner: (partner: User | null) => void;
  setRole: (role: "user1" | "user2" | null) => void;
  setLoveCode: (code: string | null) => void;
  setStartDate: (date: string | null) => void;
  setMyBirthdate: (birthdate: string | null) => void;
  setPartnerBirthdate: (birthdate: string | null) => void;
  setMyGender: (gender: "male" | "female" | null) => void;
  setPartnerGender: (gender: "male" | "female" | null) => void;
  setPartnerOnline: (online: boolean) => void;
  clear: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      partner: null,
      role: null,
      loveCode: null,
      startDate: null,
      myBirthdate: null,
      partnerBirthdate: null,
      myGender: null,
      partnerGender: null,
      isPartnerOnline: false,

      setUser: (user) => set({ user }),
      setPartner: (partner) => set({ partner }),
      setRole: (role) => set({ role }),
      setLoveCode: (code) => set({ loveCode: code }),
      setStartDate: (startDate) => set({ startDate }),
      setMyBirthdate: (myBirthdate) => set({ myBirthdate }),
      setPartnerBirthdate: (partnerBirthdate) => set({ partnerBirthdate }),
      setMyGender: (myGender) => set({ myGender }),
      setPartnerGender: (partnerGender) => set({ partnerGender }),
      setPartnerOnline: (isPartnerOnline) => set({ isPartnerOnline }),

      clear: () =>
        set({
          user: null,
          partner: null,
          role: null,
          loveCode: null,
          startDate: null,
          myBirthdate: null,
          partnerBirthdate: null,
          myGender: null,
          partnerGender: null,
          isPartnerOnline: false,
        }),
    }),
    {
      name: "loveyou-storage",
      version: 3,
      // isPartnerOnline là runtime state, không lưu localStorage
      partialize: (state) => ({
        user: state.user,
        partner: state.partner,
        role: state.role,
        loveCode: state.loveCode,
        startDate: state.startDate,
        myBirthdate: state.myBirthdate,
        partnerBirthdate: state.partnerBirthdate,
        myGender: state.myGender,
        partnerGender: state.partnerGender,
      }),
      // Khi schema thay đổi, migrate về state mặc định để tránh crash với data cũ
      migrate: (_persistedState, fromVersion) => {
        // version < 3: reset toàn bộ — user sẽ cần đăng nhập lại từ Supabase
        if (fromVersion < 3) {
          return {
            user: null,
            partner: null,
            role: null,
            loveCode: null,
            startDate: null,
            myBirthdate: null,
            partnerBirthdate: null,
            myGender: null,
            partnerGender: null,
          };
        }
        return _persistedState as AppState;
      },
    },
  ),
);
