import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

// Resolve a bare indicator code to its detail page (which carries the
// benchmarks and the ready-to-send Accurx improvement actions). Lets the AI QI
// plan link straight to an indicator without knowing its domain.
export default async function IndicatorRedirect({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("qof_indicator").select("domain").eq("indicator_code", code).maybeSingle();
  redirect(data?.domain ? `/domains/${data.domain}/${code}` : "/indicators");
}
