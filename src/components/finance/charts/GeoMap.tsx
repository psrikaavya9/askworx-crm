"use client";

/**
 * GeoMap — expense GPS heatmap using react-leaflet.
 *
 * IMPORTANT: This component MUST be imported with dynamic() + ssr:false
 * in the parent because Leaflet accesses `window` on import.
 *
 *   const GeoMap = dynamic(() => import("./charts/GeoMap"), { ssr: false });
 *
 * Markers
 *   ● Red/filled     — flagged expense (GPS mismatch or receipt issue)
 *   ● Indigo/outline — normal expense
 * Radius is proportional to amount (capped for readability).
 */

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LocationDataPoint } from "@/modules/finance/repositories/expenseAnalytics.repository";

interface Props {
  data:   LocationDataPoint[];
  height?: number;
}

function shortINR(v: number) {
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)   return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
}

/** Auto-fit map bounds whenever the data changes. */
function BoundsController({ data }: { data: LocationDataPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!data.length) return;
    const bounds = data.map((d) => [d.lat, d.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  return null;
}

// India's geographic center — default view when no data
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

export default function GeoMap({ data, height = 420 }: Props) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden ring-1 ring-gray-200">
      {data.length === 0 && (
        <div
          className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80 text-sm text-gray-500"
          style={{ height }}
        >
          No GPS data in this period
        </div>
      )}
      <MapContainer
        center={INDIA_CENTER}
        zoom={5}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsController data={data} />

        {data.map((point) => {
          // Radius: 6–18px, proportional to amount relative to max
          const radius = 6 + Math.round((point.amount / maxAmount) * 12);

          return (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={radius}
              pathOptions={
                point.isFlagged
                  ? { color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.55, weight: 2 }
                  : { color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.4,  weight: 1.5 }
              }
            >
              <Popup>
                <div className="text-xs space-y-0.5 min-w-[140px]">
                  <p className="font-semibold text-gray-900">{point.staffName}</p>
                  <p className="text-gray-600">{point.category}</p>
                  <p className="font-bold text-indigo-700">{shortINR(point.amount)}</p>
                  {point.isFlagged && (
                    <p className="text-red-600 font-medium">⚠ Flagged</p>
                  )}
                  <p className="text-gray-400 capitalize">{point.status.toLowerCase()}</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
