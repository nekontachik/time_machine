---
tags: [eval, time-machine, adjudication, product-baseline, human-review]
created: 2026-07-04
purpose: адюдикувати 2 fail-кандидати судді, перш ніж публікувати базову лінію 2.0%
---

# Адюдикація 2 central fail-кандидатів (перед публікацією базової лінії)

**Навіщо.** Замір продукту дав 2/100 нудних кінцівок — але це **вердикт судді**, не ground truth. Ти читаєш повний фінальний абзац кожного й вирішуєш:
- **same (fail)** = альтернативний світ по суті ≈ наш реальний 2025 (нудна кінцівка). Підтверджує суддю.
- **diff** = світ матеріально інший. Тоді це хибна тривога судді (false positive), і базова лінія падає.

Наслідок для цифри: обидва same → **2.0%** · один diff → **1.0%** · обидва diff → **0%**.

> Критерій нагадаю: рахуй **матеріальний** present. Обрамлення «what is missing / чого бракує» саме по собі різним світом НЕ робить (той самий принцип, що ми застосували в калібруванні).
> Обидва — свідомо граничні кейси (borderline): світ майже наш, різниця тонка. Розумні люди можуть розійтись — тому вирішуєш ти.

---

### Кандидат 1 · T15-r3 · рік 1816 · central
**Зміна:** «The Year Without a Summer» НЕ сталося (рік без літа — під час нього Мері Шеллі написала «Франкенштейна»).
**Вердикт судді:** same_world (fail).

**Фінальний абзац (повністю):**
> In 2025, the world is recognizably modern but tilted on a slightly different axis. The American Midwest is less densely populated in its older cities, and the political geography of the Great Lakes states retains a faint Eastern character, as if the frontier never quite exhaled. German unification occurred in 1871 on schedule, but the romantic-nationalist mythology that fueled it was less saturated with the gothic and the transgressive, producing a Wilhelmine culture that was aggressive in familiar ways but oddly less obsessed with the uncanny. Computing arrived on approximately the same timetable — transistors, mainframes, the internet — but the field's self-mythology, its recurring dream of artificial minds and digital consciousness, developed without Frankenstein as a shared cultural shorthand. Programmers do not speak of "playing God." They speak instead of engineering, purely, without the shiver. The discipline is more confident and perhaps more reckless for lacking that particular ghost. In university libraries around the world, on the shelf between Percy Shelley's collected poems and a biography of Lord Byron, there is a gap — a thin, conspicuous absence where a novel called Frankenstein; or, The Modern Prometheus would have stood — and most students walk past it without noticing that anything is missing.

**Підказка (не вердикт):** світ матеріально ≈ наш (ті самі кордони, технології, хронологія обчислень); різниця — відсутній роман + тонкий культурний відтінок. Схиляюсь, що суддя правий (same), але це гранично.

**Твій вердикт:**  `[+] same (нудна, fail)`   `[ ] diff (інший світ)`
**Коментар:**

---

### Кандидат 2 · T18-r3 · рік 1969 · central
**Зміна:** «Apollo 11 Moon Landing» НЕ сталося.
**Вердикт судді:** same_world (fail).

**Фінальний абзац (повністю):**
> In 2025, the world runs on a communication satellite grid that is denser, cheaper, and more internationally distributed than in any other conceivable history, because the Space Reorientation Act turned out to be, accidentally, the right economic bet: GPS is a joint American-European system administered from a bland office building in The Hague, and the mobile internet arrived roughly on schedule, shaped by slightly different hands. The Soviet Union fractured in 1991 just the same, under the same economic pressures, though the Russian Federation carries a residual prestige — *we were first on the moon* — that manifests as a harder nationalism and a security council veto exercised with noticeably less hesitation. Most people alive today have never thought carefully about any of this. They order food to their apartments, argue on social platforms, worry about their parents' health. What is missing is harder to name than what is present: a particular flavor of collective awe, a specific muscle in the human imagination that gets exercised when a species watches itself do the impossible and believes, for one verifiable moment, that it did. The Smithsonian Air and Space Museum on the National Mall exists, and it is popular, but its central gallery — the one that in every other timeline holds an actual Apollo 11 command module under track lighting — holds instead a detailed scale model, and docents have learned, over fifty years of repeat questions, to answer patiently when children ask why.

**Підказка (не вердикт):** present матеріально ≈ наш (той самий розпад СРСР, смартфони, соцмережі); різниця — Росія «перша на Місяці» + обрамлення «what is missing». Схиляюсь, що суддя правий (same), але теж гранично.

**Твій вердикт:**  `[+ ] same (нудна, fail)`   `[ ] diff (інший світ)`
**Коментар:**

---

## Після твого рішення

Скажеш вердикти — я:
1. зафіксую підтверджену базову лінію (2.0% / 1.0% / 0%) у `product-100-weak-payoff-measurement.md` і `SUMMARY.md`, прибравши позначку «оцінка судді»;
2. якщо котрийсь виявиться FP — це знайдений новий приклад помилки судді на свіжих трейсах; занотуємо як кандидата на калібрування раунд 2 (суддя, валідований на старих трейсах, міг трохи інакше поводитись на нових).
