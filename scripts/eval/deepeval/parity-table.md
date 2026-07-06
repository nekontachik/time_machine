# Parity — DeepEval wrapper vs TS runner (payoff judge)

model: google/gemini-3.1-flash-lite  ·  traces: 20

| traceId | gold | original (TS) | wrapper (DeepEval) | match |
|---|---|---|---|---|
| T01-r1 | good | different_world | different_world | ✅ |
| T01-r2 | good | different_world | different_world | ✅ |
| T01-r3 | good | different_world | different_world | ✅ |
| T01-r4 | good | different_world | different_world | ✅ |
| T01-r5 | good | different_world | different_world | ✅ |
| T02-r1 | fail | same_world | same_world | ✅ |
| T02-r2 | fail | same_world | same_world | ✅ |
| T02-r3 | good | different_world | different_world | ✅ |
| T02-r4 | fail | same_world | same_world | ✅ |
| T02-r5 | fail | same_world | same_world | ✅ |
| T03-r1 | good | different_world | different_world | ✅ |
| T03-r2 | good | different_world | different_world | ✅ |
| T03-r3 | good | different_world | different_world | ✅ |
| T03-r4 | good | different_world | different_world | ✅ |
| T03-r5 | good | different_world | different_world | ✅ |
| T04-r1 | good | different_world | different_world | ✅ |
| T04-r2 | good | different_world | different_world | ✅ |
| T04-r3 | good | different_world | different_world | ✅ |
| T04-r4 | good | different_world | different_world | ✅ |
| T04-r5 | good | different_world | different_world | ✅ |

**Agreement: 20/20**  ·  disagreements: 0

Conclusion: verdicts identical — wrapper reproduces the TS judge exactly.
