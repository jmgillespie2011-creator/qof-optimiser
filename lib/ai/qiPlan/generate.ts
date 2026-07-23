import { AnthropicProvider } from "@/lib/ai/provider";
import { putArtifact } from "@/lib/ai/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt, buildUserContent } from "./prompt";
import { QI_PLAN_SCHEMA, QiPlan } from "./types";
import { validateQiPlan } from "./validate";
import { universalFooter } from "./footer";
import type { QiPlanInput } from "./input";

async function setJob(jobId: string, status: "running" | "done" | "error", error?: string) {
  const supabase = createAdminClient();
  await supabase
    .from("ai_job")
    .update({ status, error: error ?? null, finished_at: status === "running" ? null : new Date().toISOString() })
    .eq("id", jobId);
}

// Full generation flow for one QI plan (§0.3, §0.5). Runs async, off the request
// path. Never caches invalid output.
export async function runQiPlanGeneration(args: {
  input: QiPlanInput;
  cacheKey: string;
  entityId: string;
  qofYear: string;
  jobId: string;
}): Promise<void> {
  const { input, cacheKey, entityId, qofYear, jobId } = args;
  await setJob(jobId, "running");

  try {
    const provider = new AnthropicProvider();
    const systemPrompt = buildSystemPrompt();
    let userContent = buildUserContent(input);
    let lastErrors: string[] = [];

    // Schema-validate; on failure, one retry with the error appended (§0.5).
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await provider.generate({
        systemPrompt,
        userContent,
        maxTokens: 8000,
        responseFormat: "json",
        jsonSchema: QI_PLAN_SCHEMA,
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(res.text);
      } catch {
        lastErrors = ["Model output was not valid JSON."];
        userContent = buildUserContent(input) + `\n\nYour previous output was not valid JSON. Return only the JSON object.`;
        continue;
      }

      const validated = validateQiPlan(parsed, input);
      if (!validated.ok) {
        lastErrors = validated.errors;
        userContent =
          buildUserContent(input) +
          `\n\nYour previous output was rejected for these reasons — fix them and return corrected JSON:\n- ${validated.errors.join("\n- ")}`;
        continue;
      }

      const plan: QiPlan = { ...validated.plan, footer: universalFooter(qofYear) };
      await putArtifact({
        key: cacheKey,
        feature: "qi_plan",
        entityType: "practice",
        entityId,
        qofYear,
        content: plan,
        modelUsed: res.model,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
      });
      await setJob(jobId, "done");
      return;
    }

    await setJob(jobId, "error", `Validation failed after retry: ${lastErrors.join("; ")}`);
  } catch (err) {
    await setJob(jobId, "error", err instanceof Error ? err.message : "Generation failed.");
  }
}
