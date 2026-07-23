"use client";
import { useRouter } from "next/navigation";
export default function IndicatorSelect({ options, value }: { options: { indicator_code: string; title: string }[]; value: string }) {
  const router = useRouter();
  return (
    <select className="input w-full sm:w-72" value={value} onChange={(e) => router.push(`/map?indicator=${e.target.value}`)}>
      {options.map((i) => <option key={i.indicator_code} value={i.indicator_code}>{i.indicator_code} — {i.title}</option>)}
    </select>
  );
}
