# V175 Flashcard Source + Quiz Audit

## Scope
Audited the flashcard bank and quiz logic against the IPPC Study Text 3rd Edition and Updated IPPC Module Specifications. Scope was limited to the four requested straight-recall decks:

1. Important Dates
2. Acts & Schedules
3. Fines, Penalties & Jail Terms
4. Islamic Terms

## Result
**Status:** PASS  
**Issue count after patch:** 0

## Card Counts
- Important Dates: 23
- Acts & Schedules: 49
- Fines, Penalties & Jail Terms: 15
- Islamic Terms: 17

**Total:** 104

## Source Alignment
- Source-supported cards: 104 / 104
- Source flags: 0

## Quiz Option Logic
Patched quiz distractors so wrong answers are selected as follows:

1. Same tag/sub-topic first, where at least three other facts exist.
2. Same deck/category where the tag is too small.
3. Global fallback only if absolutely necessary.

Actual result:
- Same tag/sub-topic used: 59 cards
- Same deck/category fallback used: 45 cards
- Global fallback used: 0 cards

## Patch Applied
- Updated `FLASHCARD_VERSION` to `V175`.
- Updated the AMLA Act answer from short-form `AMLA 2001` to the full Study Text title.
- Patched the quiz engine from category-only distractors to tag-first distractors.

## Build
Build result: PASS (`npm ci && npm run build`).
