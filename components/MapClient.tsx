"use client";
import dynamic from "next/dynamic";
const QofMap = dynamic(() => import("./QofMap"), {
  ssr: false,
  loading: () => <div className="flex h-[560px] items-center justify-center rounded-xl border border-slate-200 text-slate-400">Loading map…</div>,
});
type IcbValue = Record<string, number>;
type Pcn = { code: string; name: string; pct: number | null; listSize: number | null };
type Practice = { code: string; name: string; pct: number | null };
export default function MapClient(props: {
  icbValues: IcbValue; pcnsByIcb: Record<string, Pcn[]>; practicesByPcn: Record<string, Practice[]>;
  lower: number; upper: number; indicator: string;
}) {
  return <QofMap {...props} />;
}
