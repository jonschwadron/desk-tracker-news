# desk-tracker-news

Wire desk. NEWS is the hero — a Reuters/Bloomberg headline rail taped to a warm off-black blotter.

Live: https://jonschwadron.github.io/desk-tracker-news/

- `news.json` — array export of the NEWS `cards.jsonl` bus
- `current-news.json` — latest NEWS snapshot
- `events.json` / `book.json` — desk bus, polled every 3s (`?t=` cache-bust)
- Live XAU from `https://api.gold-api.com/price/XAU` every 20s (`cache: "no-store"`, never `?t=`)

Quiet is a state. Book-moving only (FOMC/minutes, PCE, CPI, NFP, Hormuz, USD shock, war/Iran/oil/CB). Do not flatten ticket 102034139 / SL 4050 for ordinary US data. NEWS is not the calendar seat.
