# desk-tracker-news

Wire desk. News is the hero. Desk strip secondary.

Warm off-black, hairlines, IBM Plex Sans + Mono. No gold glow.

https://jonschwadron.github.io/desk-tracker-news/

## Live

- `news.json` — export of `/workspace/news-desk/cards.jsonl` (array)
- `current-news.json` — snapshot of `/workspace/news-desk/current.json`
- `events.json` + `book.json` polled every 3s with `?t=`
- Spot: `fetch("https://api.gold-api.com/price/XAU", {cache:"no-store"})` every 20s. Never `?t=` on gold-api.

## What the board shows

1. Hero card from the live NEWS print (`book_effect` is the card: HOLD / WAIT / NO NEW LONG / QUIET)
2. NEXT event with print time
3. Quiet scan as a state row, not the mast
4. Tape from `current-news.json` when present (XAU / DXY / US10Y / Brent)
5. Do not flatten ticket 102034139 / SL 4050 — always
6. Source + URL clickable
7. `gold_implication`
8. Secondary desk strip: WAIT, lottery ticket, one-line M30 box, one-line FVG profit area

Quiet is a state. NEWS does not flatten. NEWS does not invent headlines.
