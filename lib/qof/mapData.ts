import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "./data";

// The map re-reads the whole org hierarchy and a full indicator's achievement on
// every load. Both are global, public, and change only when new QOF data lands —
// so cache them (day-long revalidate) instead of scanning ~15k rows each request.
// The admin client is used because unstable_cache cannot touch request cookies.

export const getOrgHierarchy = unstable_cache(
  async () => {
    const supa = createAdminClient();
    return fetchAllRows((from, to) =>
      supa
        .from("organisation")
        .select("ods_code,name,org_level,parent_icb,parent_pcn,ons_code,list_size")
        .order("ods_code", { ascending: true })
        .range(from, to),
    );
  },
  ["org-hierarchy"],
  { revalidate: 86400, tags: ["qof-data"] },
);

export function getIndicatorAchievement(indicator: string, year: string) {
  return unstable_cache(
    async () => {
      const supa = createAdminClient();
      return fetchAllRows((from, to) =>
        supa
          .from("qof_achievement")
          .select("ods_code,org_level,achievement_pct")
          .eq("indicator_code", indicator)
          .eq("year", year)
          .order("ods_code", { ascending: true })
          .range(from, to),
      );
    },
    ["ind-ach", indicator, year],
    { revalidate: 86400, tags: ["qof-data"] },
  )();
}
