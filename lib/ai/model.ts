// Model identity is a config value, never hardcoded at call sites (§0.1).
// Sonnet is the planned baseline for the model-comparison exercise (build order
// step 6); swap ANTHROPIC_MODEL to run the same feature through another model.
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Per-session and global rate limits (§0.4).
export const RATE_PER_SESSION_HOUR = Number(process.env.AI_RATE_PER_SESSION_HOUR || 20);
export const RATE_GLOBAL_DAY = Number(process.env.AI_RATE_GLOBAL_DAY || 500);
