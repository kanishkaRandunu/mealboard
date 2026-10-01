# Mealboard

A small, offline-friendly web app for planning the week's meals and turning the plan into a grocery list. Built to sit on an iPhone home screen.

- **Plan**: four slots a day (12:00, 16:00, 19:30, snack) with running totals against a daily calorie and protein target.
- **Groceries**: quantities summed across the week, grouped by shop section, tick off as you go, share to WhatsApp or Notes.
- **Meals**: the library, with ingredients in grams and macros calculated from them.

Calorie logging stays in Cronometer and training stays in Caliber; this app only plans and shops.

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

No build step and no dependencies.

## Deploy

Import this repo in Vercel (framework preset: Other, no build command, output directory `.`). Every push to `main` redeploys.

## Add to the iPhone home screen

Open the Vercel URL in Safari, tap Share, then Add to Home Screen.

## Change the meals

Edit `meals.json`. See `SPEC.md` for the format.
