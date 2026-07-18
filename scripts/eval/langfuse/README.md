# Langfuse backfill — observability-шар поверх наявних eval-артефактів

Заливає наявні JSONL-трейси у Langfuse Cloud як traces із двома generation-spans
і розділеними scores. **Паралельний шар спостереження, не заміна харнесу**:
`runTraces.ts` / `runJudge.ts` лишаються джерелом істини, цей скрипт лише
індексує їхні виходи для інтерактивного семплінгу.

## Запуск

```bash
# з кореня репо
npx tsx scripts/eval/langfuse/ingest.ts --dry-run   # парсинг + підсумок, без мережі
npx tsx scripts/eval/langfuse/ingest.ts             # реальний ingest
```

Ключі в `.env.local` (не комітяться):

```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

## Що заливається

| Джерело | Ран | Traces | Scores |
|---|---|---|---|
| `scripts/eval/out/traces.jsonl` | `calib` (calibration) | 100 | `payoff-judge` + `human-payoff` |
| `scripts/eval/out/product_100.jsonl` | `prod100` (baseline, score-only) | 100 | `payoff-judge` |

Кожен trace:

- **trace** `alt-history-pipeline` — один повний прогін (unit of analysis);
  metadata: `runId`, `tupleId`, `run`, `dims` (era/density/complexity/lang),
  `hypothesis`, `scenarioModel`; tags: `runId`, `complexity:*`, `era:*`, `density:*`
- **generation** `events-generation` — стадія Gemini
- **generation** `scenario-generation` — стадія Claude Sonnet: model, latency
  (start/end), totalTokens, повний output

Trace id = `{runId}-{traceId}` (`calib-T01-r1`), бо `T01-r1` існує в обох ранах.

## Scores: два імені, два джерела — навмисно

- `payoff-judge` (BOOLEAN, 1 = pass/diff-world, 0 = fail/same-world) — вердикт
  каліброваного судді (92.9% precision / 100% recall). Це **prediction**.
- `human-payoff` (BOOLEAN, та сама полярність) — рукокодовані gold-мітки з
  `evals1/payoff-review.md`. Це **ground truth**. Є лише для `calib`-рану.

Окремі імена зберігають пари (judge, human) на тих самих трейсах — без цього
TPR/TNR неможливо перерахувати, а калібрування стає неповторюваним фактом.

## Чесні обмеження цього backfill

1. **Вердикти судді реконструйовані.** `runJudge.ts` персистить лише md-звіти,
   не per-trace вердикти. Реконструкція детермінована:
   - `calib`: judge == gold усюди, крім disagreements-таблиці звіту
     (1 FP: T20-r2; FN: 0);
   - `prod100`: pass усюди, крім failure-таблиці (T15-r3, T18-r3).
   Reasoning судді зберігся тільки для цих 3 трейсів; решта scores мають
   службовий коментар `reconstructed: ...`. Урок: score, що живе лише у
   звіті, не можна перевикористати — наступна ітерація `runJudge.ts` мала б
   писати і структурований JSONL вердиктів.
2. **`events-generation` без model/latency/tokens** — стадія Gemini не логувала
   свій тайминг у трейси. Backfill не вигадує дані.
3. **`startTime` scenario-стадії — апроксимація** (`ts - latencyMs`).
4. **Точний промпт scenario-стадії не персистився** — input span'а = його
   аргументи (events, changes), не фінальний текст промпту.
5. **Сирий ingestion API замість SDK** — свідомо: нуль нових залежностей у
   репо і видно модель даних (trace-create / generation-create / score-create)
   без абстракцій. Для live-інструментації продукту правильний шлях — SDK/OTel.

## Не використано (межі досвіду, не перебільшувати в резюме)

Live ingestion з продакшену, семплінг живого трафіку, alerting/monitoring,
datasets & experiments в UI, prompt management, sessions (продукт single-turn).
Використано: backfill традиційним batch-API, модель даних trace/span/generation/
score, розділення джерел scores, інтерактивний семплінг по metadata/tags/scores.
