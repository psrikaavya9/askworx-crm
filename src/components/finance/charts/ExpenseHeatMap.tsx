"use client";

/**
 * ExpenseHeatMap — self-fetching expense location map.
 *
 * MUST be imported with dynamic() + ssr:false in the parent:
 *
 *   const ExpenseHeatMap = dynamic(
 *     () => import("@/components/finance/charts/ExpenseHeatMap"),
 *     { ssr: false, loading: () => <div className="h-[480px] animate-pulse rounded-xl bg-gray-100" /> }
 *   );
 *
 * Markers
 *   ● Color-coded by expense category (see CATEGORY_COLORS below)
 *   ● Radius proportional to amount relative to the max in the dataset
 *   ● Click a marker to see a popup with amount and category
 */

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useApiClient } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpenseLocation {
  id:       string;
  lat:      number;
  lng:      number;
  amount:   number;
  category: string;
}

// ---------------------------------------------------------------------------
// Category → marker color
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  "Travel":              "#6366f1", // indigo
  "Food":                "#f59e0b", // amber
  "Fuel":                "#ef4444", // red
  "Office Supplies":     "#10b981", // emerald
  "Client Entertainment":"#8b5cf6", // violet
  "Software":            "#0ea5e9", // sky
  "Hardware":            "#64748b", // slate
  "Marketing":           "#ec4899", // pink
  "Utilities":           "#14b8a6", // teal
  "Other":               "#94a3b8", // gray
};

const DEFAULT_COLOR = "#94a3b8";

function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

function shortINR(v: number): string {
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)   return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
}

// ---------------------------------------------------------------------------
// BoundsController — auto-fits map when data arrives
// ---------------------------------------------------------------------------

function BoundsController({ data }: { data: ExpenseLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (!data.length) return;
    map.fitBounds(
      data.map((d) => [d.lat, d.lng] as [number, number]),
      { padding: [40, 40], maxZoom: 12 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  return null;
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend({ categories }: { categories: string[] }) {
  if (!categories.length) return null;
  return (
    <div className="absolute bottom-6 right-3 z-[1000] rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Category</p>
      <div className="space-y-1">
        {categories.map((cat) => (
          <div key={cat} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor(cat) }}
            />
            <span className="text-xs text-gray-700">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

export default function ExpenseHeatMap() {
  const api = useApiClient();
  const [locations, setLocations] = useState<ExpenseLocation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ExpenseLocation[]>("/api/expenses/locations")
      .then(setLocations)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load locations")
      )
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive unique categories present in the data (preserves declaration order)
  const presentCategories = Object.keys(CATEGORY_COLORS).filter((cat) =>
    locations.some((l) => l.category === cat)
  );

  const maxAmount = Math.max(...locations.map((l) => l.amount), 1);

  if (loading) {
    return <div className="h-[480px] animate-pulse rounded-xl bg-gray-100" />;
  }

  if (error) {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-xl bg-red-50 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="relative h-[480px] overflow-hidden rounded-xl ring-1 ring-gray-200">
      {locations.length === 0 && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80 text-sm text-gray-500">
          No approved expense locations to display
        </div>
      )}

      <MapContainer
        center={INDIA_CENTER}
        zoom={5}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <BoundsController data={locations} />

        {locations.map((point) => {
          const color  = categoryColor(point.category);
          // Radius: 6–20px proportional to amount
          const radius = 6 + Math.round((point.amount / maxAmount) * 14);

          return (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.55,
                weight: 1.5,
              }}
            >
              <Popup>
                <div className="min-w-[140px] space-y-1 text-xs">
                  <p className="font-semibold text-gray-900">{point.category}</p>
                  <p className="text-lg font-bold" style={{ color }}>
                    {shortINR(point.amount)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <Legend categories={presentCategories} />
    </div>
  );
}
