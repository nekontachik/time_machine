# Q1 v2 — recall recovery check (v0 vs v2)

Model: google/gemini-3.1-flash-lite · runs/year: 3 · prompt-agnostic (candidates inlined).
Goal: v2 recovers count on DENSE years AND keeps sparse years padding-free.

| year | density | v0 counts | v2 counts | v0 avg | v2 avg |
|---|---|---|---|---|---|
| 44 BCE | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 79 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1066 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1347 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1517 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1789 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1914 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1969 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1989 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 753 BCE | medium | 3,3,3 | 1,1,1 | 3.0 | 1.0 |
| 410 | medium | 3,3,3 | 2,3,3 | 3.0 | 2.7 |
| 313 | medium | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 800 | medium | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1648 | medium | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1755 | medium | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1871 | medium | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1973 | medium | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 3000 BCE | low | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1237 | low | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1816 | low | 3,3,3 | 3,3,3 | 3.0 | 3.0 |

# v2 events (adjudicate padding by hand)

## 44 BCE (high) — v2 events
- r1 (3): [high] Assassination of Julius Caesar · [high] Introduction of the Julian Calendar · [medium] Cicero's Publication of De Officiis
- r2 (3): [high] Assassination of Julius Caesar · [high] Establishment of the Second Triumvirate's foundations · [medium] Cicero publishes the Philippics
- r3 (3): [high] Assassination of Julius Caesar · [high] Rise of Octavian · [medium] Release of Cicero's De Officiis

## 79 (high) — v2 events
- r1 (3): [high] Eruption of Mount Vesuvius · [medium] Accession of Titus · [medium] Death of Vespasian
- r2 (3): [high] Eruption of Mount Vesuvius · [medium] Accession of Emperor Titus · [medium] Death of Vespasian
- r3 (3): [high] Eruption of Mount Vesuvius · [medium] Accession of Titus · [medium] Death of Vespasian

## 1066 (high) — v2 events
- r1 (3): [high] The Battle of Hastings · [high] The Battle of Stamford Bridge · [medium] Appearance of Halley's Comet
- r2 (3): [high] Battle of Hastings · [high] Battle of Stamford Bridge · [medium] Appearance of Halley's Comet
- r3 (3): [high] The Battle of Hastings · [high] The Battle of Stamford Bridge · [medium] Perihelion Passage of Halley's Comet

## 1347 (high) — v2 events
- r1 (3): [high] The Arrival of the Black Death in Sicily · [high] Foundation of Charles University in Prague · [medium] The Fall of Caffa to the Golden Horde
- r2 (3): [high] The Arrival of the Black Death in Messina · [high] The Founding of Charles University in Prague · [medium] The Siege and Capture of Calais
- r3 (3): [high] The Arrival of the Black Death in Messina · [medium] Establishment of the Order of the Garter · [medium] The Coronation of Charles IV

## 1517 (high) — v2 events
- r1 (3): [high] Martin Luther posts the Ninety-five Theses · [high] The Ottoman-Mamluk War concludes with the conquest of Egypt · [medium] The first Portuguese diplomatic mission arrives in Ming China
- r2 (3): [high] Martin Luther publishes the 95 Theses · [high] Ottoman conquest of the Mamluk Sultanate · [medium] Establishment of the first permanent Portuguese presence in China
- r3 (3): [high] Martin Luther posts the Ninety-five Theses · [high] The Ottoman Empire conquers the Mamluk Sultanate · [medium] The first major outbreak of smallpox in the Americas

## 1789 (high) — v2 events
- r1 (3): [high] The French Revolution Begins · [high] Inauguration of the First U.S. President · [high] Publication of Lavoisier's 'Elementary Treatise on Chemistry'
- r2 (3): [high] The French Revolution Begins · [high] Ratification of the United States Constitution · [high] Publication of Lavoisier's Elementary Treatise on Chemistry
- r3 (3): [high] The French Revolution: Storming of the Bastille · [high] Inauguration of George Washington · [high] Antoine Lavoisier Publishes 'Elementary Treatise on Chemistry'

## 1914 (high) — v2 events
- r1 (3): [high] Assassination of Archduke Franz Ferdinand · [high] Opening of the Panama Canal · [high] Introduction of the Ford assembly line
- r2 (3): [high] Assassination of Archduke Franz Ferdinand · [high] Opening of the Panama Canal · [high] The First Battle of the Marne
- r3 (3): [high] Assassination of Archduke Franz Ferdinand · [high] Opening of the Panama Canal · [high] Introduction of the Ford assembly line

## 1969 (high) — v2 events
- r1 (3): [high] Apollo 11 Moon Landing · [high] The Woodstock Music & Art Fair · [high] ARPANET Goes Online
- r2 (3): [high] Apollo 11 Moon Landing · [high] Establishment of ARPANET · [medium] Woodstock Music & Art Fair
- r3 (3): [high] Apollo 11 Moon Landing · [high] Establishment of ARPANET · [medium] Woodstock Music & Art Fair

## 1989 (high) — v2 events
- r1 (3): [high] Fall of the Berlin Wall · [high] Invention of the World Wide Web · [medium] Tiananmen Square Protests
- r2 (3): [high] Fall of the Berlin Wall · [high] Tiananmen Square Protests · [high] Invention of the World Wide Web
- r3 (3): [high] Fall of the Berlin Wall · [high] Invention of the World Wide Web · [high] Tiananmen Square Protests

## 753 BCE (medium) — v2 events
- r1 (1): [high] The Traditional Founding of Rome
- r2 (1): [high] Traditional Founding of Rome
- r3 (1): [high] Traditional Founding of Rome

## 410 (medium) — v2 events
- r1 (2): [high] The Sack of Rome · [medium] Rescript of Honorius
- r2 (3): [high] The Sack of Rome by the Visigoths · [high] The Rescript of Honorius · [medium] The Death of Alaric I
- r3 (3): [high] The Sack of Rome by the Visigoths · [medium] The Rescript of Honorius · [medium] Death of Alaric I

## 313 (medium) — v2 events
- r1 (3): [high] Edict of Milan · [medium] Battle of Tzirallum · [medium] Death of Maximinus Daza
- r2 (3): [high] Edict of Milan · [high] Battle of Tzirallum · [medium] Death of Maximinus Daza
- r3 (3): [high] Edict of Milan · [high] Battle of Tzirallum · [medium] Death of Maximinus Daza

## 800 (medium) — v2 events
- r1 (3): [high] Coronation of Charlemagne · [medium] Death of Al-Qasim ibn Muhammad · [medium] Establishment of the Abbasid naval station in Crete
- r2 (3): [high] Coronation of Charlemagne · [medium] Establishment of the Abbasid-Carolingian Strategic Dialogue · [medium] Establishment of the Kingdom of Pamplona
- r3 (3): [high] Coronation of Charlemagne · [high] Death of Al-Khwarizmi's Predecessors and the maturation of the House of Wisdom · [medium] Establishment of the Viking settlement in Ireland

## 1648 (medium) — v2 events
- r1 (3): [high] The Peace of Westphalia · [high] Blaise Pascal's Puy de Dôme experiment · [medium] The Khmelnytsky Uprising
- r2 (3): [high] The Peace of Westphalia · [high] Blaise Pascal's Puy de Dôme experiment · [medium] The commencement of the Fronde in France
- r3 (3): [high] The Peace of Westphalia · [high] Blaise Pascal's Puy de Dôme experiment · [medium] Start of the Khmelnytsky Uprising's major military phase

## 1755 (medium) — v2 events
- r1 (3): [high] The Great Lisbon Earthquake · [medium] The Expulsion of the Acadians · [medium] Publication of A Dictionary of the English Language
- r2 (3): [high] The Great Lisbon Earthquake · [high] Publication of Samuel Johnson's 'A Dictionary of the English Language' · [medium] The Battle of the Monongahela
- r3 (3): [high] The Great Lisbon Earthquake · [high] Publication of A Dictionary of the English Language · [medium] The Battle of the Monongahela

## 1871 (medium) — v2 events
- r1 (3): [high] Unification of Germany · [medium] The Great Chicago Fire · [medium] Publication of The Descent of Man
- r2 (3): [high] Unification of Germany · [high] Establishment of the Paris Commune · [medium] Great Chicago Fire
- r3 (3): [high] Unification of Germany · [high] The Paris Commune · [medium] Passage of the Ku Klux Klan Act

## 1973 (medium) — v2 events
- r1 (3): [high] The OPEC Oil Embargo · [high] Roe v. Wade Supreme Court Decision · [medium] First Mobile Phone Call
- r2 (3): [high] The 1973 Oil Crisis · [high] Roe v. Wade Supreme Court Decision · [medium] Completion of the World Trade Center
- r3 (3): [high] The OPEC Oil Embargo · [high] Paris Peace Accords · [medium] First Mobile Phone Call

## 3000 BCE (low) — v2 events
- r1 (3): [high] Unification of Upper and Lower Egypt · [high] Early Development of Proto-Writing in Sumer · [medium] Expansion of the Caral-Supe Civilization
- r2 (3): [high] Unification of Upper and Lower Egypt · [medium] Foundation of the City of Troy · [medium] Development of Proto-Cuneiform Writing
- r3 (3): [high] Unification of Upper and Lower Egypt · [high] The Rise of Urbanization in Sumer · [medium] The Establishment of Skara Brae

## 1237 (low) — v2 events
- r1 (3): [high] The Mongol Invasion of Ryazan · [high] Unification of the Livonian and Teutonic Orders · [medium] Battle of Cortenuova
- r2 (3): [high] The Mongol Siege of Ryazan · [medium] Battle of Cortenuova · [medium] Unification of the Livonian and Teutonic Orders
- r3 (3): [high] The Mongol Invasion of Ryazan · [medium] Battle of Cortenuova · [medium] Union of the Livonian Brothers of the Sword and the Teutonic Order

## 1816 (low) — v2 events
- r1 (3): [high] The Year Without a Summer · [high] Invention of the Stethoscope · [medium] Indiana Achieves Statehood
- r2 (3): [high] The Year Without a Summer · [medium] The Invention of the Stethoscope · [medium] The Publication of 'Frankenstein'
- r3 (3): [high] The Year Without a Summer · [high] Invention of the Stethoscope · [medium] Indiana Statehood
