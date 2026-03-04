"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useStore } from "@/store/useStore";
import {
  Navigation,
  Search,
  X,
  Route,
  Loader2,
  MapPin,
  History,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { useConfirm } from "@/hooks/useConfirm";
import type {
  LatLng,
  BatteryInfo,
  SearchResult,
  LovePlace,
} from "@/components/map/MapView";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-rose-50">
      <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
    </div>
  ),
});

const ORS_KEY = process.env.NEXT_PUBLIC_ORS_KEY ?? "";

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function nominatimSearch(
  q: string,
  nearLat?: number,
  nearLng?: number,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "8",
    countrycodes: "vn",
    addressdetails: "1",
    "accept-language": "vi",
  });
  // Bias results toward current map area if we have a location
  if (nearLat != null && nearLng != null) {
    const d = 0.5; // ~55km box
    params.set(
      "viewbox",
      `${nearLng - d},${nearLat + d},${nearLng + d},${nearLat - d}`,
    );
    params.set("bounded", "0"); // prefer viewbox but don't restrict
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d: any) => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      label: d.display_name,
    }));
  } catch {
    return [];
  }
}

async function fetchRoute(
  from: LatLng,
  to: LatLng,
): Promise<[number, number][] | null> {
  // 1. Try OSRM demo (free, real road routing, no key needed)
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const json = await res.json();
      if (json.code === "Ok" && json.routes?.[0]) {
        return json.routes[0].geometry.coordinates.map(
          ([lng, lat]: number[]) => [lat, lng] as [number, number],
        );
      }
    }
  } catch {
    /* fall through */
  }

  // 2. Try ORS if key provided
  if (ORS_KEY) {
    try {
      const res = await fetch(
        "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: ORS_KEY,
          },
          body: JSON.stringify({
            coordinates: [
              [from.lng, from.lat],
              [to.lng, to.lat],
            ],
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (res.ok) {
        const json = await res.json();
        return json.features[0].geometry.coordinates.map(
          ([lng, lat]: number[]) => [lat, lng] as [number, number],
        );
      }
    } catch {
      /* fall through */
    }
  }

  // 3. Fallback: straight line
  return [
    [from.lat, from.lng],
    [to.lat, to.lng],
  ];
}

export default function MapPage() {
  const { user, partner, loveCode, role } = useStore();
  const { confirm: showConfirm, ConfirmNode } = useConfirm();
  const [isMounted, setIsMounted] = useState(false);
  const [myLoc, setMyLoc] = useState<LatLng | null>(null);
  const [partnerLoc, setPartnerLoc] = useState<LatLng | null>(null);
  const [distance, setDistance] = useState("Đang tìm vị trí...");
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [myBattery, setMyBattery] = useState<BatteryInfo>(null);
  const [partnerBattery, setPartnerBattery] = useState<BatteryInfo>(null);
  const myBatteryRef = useRef<BatteryInfo>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMarker, setSearchMarker] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(
    null,
  );
  const [isRouting, setIsRouting] = useState(false);
  const [lovePlaces, setLovePlaces] = useState<LovePlace[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinName, setPinName] = useState("");
  const [pinNote, setPinNote] = useState("");
  const [isPinning, setIsPinning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const currentMapCenterRef = useRef<LatLng | null>(null);
  const lastGPSUploadRef = useRef<number>(0);
  const hasInitialFlownRef = useRef(false);
  const bestAccuracyRef = useRef<number>(Infinity);
  const lastLocRef = useRef<LatLng | null>(null);
  const lastLocTimeRef = useRef<number>(0);
  const centerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Places are fetched lazily via handleCenterChange once GPS or user pans the map
  // (removed hardcoded-coord initial fetch to avoid 504 on slow Overpass API)

  // Battery API
  useEffect(() => {
    if (!isMounted) return;
    const nav = navigator as any;
    if (!("getBattery" in nav)) return;
    let bm: any = null;
    const update = () => {
      if (!bm) return;
      const info: BatteryInfo = {
        level: Math.round(bm.level * 100),
        charging: bm.charging,
      };
      setMyBattery(info);
      myBatteryRef.current = info;
    };
    nav.getBattery().then((battery: any) => {
      bm = battery;
      update();
      battery.addEventListener("levelchange", update);
      battery.addEventListener("chargingchange", update);
    });
    return () => {
      if (bm) {
        bm.removeEventListener("levelchange", update);
        bm.removeEventListener("chargingchange", update);
      }
    };
  }, [isMounted]);

  // Supabase: initial fetch + realtime
  useEffect(() => {
    if (!isMounted || !loveCode || !role) return;
    const fetchInitial = async () => {
      const { data } = await supabase
        .from("couples")
        .select(
          "user1_lat,user1_lng,user2_lat,user2_lng,user1_battery,user1_charging,user2_battery,user2_charging",
        )
        .eq("code", loveCode)
        .single();
      if (!data) return;
      // Không load myLoc từ DB — GPS sẽ cho vị trí chính xác, tránh hiện vị trí cũ
      if (role === "user1") {
        if (data.user2_lat)
          setPartnerLoc({ lat: data.user2_lat, lng: data.user2_lng });
        if (data.user2_battery != null)
          setPartnerBattery({
            level: data.user2_battery,
            charging: data.user2_charging ?? false,
          });
      } else {
        if (data.user1_lat)
          setPartnerLoc({ lat: data.user1_lat, lng: data.user1_lng });
        if (data.user1_battery != null)
          setPartnerBattery({
            level: data.user1_battery,
            charging: data.user1_charging ?? false,
          });
      }
    };
    fetchInitial();

    // Polling 10s làm backup khi realtime bị trễ hoặc miss event
    const pollPartner = async () => {
      const { data } = await supabase
        .from("couples")
        .select(
          "user1_lat,user1_lng,user2_lat,user2_lng,user1_battery,user1_charging,user2_battery,user2_charging",
        )
        .eq("code", loveCode)
        .single();
      if (!data) return;
      if (role === "user1") {
        if (data.user2_lat)
          setPartnerLoc((prev) =>
            prev && prev.lat === data.user2_lat && prev.lng === data.user2_lng
              ? prev
              : { lat: data.user2_lat, lng: data.user2_lng },
          );
      } else {
        if (data.user1_lat)
          setPartnerLoc((prev) =>
            prev && prev.lat === data.user1_lat && prev.lng === data.user1_lng
              ? prev
              : { lat: data.user1_lat, lng: data.user1_lng },
          );
      }
    };
    const pollTimer = setInterval(pollPartner, 10_000);

    const channel = supabase
      .channel(`map_${loveCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "couples",
          filter: `code=eq.${loveCode}`,
        },
        (payload) => {
          const r = payload.new as any;
          if (!r) return;
          if (role === "user1") {
            if (r.user2_lat)
              setPartnerLoc((prev) =>
                prev && prev.lat === r.user2_lat && prev.lng === r.user2_lng
                  ? prev
                  : { lat: r.user2_lat, lng: r.user2_lng },
              );
            if (r.user2_battery != null)
              setPartnerBattery({
                level: r.user2_battery,
                charging: r.user2_charging ?? false,
              });
          } else {
            if (r.user1_lat)
              setPartnerLoc((prev) =>
                prev && prev.lat === r.user1_lat && prev.lng === r.user1_lng
                  ? prev
                  : { lat: r.user1_lat, lng: r.user1_lng },
              );
            if (r.user1_battery != null)
              setPartnerBattery({
                level: r.user1_battery,
                charging: r.user1_charging ?? false,
              });
          }
        },
      )
      .subscribe();
    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [isMounted, loveCode, role]);
  useEffect(() => {
    if (!isMounted || !loveCode) return;
    const fetchLovePlaces = async () => {
      const { data } = await supabase
        .from("love_places")
        .select("*")
        .eq("code", loveCode)
        .order("created_at", { ascending: false });
      if (data) setLovePlaces(data as LovePlace[]);
    };
    fetchLovePlaces();
    const channel = supabase
      .channel(`love_places_${loveCode}`)
      .on(
        "postgres_changes",
        // Không dùng filter cho DELETE — Supabase gửi old record,
        // filter by column không match → dùng table-level listener rồi lọc bằng code
        { event: "INSERT", schema: "public", table: "love_places" },
        (payload) => {
          const rec = payload.new as LovePlace;
          if (rec?.id && (rec as any).code === loveCode) {
            setLovePlaces((prev) =>
              [rec, ...prev].sort(
                (a, b) =>
                  new Date(b.visited_at).getTime() -
                  new Date(a.visited_at).getTime(),
              ),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "love_places" },
        (payload) => {
          const old = payload.old as { id?: string };
          if (old?.id) {
            setLovePlaces((prev) => prev.filter((p) => p.id !== old.id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMounted, loveCode]);

  // GPS — hiển thị ngay từ cache, sau đó cập nhật độ chính xác liên tục
  useEffect(() => {
    if (!isMounted || !loveCode || !role || !("geolocation" in navigator))
      return;

    let watchId: number | null = null;

    const applyPosition = async (
      lat: number,
      lng: number,
      accuracy: number,
    ) => {
      // Speed sanity check — loại bỏ teleport (> 500 km/h)
      if (lastLocRef.current && lastLocTimeRef.current) {
        const dt = (Date.now() - lastLocTimeRef.current) / 3_600_000;
        if (
          dt > 0 &&
          getDistance(
            lastLocRef.current.lat,
            lastLocRef.current.lng,
            lat,
            lng,
          ) /
            dt >
            500
        )
          return;
      }

      // Chỉ cập nhật khi: lần đầu, độ chính xác tăng đáng kể, hoặc di chuyển thực sự
      const isFirst = !lastLocRef.current;
      const improved = accuracy < bestAccuracyRef.current - 5;
      const moved = lastLocRef.current
        ? getDistance(
            lastLocRef.current.lat,
            lastLocRef.current.lng,
            lat,
            lng,
          ) *
            1000 >
          Math.max(8, accuracy * 0.3)
        : true;
      if (!isFirst && !improved && !moved) return;

      if (accuracy < bestAccuracyRef.current)
        bestAccuracyRef.current = accuracy;
      setGpsAccuracy(Math.round(accuracy));
      lastLocRef.current = { lat, lng };
      lastLocTimeRef.current = Date.now();
      setMyLoc((prev) =>
        prev && prev.lat === lat && prev.lng === lng ? prev : { lat, lng },
      );

      // Phóng to tới vị trí hiện tại lần đầu mở map
      if (!hasInitialFlownRef.current) {
        hasInitialFlownRef.current = true;
        setFlyTarget({ lat, lng });
        setRecenterKey((k) => k + 1);
      }

      // Upload lên Supabase (throttle 5s, bỏ qua nếu accuracy > 300m)
      const now = Date.now();
      const isFirstUpload = lastGPSUploadRef.current === 0;
      if (
        !isFirstUpload &&
        (now - lastGPSUploadRef.current < 5_000 || accuracy > 300)
      )
        return;
      lastGPSUploadRef.current = now;
      const bat = myBatteryRef.current;
      const fields =
        role === "user1"
          ? {
              user1_lat: lat,
              user1_lng: lng,
              ...(bat
                ? { user1_battery: bat.level, user1_charging: bat.charging }
                : {}),
            }
          : {
              user2_lat: lat,
              user2_lng: lng,
              ...(bat
                ? { user2_battery: bat.level, user2_charging: bat.charging }
                : {}),
            };
      await supabase.from("couples").update(fields).eq("code", loveCode);
    };

    // Bước 1: Lấy vị trí từ cache ngay lập tức (< 2 phút cũ) → hiển thị ngay
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        applyPosition(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
        ),
      () => {}, // bỏ qua lỗi cache — watchPosition sẽ lấy vị trí mới
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 3_000 },
    );

    // Bước 2: Watch liên tục với độ chính xác cao → cập nhật progressive
    watchId = navigator.geolocation.watchPosition(
      (pos) =>
        applyPosition(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
        ),
      () => {
        // Nếu high accuracy fail (indoor, permission denied) → thử low accuracy
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = navigator.geolocation.watchPosition(
          (pos) =>
            applyPosition(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy,
            ),
          () => {},
          { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 },
        );
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 8_000 },
    );

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isMounted, loveCode, role]);

  // Distance
  useEffect(() => {
    if (myLoc && partnerLoc) {
      const d = getDistance(
        myLoc.lat,
        myLoc.lng,
        partnerLoc.lat,
        partnerLoc.lng,
      );
      setDistance(d < 1 ? `${(d * 1000).toFixed(0)} m` : `${d.toFixed(1)} km`);
    } else {
      setDistance("Đang chờ đối phương...");
    }
  }, [myLoc, partnerLoc]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    setSearchError(null);
    try {
      const near = lastLocRef.current;
      const results = await nominatimSearch(searchQuery, near?.lat, near?.lng);
      if (results.length === 0) setSearchError("Không tìm thấy kết quả");
      setSearchResults(results);
    } catch {
      setSearchError("Lỗi kết nối, thử lại");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const selectResult = (r: SearchResult) => {
    setSearchMarker(r);
    setFlyTarget(r);
    setRecenterKey((k) => k + 1);
    setShowSearch(false);
    setSearchQuery(r.label.split(",")[0]);
    setSearchResults([]);
    setSearchError(null);
  };

  // Track map center for pin placement
  const handleCenterChange = useCallback((lat: number, lng: number) => {
    currentMapCenterRef.current = { lat, lng };
  }, []);

  const handlePin = useCallback(
    async (name: string, note: string) => {
      // Ưu tiên tâm bản đồ hiện tại; fallback về GPS nếu chưa di chuyển map
      const center = currentMapCenterRef.current ?? myLoc;
      if (!center || !loveCode || !user) return;
      setIsPinning(true);
      await supabase.from("love_places").insert({
        code: loveCode,
        name: name.trim(),
        note: note.trim() || null,
        lat: parseFloat(center.lat.toFixed(6)),
        lng: parseFloat(center.lng.toFixed(6)),
        added_by: user.name,
        visited_at: new Date().toISOString().split("T")[0],
      });
      setIsPinning(false);
      setShowPinModal(false);
      setPinName("");
      setPinNote("");
    },
    [loveCode, user, myLoc],
  );

  const doDeletePlace = useCallback(async (id: string) => {
    // Optimistic update — xóa khỏi UI ngay lập tức
    setLovePlaces((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("love_places").delete().eq("id", id);
  }, []);

  const handleDeletePlace = useCallback(
    (id: string) => {
      showConfirm({
        title: "Xoá địa điểm này?",
        message: "Địa điểm sẽ bị xoá vĩnh viễn.",
        confirmLabel: "Xoá",
        variant: "danger",
        onConfirm: () => doDeletePlace(id),
      });
    },
    [showConfirm, doDeletePlace],
  );

  const handleRoute = useCallback(async () => {
    if (!myLoc || !partnerLoc) return;
    setIsRouting(true);
    setRouteCoords(null);
    try {
      const coords = await fetchRoute(myLoc, partnerLoc);
      setRouteCoords(coords);
    } finally {
      setIsRouting(false);
    }
  }, [myLoc, partnerLoc]);

  if (!isMounted || !user || !partner) return null;

  return (
    <>
      <main
        className="relative w-full overflow-hidden"
        style={{ height: "100dvh" }}
      >
        {/* ── Map ── */}
        <MapView
          myLoc={myLoc}
          partnerLoc={partnerLoc}
          myBattery={myBattery}
          partnerBattery={partnerBattery}
          userAvatar={user.avatar}
          userName={user.name}
          partnerAvatar={partner.avatar}
          partnerName={partner.name}
          searchMarker={searchMarker}
          routeCoords={routeCoords}
          flyTarget={flyTarget}
          recenterKey={recenterKey}
          lovePlaces={lovePlaces}
          onCenterChange={handleCenterChange}
          showCrosshair={showPinModal}
        />

        {/* ── Top Bar ── */}
        <div
          className="absolute top-0 left-0 right-0 z-[1000] px-4 pb-3 bg-gradient-to-b from-white/95 via-white/70 to-transparent pointer-events-none"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
        >
          <div className="flex items-start gap-2 pointer-events-auto">
            {/* Distance + GPS card */}
            <div className="flex-1 bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-sm border border-rose-100/60">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-800">Bản đồ</span>
                <span className="text-rose-400 text-sm">·</span>
                <span className="text-xs font-semibold text-rose-500">
                  📍 {distance}
                </span>
                {gpsAccuracy !== null && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      gpsAccuracy <= 15
                        ? "bg-green-100 text-green-700"
                        : gpsAccuracy <= 40
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-600"
                    }`}
                  >
                    ±{gpsAccuracy}m
                  </span>
                )}
              </div>
            </div>

            {/* Search toggle */}
            <button
              onClick={() => setShowSearch((v) => !v)}
              className="w-11 h-11 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm flex items-center justify-center text-rose-500 border border-rose-100/60 shrink-0"
            >
              {showSearch ? (
                <X className="w-4 h-4" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Search panel */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-2 pointer-events-auto"
              >
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-white rounded-2xl px-4 py-2.5 text-sm border border-rose-100 shadow-sm outline-none focus:ring-2 focus:ring-rose-200"
                    placeholder="Tìm địa điểm tại VN..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    autoFocus
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="w-11 h-11 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-sm shrink-0 disabled:opacity-60"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {searchError && (
                  <p className="mt-2 text-xs text-center text-gray-400 font-medium">
                    {searchError}
                  </p>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-white rounded-2xl shadow-lg border border-rose-50 overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => selectResult(r)}
                        className="w-full text-left px-4 py-3 text-xs active:bg-rose-50 border-b border-rose-50/60 last:border-0"
                      >
                        📍 {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── FAB row (bottom-right) ── */}
        <div
          className="absolute right-4 z-[1000] flex flex-col items-center gap-2.5"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)",
          }}
        >
          {/* Pin */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              setShowPinModal(true);
              setShowHistory(false);
            }}
            className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center border transition-colors ${
              showPinModal
                ? "bg-rose-600 text-white border-rose-500"
                : "bg-rose-500 text-white border-rose-400"
            }`}
          >
            <MapPin className="w-4.5 h-4.5" />
          </motion.button>

          {/* History */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              setShowHistory((v) => !v);
              setShowPinModal(false);
            }}
            className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center border transition-colors ${
              showHistory
                ? "bg-pink-500 text-white border-pink-400"
                : "bg-white text-pink-500 border-pink-100"
            }`}
          >
            <History className="w-4.5 h-4.5" />
          </motion.button>

          {/* My location */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              if (!myLoc) return;
              setFlyTarget(myLoc);
              setRecenterKey((k) => k + 1);
            }}
            className="w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center text-rose-500 border border-rose-100"
          >
            <Navigation className="w-4.5 h-4.5" />
          </motion.button>

          {/* Route / Clear route */}
          {myLoc && partnerLoc && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={routeCoords ? () => setRouteCoords(null) : handleRoute}
              disabled={isRouting}
              className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center border transition-colors disabled:opacity-60 ${
                routeCoords
                  ? "bg-white text-gray-500 border-gray-200"
                  : "bg-rose-500 text-white border-rose-400"
              }`}
            >
              {isRouting ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
              ) : routeCoords ? (
                <X className="w-4.5 h-4.5" />
              ) : (
                <Route className="w-4.5 h-4.5" />
              )}
            </motion.button>
          )}

          {/* Mở Google Maps */}
          {myLoc && partnerLoc && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&origin=${myLoc.lat},${myLoc.lng}&destination=${partnerLoc.lat},${partnerLoc.lng}&travelmode=driving`;
                window.open(url, "_blank");
              }}
              className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center border bg-white border-green-200 text-green-600"
            >
              <ExternalLink className="w-4 h-4" />
            </motion.button>
          )}
        </div>

        {/* ── Pin crosshair hint ── */}
        <AnimatePresence>
          {showPinModal && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 z-[1050] pointer-events-none"
              style={{ marginTop: "-48px" }}
            >
              <div className="bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                Di chuyển bản đồ để chọn vị trí
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Pin bottom sheet ── */}
        <AnimatePresence>
          {showPinModal && (
            <>
              <div
                className="fixed inset-0 z-[1100] bg-black/30 backdrop-blur-sm"
                onClick={() => setShowPinModal(false)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="fixed left-0 right-0 z-[1200] bg-white rounded-t-3xl shadow-2xl px-5 pt-5"
                style={{
                  bottom: 0,
                  paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
                }}
              >
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
                <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-500" /> Ghim địa điểm
                </h2>
                <input
                  className="w-full border border-rose-100 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-200 mb-3 bg-rose-50/40"
                  placeholder="Tên địa điểm (vd: Quán cà phê đầu tiên) *"
                  value={pinName}
                  onChange={(e) => setPinName(e.target.value)}
                  autoFocus
                  maxLength={80}
                />
                <input
                  className="w-full border border-rose-100 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-200 mb-4 bg-rose-50/40"
                  placeholder="Ghi chú (không bắt buộc)"
                  value={pinNote}
                  onChange={(e) => setPinNote(e.target.value)}
                  maxLength={200}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPinModal(false)}
                    className="flex-1 py-3 rounded-2xl border border-gray-100 text-sm font-semibold text-gray-500 bg-gray-50"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={() => handlePin(pinName, pinNote)}
                    disabled={!pinName.trim() || isPinning}
                    className="flex-1 py-3 rounded-2xl bg-rose-500 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPinning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                    Ghim
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── History bottom panel ── */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="fixed left-0 right-0 z-[1050] bg-white rounded-t-3xl shadow-2xl"
              style={{
                bottom: "calc(env(safe-area-inset-bottom) + 3.75rem)",
                maxHeight: "50vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />
              <div className="px-5 py-3 flex items-center justify-between border-b border-rose-50 shrink-0">
                <h2 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-rose-500" />
                  Địa điểm của hai mình
                  <span className="text-[11px] font-normal text-gray-400">
                    ({lovePlaces.length})
                  </span>
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 rounded-full bg-gray-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {lovePlaces.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="w-16 h-16 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-3">
                      <MapPin className="w-7 h-7 text-rose-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-500">
                      Chưa có địa điểm nào
                    </p>
                    <p className="text-xs text-gray-400 mt-1 px-8">
                      Di chuyển bản đồ đến nơi muốn ghim, rồi ấn nút 📍
                    </p>
                  </div>
                ) : (
                  lovePlaces.map((lp) => (
                    <div
                      key={lp.id}
                      className="flex items-start gap-3 px-5 py-3.5 border-b border-rose-50/60 last:border-0"
                    >
                      <button
                        onClick={() => {
                          setFlyTarget({ lat: lp.lat, lng: lp.lng });
                          setRecenterKey((k) => k + 1);
                          setShowHistory(false);
                        }}
                        className="flex-1 text-left"
                      >
                        <p className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
                          <span>💕</span> {lp.name}
                        </p>
                        {lp.note && (
                          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                            {lp.note}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-300 mt-1">
                          {lp.added_by} · {lp.visited_at}
                        </p>
                      </button>
                      <button
                        onClick={() => handleDeletePlace(lp.id)}
                        className="w-8 h-8 flex items-center justify-center text-gray-300 active:text-red-400 transition-colors shrink-0 mt-0.5 rounded-full"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Route info hint */}
        {routeCoords && routeCoords.length === 2 && (
          <div
            className="absolute z-[1000] bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold px-3 py-2 rounded-xl shadow-sm whitespace-nowrap left-1/2 -translate-x-1/2"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
          >
            Đường thẳng · Không có mạng để tính lộ trình
          </div>
        )}
      </main>
      {ConfirmNode}
    </>
  );
}
