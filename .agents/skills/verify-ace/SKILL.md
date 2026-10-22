---
name: verify-ace
description: >-
  Prove an Ace site change works in a real browser, before merge and on production after. Use after any
  edit to the page, its styles or images.
---

# Verify the Ace site

The product is one page. Its one journey is a visitor loading it on a laptop and on a phone, so the check
opens it in Chromium at 1280 px and 320 px and fails on any WCAG 2.2 A/AA violation.

- Before merge: `/opt/automancer/bin/heavy -- scripts/check`. Prints one line per violation, or `No WCAG A/AA violations`.
- After merge: `scripts/verify-live`. Waits until `https://acecredit.co.uk/revision.json` shows the merged SHA,
  then runs the same check on the live page. Exits non-zero if the SHA is not live in 5 minutes.

Red proof (21 Oct 2026, repeat after changing `scripts/axe.mjs`): remove an `alt` from an `<img>` in a copy
of the site and run `scripts/check <copy>`; it must exit 1 with `image-alt`.
