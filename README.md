# Bluesky Postmortems

Single-page SvelteKit app that fetches one Bluesky post and continuously collects its quote posts and replies.

## Features

- Paste a `bsky.app` post URL.
- Fetches post metadata using Bluesky public APIs.
- Polls quote posts and replies continuously with a 200ms delay between calls.
- Shows top 5 quotes and replies by default.
- Sort by engagement/newest/oldest and filter by minimum engagement.
- Download collected data snapshot as JSON.
- Static build via `@sveltejs/adapter-static`, ready for GitHub Pages.

## Local run

```bash
npm install
npm run dev
```

## Type/lint check

```bash
npm run check
```

## Build

```bash
npm run build
```
