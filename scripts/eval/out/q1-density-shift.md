# Q1 — Event-count shift check (before vs after)

Model: google/gemini-3.1-flash-lite · runs/year: 3 · both prompts per year, same run.
Question: does the year-accuracy fix shrink event count on DENSE years?

| year | density | before (counts) | after (counts) | before avg | after avg |
|---|---|---|---|---|---|
| 44 BCE | high | 3,3,3 | 2,2,2 | 3.0 | 2.0 |
| 79 | high | 3,3,3 | 2,2,2 | 3.0 | 2.0 |
| 1066 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1347 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1517 | high | 3,3,3 | 3,2,2 | 3.0 | 2.3 |
| 1789 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1914 | high | 3,3,3 | 3,3,2 | 3.0 | 2.7 |
| 1969 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1989 | high | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 753 BCE | medium | 3,3,3 | 1,1,1 | 3.0 | 1.0 |
| 410 | medium | 3,3,3 | 2,2,2 | 3.0 | 2.0 |
| 313 | medium | 3,3,3 | 2,2,2 | 3.0 | 2.0 |
| 800 | medium | 3,3,3 | 2,2,2 | 3.0 | 2.0 |
| 1648 | medium | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1755 | medium | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1871 | medium | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 1973 | medium | 3,3,3 | 3,3,3 | 3.0 | 3.0 |
| 3000 BCE | low | 3,3,3 | 2,2,2 | 3.0 | 2.0 |
| 1237 | low | 3,3,3 | 2,3,2 | 3.0 | 2.3 |
| 1816 | low | 3,3,3 | 3,3,3 | 3.0 | 3.0 |

## Dense-year read

9 high-density years checked. Look at the "after avg" column for these:
- 44 BCE
- 79
- 1066
- 1347
- 1517
- 1789
- 1914
- 1969
- 1989

Rule of thumb: after-avg ≈ 3 on dense years -> no shift (44 BCE dip was noise).
after-avg systematically < 3 on dense years -> real shift, escalate to Q2 (full 100 traces + judge).
