const fs = require("fs");

const mapview = `"use client";

import { useEffect, useRef } from "react";
import Map, { Marker, Source, Layer, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

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
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

function BatteryBadge({ battery }: { battery: BatteryInfo }) {
  if (!battery) return null;
  const { level, charging } = battery;
  const color = level <= 20 ? "#ef4444" : level <= 50 ? "#f59e0b" : "#22c55e";
  return (
    <span style={{ color, fontWeight: 700, fontSize: 10 }}>
      {charging ? "⚡" : ""}{level}%
    </span>
  );
}

function AvatarMarker({
  avatar, name, battery, accent, label,
}: {
  avatar: string; name: string; battery: BatteryInfo;
  accent: "white" | "rose"; label: string;
}) {
  const bg = accent === "white" ? "rgba(255,255,255,0.95)" : "rgba(244,63,94,0.92)";
  const fg = accent === "white" ? "#f43f5e" : "#fff";
  const border = accent === "white" ? "#fff" : "#f43f5e";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.22))", transform: "translateX(-50%) translateY(-100%)" }}>
      <div style={{ background: bg, color: fg, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
        {label}
        {battery && <><span style={{ opacity: 0.4 }}>·</span><BatteryBadge battery={battery} /></>}
      </div>
      <img
        src={avatar} alt={name}
        style={{ width: 52, height: 52, borderRadius: "50%", border: \`3px solid \${border}\`, objectFit: "cover", background: "#fff" }}
        onError={(e: any) => { e.target.src = \`https://ui-avatars.com/api/?name=\${encodeURIComponent(name)}&background=fecdd3&color=f43f5e\`; }}
      />
      <div style={{ width: 14, height: 14, background: border, transform: "rotate(45deg)", marginTop: -6, borderRadius: 3 }} />
    </div>
  );
}

export default function MapView({
  myLoc, partnerLoc, myBattery, partnerBattery,
  userAvatar, userName, partnerAvatar, partnerName,
  searchMarker, routeCoords, flyTarget,
}: Props) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (!flyTarget || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: 15, duration: 1400 });
  }, [flyTarget?.lat, flyTarget?.lng]);

  const center = myLoc ?? partnerLoc ?? { lat: 10.78, lng: 106.7 };

  const routeGeoJSON: GeoJSON.Feature = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: (routeCoords ?? []).map(([lat, lng]) => [lng, lat]),
    },
    properties: {},
  };

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={TOKEN}
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 13 }}
      style={{ width: "100vw", height: "100vh" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
    >
      {myLoc && (
        <Marker longitude={myLoc.lng} latitude={myLoc.lat} anchor="bottom" style={{ transform: "none" }}>
          <AvatarMarker avatar={userAvatar} name={userName} battery={myBattery} accent="white" label="Bạn ở đây" />
        </Marker>
      )}

      {partnerLoc && (
        <Marker longitude={partnerLoc.lng} latitude={partnerLoc.lat} anchor="bottom" style={{ transform: "none" }}>
          <AvatarMarker avatar={partnerAvatar} name={partnerName} battery={partnerBattery} accent="rose" label={partnerName} />
        </Marker>
      )}

      {searchMarker && (
        <Marker longitude={searchMarker.lng} latitude={searchMarker.lat} anchor="bottom">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.3))", transform: "translateX(-50%) translateY(-100%)" }}>
            <div style={{ background: "#7c3aed", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, marginBottom: 4, maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              📍 {searchMarker.label.split(",")[0]}
            </div>
            <div style={{ width: 16, height: 16, background: "#7c3aed", borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", border: "2px solid #fff" }} />
          </div>
        </Marker>
      )}

      {routeCoords && routeCoords.length > 1 && (
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": "#f43f5e", "line-width": 4, "line-opacity": 0.85 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>
      )}
    </Map>
  );
}
`;

fs.writeFileSync("src/components/map/MapView.tsx", mapview, "utf8");
console.log("MapView written:", fs.statSync("src/components/map/MapView.tsx").size, "bytes");
