"use server";
import { createClient } from "@/lib/supabase/server";
import { getOrganisation } from "@/lib/ods";
import { redirect } from "next/navigation";

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const fullName = String(formData.get("full_name"));
  const role = String(formData.get("role") || "gp");
  const practiceCode = String(formData.get("practice_ods_code") || "");
  const practiceName = String(formData.get("practice_name") || "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } },
  });
  if (error) redirect("/register?error=" + encodeURIComponent(error.message));

  // Resolve + persist the practice + hierarchy (best-effort; ODS is public).
  if (practiceCode && data.user) {
    let icb: string | null = null, pcn: string | null = null;
    try {
      const org = await getOrganisation(practiceCode);
      const rels = org?.Organisation?.Rels?.Rel ?? [];
      for (const r of rels) {
        const target = r?.Target?.OrgId?.extension;
        if (r?.id === "RE6" || r?.id === "RE4") icb = icb ?? target; // commissioner/geography
        if (r?.id === "RE8") pcn = pcn ?? target;                    // PCN membership
      }
    } catch { /* ignore - lookup is non-blocking */ }

    await supabase.from("organisation").upsert({
      ods_code: practiceCode, org_level: "practice", name: practiceName,
      parent_pcn: pcn, parent_icb: icb, status: "active",
    });
    await supabase.from("profile").update({
      full_name: fullName, role: role as any, practice_ods_code: practiceCode,
    }).eq("user_id", data.user.id);
    await supabase.from("practice_membership").upsert({
      practice_ods_code: practiceCode, user_id: data.user.id, role_at_practice: role as any,
    });
  }
  redirect("/dashboard");
}
