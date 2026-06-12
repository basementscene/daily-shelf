# Food Tracker

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
```

## Run Locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in a browser.

## Deploy to Netlify (free, HTTPS, auto-deploys from GitHub)

1. Push this repo to GitHub
2. Go to https://netlify.com → Add new site → Import from GitHub
3. Pick this repo → Deploy

Netlify auto-deploys on every `git push`.

## Push to GitHub for the First Time

```bash
git init
git add .
git commit -m "initial commit"
gh repo create food-tracker --public --push
```

Or create the repo on github.com first, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/food-tracker.git
git push -u origin main
```
