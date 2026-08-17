/* WIRE desk — NEWS hero. Live spot + desk poll. */
(function () {
  "use strict";

  const TZ = "America/New_York";
  const SPOT_URL = "https://api.gold-api.com/price/XAU";
  const SPOT_MS = 20000;
  const POLL_MS = 3000;
  const TICKET = "102034139";
  const SL = 4050;

  const ET_CLOCK = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const ET_ROW = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const state = {
    events: [],
    book: null,
    news: [],
    current: null,
    spot: null,
    spotLive: false,
    spotAt: null,
  };

  const $ = (id) => document.getElementById(id);

  function parseTs(ts) {
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d) ? null : d;
  }
  function fmtET(ts) {
    const d = parseTs(ts);
    return d ? ET_ROW.format(d) + " ET" : "—";
  }
  function px(n) {
    if (n == null || n === "") return "—";
    const x = Number(n);
    if (Number.isNaN(x)) return "—";
    return x.toFixed(x >= 100 ? 2 : 3);
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function payload(e) { return (e && e.payload) || {}; }

  function tickClock() {
    $("clock").textContent = ET_CLOCK.format(new Date()) + " ET";
  }

  /* ---------- normalize NEWS rows ---------- */
  function normalize(item) {
    if (!item) return null;
    const p = item.payload && typeof item.payload === "object" ? item.payload : null;
    const src = p || item;
    const tickets = src.tickets_do_not_touch || item.tickets_do_not_touch || [];
    const t0 = tickets[0] || {};
    return {
      ts: item.ts || src.ts_et || item.ts_et,
      action: (item.action || src.action || "").toLowerCase(),
      event: src.event || null,
      when_et: src.when_et || null,
      headline: src.headline || null,
      source: src.source || null,
      url: src.url || null,
      correlating: Array.isArray(src.correlating) ? src.correlating : [],
      gold_implication: src.gold_implication || "",
      book_effect: src.book_effect != null ? src.book_effect : (item.book_effect != null ? item.book_effect : null),
      quiet: src.quiet === true || item.quiet === true,
      do_not_flatten: src.do_not_flatten !== false,
      ticket: t0.id || TICKET,
      sl: t0.sl != null ? t0.sl : SL,
      to: src.to || item.to || "MACRO",
      impact: src.impact || null,
    };
  }

  function stampOf(row) {
    const be = (row.book_effect || "").toString().toLowerCase();
    if (be === "hold") return { lab: "HOLD", cls: "hold" };
    if (be === "wait") return { lab: "WAIT", cls: "wait" };
    if (be === "no_new_long" || be === "no new long") return { lab: "NO NEW LONG", cls: "nonew" };
    if (row.book_effect == null && row.quiet) return { lab: "QUIET", cls: "quiet" };
    if (row.quiet) return { lab: "QUIET", cls: "quiet" };
    return { lab: "—", cls: "quiet" };
  }

  function headlineOf(row) {
    if (row.headline) return row.headline;
    if (row.quiet || row.action === "scan") return "no book-moving card";
    return "no book-moving card";
  }

  function rowKey(row) {
    return [row.ts, row.action, row.event || "", row.headline || "", row.book_effect || ""].join("|");
  }

  function renderNewsRow(row, isCurrent) {
    if (!row) return "";
    const st = stampOf(row);
    const act = (row.action || "scan").toUpperCase();
    const when = fmtET(row.when_et || row.ts);
    const ev = row.event ? String(row.event).replace(/_/g, " ") : "";
    const hl = headlineOf(row);
    const quietHl = !row.headline;
    const tags = row.correlating.length
      ? row.correlating.join(" · ")
      : "";
    const src = row.source
      ? (row.url
        ? `<a href="${esc(row.url)}" target="_blank" rel="noopener">${esc(row.source)}</a>`
        : esc(row.source))
      : "";
    const urlBit = row.url && !row.source
      ? `<a href="${esc(row.url)}" target="_blank" rel="noopener">${esc(row.url)}</a>`
      : (row.url && row.source ? "" : "");
    const metaParts = [src, urlBit].filter(Boolean);
    return `
      ${isCurrent ? `<div class="lead">CURRENT</div>` : ""}
      <div class="slug">
        <span class="action">${esc(act)}</span>
        <span class="stamp ${st.cls}">${esc(st.lab)}</span>
        <span class="when">${esc(when)}</span>
        ${ev ? `<span class="event">${esc(ev)}</span>` : ""}
      </div>
      <div class="headline${quietHl ? " quiet-line" : ""}">${esc(hl)}</div>
      ${metaParts.length ? `<div class="meta">${metaParts.join(" · ")}</div>` : ""}
      ${tags ? `<div class="tags">${esc(tags)}</div>` : ""}
      ${row.gold_implication ? `<div class="impl">${esc(row.gold_implication)}</div>` : ""}
      <div class="hold-line">
        ${row.do_not_flatten ? "<b>DO NOT FLATTEN</b>" : "flatten unset"}
        · ticket <b>${esc(row.ticket)}</b>
        · SL <b>${esc(px(row.sl))}</b>
        · to: <b>${esc(row.to)}</b>
      </div>`;
  }

  function renderWire() {
    const current = normalize(state.current);
    const rows = (state.news || []).map(normalize).filter(Boolean);
    rows.sort((a, b) => (parseTs(b.ts)?.getTime() || 0) - (parseTs(a.ts)?.getTime() || 0));

    const scans = rows.filter((r) => r.action === "scan").length;
    const cards = rows.filter((r) => r.action === "card").length;
    const quietN = rows.filter((r) => r.quiet && r.book_effect == null).length;
    $("wire-meta").textContent =
      rows.length + " prints · " + cards + " card · " + scans + " scan · " +
      quietN + " quiet · newest first";

    const curEl = $("current");
    if (current) {
      curEl.innerHTML = renderNewsRow(current, true);
      curEl.hidden = false;
    } else {
      curEl.innerHTML = "";
      curEl.hidden = true;
    }

    const curKey = current ? rowKey(current) : "";
    const rest = rows.filter((r) => rowKey(r) !== curKey);
    $("rows").innerHTML = rest.map((r) =>
      `<article class="row">${renderNewsRow(r, false)}</article>`
    ).join("");
  }

  /* ---------- desk strip from events + book ---------- */
  function lastCard() {
    const evs = state.events || [];
    for (let i = evs.length - 1; i >= 0; i--) {
      const e = evs[i];
      if ((e.action || "").toLowerCase() === "card") return e;
    }
    return null;
  }

  function extractM30() {
    const evs = state.events || [];
    for (let i = evs.length - 1; i >= 0; i--) {
      const e = evs[i];
      const p = payload(e);
      if ((e.tf || "") === "M30" && (e.action || "").toLowerCase() === "box" &&
          (p.distal != null || p.proximal != null)) {
        return { distal: p.distal, proximal: p.proximal, mid: p.mid_50 || p.mid, unused: p.freshness === "unused", refuse: p.refuse, spot: p.spot };
      }
      const box = p.htf_box || ((e.tf === "M30" && p.box) ? p.box : null);
      if (box && (box.distal != null || box.proximal != null) && (box.tf == null || box.tf === "M30")) {
        return { distal: box.distal, proximal: box.proximal, mid: box.mid_50 || box.mid, unused: box.unused, refuse: p.refuse, spot: p.spot };
      }
    }
    return null;
  }

  function extractFvg() {
    const evs = state.events || [];
    for (let i = evs.length - 1; i >= 0; i--) {
      const e = evs[i];
      const p = payload(e);
      if (p.fvg && (p.fvg.fvg_low != null || p.fvg.fvg_high != null)) {
        const f = p.fvg;
        return {
          low: f.fvg_low, high: f.fvg_high, mid: f.fvg_mid,
          role: f.role || "profit_area", unused: f.unused, tf: f.tf || e.tf,
        };
      }
      if (p.gap_low != null || p.gap_high != null) {
        return {
          low: p.gap_low, high: p.gap_high, mid: p.gap_mid,
          role: "profit_area",
          unused: p.fill_state === "unused" || p.unused === true,
          tf: e.tf,
        };
      }
    }
    return null;
  }

  function renderDesk() {
    const b = state.book || {};
    const open = (b.open || []).find((r) => String(r.ticket) === TICKET) || (b.open || [])[0] || {};
    const tix = open.ticket || TICKET;
    const sl = open.sl != null ? open.sl : SL;
    const lots = open.lots != null ? open.lots : 0.05;
    const entry = open.entry != null ? open.entry : 4043.95;
    $("tix-v").textContent = tix;
    $("tix-s").textContent = "buy " + lots + " @ " + px(entry) + " · SL " + px(sl) + " · do not flatten";

    const card = lastCard();
    const cp = payload(card);
    const st = (cp.status || cp.card || "WAIT").toString().toUpperCase();
    $("wait-v").textContent = st;
    $("wait-s").textContent = cp.skip_reason || cp.reason || cp.refuse || "price above unused M30 · no 50% · do not chase";

    const m30 = extractM30();
    if (m30) {
      $("m30-v").textContent = px(m30.distal) + "–" + px(m30.proximal);
      $("m30-s").textContent =
        (m30.unused ? "unused · " : "") +
        (m30.mid != null ? "50% " + px(m30.mid) : "") +
        (m30.refuse ? " · " + m30.refuse : " · demand");
    } else {
      $("m30-v").textContent = "4373–4392";
      $("m30-s").textContent = "unused · 50% 4382.50 · do not chase";
    }

    const fvg = extractFvg();
    if (fvg) {
      $("fvg-v").textContent = px(fvg.low) + "–" + px(fvg.high);
      $("fvg-s").textContent =
        (fvg.tf ? fvg.tf + " · " : "") +
        (fvg.role || "profit area").replace(/_/g, " ") +
        (fvg.unused ? " · unused" : "") +
        (fvg.mid != null ? " · mid " + px(fvg.mid) : "") +
        " · not a buy";
    } else {
      $("fvg-v").textContent = "—";
      $("fvg-s").textContent = "profit area · not a buy";
    }
  }

  function renderSpot() {
    if (state.spot == null) {
      $("spot-k").textContent = "LIVE SPOT";
      $("spot-v").textContent = "—";
      $("spot-s").textContent = "gold-api XAU · waiting";
      return;
    }
    $("spot-k").textContent = state.spotLive ? "LIVE SPOT" : "STALE SPOT";
    $("spot-v").textContent = px(state.spot);
    $("spot-s").textContent = state.spotLive
      ? "gold-api XAU · not Coinexx · not OANDA"
      : "STALE · book bid · gold-api failed";
  }

  /* ---------- live XAU — NEVER append ?t= ---------- */
  async function pollSpot() {
    try {
      const r = await fetch(SPOT_URL, { cache: "no-store" });
      if (!r.ok) throw new Error("spot " + r.status);
      const j = await r.json();
      const price = j.price != null ? Number(j.price) : null;
      if (price == null || Number.isNaN(price)) throw new Error("no price");
      state.spot = price;
      state.spotLive = true;
      state.spotAt = new Date();
    } catch (err) {
      state.spotLive = false;
      if (state.spot == null && state.book && state.book.bid != null) {
        state.spot = Number(state.book.bid);
      }
    }
    renderSpot();
  }

  async function pollJson(path) {
    const r = await fetch(path + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  }

  async function pollDesk() {
    try {
      const [events, book, news, current] = await Promise.all([
        pollJson("events.json"),
        pollJson("book.json"),
        pollJson("news.json"),
        pollJson("current-news.json"),
      ]);
      state.events = Array.isArray(events) ? events : [];
      state.book = book || null;
      state.news = Array.isArray(news) ? news : [];
      state.current = current || null;
      if (!state.spotLive && state.book && state.book.bid != null && state.spot == null) {
        state.spot = Number(state.book.bid);
      }
      renderDesk();
      renderWire();
      renderSpot();
    } catch (err) {
      /* keep last good board */
    }
  }

  tickClock();
  setInterval(tickClock, 1000);
  pollDesk();
  pollSpot();
  setInterval(pollDesk, POLL_MS);
  setInterval(pollSpot, SPOT_MS);
})();
