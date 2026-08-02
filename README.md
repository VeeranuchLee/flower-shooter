# Petal Kingdom

Petal Kingdom is a child-friendly flower-matching shooter with a unicorn and princess theme. It is built as a dependency-free HTML5 canvas game for iPad and desktop.

## Play

Open the live game: **https://veeranuchlee.github.io/flower-shooter/**

Choose one of three modes:

- **Classic** — 12 gardens with traditional descending-row play.
- **Arcade** — 8 short score, pop, drop, and clear challenges.
- **Puzzle** — 8 fixed maps with limited shots and no automatic descent.

Aim with touch, mouse, or keyboard. Match three or more flowers; unsupported clusters fall for bonus points. Progress is stored separately for each mode in the browser.

## Run locally

No build step or dependencies are required. Open `index.html` directly, or serve this folder over HTTP to enable the service worker and offline cache:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Accessibility

- Distinct flower silhouettes as well as colours
- Keyboard controls and ARIA labels
- 44 px minimum touch targets
- Reduced-motion support
- Calm sparkle mode and sound controls

The three illustrated backgrounds have code-drawn fallbacks. Optional home-screen icon artwork has not yet been added, so some devices may generate an icon from the page.
