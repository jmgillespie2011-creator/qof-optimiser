import { createClient } from "@/lib/supabase/server";
import ChangePractice from "@/components/ChangePractice";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profile").select("*").eq("user_id", user?.id).single();
  let practice: any = null;
  if (profile?.practice_ods_code) {
    const { data } = await supabase.from("organisation").select("*").eq("ods_code", profile.practice_ods_code).single();
    practice = data;
  }
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">My account</h1>
      <div className="card space-y-2">
        <Row label="Name" value={profile?.full_name || "—"} />
        <Row label="Email" value={user?.email || "—"} />
        <Row label="Role" value={profile?.role || "—"} />
        <Row label="Practice" value={practice ? `${practice.name} (${practice.ods_code})` : "Not set"} />
        <Row label="Plan" value={(profile?.plan || "free").toUpperCase()} />
      </div>
      <div className="card">
        <h2 className="font-semibold">Default practice for QOF data</h2>
        <p className="mt-1 mb-3 text-sm text-slate-600">
          {practice ? <>Currently <strong>{practice.name}</strong> ({practice.ods_code}). Change it below.</> : "Choose the practice whose QOF data you want to see."}
        </p>
        <ChangePractice current={practice?.ods_code} />
      </div>

      <div className="card">
        <h2 className="font-semibold">Plan</h2>
        <p className="mt-1 text-sm text-slate-600">You are on the free plan. A paid tier with all domains, QI action packs and board reports is coming.</p>
        <button className="btn mt-3 opacity-60" disabled>Upgrade (coming soon)</button>
      </div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between border-b border-slate-100 py-2 last:border-0"><span className="text-slate-500">{label}</span><span className="font-medium">{value}</span></div>;
}
