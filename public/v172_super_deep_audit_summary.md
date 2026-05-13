# IPPC Study Suite V174 — Current Audit Summary

## Current build

V174 is the flashcard recall rebuild based on the V172 mobile/offline website and the V168 full deep-audit-clean question bank baseline.

## Question bank baseline retained

- 2,000 questions
- 25 sets
- 80 MCQs per set
- Formula-led calculation explanations
- Statement-by-statement Roman numeral explanations
- Answer-length cueing controlled from the V168 deep-audit baseline
- Previous full deep audit status: zero remaining issue flags before the flashcard rebuild

## Flashcard rebuild audit

Status: PASS

The flashcard module now tests only the four requested straight-recall areas:

| Deck | Cards |
|---|---:|
| Important Dates | 23 |
| Acts & Schedules | 49 |
| Fines, Penalties & Jail Terms | 15 |
| Islamic Terms | 17 |
| **Total** | **104** |

## Flashcard quiz option logic

Quiz distractors are selected from the same deck/category but from a different fact.

- Penalty question → all choices are other penalty/fine/jail-term answers.
- Date question → all choices are other dates.
- Acts & Schedules question → all choices are other Acts, Sections or Schedules.
- Islamic term question → all choices are other Islamic terms.

## Checks passed

- Only requested flashcard categories remain.
- No old flashcard categories remain.
- No broad investor-category/PIDM/general-rule cards remain in the flashcard deck.
- Every card has at least three same-topic distractors available.
- No duplicate prompts.
- Build test passed.
