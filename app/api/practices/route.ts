import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ matches: [] });
  const supabase = await createClient();
  const { data } = await supabase
    .from("organisation")
    .select("ods_code,name,parent_icb")
    .eq("org_level", "practice")
    .or(`name.ilike.%${q}%,ods_code.ilike.%${q}%`)
    .limit(20);
  return NextResponse.json({ matches: data ?? [] });
}
