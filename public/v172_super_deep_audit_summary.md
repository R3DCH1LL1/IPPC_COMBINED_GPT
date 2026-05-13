# IPPC Study Suite V195 — Current Audit Summary

## Current build

V195 is the explanation-quality, explanation-UI, colophon and audit-report refresh on top of the V193 question-bank baseline.

## Question bank baseline retained

- 2,000 questions
- 25 sets
- 80 MCQs per set
- 218 calculation questions with formula-led workings
- Statement-by-statement Roman numeral explanations
- Set 19 CLO metadata restored to the 12 / 36 / 32 blueprint
- Zero duplicate stems carried forward from the late-stage quality cycle

## V195 explanation review

Status: PASS

Scope covered Sets 3-25 only, matching the user-requested review scope.

- 1,840 questions checked.
- Old generic explanation template phrases: 0 remaining.
- Broad fallback wording: 0 remaining.
- Missing answer lines: 0.
- Short or empty explanations: 0.
- Targeted fixes applied for callable/putable bonds, fit-and-proper bankruptcy, KYC/risk profiling, broker/dealer distinction, structured-note share references, and product-governance explanations.
- Content mismatches that could not be fixed honestly by explanation-only edits were corrected at stem level where needed.

## Explanation UI refresh

Status: PASS

The structured explanation-card UI now applies consistently to:

- Statement-combination questions
- Recall questions
- Scenario-based questions

Recognised explanation sections now include:

- Correct answer / Answer line
- Explanation / Why this is correct
- Statement analysis
- Worked calculation
- Why the other options are wrong
- Why the other options are not correct

Wrong-option rows now parse `A. Incorrect — ...` and `A - ...` formats into the same card style used by statement explanations.

## Colophon and audit website refresh

Status: PASS

- Landing-page edition labels updated from V193 to V195.
- Audit report timeline extended with the V194-V195 explanation and UI sign-off.
- Colophon timeline updated from V1-V193 to V1-V195 while preserving the historical V193 CLO metadata milestone.
- Public metadata updated for the current V195 package.

## Checks passed

- Patched package contains the updated React audit report.
- Patched package contains the updated static colophon page.
- Patched package contains the cleaned `questions.packed.json`.
- Zip integrity check passed.

## Build note

A production Vite build was not run because `npm install` timed out and no `node_modules` directory was created in the extracted app workspace.
