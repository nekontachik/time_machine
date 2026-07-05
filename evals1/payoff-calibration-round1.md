---
tags: [eval, time-machine, judge, payoff, calibration, round1]
created: 2026-07-02
judge_model: google/gemini-3.1-flash-lite
generator_model: anthropic/claude-sonnet-4.6
source_traces: scripts/eval/out/traces.jsonl
source_labels: evals1/payoff-review.md
gold: 100 traces · 10 fail (same_world) / 90 good (different_world)
---

# Payoff-суддя — калібрування, раунд 1 (review-пакет)

> Positive class = **`same_world`** (fail / weak payoff).
> Суддя `gemini-3.1-flash-lite` — крос-родинний до генератора сценаріїв (`claude-sonnet-4.6`), self-preference bias не діє.
> **Фінальні вердикти по розбіжностях виносить людина.** Тут — тільки дані + по одній гіпотезі на картку.

## 1. Метрики + confusion matrix

| | judge: fail | judge: good |
|---|---|---|
| **gold: fail** | **10** (TP) | **0** (FN) |
| **gold: good** | **7** (FP) | **83** (TN) |

- **precision (fail) = 10/17 = 58.8%**
- **recall (fail) = 10/10 = 100.0%**
- accuracy = 93.0% · F1 = 74.1% · unknown = 0

## 2. Висновок: поріг ≥80/≥80 — НІ

- **recall 100% — пройдено з запасом.** Суддя не пропустив жодного реального `same_world`: нуль FN. Як high-sensitivity скринінг він надійний — крізь нього нічого не протікає.
- **precision 58.8% — провалено.** Із 17 «fail»-вердиктів 7 хибні. Суддя **over-flag'ає**: схиляється називати світ «таким самим, як наш». Довіряти окремому fail-вердикту без ревʼю поки не можна.
- **accuracy 93% — це пастка.** Виглядає прекрасно й повністю маскує діру в precision. Рівно той випадок, чому accuracy заборонена як критерій на меншісному класі (10/100).

Це не «зламаний» суддя і не rubber-stamp — це **чутливий, але надто охочий** детектор. І, головне, 7 FP **не випадкові** — вони лягають у два системні патерни (нижче). Це продуктивний стан: є що чинити.

## 3. Два патерни серед 7 FP

**Патерн A — суддя переоцінює паритет «ядрової» технології (4 картки).**
Коли історія лишає смартфони/інтернет/Spotify «як у нас», суддя ставить `same_world`, **ігноруючи** явно виписану змінену цивілізацію — інститути, культуру, інтелектуально-релігійний лад. А критерій `different_world` прямо включає *«recognizably altered civilization»*. Тобто суддя недозастосовує цю клаузу. → трейси **T07-r2, T13-r1, T17-r3, T20-r2**. Гіпотеза (a). Лікується правкою промпту.

**Патерн B/C — «нічого не вимкнено» (all events happened) → present ≈ наш (3 картки).**
Тут дивергенції не було взагалі, тож теперішнє рендериться матеріально нашим, а «різність» тримається на рефлексивному обрамленні («haunting detail», «what is missing / road not taken»). Суддя читає матеріальний present (= наш → `same_world`); людина зарахувала контрфактичне обрамлення як `different_world`. → трейси **T17-r4, T09-r3** (гіпотеза b — мітка сумнівна), **T17-r5** (гіпотеза c — критерій розмитий). Повʼязано з комітом `e1c55be fix(none): diverge when nothing is toggled` — gold-мітки для none-кейсів можуть передувати цьому рішенню.

---

## 4. Картки розбіжностей (7)

Легенда гіпотез: **(a)** суддя помиляється · **(b)** людська мітка сумнівна · **(c)** критерій `same_world` розмитий саме тут.
_Reasoning судді наведено як у звіті (обрізаний харнесом до ~80 симв.; позначено «…»)._

---

### Картка 1 — T07-r2 · рік 800 · complexity=peripheral
**Якір (вимкнено):** «Book of Exodus Commentary by Saadia Gaon» не сталося.
**Людська мітка:** `good` (different_world). Нотатка: `diff` (без деталізації).
**Вердикт судді:** `same_world`. Reason: *«The paragraph describes a world with identical 2025 technology, geopolitics, and…»*
**Present-day фрагмент (суть):** раціоналістичне крило юдейської філософії зʼявилось на ~3 століття пізніше й лишилось «more mystical, more Neoplatonic»; Аквінат зважений радше на Августина, ніж на Аристотеля; Наукова революція зсунута на ~40 років; «churches and mosques and synagogues are subtly more authoritative in daily life». При цьому «quantum computing and gene editing and electric vehicles… not a lesser world technologically».
**Гіпотеза → (a) суддя помиляється.** Історія встановлює *recognizably altered civilization* (інтелектуально-релігійний лад), а суддя списав це як «identical», зафіксувавшись на паритеті технологій.

---

### Картка 2 — T13-r1 · рік 1755 · complexity=peripheral
**Якір (вимкнено):** Semmuel Johnson «A Dictionary of the English Language» не сталося.
**Людська мітка:** `good` (different_world). Нотатка: `diff`.
**Вердикт судді:** `same_world`. Reason: *«The setting remains the United Kingdom and America with the same internet-based,…»*
**Present-day фрагмент (суть):** реформована американська орфографія («thru», «clas», «medisin») за Франкліном; у Британії — століття орфографічного різнобою без стандартизувального словника; авто-корекція в інтернеті підтримує регіональні варіанти, бо єдиного авторитету не постало; «loneliness» не має узгодженого написання в жодному діалекті.
**Гіпотеза → (a) суддя помиляється.** Конкретна змінена щоденна культура (мова/орфографія) кваліфікується як different_world; суддя переважив «same internet/tech».

---

### Картка 3 — T17-r3 · рік 1871 · complexity=none (нічого не вимкнено)
**Людська мітка:** `good` (different_world). Нотатка: `diff`.
**Вердикт судді:** `same_world`. Reason: *«The daily life, technology, and geopolitical history (including the specific fat…»*
**Present-day фрагмент (суть):** інтернет «architecturally feudal», автентифікація в руках чотирьох державно-ліцензованих сертифікаційних монополій (2 US, 1 DE, 1 JP) за договором 1987; Сноуден екстрадований за 11 днів і відбуває 14-й рік у Terre Haute; «most people alive have never heard his name».
**Гіпотеза → (a) суддя помиляється.** Reason стверджує «identical», але фрагмент прямо описує інакший інститут інтернету й інакшу долю Сноудена — це матеріально інший present, а не косметика.

---

### Картка 4 — T20-r2 · рік 1973 · complexity=peripheral
**Якір (вимкнено):** реліз «The Dark Side of the Moon» не сталося.
**Людська мітка:** `good` (different_world). Нотатка: `diff`.
**Вердикт судді:** `same_world`. Reason: *«The world described utilizes the exact same technology (Spotify) and cultural in…»*
**Present-day фрагмент (суть):** стрімінгові алгоритми навчені на іншому корпусі; «side-long listening» не закріпилось як легітимний режим; music therapy — менша й гірше фінансована дисципліна; Abbey Road Studio Two перероблено на бутик-готель.
**Гіпотеза → (a) суддя помиляється.** Reason сам стверджує «same cultural institutions», хоча фрагмент перелічує змінені інститути (music therapy, Abbey Road) — суддя переважив паритет Spotify. _Найм'якший із (a): відмінності реальні, але вужчі._

---

### Картка 5 — T17-r4 · рік 1871 · complexity=none (нічого не вимкнено)
**Людська мітка:** `good` (different_world). Нотатка: `diff`.
**Вердикт судді:** `same_world`. Reason: *«The text explicitly confirms the 2025 timeline is identical to our real world, i…»*
**Present-day фрагмент (дослівно, зачин):** *«The world of 2025 is therefore our world, which is the most haunting alternative of all — a place built on the rubble of two world wars, the Holocaust, Hiroshima, the Gulag…»*
**Гіпотеза → (b) людська мітка сумнівна.** Текст **прямо** каже «is therefore our world» — це буквально `same_world`; тут вердикт судді виглядає коректним, а gold-мітка `diff` вимагає перегляду.

---

### Картка 6 — T09-r3 · рік 1237 · complexity=none (нічого не вимкнено)
**Людська мітка:** `good` (different_world). Нотатка: `diff`.
**Вердикт судді:** `same_world`. Reason: *«The paragraph describes the modern Russian Federation as it currently exists, co…»*
**Present-day фрагмент (суть):** «The Russian Federation exists, enormous and extractive», монгольський спадок в адмініструванні — це опис **реальної** сьогоднішньої РФ; різність — лише в «what is missing… a road not taken».
**Гіпотеза → (b) людська мітка сумнівна.** Матеріальний present = наш світ; `same_world` захищений. Різниця тримається на контрфактичній тузі, а не на іншому теперішньому.

---

### Картка 7 — T17-r5 · рік 1871 · complexity=none (нічого не вимкнено)
**Людська мітка:** `good` (different_world). Нотатка: `diff`.
**Вердикт судді:** `same_world`. Reason: *«The paragraph describes an identical history to our own, including the same Worl…»*
**Present-day фрагмент (суть):** ЄС як мирний проєкт після WW1/WW2, смартфони, Channel Tunnel, «European values» — наш фактичний світ; поряд — рефлексія «what is missing» (Османський світ, колоніальні субʼєкти).
**Гіпотеза → (c) критерій `same_world` розмитий тут.** Матеріальний present = наш, але текст навантажений контрфактичним обрамленням; критерій не каже, чи зараховувати рефлексію «road not taken» як different. Спільний корінь із T17-r4/T09-r3.

---

## 5. Пропозиція правки промпту (тільки для патерну A — 4 картки)

**НЕ комічено. Чернетка на твоє погодження.** Ціль: підняти precision, не зачепивши recall (10 реальних fail — це чисті «our world / recap» БЕЗ жодного зміненого інституту, тож ризик регресії низький — але треба перевірити ре-раном).

Зараз у `payoffJudge.ts` визначення:
> `"different_world": meaningfully different… — e.g. nations that don't exist / are missing, a different technology level, a recognizably altered civilization.`

Суддя читає цей перелік як «нації АБО рівень технологій» і відкидає culture/institutions. Пропоную:

1. **Явна клауза + контраст у `different_world`:**
   *«A recognizably altered civilization COUNTS as different_world even if consumer technology (smartphones, the internet, streaming) is identical to ours — e.g. a different religious-intellectual order, altered core institutions (a differently-governed internet, a different linguistic/orthographic standard), or a materially different cultural landscape. Identical gadgets do NOT by themselves make a world same_world.»*
2. **Звузити `same_world`:**
   *«same_world requires that institutions, culture, and daily social order — not just core technology — match ours. If the paragraph establishes a materially altered institution or culture, it is different_world.»*
3. **(опційно, зачіпає патерн B/C — обговорити окремо):** *«Judge the MATERIAL present described, not the narrative's counterfactual musing about what is missing or roads not taken.»* — це зробить суддю ще жорсткішим на none-кейсах; вводити лише синхронно з рішенням по gold-мітках T17-r4/r5, T09-r3, інакше зламаєш логіку в інший бік.

## 6. Куди рухається precision (умовна арифметика — рішення за тобою)

Два **незалежні** важелі; поодинці жоден не дає ≥80, разом — дають:

- **Важіль 1 — перегляд 3 none-міток** (T17-r4, T09-r3 як b; T17-r5 як c). Якщо визнати їх реальними fail: TP=13, FP=4 → **precision 76.5%**, recall лишається 100% (gold fails=13).
- **Важіль 2 — правка промпту** усуває 4 хиби патерну A (FP−4).
- **Разом** (3 none-мітки → fail, 4×A виправлено): FP=0, TP=13 → **precision 100%**, recall 100%.
- Якщо none-мітки лишити `good`, а виправити лише 4×A: TP=10, FP=3 → **precision 76.9%** — усе ще <80, тож самої правки промпту **недостатньо**; потрібен і перегляд gold.

> Наступний крок (з твого «так»): ти виносиш вердикти по 7 картках → за ними вирішуємо, чи правимо промпт, чи чистимо 3 gold-мітки, чи і те, і те → **один** ре-ран для підтвердження ≥80/≥80. Автономний цикл «правка→ре-ран» не запускаю.

---

## 7. Вердикти людини (раунд 1) — фінальні

_Винесені тобою після перечитування present-day абзаців. Я — тільки записав._

| # | trace | complexity | gold (було) | суддя | **твій вердикт** | гіпотеза | дія |
|---|---|---|---|---|---|---|---|
| 1 | T07-r2 | peripheral | good | same_world | **суддя помилився** (світ інший, хоч різниця мʼяка) | (a) | правка промпту |
| 2 | T13-r1 | peripheral | good | same_world | **суддя помилився** (інший світ, різниця мінімальна) | (a) | правка промпту |
| 3 | T17-r3 | none | good | same_world | **суддя помилився** — інший світ | (a) | правка промпту |
| 4 | T20-r2 | peripheral | good | same_world | **суддя помилився** | (a) | правка промпту |
| 5 | T17-r4 | none | good | same_world | **суддя правий** — той самий світ | (b) | перевернути gold → fail |
| 6 | T09-r3 | none | good | same_world | **суддя правий** | (b) | перевернути gold → fail |
| 7 | T17-r5 | none | good | same_world | **суддя правий** | (b) | перевернути gold → fail |

Підсумок: **4 реальні помилки судді** (усі — патерн A: чіпляється за паритет технологій, ігнорує змінені інститути) + **3 хибні gold-мітки** на none-кейсах (present матеріально = наш світ; «різність» була лише в обрамленні «what is missing»).

> Важливо (урок методу): перевернути 3 gold-мітки — це **не** «дати роботу перемогти». Ти перечитав текст і вирішив, що present матеріально наш. Розбіжність зробила свою роботу — вона проаудитувала **і суддю, і твій власний gold**, і в 3 випадках підсвітила непослідовність у твоїй старій розмітці. Це нормальний і корисний результат калібрування.

## 8. Перерахунок метрик за твоїми вердиктами

**Крок 1 — виправити 3 gold-мітки** (T17-r4, T09-r3, T17-r5: good → fail). Вердикти судді не змінюються; ці 3 переходять FP → TP. Тепер gold fail = 13.

| | judge: fail | judge: good |
|---|---|---|
| **gold: fail** | 13 (TP) | 0 (FN) |
| **gold: good** | 4 (FP) | 83 (TN) |

- precision = 13/17 = **76.5%** · recall = 13/13 = **100%**
- Це чесна калібровка **поточного** судді проти **виправленого** gold. Precision усе ще <80 — лишились рівно 4 помилки патерну A.

**Крок 2 — правка промпту прибирає 4 помилки патерну A** (розділ 5). Якщо суддя почне коректно ставити `different_world` на цих 4 — вони переходять FP → TN.

| | judge: fail | judge: good |
|---|---|---|
| **gold: fail** | 13 (TP) | 0 (FN) |
| **gold: good** | 0 (FP) | 87 (TN) |

- precision = 13/13 = **100%** · recall = 13/13 = **100%** → **поріг ≥80/≥80 пройдено.**
- ⚠ Це **прогноз**, не факт. Підтверджується лише ре-раном на тому самому gold. Правка промпту — ручка precision↔recall; після неї перевіряємо **обидва** числа (recall не має впасти нижче 100%).

## 9. Конкретні наступні дії

1. **Ти** у `evals1/payoff-review.md` перевертаєш 3 мітки на fail (`same`): **T17-r4, T09-r3, T17-r5**. _Я цей файл не чіпаю — заборонено правити gold._
2. **Ти** погоджуєш чернетку правки промпту з розділу 5 (тільки патерн A: «змінені інститути/культура = different_world; смартфони-як-у-нас цього не скасовують; поетичні деталі й „what is missing“ не рахуються»).
3. Після (1)+(2) — **один** ре-ран → підтвердити 100/100 (чи хоча б ≥80/≥80). Автономний цикл «правка→ре-ран» без твого «так» не запускаю.
