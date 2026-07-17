---
name: html-planning
description: Format implementation plans, PRDs, BSDs, and design documents as a single self-contained interactive HTML file. Use when asked to produce or format any plan or design document as HTML.
---

# html-planning

Turn implementation plans, PRDs, BSDs, and design documents into a **single, self-contained, interactive HTML file** that reads like a polished internal design doc. This skill handles **how to format and present** — domain skills handle **what to plan**.

There is no bundled framework, generator, or asset library. Instead, **use the full native design and front-end capability of whatever environment you are running in** (Claude Code, Codex, Cursor, or any other LLM CLI/agent). You already know how to write clean HTML, modern CSS, and small vanilla-JS interactions — do that, and do it well.

## Core principles

1. **One file, no dependencies.** Everything — HTML, CSS, JS — lives inline in a single `.html` file. No build step, no external stylesheet, no runtime library to resolve. It must open correctly by double-clicking, fully offline.

2. **No mandatory external network calls.** The document must render and be fully usable offline. If you want a nicety that needs a CDN (e.g. a diagram or syntax-highlighting library), lazy-load it and degrade gracefully to readable plain text when offline — never let it block core rendering.

3. **Lean on your own design taste.** Don't ask for a design system — bring one. Establish CSS custom properties for color, spacing, and typography at the top of the file, then compose a clean, modern, readable layout. Aim for the quality of a thoughtfully designed internal engineering doc, not a raw dump of `<h1>`/`<p>`.

4. **Semantic first, decorative second.** Structure the document around the plan's meaning (sections, decisions, phases, code changes), then style that structure. The content is the point; the styling serves legibility.

## What a good plan document contains

Adapt to the material, but most plan documents benefit from:

- **A header** — title, a status (draft/approved/implemented/etc.), date, and a few context chips (teams, phase, scope).
- **Sticky navigation** — a compact nav that jumps to each major section. For longer docs, auto-generate it from the sections rather than hand-maintaining links.
- **Numbered sections** for major topics; lighter nested subsections for steps, sub-phases, or TDD red/green/refactor breakdowns.
- **Metric / summary cards** — a small grid of 2–4 key numbers at the top of quantitative sections.
- **Tables** for structured data, with a clear header row and, where useful, an emphasized total row.
- **Callouts** — sparingly — for genuinely important info, warnings, confirmations, and risks. Distinguish them by color/icon.
- **Status badges** — inline chips for decision state (decided/open/deferred) or priority (high/medium/low).
- **Collapsible sections** (`<details>`/`<summary>`) for optional depth: long calculations, raw data, edge cases.
- **Tabs** to collapse parallel views (summary vs. detail, per-tier breakdowns) and cut vertical scrolling.
- **A phased timeline** for rollout plans.
- **Formulas / key-principle grids** where a plan hinges on a specific equation or a short set of design invariants.

Use only what the content needs. A short plan doesn't need tabs and timelines.

## Encoding code changes

**This is where plan documents earn their keep — do not skimp here.**

- **Show diffs, don't describe them.** Never write "around line 45, replace `CASCADE` with `SET_NULL`." Instead render a GitHub-style unified diff: file path header, line numbers, `+`/`-` add/delete coloring, and syntax highlighting. The markup *is* the instruction; prose should explain *why*, not *what lines to edit*.
- **Show file references as code views**, with the path, an optional line range, a line-number gutter, and a "NEW"/"ADD" indicator for new files or appended blocks — rather than describing code in a sentence.
- **Syntax-highlight code blocks.** Either hand-roll lightweight highlighting, or lazy-load a library (e.g. highlight.js from a CDN) with graceful offline fallback to plain monospace.

> **Escaping in code/diff/diagram content:** whatever is inside a `<pre>`/code element is parsed as HTML first. Escape `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;` in literal code (`Vector<int>`, `a && b`, JSX, `&str`) so the browser's parser doesn't mangle it before your styling runs. Attribute values and diff `+`/`-` gutter markers are unaffected.

## Diagrams

Prefer a text-driven diagram (e.g. Mermaid) over hand-drawn SVG for flowcharts, sequence, state, and ER diagrams — it's far more compact and easier to get right. Lazy-load the library on first use and fall back to showing the diagram source as plain text when offline. Escape literal `<`/`&` inside node labels for the same parser reason as above.

## Small interactions

Keep JS minimal, inline, and vanilla. Good candidates:

- Auto-generated sticky nav with scroll-spy / active-section highlighting.
- Tab switching and collapsible panels.
- A "wrap long lines" toggle for code and diff blocks, persisted per reader via `localStorage`.
- Light/dark theme awareness (respect `prefers-color-scheme`; optionally a toggle).

Don't over-engineer. Every interaction should earn its place by making the document easier to read.

## Workflow

1. Understand the plan content (from the user or a domain skill).
2. Decide which of the elements above the material actually calls for.
3. Write a single self-contained `.html` file: design tokens → base styles → semantic structure → inline interactions.
4. Encode all code changes as diffs and file views, not prose.
5. Verify it opens and renders correctly offline (open the file, check that nothing hard-depends on a network fetch).
