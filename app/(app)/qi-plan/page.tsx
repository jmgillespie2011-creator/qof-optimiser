import Link from "next/link";
import { getUserPractice, getPracticeProfile } from "@/lib/qof/data";
import QiPlanPanel from "@/components/QiPlanPanel";
export const dynamic = "force-dynamic";

export default async function QiPlanPage() {
  const { practiceCode } = await getUserPractice();
  const profile = practiceCode ? await getPracticeProfile(practiceCode) : null;

  return (
    <div className="space-y-6">
      {/* On-screen header */}
      <div className="print:hidden">
        <Link href="/dashboard" className="text-sm text-nhs-blue">← Dashboard</Link>
        <h1 className="mt-2 text-2xl font-bold">AI QI plan</h1>
        <p className="mt-1 text-slate-600">
          A practice-specific quality-improvement plan across all domains for{" "}
          <span className="font-medium">{profile?.name ?? practiceCode}</span>. Prompts for discussion — not clinical or
          financial advice. Patient-identification suggestions require clinician review before action.
        </p>
      </div>

      {/* Print-only document title block */}
      <div className="hidden border-b-2 border-nhs-blue pb-4 print:block">
        <div className="kicker">Quality Improvement Plan · QOF</div>
        <h1 className="mt-1 text-2xl font-bold">{profile?.name ?? practiceCode}</h1>
        <p className="mt-1 text-sm text-slate-500">Generated from published NHS QOF data · prompts for discussion, not clinical advice</p>
      </div>

      <QiPlanPanel />
    </div>
  );
}
