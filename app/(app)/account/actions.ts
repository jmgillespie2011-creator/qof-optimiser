"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function setPracticeAction(formData: FormData) {
  const ods = String(formData.get("practice_ods_code") || "").trim();
  if (!ods) redirect("/account?error=Choose+a+practice");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.from("profile").update({ practice_ods_code: ods }).eq("user_id", user.id);
  await supabase.from("practice_membership").upsert({ practice_ods_code: ods, user_id: user.id, role_at_practice: "gp" });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
