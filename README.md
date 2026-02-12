# Bluesky Postmortems

Single-page SvelteKit app that fetches one Bluesky post and continuously collects its quote posts and replies.

## Features

- Paste a `bsky.app` post URL.
- Fetches post metadata using Bluesky public APIs.
- Polls quote posts continuously (cursor-based) and fetches replies once via thread snapshot.
- Live status line while polling (`fetching`/`complete`), with pause/resume.
- Side-by-side quote/reply columns with mobile collapse.
- Pagination for quotes and replies (10 per page) with top and bottom nav controls.
- Sort controls: biggest/smallest + Engagement, Ratio, Timestamp, Author age, Likes + Reposts, Replies + Quotes.
- Filters:
  - minimum engagements,
  - minimum account age (days older than root post),
  - optional `Post has images/video` checkbox.
- Rich child-post cards:
  - compact author metadata,
  - response/joined relative durations with ISO hover tooltips,
  - engagement + ratio line with conditional highlights,
  - optional own-media thumbnail (max 200px height crop).
- Live collection stats panel (first hour/day, averages, most engaged quote/reply links).
- Download collected data snapshot as JSON.
- Post metadata block includes root post URI and author DID.
- Static build via `@sveltejs/adapter-static`, ready for GitHub Pages.

## Architecture

- `src/lib/post-collector.ts`: collection orchestration service/store (URL parsing, metadata fetch, polling loop, pause/resume, snapshot download).
- `src/lib/post-analysis.ts`: pure post list/filter/pagination/stats functions.
- `src/lib/child-post-presenter.ts`: pure presentation helpers for child-post labels and truncation.
- `src/lib/components/*.svelte`: focused UI components (`PostDetailsPanel`, `LiveStatsPanel`, `FilterPanel`, `PostListColumn`, `ChildPost`).
- `src/routes/+page.svelte`: page coordinator that binds UI state to the collector and analysis functions.

## Local run

```bash
npm install
npm run dev
```

## Validation

```bash
npm run check
npx vitest run
```

## Build

```bash
npm run build
```
