import { NextRequest, NextResponse } from "next/server";
import { searchPractices } from "@/lib/ods";
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const matches = await searchPractices(q);
  return NextResponse.json({ matches });
}
