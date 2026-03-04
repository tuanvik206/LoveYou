const fs = require("fs");

const code = `"use client";

import { useEffect, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  OverlayView,
  Polyline,
} from "@react-google-maps/api";

export interface LatLng { lat: number; lng: number }
export type BatteryInfo = { level: number; charging: boolean } | null;
export interface SearchResult extends LatLng { label: string }

interface Props {
  myLoc: LatLng | null;
  partnerLoc: LatLng | null;
  myBattery: BatteryInfo;
  partnerBattery: BatteryInfo;
  userAvatar: string;
  userName: string;
  partnerAvatar: string;
  partnerName: string;
  searchMarker: SearchResult | null;
  routeCoords: [number, number][] | null;
  flyTarget: LatLng | null;
  onMapReady?: (map: google.maps.Map) => void;
}

const GMAP_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

function BatteryTag({ battery }: { battery: BatteryInfo }) {
  if (!battery) return null;
  const { level, charging } = battery;
  const color = level <= 20 ? "#ef4444" : level <= 50 ? "#f59e0b" : "#22c55e";
  return (
    <span style={{ color, fontWeight: 700, fontSize: 10 }}>
      {charging ? "⚡" : ""}{level}%
    </span>
  );
}

function AvatarMarker({ avatar, name, battery, accentColor, label }: {
  avatar: string; name: string; battery: BatteryInfo;
  accentColor: "white" | "rose"; label: string;
}) {
  const isWhite = accentColor === "white";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))", transform: "translate(-50%, -100%)" }}>
      <div style={{
        background: isWhite ? "rgba(255,255,255,0.95)" : "rgba(244,63,94,0.92)",
        color: isWhite ? "#f43f5e" : "#fff",
        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
        whiteSpace: "nowrap", marginBottom: 4, display: "flex", alignItems: "center", gap: 4,
      }}>
        {label}
        {battery && (
          <>
            <span style={{ opacity: 0.4 }}>·</span>
            <BatteryTag battery={battery} />
          </>
        )}
      </div>
      <img
        src={avatar}
        alt={name}
        style={{
          width: 52, height: 52, borderRadius: "50%",
          border: isWhite ? "3px solid #fff" : "3px solid #f43f5e",
          objectFit: "cover", background: "#fff",
        }}
      />
      <div style={{
        width: 12, height: 12,
        background: isWhite ? "#fff" : "#f43f5e",
        transform: "rotate(45deg)", marginTop: -5, borderRadius: 2,
      }} />
    </div>
  );
}

export default function MapView({
  myLoc, partnerLoc, myBattery, partnerBattery,
  userAvatar, userName, partnerAvatar, partnerName,
  searchMarker, routeCoords, flyTarget, onMapReady,
}: Props) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GMAP_KEY,
    libraries: ["places"] as any,
  });
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!flyTarget || !mapRef.current) return;
    mapRef.current.panTo({ lat: flyTarget.lat, lng: flyTarget.lng });
    mapRef.current.setZoom(15);
  }, [flyTarget?.lat, flyTarget?.lng]);

  if (!isLoaded) return (
    <div className="w-full h-screen flex items-center justify-center bg-rose-50">
      <div className="w-8 h-8 border-[3px] border-rose-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const center = myLoc ?? partnerLoc ?? { lat: 10.78, lng: 106.7 };
  const routePath = routeCoords?.map(([lat, lng]) => ({ lat, lng })) ?? [];

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100vw", height: "100vh" }}
      center={center}
      zoom={13}
      onLoad={(map) => { mapRef.current = map; onMapReady?.(map); }}
      options={{
        disableDefaultUI: true,
        gestureHandling: "greedy",
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        ],
      }}
    >
      {myLoc && (
        <OverlayView position={myLoc} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <AvatarMarker avatar={userAvatar} name={userName} battery={myBattery} accentColor="white" label="Bạn ở đây" />
        </OverlayView>
      )}
      {partnerLoc && (
        <OverlayView position={partnerLoc} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <AvatarMarker avatar={partnerAvatar} name={partnerName} battery={partnerBattery} accentColor="rose" label={partnerName} />
        </OverlayView>
      )}
      {searchMarker && (
        <OverlayView position={searchMarker} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div style={{ transform: "translate(-50%, -100%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ background: "#7c3aed", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, marginBottom: 4, maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              📍 {searchMarker.label.split(",")[0]}
            </div>
            <div style={{ width: 16, height: 16, background: "#7c3aed", borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }} />
          </div>
        </OverlayView>
      )}
      {routePath.length > 1 && (
        <Polyline
          path={routePath}
          options={{ strokeColor: "#f43f5e", strokeWeight: 4, strokeOpacity: 0.85 }}
        />
      )}
    </GoogleMap>
  );
}
`;

fs.writeFileSync("src/components/map/MapView.tsx", code, "utf8");
console.log("Done:", fs.statSync("src/components/map/MapView.tsx").size, "bytes");
