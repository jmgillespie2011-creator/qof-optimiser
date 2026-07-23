"use client";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type IcbValue = Record<string, number>;
type Pcn = { code: string; name: string; pct: number | null; listSize: number | null };
type Practice = { code: string; name: string; pct: number | null };

// Bundled locally (public/icb.geojson) — the previous live ArcGIS query 400'd on a
// non-existent field, which broke the map. Local load is also far faster.
const ICB_GEOJSON = "/icb.geojson";

function colour(v: number | null | undefined, lower: number, upper: number): string {
  if (v == null) return "#e2e8f0";
  if (v >= upper) return "#007F3B";
  if (v >= (lower + upper) / 2) return "#78BE20";
  if (v >= lower) return "#FFB81C";
  return "#DA291C";
}
const valFor = (p: any, m: IcbValue) => m[p?.ICB23CDH] ?? m[p?.ICB23CD];

function Bar({ pct, lower, upper }: { pct: number | null; lower: number; upper: number }) {
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-100">
      <div className="absolute inset-y-0 rounded-full bg-slate-200" style={{ left: `${lower}%`, width: `${Math.max(0, upper - lower)}%` }} />
      {pct != null && <div className="absolute -top-0.5 h-3 w-1 rounded" style={{ left: `calc(${Math.min(100, Math.max(0, pct))}% - 2px)`, background: colour(pct, lower, upper) }} />}
    </div>
  );
}

export default function QofMap({
  icbValues, pcnsByIcb, practicesByPcn, lower, upper, indicator,
}: {
  icbValues: IcbValue; pcnsByIcb: Record<string, Pcn[]>; practicesByPcn: Record<string, Practice[]>;
  lower: number; upper: number; indicator: string;
}) {
  const [geo, setGeo] = useState<any>(null);
  const [sel, setSel] = useState<{ code: string; name: string } | null>(null);
  const [openPcn, setOpenPcn] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  useEffect(() => { fetch(ICB_GEOJSON).then((r) => r.json()).then(setGeo).catch(() => setGeo(null)); }, []);

  const pcns = sel ? (pcnsByIcb[sel.code] ?? []) : [];

  function reset() { mapRef.current?.setView([52.9, -1.8], 6); setSel(null); setOpenPcn(null); }

  return (
    <div className="relative h-[560px] w-full overflow-hidden rounded-xl border border-slate-200">
      <MapContainer ref={mapRef} center={[52.9, -1.8]} zoom={6} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {geo && (
          <GeoJSON
            key={indicator + (sel?.code ?? "")}
            data={geo}
            style={(f: any) => {
              const isSel = sel && (f?.properties?.ICB23CDH === sel.code || f?.properties?.ICB23CD === sel.code);
              return { fillColor: colour(valFor(f?.properties, icbValues), lower, upper), weight: isSel ? 3 : 1, color: isSel ? "#003087" : "#fff", fillOpacity: sel && !isSel ? 0.3 : 0.72 };
            }}
            onEachFeature={(f: any, layer: any) => {
              const p = f?.properties; const v = valFor(p, icbValues);
              layer.bindTooltip(`${p?.ICB23NM ?? "ICB"}: ${v != null ? v + "%" : "no data"} — click to drill in`);
              layer.on("click", () => {
                try { mapRef.current?.fitBounds(layer.getBounds(), { maxZoom: 9, padding: [20, 20] }); } catch {}
                setSel({ code: p?.ICB23CDH ?? p?.ICB23CD, name: p?.ICB23NM ?? "ICB" }); setOpenPcn(null);
              });
            }}
          />
        )}
      </MapContainer>

      {/* breadcrumb */}
      <div className="absolute left-3 top-3 z-[1000] rounded-lg bg-white/95 px-3 py-1.5 text-sm shadow">
        <button onClick={reset} className={sel ? "text-nhs-blue" : "font-medium"}>England</button>
        {sel && <span className="text-slate-400"> ▸ </span>}
        {sel && <span className="font-medium">{sel.name}</span>}
      </div>

      {/* drill-down panel */}
      {sel && (
        <div className="absolute right-3 top-3 z-[1000] max-h-[92%] w-80 overflow-auto rounded-xl bg-white/97 p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">PCNs in this ICB</div>
            <button onClick={reset} className="text-xs text-nhs-blue">✕ back</button>
          </div>
          {pcns.length === 0 && <p className="text-sm text-slate-500">No PCN data yet for this ICB. Run the ingestion to populate PCNs and practices.</p>}
          <ul className="space-y-2">
            {pcns.map((pcn) => (
              <li key={pcn.code} className="rounded-lg border border-slate-200 p-2">
                <button onClick={() => setOpenPcn(openPcn === pcn.code ? null : pcn.code)} className="w-full text-left">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{pcn.name}</span>
                    <span style={{ color: colour(pcn.pct, lower, upper) }} className="font-semibold">{pcn.pct ?? "—"}%</span>
                  </div>
                  <div className="mt-1"><Bar pct={pcn.pct} lower={lower} upper={upper} /></div>
                </button>
                {openPcn === pcn.code && (
                  <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                    {(practicesByPcn[pcn.code] ?? []).map((pr) => (
                      <li key={pr.code} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{pr.name}</span>
                        <span style={{ color: colour(pr.pct, lower, upper) }} className="font-semibold">{pr.pct ?? "—"}%</span>
                      </li>
                    ))}
                    {(practicesByPcn[pcn.code] ?? []).length === 0 && <li className="text-xs text-slate-400">No practices loaded</li>}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
