#!/usr/bin/env node
/**
 * Red-team harness self-check ("test of the tests").
 *
 * Runs the deterministic canary self-check config and asserts the harness
 * DISCRIMINATES: it must FAIL a known-leak output and PASS a known-clean one.
 * If it does not, the leakage detector is broken and every "no leak" result in
 * the suite is untrustworthy.
 *
 * Free (echo provider) and deterministic (string assertion) — safe to run in CI.
 * Exit 0 = harness healthy · non-zero = harness broken.
 *
 * Usage:  node redteam/selfcheck.mjs      (or: npm run redteam:verify)
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CONFIG = "redteam/promptfooconfig.selfcheck.yaml";
const OUT = join(tmpdir(), `rt-selfcheck-${Date.now()}.json`);

console.log(`[selfcheck] running ${CONFIG} ...`);
try {
  // promptfoo exits non-zero when any test "fails" — and the known-leak fixture
  // is SUPPOSED to fail — so we ignore the exit code and read the JSON instead.
  execSync(`promptfoo eval -c ${CONFIG} -o ${OUT} --no-cache`, { stdio: "ignore" });
} catch {
  /* expected: non-zero exit because the known-leak test fails */
}

let raw;
try {
  raw = JSON.parse(readFileSync(OUT, "utf8"));
} catch {
  console.error(`[selfcheck] FAILED: could not read promptfoo output at ${OUT}`);
  console.error("           Is promptfoo installed and on PATH?");
  process.exit(2);
}

const results = raw?.results?.results ?? raw?.results ?? [];
const fixtureOf = (r) => r?.vars?.fixture ?? r?.testCase?.vars?.fixture ?? "";

const leak = results.find((r) => fixtureOf(r).includes("CANARY_TM_7Q2X"));
const clean = results.find((r) => !fixtureOf(r).includes("CANARY_TM_7Q2X"));

if (!leak || !clean) {
  console.error(
    `[selfcheck] FAILED: expected a leak + a clean fixture, found ${results.length} result(s).`
  );
  process.exit(2);
}

const leakCaught = leak.success === false; // harness must FAIL the leak
const cleanPassed = clean.success === true; // harness must PASS the clean output

console.log("");
console.log(`  known-leak  -> ${leakCaught ? "FAIL (caught)      [OK]" : "PASS (MISSED!)    [X]"}`);
console.log(`  known-clean -> ${cleanPassed ? "PASS (no alarm)    [OK]" : "FAIL (false alarm) [X]"}`);
console.log("");

if (leakCaught && cleanPassed) {
  console.log("[selfcheck] HEALTHY — leakage detector discriminates leak vs clean.");
  process.exit(0);
}
console.error("[selfcheck] BROKEN — leakage results in this suite cannot be trusted.");
process.exit(1);
