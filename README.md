# LeetLoop

LeetLoop is a lightweight spaced-repetition tracker for LeetCode-style interview prep. It helps answer the daily question: what should I revisit today?

## MVP

- Add and manage coding problems.
- Log attempts with fast result choices.
- Automatically schedule the next review.
- Browse official LeetCode 75 and Top Interview 150 templates.
- Export/import local data as JSON.

## Roadmap

- Chrome Extension Lite: detect the current LeetCode problem, add/open it in LeetLoop, and log attempts from the LeetCode page.
- Auth and sync: add accounts plus cloud-backed data so the queue works across browsers/devices.

## Chrome Extension

The first extension pass is a LeetCode spoiler shield. LeetLoop problem links add `?leetloop=review`, and the unpacked extension hides the LeetCode code editor until you choose to start fresh, reveal previous code, or dismiss the shield.

To try it locally:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this repo's `extension` folder.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.
