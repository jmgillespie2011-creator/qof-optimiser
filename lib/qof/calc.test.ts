// Minimal assertion-based tests (run with: npx tsx lib/qof/calc.test.ts)
import { pointsEarned, moneyAtRisk } from "./calc";
const iy = { points: 44, lower_threshold: 20, upper_threshold: 50, pound_per_point: 225.49 };
function assert(name: string, cond: boolean) { if (!cond) { console.error("FAIL", name); process.exit(1);} else console.log("ok", name); }
assert("below lower = 0", pointsEarned(15, iy) === 0);
assert("at upper = full", pointsEarned(50, iy) === 44);
assert("above upper = full", pointsEarned(80, iy) === 44);
assert("midpoint ~half", Math.abs(pointsEarned(35, iy) - 22) < 0.5);
assert("money at risk positive at 34%", moneyAtRisk(34, iy) > 0);
console.log("all calc tests passed");
