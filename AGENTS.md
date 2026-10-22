# ace

One-page marketing site for Ace Credit (accident claims, taxi hire), served at https://acecredit.co.uk by
GitHub Pages straight from `main`. No build step, no framework, no backend, no forms.

## Where things live

- `index.html`: the whole page. `Home.css`: its styles. `images/`: WebP, sized per breakpoint.
- `nicepage.css`, `nicepage.js`, `jquery.js`: vendored output of the Nicepage editor. Leave them alone; the
  design pass (draft PR #8) replaces them.
- `revision.json`: Jekyll writes the served commit into it (`{"revision": "<sha>"}`). `deploy.json` tells
  Guardian's served-vs-main check to read it.
- `_config.yml` keeps `AGENTS.md`, `README.md` and `scripts/` off the public site.

## Commands

- `scripts/check` is the one check and what CI runs: it serves the checkout and fails on WCAG 2.2 A/AA
  violations (axe-core) at 1280 px and 320 px. Heavy (it downloads Chromium): `/opt/automancer/bin/heavy -- scripts/check`.
- `scripts/verify-live` runs after a merge: waits for Pages to serve the merged SHA, then runs the same check
  against production. Merge-to-live is about a minute.
- `git config core.hooksPath .githooks` turns on the secret-scan hooks in a fresh clone.

## Release

Merging to `main` is the release: Pages builds and serves it. Verify with `scripts/verify-live`; the step is
`.agents/skills/verify-ace/SKILL.md`.

## Observability

- Uptime: `obs uptime ace` (UptimeRobot monitor on `/revision.json`).
- Errors: none. The page runs no application code of its own, so there is nothing to report.
- Served version: `curl -fsS https://acecredit.co.uk/revision.json`.
