/* Wire desk — live NEWS hero + secondary desk strip. */
(function () {
  "use strict";

  const TZ = "America/New_York";
  const POLL_MS = 3000;
  const SPOT_MS = 20000;
  const SPOT_URL = "https://api.gold-api.com/price/XAU";

  const ET_CLOCK = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const ET_SHORT = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const ET_WHEN = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "short", day: "numeric", month: "short",
    year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });

  const state = {
    news: [],
    current: null,
    events: [],
    book: null,
    spot: null,
    spotAt: null,
    spotLive: false,
    spotSource: null,
  };

  const $ = (id) => document.getElementById(id);

  function parseTs(ts) {
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d) ? null : d;
  }
  function fmtClock(d) { return ET_CLOCK.format(d); }
  function fmtShort(ts) {
    const d = parseTs(ts);
    return d ? ET_SHORT.format(d) + " ET" : "—";
  }
  function fmtWhen(ts) {
    const d = parseTs(ts);
    if (!d) return "—";
    const parts = ET_WHEN.formatToParts(d);
    const get = (t) => (parts.find((p) => p.type === t) || {}).value || "";
    const day = get("day");
    const mon = get("month");
    const year = get("year");
    const wk = get("weekday").replace(",", "");
    const hour = get("hour");
    const min = get("minute");
    const dayPeriod = get("dayPeriod");
    return wk + " " + day + " " + mon + " " + year + " " + hour + ":" + min + " " + dayPeriod + " ET";
  }
  function num(n, d) {
    if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
    return Number(n).toLocaleString("en-US", {
      minimumFractionDigits: d ?? 2, maximumFractionDigits: d ?? 2,
    });
  }
  function px(n) {
    if (n == null || n === "") return "—";
    return Number(n).toFixed(Number(n) >= 100 ? 2 : 2);
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function payload(e) {
    if (!e) return {};
    return e.payload && typeof e.payload === "object" ? e.payload : e;
  }
  function effectLabel(v) {
    if (v == null || v === "") return "QUIET";
    const s = String(v).toLowerCase().replace(/-/g, "_");
    if (s === "hold") return "HOLD";
    if (s === "wait") return "WAIT";
    if (s === "no_new_long" || s === "nonewlong" || s === "no new long") return "NO NEW LONG";
    if (s === "quiet") return "QUIET";
    return String(v).toUpperCase().replace(/_/g, " ");
  }
  function effectClass(v) {
    if (v == null || v === "") return "quiet";
    const s = String(v).toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
    if (s === "no_new_long" || s === "nonewlong") return "no_new_long";
    if (s === "hold" || s === "wait" || s === "quiet") return s;
    return "quiet";
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch (e) { return url; }
  }

  function tickClock() {
    $("clock-et").textContent = fmtClock(new Date());
  }

  function renderSpot() {
    const el = $("mast-spot");
    const live = !!state.spotLive;
    el.className = "spot" + (state.spot == null ? "" : (live ? " live" : " stale"));
    $("spot-lab").textContent = state.spot == null ? "SPOT" : (live ? "LIVE SPOT" : "STALE SPOT");
    $("spot-price").textContent = state.spot == null ? "—" : px(state.spot);
    $("spot-meta").textContent = state.spot == null
      ? "gold-api · waiting"
      : (live
        ? "indicative XAU mid · not Coinexx · not OANDA"
        : "STALE · book/tape · gold-api failed");
  }

  function refreshDot(err) {
    const el = $("live-dot");
    if (err) {
      el.className = "live-dot fail";
      el.textContent = "BOARD · FAIL";
    } else {
      el.className = "live-dot";
      el.textContent = "BOARD · 3s";
    }
  }

  function newsCardMatching(event) {
    if (!event) return null;
    for (let i = state.news.length - 1; i >= 0; i--) {
      const e = state.news[i];
      const p = payload(e);
      if ((e.action || "").toLowerCase() === "card" && p.event === event) return e;
    }
    return null;
  }

  function buildHero() {
    const cur = state.current;
    if (!cur || !cur.event) return null;
    const match = newsCardMatching(cur.event);
    const p = match ? payload(match) : cur;
    return {
      event: cur.event,
      book_effect: p.book_effect || cur.book_effect || cur.card,
      headline: p.headline || cur.headline,
      source: p.source || cur.source,
      url: p.url || cur.url,
      correlating: p.correlating || cur.correlating || [],
      gold_implication: p.gold_implication || cur.gold_implication,
      when_et: p.when_et || cur.when_et,
      impact: p.impact || cur.impact,
      ts: (match && (match.ts || match.ts_et)) || cur.ts_et,
      macro_note: cur.macro_score && cur.macro_score.note,
    };
  }

  function renderHero() {
    const h = buildHero();
    const el = $("hero");
    if (!h) {
      el.innerHTML = '<div class="kicker">CARD</div><div class="event-code">NO CARD</div><p class="headline">Quiet. No book-moving print.</p>';
      return;
    }
    const tags = (h.correlating || []).map((t) => '<span class="tag">' + esc(t) + "</span>").join("");
    const src = h.url
      ? '<a href="' + esc(h.url) + '" target="_blank" rel="noopener">' + esc(h.source || hostOf(h.url)) + " ↗ " + esc(hostOf(h.url)) + "</a>"
      : esc(h.source || "");
    const when = h.when_et ? '<div class="when">' + esc(fmtWhen(h.when_et)) + "</div>" : "";
    const macro = h.macro_note ? '<div class="macro-note">MACRO · ' + esc(h.macro_note) + "</div>" : "";
    el.innerHTML =
      '<div class="hero-top">' +
        '<div>' +
          '<div class="kicker">CARD</div>' +
          '<div class="event-code">' + esc(h.event) + "</div>" +
          when +
        "</div>" +
        '<div class="effect ' + effectClass(h.book_effect) + '">' + esc(effectLabel(h.book_effect)) + "</div>" +
      "</div>" +
      '<h1 class="headline">' + esc(h.headline || "") + "</h1>" +
      '<div class="byline"><span>' + src + "</span></div>" +
      (tags ? '<div class="tags">' + tags + "</div>" : "") +
      '<div class="impl"><div class="lab">GOLD IMPLICATION</div><p>' + esc(h.gold_implication || "") + "</p>" + macro + "</div>";
  }

  function nextFromNews(event) {
    if (!event) return null;
    return newsCardMatching(event);
  }

  function renderNext() {
    const el = $("next");
    const cur = state.current || {};
    const nxt = cur.next || null;
    if (!nxt || !nxt.event) {
      el.innerHTML = "";
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const match = nextFromNews(nxt.event);
    const p = match ? payload(match) : nxt;
    const effect = p.book_effect || nxt.book_effect;
    const when = p.when_et || nxt.when_et;
    const tags = (p.correlating || []).map((t) => '<span class="tag">' + esc(t) + "</span>").join("");
    const src = (p.url || nxt.url)
      ? '<a href="' + esc(p.url || nxt.url) + '" target="_blank" rel="noopener">' + esc(p.source || hostOf(p.url || nxt.url)) + "</a>"
      : esc(p.source || "");
    el.innerHTML =
      '<div class="next-k">NEXT</div>' +
      '<div>' +
        '<div class="next-event">' + esc(nxt.event) + "</div>" +
        '<div class="next-when">' + esc(fmtWhen(when)) + (tags ? " · " + (p.correlating || []).join(" · ") : "") + "</div>" +
        '<div class="next-head">' + esc(p.headline || nxt.headline || "") + (src ? " · " + src : "") + "</div>" +
        '<div class="next-impl">' + esc(p.gold_implication || "") + "</div>" +
      "</div>" +
      '<div class="next-effect ' + effectClass(effect) + '">' + esc(effectLabel(effect)) + "</div>";
  }

  function renderTape() {
    const el = $("tape");
    const tape = (state.current && state.current.tape) || null;
    if (!tape) {
      el.innerHTML = "";
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const asof = tape.asof_et ? fmtShort(tape.asof_et) : "";
    const cells = [
      { k: "XAU", v: num(tape.xauusd, 2), s: asof },
      { k: "DXY", v: num(tape.dxy, 2), s: "dollar" },
      { k: "US10Y", v: num(tape.us10y, 2), s: "yield" },
      { k: "BRENT", v: num(tape.brent, 0), s: "oil" },
    ];
    el.innerHTML = '<div class="tape-k">TAPE</div>' + cells.map((c) =>
      '<div class="tape-cell"><div class="k">' + c.k + '</div><div class="v">' + c.v + '</div><div class="s">' + esc(c.s) + "</div></div>"
    ).join("");
  }

  function tickets() {
    const cur = state.current || {};
    const fromCur = cur.tickets_do_not_touch || [];
    if (fromCur.length) return fromCur;
    const book = state.book || {};
    return (book.open || []).map((t) => ({
      id: t.ticket, side: t.side, lots: t.lots, entry: t.entry, sl: t.sl,
    }));
  }

  function renderTicket() {
    const el = $("ticket");
    const list = tickets();
    const t = list[0] || { id: "102034139", side: "buy", lots: 0.05, entry: 4043.95, sl: 4050 };
    el.innerHTML =
      '<div class="ticket-k">DO NOT FLATTEN</div>' +
      '<div class="ticket-v">ticket ' + esc(t.id) + " · " +
        esc(String(t.side || "buy").toUpperCase()) + " " + esc(t.lots) +
        " @ " + px(t.entry) + " · SL " + px(t.sl) + "</div>" +
      '<div class="ticket-always">ALWAYS</div>';
  }

  function lastEvent(agent, action) {
    for (let i = state.events.length - 1; i >= 0; i--) {
      const e = state.events[i];
      if (agent && String(e.agent || "").toUpperCase() !== agent) continue;
      if (action && String(e.action || "").toLowerCase() !== action) continue;
      return e;
    }
    return null;
  }

  function findM30() {
    for (let i = state.events.length - 1; i >= 0; i--) {
      const e = state.events[i];
      const p = payload(e);
      const box = p.box || p.htf_box || ((e.tf === "M30" && p.distal != null) ? p : null);
      const tf = (box && box.tf) || e.tf;
      if (box && String(tf).toUpperCase() === "M30" && (box.distal != null || box.proximal != null)) {
        return { e, p, box };
      }
    }
    return null;
  }

  function findFVG() {
    for (let i = state.events.length - 1; i >= 0; i--) {
      const e = state.events[i];
      const p = payload(e);
      const f = p.fvg || ((p.gap_low != null || p.fvg_low != null) ? p : null);
      if (!f) continue;
      const lo = f.fvg_low != null ? f.fvg_low : f.gap_low;
      const hi = f.fvg_high != null ? f.fvg_high : f.gap_high;
      if (lo == null || hi == null) continue;
      return { e, p, f, lo, hi, mid: f.fvg_mid != null ? f.fvg_mid : f.gap_mid };
    }
    return null;
  }

  function deskStatus() {
    const card = lastEvent(null, "card") || lastEvent("MACRO", "scan");
    const p = payload(card);
    const st = (p.status || p.card || p.book_effect || "WAIT").toString();
    const reason = p.skip_reason || p.reason || p.refuse || p.note || "price above unused M30 · no 50%";
    return { st, reason };
  }

  function renderDesk() {
    const el = $("desk");
    const ds = deskStatus();
    const book = state.book || {};
    const open = (book.open && book.open[0]) || {};
    const m30 = findM30();
    const fvg = findFVG();
    const box = m30 && m30.box;
    const m30line = box
      ? "M30 " + px(box.distal) + "–" + px(box.proximal) +
        (box.mid_50 != null || box.mid != null ? " mid " + px(box.mid_50 || box.mid) : "") +
        " unused · do not chase"
      : "M30 box —";
    const fvgline = fvg
      ? "D1 " + px(fvg.lo) + "–" + px(fvg.hi) + " · PROFIT AREA · not a buy"
      : "FVG —";
    const lotto = (open.ticket || "102034139") + " " +
      (open.side || "buy") + " " + (open.lots != null ? open.lots : 0.05) +
      " @ " + px(open.entry || 4043.95) + " SL " + px(open.sl || 4050) +
      " · " + (open.state || "lottery_ticket");
    el.innerHTML =
      '<div class="desk-k">DESK</div>' +
      '<div class="desk-rows">' +
        '<div class="desk-row"><div class="k">STATUS</div><div class="v ' + effectClass(ds.st) + '">' +
          esc(effectLabel(ds.st)) + " · " + esc(ds.reason) + "</div></div>" +
        '<div class="desk-row"><div class="k">LOTTERY</div><div class="v">' + esc(lotto) + "</div></div>" +
        '<div class="desk-row"><div class="k">M30 BOX</div><div class="v">' + esc(m30line) + "</div></div>" +
        '<div class="desk-row"><div class="k">FVG</div><div class="v">' + esc(fvgline) + "</div></div>" +
      "</div>";
  }

  function quietScans() {
    return state.news.filter((e) => {
      const p = payload(e);
      return (e.action || "").toLowerCase() === "scan" && p.quiet === true;
    });
  }

  function renderState() {
    const el = $("state");
    const scans = quietScans();
    if (!scans.length) {
      el.innerHTML = "";
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const e = scans[scans.length - 1];
    const p = payload(e);
    const line = p.gold_implication || p.note || "Quiet scan. No book-moving card.";
    el.innerHTML =
      '<div class="state-k">STATE</div>' +
      '<div class="state-v">QUIET SCAN · ' + esc(line) + "</div>" +
      '<div class="state-t">' + esc(fmtShort(e.ts || e.ts_et || p.ts_et)) + "</div>";
  }

  function renderWire() {
    const el = $("wire");
    const rows = state.news.slice().reverse();
    $("wire-meta").textContent = rows.length + " prints";
    el.innerHTML = rows.map((e) => {
      const p = payload(e);
      const action = (e.action || "").toUpperCase();
      const event = p.event || "—";
      const quiet = p.quiet === true && !p.book_effect;
      const effect = quiet ? "quiet" : p.book_effect;
      const head = p.headline || p.gold_implication || "";
      const impl = p.headline && p.gold_implication ? p.gold_implication : "";
      const src = p.url
        ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.source || hostOf(p.url)) + "</a>"
        : esc(p.source || "");
      return '<div class="wire-row">' +
        '<div class="t">' + esc(fmtShort(e.ts || e.ts_et || p.ts_et)) + "</div>" +
        '<div class="a">' + esc(action) + "</div>" +
        '<div class="e">' + esc(event) + "</div>" +
        '<div class="b ' + effectClass(effect) + '">' + esc(effectLabel(effect)) + "</div>" +
        '<div class="h">' + esc(head) +
          (impl ? '<div class="impl">' + esc(impl) + "</div>" : "") +
        "</div>" +
        '<div class="src">' + src + "</div>" +
      "</div>";
    }).join("");
  }

  function renderAll() {
    renderSpot();
    renderHero();
    renderNext();
    renderTape();
    renderTicket();
    renderDesk();
    renderState();
    renderWire();
  }

  function applySpot(q) {
    state.spot = q.price;
    state.spotAt = q.updatedAt || null;
    state.spotLive = !!q.live;
    state.spotSource = q.source || null;
    renderSpot();
  }

  async function pollSpot() {
    try {
      const r = await fetch(SPOT_URL, { cache: "no-store" });
      if (!r.ok) throw new Error("gold-api " + r.status);
      const q = await r.json();
      const price = Number(q.price);
      if (!Number.isFinite(price) || price <= 0) throw new Error("bad XAU price");
      applySpot({ price: price, updatedAt: q.updatedAt || new Date().toISOString(), live: true, source: "gold-api" });
    } catch (err) {
      const bid = state.book && state.book.bid;
      const tape = state.current && state.current.tape && state.current.tape.xauusd;
      const fallback = bid != null ? Number(bid) : (tape != null ? Number(tape) : null);
      if (fallback != null && Number.isFinite(fallback) && fallback > 0) {
        applySpot({ price: fallback, updatedAt: null, live: false, source: "book" });
      } else {
        state.spotLive = false;
        renderSpot();
      }
    }
  }

  async function loadJSON(url) {
    const r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }

  async function poll() {
    try {
      const newsP = loadJSON("news.json");
      const curP = loadJSON("current-news.json").catch(function () { return null; });
      const evsP = loadJSON("events.json").catch(function () { return []; });
      const bookP = loadJSON("book.json").catch(function () { return null; });
      const news = await newsP;
      const cur = await curP;
      const evs = await evsP;
      const book = await bookP;
      if (Array.isArray(news)) state.news = news;
      if (cur && typeof cur === "object") state.current = cur;
      if (Array.isArray(evs)) state.events = evs;
      if (book && typeof book === "object") state.book = book;
      renderAll();
      refreshDot();
    } catch (err) {
      refreshDot(err.message);
    }
  }

  async function boot() {
    tickClock();
    setInterval(tickClock, 1000);
    await poll();
    setInterval(poll, POLL_MS);
    pollSpot();
    setInterval(pollSpot, SPOT_MS);
  }

  boot();
})();
