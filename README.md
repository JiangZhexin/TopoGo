# TopoGo — Go on Topological Surfaces

**English** | [简体中文](README.zh-CN.md)

A local two-player web game of Go (19×19, also 9/13) played on five board topologies: **plane, torus T², Möbius strip, Klein bottle, and real projective plane RP²**. Two players share one browser window, alternating Black and White.

- Rules contract: TopoGo Area v1 (area scoring, no suicide, positional superko, two-pass endgame negotiation) — see [docs/RULES.md](docs/RULES.md)
- Topology model & verification counts — see [docs/TOPOLOGY.md](docs/TOPOLOGY.md)
- Full design proposal (math model + acceptance tests) — see [docs/design-proposal.md](docs/design-proposal.md)
- Known limitations — see [docs/LIMITATIONS.md](docs/LIMITATIONS.md)
- References & licenses — see [docs/SOURCES.md](docs/SOURCES.md)

## Requirements

- Node.js ≥ 20 (developed and verified on Node v22.22.2)
- Network access is needed only for the first `npm ci`; afterwards play, analysis, and save/restore are fully offline

## Quick Start

```bash
npm ci
npm run dev        # open http://localhost:5173
```

Windows users can double-click `TopoGo-Start.bat` — it detects whether the dev server is already running, starts it minimized if not, waits until ready, and opens the game page. To create a desktop shortcut, run `scripts/create_shortcut.py` (requires pywin32).

> Do not open the HTML via `file://`: ES modules and the Web Worker require a local HTTP server.

## Commands

```bash
npm ci            # install dependencies (package-lock.json committed)
npm run dev       # dev server (default http://localhost:5173)
npm run typecheck # TypeScript checks
npm run test      # Vitest unit/fixture tests (77 cases)
npm run build     # production build to dist/
npm run preview   # static preview of the build
```

## Features (V1)

- Full legal play on five topologies: strings/liberties computed on the true adjacency graph — cross-seam connections, captures, suicide ban, positional superko
- Two consecutive passes enter endgame negotiation: click to toggle dead groups, both players confirm by revision, resume play; deterministic area scoring (`B+W+TB+TW+U = N²` invariant asserted)
- Undo / back-and-forth review / "continue from here" (explicit tail truncation)
- Auto-save (localStorage) + JSON game-record import/export (replay-validated by the core; tampered records rejected)
- Seam arrows, ghost copies (clicking a ghost = clicking the original), hover highlights of a string's liberties and cross-seam neighbors
- 3D surface view: a synchronized, dependency-free Canvas 3D rendering of the live board on its topological surface (drag to rotate, idle auto-spin, 2D/3D/split view switch persisted in localStorage); RP² uses a cross-cap immersion whose self-intersection line is a 3D projection artifact
- Position assistant (all heuristics — never adjudicates the game): influence map (discrete harmonic equation, Gauss–Seidel with convergence status), atari/two-liberty warnings, one-move capture points, influence-based score estimate; computed in a Web Worker, stale replies dropped by revision

## Project Layout

```text
src/core/       rules core (pure TypeScript, independent of React/DOM)
src/analysis/   influence/tactical analysis + Web Worker
src/render3d/   parametric surfaces & perspective projection for the 3D view
src/ui/         SVG board and panel components
src/io/         game-record JSON & localStorage
tests/          Vitest suites (topology/rules/scoring/history/analysis/IO)
docs/           rules, topology, design proposal, limitations, sources
tools/          Python topology invariant checker (reference implementation)
```

## Test Record

- 2026-10-03, Windows (win32), Node v22.22.2: `npm run typecheck` pass; `npm run test` 62/62 pass; `npm run build` success.
- Browser smoke flow (playwright-core + local Chromium, `scripts/smoke.mjs`, dev server required): play → occupied-point error → double pass into negotiation → dead-stone preview → mutual confirmation and scoring (Black wins by 353.5) — full flow, zero console errors.
- Playwright e2e suite: scaffolded but not yet run (see `e2e/README.md`); no fake greens.

## Acknowledgments

- Planning and design reference: **GPT 6 astra** (game concept, rules contract and topology model drafting)
- Implementation: **KIMI K3**, working through the **WorkBuddy "Game Development Studio" expert team** (multi-role studio workflow: design, engineering, QA)
- Prior art and references: see [docs/SOURCES.md](docs/SOURCES.md)

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 TopoGo contributors.
