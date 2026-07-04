---
tags: [eval, time-machine, gold, pending-labels, human-review]
created: 2026-07-02
purpose: закрити 2 pending gold-мітки (заповнювач "---") у payoff-review.md
---

# Закриття pending gold-міток — 2 картки

**Стан пункту «Закрити pending мітки (T10-r5, порожні T04/T11/T18)»:**
- T10-r5 та решта T04/T11/T18 — вже розмічені `diff`. Закрито.
- **Лишились 2 заповнювачі `---`: T04-r2 і T11-r1.** Код зарахував їх як `good` за замовчуванням (без твого реального вердикту). Якщо котрийсь насправді `same_world`, це прихований false negative → recall перестає бути 100%. Тому закриваємо руками.

**Як закрити:** винеси вердикт нижче, тоді в `evals1/payoff-review.md` заміни `---` у полі Note цих трейсів на реальну мітку (`diff` = різний світ / `same` = той самий світ). Опційно — короткий ре-ран калібрування підтвердить, що recall не змінився.

---

### Картка 1 · T04-r2 · рік 79 · complexity=central
**Зміна:** «Eruption of Mount Vesuvius» НЕ сталося.
**Поточна мітка:** `---` (заповнювач) · **вердикт судді при калібруванні:** different_world (pass)

**Фінальний абзац («World 2025»):**

> In 2025 of this timeline, the Mediterranean Basin remains the intellectual and technological center of a world where the Roman institutional tradition fractured later and differently — not collapsing so catastrophically in the West during the fifth century, partly because the agricultural and administrative networks of Campania were never severed by that single catastrophic loss of population and infrastructure. The Italian coast between Naples and Sorrento is an unbroken urban megalopolis of four million people, culturally continuous with antiquity in the way that, say, Athens feels continuous in our world. Latin never became a dead language but evolved the way Greek did — living, spoken, bureaucratic. Scholars at Herculaneum's university still read the philosophical originals in manuscript traditions stretching back without interruption. The average person in this coastal city commutes by electric rail past temples that have been in continuous use for two thousand years, past forum squares where the same stones have been worn smooth by two millennia of feet. But archaeologists working in the Campanian hills have noticed something that quietly unsettles them: beneath the topsoil of the countryside around Vesuvius, ground-penetrating radar reveals vast, sealed chambers of compressed volcanic rock — not ruins, not artifacts, but pure geological potential energy, patient and unspent, a disaster deferred rather than deleted, still waiting.

**Твій вердикт:**  `[ +] різний світ (diff)`   `[ ] той самий світ (same)`
**Коментар:** 

---

### Картка 2 · T11-r1 · рік 1517 · complexity=central
**Зміна:** «Martin Luther Posts His Ninety-five Theses» НЕ сталося.
**Поточна мітка:** `---` (заповнювач) · **вердикт судді при калібруванні:** different_world (pass)

**Фінальний абзац («World 2025»):**

> In 2025, the world is quieter in ways that feel like suffocation. The Roman Catholic Church maintains spiritual authority over approximately sixty percent of the globe's population, its institutional structures — refined across five unbroken centuries — functioning with the polished efficiency of a state that has never faced an existential challenge. The Internet exists, developed through military and commercial channels in the 1980s, but the culture of individual conscience it carries lacks a vocabulary for dissent that was never linguistically built; comment sections are strangely deferential, algorithmically shaped by concordats between Silicon Valley companies and episcopal councils that govern what constitutes harmful speech. Nations exist, democracy exists in partial forms, but the concept of the individual soul answerable to no earthly institution — the Protestant idea that quietly scaffolded liberalism, human rights law, and secular governance — was never fully theorized. The average person in Frankfurt or London wakes, works, and sleeps inside a life that is materially comfortable and spiritually administered, and cannot name the feeling that something is missing, because the word for that feeling was never coined.

**Твій вердикт:**  `[ +] різний світ (diff)`   `[ ] той самий світ (same)`
**Коментар:** 

---
