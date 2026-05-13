# IPPC Study Suite V174 — Flashcard Recall Rebuild Audit

## Result

**Status:** PASS

## Scope

The flashcard module was rebuilt to test only the four requested straight-recall areas:

1. Important Dates
2. Acts & Schedules
3. Fines, Penalties & Jail Terms
4. Islamic Terms

## Flashcard counts

| Deck | Cards |
|---|---:|
| Important Dates | 23 |
| Acts & Schedules | 49 |
| Fines, Penalties & Jail Terms | 15 |
| Islamic Terms | 17 |
| **Total** | **104** |

## Quiz-option logic

For quiz mode, distractors are now selected from the **same deck/category** but from a **different fact**. Examples:

- Penalty question → all choices are other penalty/fine/jail-term answers.
- Date question → all choices are other dates.
- Acts & Schedules question → all choices are other Acts, Sections or Schedules.
- Islamic term question → all choices are other Islamic terms.

## Checks performed

| Check | Result |
|---|---:|
| Only Requested Categories | Pass |
| All Cards Have Three Same Topic Distractors | Pass |
| No Old Flashcard Categories | Pass |
| No Duplicate Fronts | Pass |
| Build Test Passed | Pass |

## Notes

- Duplicate answer groups are allowed where two provisions carry the same penalty, but the quiz generator removes duplicate answers from the options so there is only one correct-looking answer shown.
- PIDM coverage limits and broad investor-category cards were removed from the flashcard deck because they were outside the four requested focus areas.
- The question bank was not changed in this patch.
