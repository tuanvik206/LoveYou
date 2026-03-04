"use client";

import { useEffect, useRef, useCallback, useMemo, memo } from "react";
import Map, {
  Marker,
  Source,
  Layer,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export interface LatLng {
  lat: number;
  lng: number;
}
export type BatteryInfo = { level: number; charging: boolean } | null;
export interface SearchResult extends LatLng {
  label: string;
}
export interface LovePlace {
  id: string;
  name: string;
  note?: string | null;
  lat: number;
  lng: number;
  added_by: string;
  visited_at: string;
}

// Google Maps Satellite Hybrid (Vệ tinh siêu nét + Địa chỉ/Tên đường)
const MAP_STYLE_SATELLITE = {
  version: 8 as const,
  sources: {
    "google-hybrid": {
      type: "raster" as const,
      tiles: [
        "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
      ],
      tileSize: 256,
      attribution: "Map data © Google",
      maxzoom: 21,
    },
  },
  layers: [{ id: "google-hybrid-tiles", type: "raster" as const, source: "google-hybrid" }],
};

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
  recenterKey?: number;
  lovePlaces?: LovePlace[];
  onCenterChange?: (lat: number, lng: number) => void;
  /** Show crosshair overlay (when user is about to place a pin) */
  showCrosshair?: boolean;
}

function BatteryBadge({ battery }: { battery: BatteryInfo }) {
  if (!battery) return null;
  const { level, charging } = battery;
  
  // Xác định màu pin
  let color = "#22c55e"; // xanh
  if (level <= 20) color = "#ef4444"; // đỏ
  else if (level <= 50) color = "#f59e0b"; // vàng

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {/* Battery outline container */}
      <div
        style={{
          width: 22,
          height: 10,
          border: `1px solid ${color}`,
          borderRadius: 3,
          padding: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          opacity: 0.9,
        }}
      >
        {/* Battery level fill */}
        <div
          style={{
            height: "100%",
            width: `${level}%`,
            backgroundColor: color,
            borderRadius: 1.5,
            transition: "width 0.3s ease",
          }}
        />
        {/* Charging icon overlay */}
        {charging && (
          <span 
            style={{ 
              position: "absolute", 
              left: "50%", 
              top: "50%", 
              transform: "translate(-50%, -50%)", 
              fontSize: 8, 
              lineHeight: 1,
              color: level < 40 ? color : "#fff",
              textShadow: "0px 0px 2px rgba(0,0,0,0.3)"
            }}
          >
            ⚡
          </span>
        )}
      </div>
      {/* Battery tip */}
      <div 
        style={{ 
          width: 2, 
          height: 4, 
          backgroundColor: color, 
          borderRadius: "0 2px 2px 0",
          opacity: 0.8
        }} 
      />
      {/* Percentage text */}
      <span style={{ color, fontWeight: 800, fontSize: 10, marginLeft: 2, letterSpacing: "-0.5px" }}>
        {level}%
      </span>
    </div>
  );
}

const AvatarMarker = memo(function AvatarMarker({
  avatar,
  name,
  battery,
  accent,
  label,
}: {
  avatar: string;
  name: string;
  battery: BatteryInfo;
  accent: "white" | "rose";
  label: string;
}) {
  const bg =
    accent === "white" ? "rgba(255,255,255,0.97)" : "rgba(244,63,94,0.93)";
  const fg = accent === "white" ? "#f43f5e" : "#fff";
  const borderColor = accent === "white" ? "#fecdd3" : "#f43f5e";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.25))",
      }}
    >
      <div
        style={{
          background: bg,
          color: fg,
          fontSize: 11,
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: 99,
          whiteSpace: "nowrap",
          marginBottom: 5,
          display: "flex",
          alignItems: "center",
          gap: 4,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        {label}
        {battery && (
          <>
            <span style={{ opacity: 0.2, margin: "0 2px" }}>|</span>
            <BatteryBadge battery={battery} />
          </>
        )}
      </div>
      <img
        src={avatar}
        alt={name}
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          border: `3px solid ${borderColor}`,
          objectFit: "cover",
          background: "#fff",
          boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
        }}
        onError={(e: any) => {
          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=fecdd3&color=f43f5e`;
        }}
      />
      <div
        style={{
          width: 12,
          height: 12,
          background: borderColor,
          transform: "rotate(45deg)",
          marginTop: -5,
          borderRadius: 2,
        }}
      />
    </div>
  );
});

const LovePlaceMarker = memo(function LovePlaceMarker({
  place,
}: {
  place: LovePlace;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        filter: "drop-shadow(0 4px 12px rgba(244,63,94,0.35))",
        cursor: "pointer",
        transition: "transform 0.2s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <div
        style={{
          background: "#fff",
          border: "2px solid #f43f5e",
          color: "#f43f5e",
          fontSize: 11,
          fontWeight: 700,
          padding: "4px 12px",
          borderRadius: "16px",
          whiteSpace: "nowrap",
          maxWidth: 160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: 16, lineHeight: 1 }}>📍</div>
        <span
          style={{
            maxWidth: 140,
            overflow: "hidden",
            textOverflow: "ellipsis",
            textAlign: "center",
          }}
        >
          {place.name}
        </span>
      </div>
      {/* Triangle tip pointing down */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "8px solid #f43f5e",
          marginTop: -2,
        }}
      />
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "4px solid transparent",
          borderRight: "4px solid transparent",
          borderTop: "6px solid #fff",
          position: "absolute",
          bottom: 2,
          zIndex: 1,
        }}
      />
    </div>
  );
});

const MapView = memo(function MapView({
  myLoc,
  partnerLoc,
  myBattery,
  partnerBattery,
  userAvatar,
  userName,
  partnerAvatar,
  partnerName,
  searchMarker,
  routeCoords,
  flyTarget,
  recenterKey,
  lovePlaces = [],
  onCenterChange,
  showCrosshair = false,
}: Props) {
  const mapRef = useRef<MapRef>(null);

  const flyTargetRef = useRef(flyTarget);
  flyTargetRef.current = flyTarget;

  useEffect(() => {
    if (!flyTarget || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: 18,
      duration: 1500,
      essential: true,
    });
    // recenterKey forces re-fly even when coords unchanged
  }, [flyTarget?.lat, flyTarget?.lng, recenterKey]);

  // Track center both during drag and after flyTo ends
  const handleMove = useCallback(
    (e: ViewStateChangeEvent) => {
      onCenterChange?.(e.viewState.latitude, e.viewState.longitude);
    },
    [onCenterChange],
  );

  const handleLoad = useCallback(() => {
    if (!mapRef.current) return;
    // Retry flyTo for targets that came in before map was ready
    if (flyTargetRef.current) {
      mapRef.current.flyTo({
        center: [flyTargetRef.current.lng, flyTargetRef.current.lat],
        zoom: 18,
        duration: 1500,
        essential: true,
      });
    }
    const c = mapRef.current.getCenter();
    onCenterChange?.(c.lat, c.lng);
  }, [onCenterChange]);

  const center = myLoc ?? partnerLoc ?? { lat: 10.7769, lng: 106.7009 };

  const routeGeoJSON = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features:
        routeCoords && routeCoords.length > 1
          ? [
              {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: routeCoords.map(([lat, lng]) => [lng, lat]),
                },
                properties: {},
              },
            ]
          : [],
    }),
    [routeCoords],
  );

  return (
    <Map
      ref={mapRef}
      reuseMaps
      initialViewState={{
        longitude: center.lng,
        latitude: center.lat,
        zoom: 14,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={MAP_STYLE_SATELLITE as any}
      onLoad={handleLoad}
      onMove={handleMove}
      onMoveEnd={handleMove}
      maxZoom={19}
    >
      {/* Crosshair — tip points to EXACT center of viewport */}
      {showCrosshair && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            // translate(-50%, -100%) + 5px → tâm chấm tròn = đúng tâm viewport
            transform: "translate(-50%, calc(-100% + 5px))",
            pointerEvents: "none",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Label */}
          <div
            style={{
              background: "linear-gradient(135deg,#f43f5e,#ec4899)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 12px",
              borderRadius: 99,
              marginBottom: 6,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 10px rgba(244,63,94,0.45)",
            }}
          >
            📍 Kéo bản đồ để chọn vị trí
          </div>
          {/* Stem */}
          <div
            style={{
              width: 2,
              height: 32,
              background: "#f43f5e",
              borderRadius: 2,
            }}
          />
          {/* Tip dot — this sits at exact center of viewport */}
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#f43f5e",
              border: "2.5px solid #fff",
              boxShadow: "0 0 0 1.5px #f43f5e, 0 2px 8px rgba(0,0,0,0.28)",
            }}
          />
        </div>
      )}
      {/* Route */}
      <Source id="route" type="geojson" data={routeGeoJSON}>
        <Layer
          id="route-outer"
          type="line"
          paint={{
            "line-color": "#fff",
            "line-width": 7,
            "line-opacity": 0.65,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
        <Layer
          id="route-inner"
          type="line"
          paint={{
            "line-color": "#f43f5e",
            "line-width": 4,
            "line-opacity": 0.95,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>

      {/* Love place markers */}
      {lovePlaces.map((lp) => (
        <Marker
          key={`lp-${lp.id}`}
          longitude={lp.lng}
          latitude={lp.lat}
          anchor="bottom"
        >
          <LovePlaceMarker place={lp} />
        </Marker>
      ))}

      {/* Search result */}
      {searchMarker && (
        <Marker
          longitude={searchMarker.lng}
          latitude={searchMarker.lat}
          anchor="bottom"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.28))",
            }}
          >
            <div
              style={{
                background: "#7c3aed",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 99,
                marginBottom: 4,
                maxWidth: 200,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              📍 {searchMarker.label.split(",")[0]}
            </div>
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "8px solid #7c3aed",
              }}
            />
          </div>
        </Marker>
      )}

      {/* Avatars — on top */}
      {myLoc && (
        <Marker
          key="my-avatar"
          longitude={myLoc.lng}
          latitude={myLoc.lat}
          anchor="bottom"
        >
          <AvatarMarker
            avatar={userAvatar}
            name={userName}
            battery={myBattery}
            accent="white"
            label="Bạn"
          />
        </Marker>
      )}
      {partnerLoc && (
        <Marker
          key="partner-avatar"
          longitude={partnerLoc.lng}
          latitude={partnerLoc.lat}
          anchor="bottom"
        >
          <AvatarMarker
            avatar={partnerAvatar}
            name={partnerName}
            battery={partnerBattery}
            accent="rose"
            label={partnerName}
          />
        </Marker>
      )}
    </Map>
  );
});

export default MapView;
