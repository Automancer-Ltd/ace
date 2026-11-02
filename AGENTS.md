# ace

One-page marketing site for Ace Credit (accident claims, taxi hire), served at https://acecredit.co.uk by
GitHub Pages straight from `main`. No build step, no framework, no backend, no forms.

## Where things live

- `index.html`: the whole page. `404.html`: what GitHub Pages shows for any missing path (brand, call button,
  link home; root-absolute asset paths so it works at any folder depth). `styles.css`: styles for both. `images/`: WebP, sized per breakpoint.
- `fonts/`: self-hosted Oswald and Open Sans (Latin, variable weight) with their licence. The page loads
  nothing from other sites.
- `revision.json`: Jekyll writes the served commit into it (`{"revision": "<sha>"}`). `deploy.json` tells
  Guardian's served-vs-main check to read it.
- `_config.yml` keeps `AGENTS.md`, `README.md` and `scripts/` off the public site.

## Commands

- `scripts/check` is the one check and what CI runs: it serves the checkout and fails on WCAG 2.2 A/AA
  violations (axe-core) at 1280 px and 320 px, also on the not-found page, then runs `scripts/journey.mjs`: a read-only visitor journey (dialable phone links that agree across header/hero/contact/JSON-LD, nav targets, images and fonts load, nothing loads from other sites, no sideways scroll, phone call bar, no script errors, and a missing path shows the branded not-found page with the call button) with screenshots written to `$JOURNEY_SHOTS` (default `journey-shots/`, git-ignored). Heavy (it downloads Chromium): `/opt/automancer/bin/heavy -- scripts/check`.
- `scripts/verify-live` runs after a merge: waits for Pages to serve the merged SHA, then runs the same check
  against production. Merge-to-live is about a minute.
- `git config core.hooksPath .githooks` turns on the secret-scan hooks in a fresh clone.

## Release

Merging to `main` is the release: Pages builds and serves it. Verify with `scripts/verify-live`; the step is
`.agents/skills/verify-ace/SKILL.md`.

### Roll back a failed live release

GitHub Pages serves `main`, so rollback is a **forward-fix release**, not a manual Pages edit or a reset of
`main`:

1. Read the live revision with `curl -fsS https://acecredit.co.uk/revision.json` and compare it with
   `git log --oneline origin/main`. Confirm which release introduced the failure; preserve any later, unrelated
   changes.
2. Start a branch from the current `origin/main`. Revert the faulty commit(s): use
   `git revert <commit>` for a normal commit, or `git revert -m 1 <merge-commit>` to revert a merge while keeping
   its first-parent `main` line. Resolve conflicts carefully; do not force-push or reset `main`.
3. Run `scripts/check`, push the branch, and open a PR. Merge only after the required checks pass. The merge is the
   rollback release; Pages rebuilds from the resulting `main` commit.
4. Run `scripts/verify-live` and confirm `/revision.json` reports the rollback merge SHA and the production checks
   pass. Keep the incident open until this verification succeeds. If the revert conflicts or the rollback release
   fails verification, stop and prepare a corrected forward fix; do not claim service restored.

Record the faulty and rollback SHAs, PR, and live verification result in the incident/task. Never roll back by
force-moving `main` or by editing the published site directly.

## Observability

- Uptime: `obs uptime ace` (UptimeRobot monitor on `/revision.json`).
- Errors: none. The page runs no application code of its own, so there is nothing to report.
- Served version: `curl -fsS https://acecredit.co.uk/revision.json`.

Last verified: 2026-10-26 on automancer-vps
