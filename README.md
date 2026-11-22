# Daily Shelf

A personal, offline-first PWA for tracking pantry items and logging meals with full nutrition info.

- Add foods via barcode scan (OpenFoodFacts) or manual entry
- Stock your pantry and adjust quantities
- Log meals by combining pantry items, get real-time totals (calories, protein, carbs, fat, fiber)
- View meal history grouped by date
- Fully offline after first load, installable on your phone's home screen
- No accounts, no backend, no Play Store needed

## Files

```
index.html     Entry point
style.css      Styles (light theme, minimal)
app.js         UI logic
db.js          IndexedDB data layer
manifest.json  PWA manifest
sw.js          Service worker
vendor/        Vendored barcode scanner library (offline)
fonts/         Vendored DM Mono font files (offline)
icons/         PWA and home-screen icons
```

## Run Locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in a browser.

## Install as an App (PWA)

Serve the site over HTTPS (Netlify, GitHub Pages, etc.), then:

- **Android/Chrome**: open the site → menu → **Install app** (or **Add to Home screen**).
- **Desktop/Chrome**: click the install icon in the address bar.
- **iOS/Safari**: Share → **Add to Home Screen**.

Once installed it runs full-screen and works offline. Data is stored locally in the
browser's IndexedDB — no account or backend. Use **Export Data** in the menu for backups.

## Deploy to Netlify (free, HTTPS, auto-deploys from GitHub)

1. Push this repo to GitHub
2. Go to https://netlify.com → Add new site → Import from GitHub
3. Pick this repo → Deploy

Netlify auto-deploys on every `git push`.
