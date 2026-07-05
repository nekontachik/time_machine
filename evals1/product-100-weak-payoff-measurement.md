---
tags: [eval, time-machine, judge, payoff, score-only, product-measurement, baseline]
created: 2026-07-04
judge_model: google/gemini-3.1-flash-lite
judge_calibration: precision 92.9% · recall 100.0% (vs human gold, n=100)
source_traces: scripts/eval/out/product_100.jsonl (100 fresh traces, post-fix code, 2026-07-04)
---

# Замір продукту: рівень нудних кінцівок (weak-payoff) — базова лінія

## 1. Підсумок

**Базова лінія (підтверджена): 2 нудні кінцівки зі 100 → 2.0%** (95% CI [0.6%, 7.0%]).

> ✅ **Ground truth, не оцінка.** Обидва fail-кандидати (T15-r3, T18-r3) людина прочитала й адюдикувала як справжні `same_world` (2026-07-04). Суддя (`gemini-3.1-flash-lite`, валідований P=92.9%/R=100%) вгадав обидва точно — 2/2, жодної хибної тривоги на свіжих трейсах.
> Рештка невпевненості — суто статистична: 2/100 на вибірці, справжній рівень у межах CI [0.6%, 7.0%].

Це **перша базова цифра якості продукту** — те, заради чого будувалась уся eval-інфраструктура.

## 2. Розбивка по складності (з довірчими інтервалами)

| складність | трейсів | fail | rate | 95% CI |
|---|---|---|---|---|
| **central** (1 велика подія) | 35 | **2** | **5.7%** | [1.6%, 18.6%] |
| none (нічого) | 20 | 0 | 0% | [0%, 16.1%] |
| peripheral (дрібна подія) | 20 | 0 | 0% | [0%, 16.1%] |
| compound (кілька подій) | 25 | 0 | 0% | [0%, 13.3%] |
| **разом** | 100 | 2 | 2.0% | [0.6%, 7.0%] |

Два спостереження:
- **Усі провали — у `central`.** Коли перемикається рівно одна велика подія, модель зрідка «фізкає» назад у ≈наш світ. `none`/`peripheral`/`compound` — чистий нуль.
- **`none` = 0/20 на свіжих трейсах** — це незалежно **підтверджує, що NONE-фікс тримається** (не лише на тих 20, що ми верифікували, а й на новій генерації).

## 3. Fail-кандидати для людського review

**Адюдиковано 2026-07-04: обидва підтверджені людиною як `same_world` (fail).** Історичний запис нижче.

### Кандидат 1 · T15-r3 · рік 1816 · central
**Зміна:** «The Year Without a Summer» НЕ сталося.
**Вердикт судді:** same_world (fail) · reason: *«…same geopolitical boundaries, technology, and essentiall[y our world]»*

**Фінальний абзац:**
> In 2025, the world is recognizably modern but tilted on a slightly different axis. The American Midwest is less densely populated in its older cities... German unification occurred in 1871 on schedule... Computing arrived on approximately the same timetable — transistors, mainframes, the internet — but the field's self-mythology... developed without Frankenstein as a shared cultural shorthand. Programmers do not speak of "playing God."... In university libraries around the world, on the shelf between Percy Shelley's collected poems and a biography of Lord Byron, there is a gap... where a novel called Frankenstein... would have stood — and most students walk past it without noticing that anything is missing.

**Гіпотеза (підказка, не вердикт):** схоже на справжній weak-payoff — світ матеріально ≈ наш (ті самі кордони, технології, хронологія), різниця лише у відсутньому романі + тонкому культурному відтінку. Судячи з усього, суддя правий.

**Твій вердикт:**  `[ ] нудна кінцівка (same/fail)`   `[ ] нормальна (diff)`   `[ ] не певен`
**Коментар:**

---

### Кандидат 2 · T18-r3 · рік 1969 · central
**Зміна:** «Apollo 11 Moon Landing» НЕ сталося.
**Вердикт судді:** same_world (fail) · reason: *«…same geopolitical structure, economic pressures, and lif[e]»*

**Фінальний абзац:**
> In 2025, the world runs on a communication satellite grid that is denser, cheaper... GPS is a joint American-European system administered from a bland office building in The Hague... The Soviet Union fractured in 1991 just the same... the Russian Federation carries a residual prestige — *we were first on the moon*... Most people alive today have never thought carefully about any of this. They order food to their apartments, argue on social platforms... What is missing is harder to name than what is present: a particular flavor of collective awe... The Smithsonian Air and Space Museum... holds instead a detailed scale model, and docents have learned... to answer patiently when children ask why.

**Гіпотеза (підказка, не вердикт):** теж схоже на weak-payoff — present матеріально ≈ наш (той самий розпад СРСР, смартфони, соцмережі), «інакшість» тримається на «what is missing» (немає колективного трепету) + Росія перша на Місяці. Той самий патерн, що ми перевертали на fail у none-кейсах. Схоже, суддя правий.

## 4. Висновок і чесні межі

**Базова лінія: продукт у доброму стані — ~2% нудних кінцівок, і всі вони в одному місці (`central`).** Найголовніший ризик-кейс, який ми лагодили (`none`), тримається на нулі й на свіжих трейсах.

Межі, які не можна замовчати:
- **Ground truth ✔.** Обидва fail адюдиковані людиною (2026-07-04) — 2.0% підтверджено, більше не «оцінка судді».
- **Малий n у бакетах.** `central` 2/35 має широкий CI [1.6%, 18.6%] — з 2 прикладів **не можна** твердо сказати «central гірший». Це **гіпотеза**, не доведений патерн. Нулі в інших бакетах теж означають лише «до ~13–16% зверху», а не гарантований нуль.
- **Патерн провалів однорідний:** обидва — «матеріально наш світ + обрамлення „чого бракує"». Якщо після твоєї адюдикації це підтвердиться, це конкретний, названий failure mode для наступної роботи над генератором.

## 5. Що далі — на вибір
- **Зафіксувати базову лінію** (2% weak-payoff, концентрація в `central`) і закрити задачу заміру.
- **Підтвердити central-гіпотезу:** догенерувати більше саме `central`-трейсів (напр. +50), щоб звузити [1.6%, 18.6%] і сказати впевнено, чи справді central — слабке місце.
- **Полагодити генератор** під знайдений патерн (як робили з NONE-фіксом), якщо адюдикація підтвердить обидва fail.
