/**
 * Langfuse backfill — заливає наявні eval-трейси як traces + spans + scores.
 *
 * Run (from repo root):
 *   npx tsx scripts/eval/langfuse/ingest.ts --dry-run   # без мережі: парсинг + підсумок
 *   npx tsx scripts/eval/langfuse/ingest.ts             # реальний ingest
 *
 * Requires in .env.local: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST
 *
 * Модель даних (свідомо через сирий ingestion API, без SDK — щоб бачити її голою):
 *   trace-create      → один повний прогін пайплайну (unit of analysis)
 *   generation-create → LLM-стадія всередині trace: events-generation (Gemini),
 *                       scenario-generation (Claude) — root-cause attribution по стадіях
 *   score-create      → окремі сутності з різними іменами:
 *                       "payoff-judge" (вердикт судді) vs "human-payoff" (ground truth)
 *
 * НЕ змінює: харнес, суддю, gold set, продуктовий код. Це паралельний шар.
 */

import dotenv from "dotenv";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

dotenv.config({ path: ".env.local" });
dotenv.config();

const DRY = process.argv.includes("--dry-run");
const HOST = process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com";
const PK = process.env.LANGFUSE_PUBLIC_KEY ?? "";
const SK = process.env.LANGFUSE_SECRET_KEY ?? "";

// --- source data -----------------------------------------------------------

type Dims = { era: string; density: string; complexity: string; lang: string };
type TraceRec = {
  traceId: string;
  tupleId: string;
  run: number;
  ts: string;
  dims: Dims;
  hypothesis: string;
  year: number;
  lang: string;
  events: { id: number; title: string; impact: string }[];
  disabledIds: number[];
  separable: { ok: boolean };
  changes: string;
  scenarioModel: string;
  latencyMs: number;
  totalTokens: number;
  paragraphCount: number;
  output: string;
};

/** Два рани. runId йде в id трейсу (T01-r1 існує в ОБОХ файлах — колізія),
 *  в metadata і в tags. */
const RUNS = [
  {
    runId: "calib",
    traces: "scripts/eval/out/traces.jsonl",
    report: "scripts/eval/out/payoff-judge.md", // calibration: confusion matrix + disagreements
    gold: "evals1/payoff-review.md",
    kind: "calibration" as const,
  },
  {
    runId: "prod100",
    traces: "scripts/eval/out/product_100.jsonl",
    report: "scripts/eval/out/product_100-score.md", // score-only: таблиця fail-трейсів
    gold: null,
    kind: "score-only" as const,
  },
];

function loadJsonl(path: string): TraceRec[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as TraceRec);
}

/** Gold labels з рукокодованого review .md: `same` → fail, інакше good.
 *  Та сама логіка, що loadGold у runJudge.ts (не чіпаємо оригінал). */
function loadGold(path: string): Map<string, "fail" | "good"> {
  const txt = readFileSync(path, "utf-8");
  const blocks = txt.split(/\n### (T\d+-r\d+)/);
  const m = new Map<string, "fail" | "good">();
  for (let i = 1; i < blocks.length; i += 2) {
    const id = blocks[i].trim();
    const note = (
      blocks[i + 1].match(/\*\*(?:Note|Твоя нотатка):\*\*\s*(.*)/)?.[1] ?? ""
    ).toLowerCase();
    if (!note.trim()) continue;
    m.set(id, /\bsame\b|схож|convergent/i.test(note) ? "fail" : "good");
  }
  return m;
}

/** Рядки таблиць звітів судді: `| T15-r3 | central | ... |` */
function mdRows(path: string): string[][] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => /^\|\s*T\d+-r\d+\s*\|/.test(l))
    .map((l) => l.split("|").map((c) => c.trim()).filter(Boolean));
}

/** Реконструкція per-trace вердиктів судді (runJudge.ts персистить лише md-звіт).
 *  calibration: judge == gold усюди, КРІМ рядків disagreements
 *  (cols: traceId | complexity | gold | judge | reason | snippet).
 *  score-only: всі pass, КРІМ таблиці fail (cols: traceId | complexity | reason). */
function judgeVerdicts(
  run: (typeof RUNS)[number],
  gold: Map<string, "fail" | "good"> | null,
  ids: string[]
): Map<string, { pass: boolean; reason: string }> {
  const m = new Map<string, { pass: boolean; reason: string }>();
  const rows = mdRows(run.report);
  if (run.kind === "calibration") {
    if (!gold) throw new Error("calibration run requires gold labels");
    for (const id of ids) {
      const g = gold.get(id);
      if (!g) continue; // unlabelled → судді теж не приписуємо
      m.set(id, {
        pass: g === "good",
        reason: "reconstructed: judge==gold per calibration report (no per-trace verdicts persisted)",
      });
    }
    for (const r of rows) {
      // disagreement row перекриває реконструкцію
      const [id, , , judge, reason] = r;
      m.set(id, { pass: !/same/i.test(judge), reason: reason ?? "" });
    }
  } else {
    for (const id of ids)
      m.set(id, { pass: true, reason: "reconstructed: not in failure table of score report" });
    for (const r of rows) {
      const [id, , reason] = r;
      m.set(id, { pass: false, reason: reason ?? "" });
    }
  }
  return m;
}

// --- langfuse ingestion events ---------------------------------------------

type IngestEvent = { id: string; type: string; timestamp: string; body: Record<string, unknown> };

function ev(type: string, body: Record<string, unknown>): IngestEvent {
  return { id: randomUUID(), type, timestamp: new Date().toISOString(), body };
}

function buildEvents(run: (typeof RUNS)[number]): IngestEvent[] {
  const traces = loadJsonl(run.traces);
  const gold = run.gold ? loadGold(run.gold) : null;
  const judge = judgeVerdicts(run, gold, traces.map((t) => t.traceId));
  const out: IngestEvent[] = [];

  for (const t of traces) {
    const traceId = `${run.runId}-${t.traceId}`; // T01-r1 є в обох ранах
    const end = new Date(t.ts);
    const scenarioStart = new Date(end.getTime() - t.latencyMs);

    // trace = один повний прогін пайплайну
    out.push(
      ev("trace-create", {
        id: traceId,
        timestamp: t.ts,
        name: "alt-history-pipeline",
        input: { year: t.year, lang: t.lang, complexity: t.dims.complexity },
        output: t.output,
        metadata: {
          runId: run.runId,
          tupleId: t.tupleId,
          run: t.run,
          dims: t.dims,
          hypothesis: t.hypothesis,
          scenarioModel: t.scenarioModel,
          paragraphCount: t.paragraphCount,
          separable: t.separable?.ok,
        },
        tags: [
          run.runId,
          `complexity:${t.dims.complexity}`,
          `era:${t.dims.era}`,
          `density:${t.dims.density}`,
        ],
      })
    );

    // span 1: events-стадія (Gemini). Таймінг/модель НЕ записані в source JSONL —
    // backfill чесно лишає їх порожніми (межа того, що було залоговано).
    out.push(
      ev("generation-create", {
        id: `${traceId}-events`,
        traceId,
        name: "events-generation",
        startTime: t.ts,
        input: { year: t.year, lang: t.lang },
        output: { events: t.events, disabledIds: t.disabledIds, changes: t.changes },
        metadata: { note: "model/latency/tokens not persisted in source JSONL (backfill limitation)" },
      })
    );

    // span 2: scenario-стадія (Claude). startTime ≈ ts - latencyMs (апроксимація).
    out.push(
      ev("generation-create", {
        id: `${traceId}-scenario`,
        traceId,
        name: "scenario-generation",
        startTime: scenarioStart.toISOString(),
        endTime: t.ts,
        model: t.scenarioModel,
        input: { events: t.events, disabledIds: t.disabledIds, changes: t.changes },
        output: t.output,
        usage: { total: t.totalTokens },
        metadata: { latencyMs: t.latencyMs, note: "exact prompt not persisted; input = its arguments" },
      })
    );

    // score 1: вердикт судді — prediction з відомою похибкою (92.9% precision)
    const v = judge.get(t.traceId);
    if (v)
      out.push(
        ev("score-create", {
          id: `${traceId}-payoff-judge`,
          traceId,
          name: "payoff-judge",
          dataType: "BOOLEAN",
          value: v.pass ? 1 : 0, // 1 = pass (world diverged), 0 = fail (same-world)
          comment: v.reason,
        })
      );

    // score 2: людська мітка — ground truth, ОКРЕМЕ імʼя, щоб джерела не змішались
    const g = gold?.get(t.traceId);
    if (g)
      out.push(
        ev("score-create", {
          id: `${traceId}-human-payoff`,
          traceId,
          name: "human-payoff",
          dataType: "BOOLEAN",
          value: g === "good" ? 1 : 0,
          comment: "hand-coded gold label (evals1/payoff-review.md)",
        })
      );
  }
  return out;
}

// --- send ------------------------------------------------------------------

async function send(events: IngestEvent[]): Promise<void> {
  const auth = Buffer.from(`${PK}:${SK}`).toString("base64");
  const CHUNK = 50;
  for (let i = 0; i < events.length; i += CHUNK) {
    const batch = events.slice(i, i + CHUNK);
    const res = await fetch(`${HOST}/api/public/ingestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({ batch }),
    });
    if (!res.ok) throw new Error(`ingestion HTTP ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { errors?: unknown[] };
    if (j.errors?.length) console.error("partial errors:", JSON.stringify(j.errors, null, 2));
    console.log(`sent ${Math.min(i + CHUNK, events.length)}/${events.length}`);
  }
}

// --- main ------------------------------------------------------------------

async function main() {
  const all: IngestEvent[] = [];
  for (const run of RUNS) {
    const events = buildEvents(run);
    const byType = events.reduce<Record<string, number>>((a, e) => {
      a[e.body["name"] === "human-payoff" ? "score:human" :
        e.body["name"] === "payoff-judge" ? "score:judge" : e.type] =
        (a[e.body["name"] === "human-payoff" ? "score:human" :
           e.body["name"] === "payoff-judge" ? "score:judge" : e.type] ?? 0) + 1;
      return a;
    }, {});
    console.log(`[${run.runId}] ${run.kind}:`, JSON.stringify(byType));
    all.push(...events);
  }
  console.log(`total ingestion events: ${all.length}`);

  if (DRY) {
    console.log("\n--dry-run: sample trace-create event:\n");
    console.log(JSON.stringify(all.find((e) => e.type === "trace-create"), null, 2));
    return;
  }
  if (!PK || !SK) throw new Error("LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY missing in .env.local");
  await send(all);
  console.log(`done → ${HOST}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
