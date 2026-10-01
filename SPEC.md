# Mealboard spec

Written so any agent or person can pick this up cold.

## Purpose

Plan a week of meals that fit a daily target (default 2,000 kcal, 150 g protein, eaten 12:00 to 20:00) and generate the grocery list. Not a calorie logger: Cronometer does logging, Caliber does training.

## Stack

Static files only: `index.html`, `styles.css`, `app.js`, `meals.json`, `sw.js`, `manifest.webmanifest`, `icons/`. No framework, no build, no backend. Hosted on Vercel.

## Data: `meals.json`

```jsonc
{
  "ingredients": {
    "<id>": {
      "name": "Shown in lists",
      "section": "Meat & fish | Dairy & eggs | Produce | Frozen | Bakery | Pantry",
      "per100": { "kcal": 0, "p": 0, "c": 0, "f": 0 },   // per 100 g (or ml) as bought: raw, dry or drained
      "unit": "ml",                                        // optional, default g
      "each": { "g": 52, "label": "egg", "plural": "eggs" },// optional: grocery list counts units instead of grams
      "pantry": true                                       // optional: oils, spices, sauces go in "Check the pantry"
    }
  },
  "meals": [
    {
      "id": "unique_id",
      "name": "Shown name",
      "slot": "first | main | snack",                      // which slot it is suggested for
      "items": [["<ingredient id>", grams], ...],          // raw / dry weights for ONE serving
      "method": "Short cooking note"
    }
  ]
}
```

Rules:
- Meal macros are always computed from `items` x `per100`. Never store totals on a meal.
- Weights are raw or dry, because that is what you buy and weigh. Cooked chicken is roughly 75% of raw weight; cooked rice is roughly 3x dry weight.
- Nutrition values are typical database figures. Confirm against product labels when building the same meal as a Cronometer recipe.

## Local state (`localStorage` key `mealboard:v1`)

```jsonc
{
  "targets": { "kcal": 2000, "p": 150 },
  "weeks":   { "2026-09-28": { "days": [ { "s0": "meal_id", "s1": "...", "s2": "...", "s3": "..." }, ... 7 ] } },
  "checked": { "2026-09-28": { "<ingredient id>": true, "x:0": true } },  // grocery ticks; x:N = added item N
  "extras":  { "2026-09-28": ["dishwashing liquid"] }
}
```

Week keys are the Monday's date. Slots: `s0` 12:00 first meal, `s1` 16:00, `s2` 19:30, `s3` snack. Export/import in Settings writes and reads this object as JSON.

## Behaviour

- Day strip shows each day's calories as a filled jar (red when over target) and a dot that fills when protein is met.
- Meal picker shows what the day total would become with each meal.
- Grocery quantities: grams rounded up to 10 g, kg above 1,000 g; `each` items rounded up to whole units.
- Share uses the Web Share API, falling back to clipboard. Ticked items are left out.
- Service worker is network first with cache fallback, so the app opens in a shop with no signal.

## Ideas not built yet

- Shared list across two phones (needs a small store, e.g. Supabase or Vercel KV, plus a household code).
- Serving multiplier per slot (e.g. 1.5x rice on training days).
- Sunday batch-cook summary (total raw chicken, rice, curry portions).
- Export a meal as a Cronometer-ready ingredient list.
