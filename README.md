# CoffeeCanvas (Sample API demo)

A tiny front-end demo that fetches and displays random coffee images from the public API at https://coffee.alexflipnote.dev. The project demonstrates safe cross-origin image display and a probe-style `fetch()` usage.

## Features
- Brew images: fetch 1, 6, or 12 random images and display them in a gallery.
- Favorites: mark/unmark images as favorites (stored in localStorage).
- Notes: add per-image notes (stored in localStorage).
- Search & sort: filter by filename or notes; sort by newest / A→Z / Z→A / favorites.
- Theme toggle: light/dark theme persisted to localStorage.
- Reliable image display: images are shown via `<img src="...">` while a `fetch()` probe (mode: `no-cors`) demonstrates async/await usage without reading CORS-protected bodies.

## Files
- index.html — HTML UI shell and elements the script expects.
- style.css — Styles for the gallery and controls.
- script.js — Main application logic (fetch probe, rendering, storage, events).

## How to run

Option 1 — Open directly (quick, may have browser restrictions):

1. Open `index.html` in your browser (double-click or File → Open).

Option 2 — Run a simple local HTTP server (recommended):

Using Python 3 (works on Windows/macOS/Linux):

