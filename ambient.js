/* Background animations, one per chapter, each drawn from what the chapter is about.
   The same painters run in two places: faintly in the margins behind the reading column
   (cobalt on white), and larger inside each chapter opener (white on cobalt). */
(() => {
  "use strict";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const LIME = "#d4ff3a";

  // Small seeded random so every painter looks the same on every visit.
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

  /* Each painter: make(w, h, s) returns draw(c, t, p) where t is seconds and p is chapter progress 0..1.
     s is a scale factor (1 in margins, larger in openers). Stroke/fill colour is set by the caller. */
  const PAINTERS = {
    // Intro: rows of posts scrolling past right to left, like a feed you swipe through.
    feed(w, h, s) {
      const r = rng(11), cw = 110 * s, ch = 140 * s, gap = 28 * s;
      const rows = Math.max(2, Math.round(h / (ch + 60 * s)));
      const per = Math.ceil(w / (cw + gap)) + 2, span = per * (cw + gap);
      const lanes = Array.from({ length: rows }, (_, i) => ({ y: (i + 0.5) * (h / rows) - ch / 2, speed: (18 + r() * 26) * s, off: r() * span }));
      return (c, t) => {
        for (const ln of lanes) for (let j = 0; j < per; j++) {
          const x = ((j * (cw + gap) - t * ln.speed - ln.off) % span + span) % span - cw;
          const y = ln.y;
          rrect(c, x, y, cw, ch, 10 * s); c.stroke();
          c.beginPath(); c.arc(x + 16 * s, y + 16 * s, 7 * s, 0, TAU); c.fill();
          rrect(c, x + 10 * s, y + 32 * s, cw - 20 * s, ch * 0.45, 4 * s); c.stroke();
          for (let l = 0; l < 3; l++) c.fillRect(x + 10 * s, y + ch * 0.72 + l * 9 * s, (cw - 20 * s) * (l === 2 ? 0.5 : 1), 3 * s);
        }
      };
    },

    // Chapter 1: banner blocks loosen into flowing lines of a story as you read.
    story(w, h, s) {
      const rows = Math.round(h / (34 * s));
      const r = rng(7);
      const seeds = Array.from({ length: rows }, () => r() * TAU);
      return (c, t, p) => {
        const flow = clamp(p * 1.4);
        for (let i = 0; i < rows; i++) {
          const y = (i + 0.5) * (h / rows);
          c.lineWidth = (10 - 8 * flow) * s;
          c.setLineDash(flow < 0.98 ? [lerp(70, 400, flow) * s, lerp(30, 0, flow) * s] : []);
          c.beginPath();
          for (let x = -20; x <= w + 20; x += 12) {
            const a = flow * 9 * s * Math.sin(x / (70 * s) + t * 0.9 + seeds[i]);
            x === -20 ? c.moveTo(x, y + a) : c.lineTo(x, y + a);
          }
          c.stroke();
        }
        c.setLineDash([]);
      };
    },

    // Chapter 2: followers around authors. Small dense clusters and one huge loose one.
    network(w, h, s) {
      const r = rng(23), hubs = [], nodes = [];
      const hubN = Math.max(3, Math.round((w * h) / (260000 * s * s)));
      for (let i = 0; i < hubN; i++) hubs.push({ x: r() * w, y: r() * h, mega: i === 0 });
      hubs.forEach((hb) => {
        const n = hb.mega ? 46 : 12, spread = (hb.mega ? 260 : 80) * s;
        for (let j = 0; j < n; j++) nodes.push({ hb, a: r() * TAU, d: (0.35 + r() * 0.65) * spread, sp: (r() - 0.5) * 0.3 });
      });
      return (c, t) => {
        const A = c.globalAlpha;
        for (const nd of nodes) {
          const x = nd.hb.x + Math.cos(nd.a + t * nd.sp) * nd.d, y = nd.hb.y + Math.sin(nd.a + t * nd.sp) * nd.d;
          c.globalAlpha = A * (nd.hb.mega ? 0.35 : 1);
          c.beginPath(); c.moveTo(nd.hb.x, nd.hb.y); c.lineTo(x, y); c.stroke();
          c.beginPath(); c.arc(x, y, 3 * s, 0, TAU); c.fill();
        }
        c.globalAlpha = A * (1);
        for (const hb of hubs) {
          const pr = (hb.mega ? 16 : 9) * s * (1 + 0.15 * Math.sin(t * 2 + hb.x));
          c.beginPath(); c.arc(hb.x, hb.y, pr, 0, TAU); c.fill();
          c.beginPath(); c.arc(hb.x, hb.y, pr + ((t * 30 * s) % (40 * s)), 0, TAU); c.stroke();
        }
      };
    },

    // Chapter 3: a 1000 MW plant — transmission towers, sagging wires, pulses of current.
    power(w, h, s) {
      const span = 240 * s, towers = Math.ceil(w / span) + 1, baseY = h * 0.62, top = baseY - 150 * s;
      const wires = [0, 1, 2].map((k) => top + k * 26 * s);
      const pulses = Array.from({ length: 9 }, (_, i) => ({ wire: i % 3, off: i / 9, sp: 0.05 + (i % 4) * 0.015 }));
      const sag = (x, wy) => { const u = (((x % span) + span) % span) / span; return wy + Math.sin(u * Math.PI) * 28 * s; };
      return (c, t) => {
        for (let i = 0; i < towers; i++) {
          const x = i * span;
          c.beginPath();
          c.moveTo(x - 24 * s, h); c.lineTo(x - 6 * s, top - 18 * s); c.lineTo(x + 6 * s, top - 18 * s); c.lineTo(x + 24 * s, h);
          for (let y = top; y < h; y += 30 * s) { const k = (y - top) / (h - top); c.moveTo(x - 6 * s - k * 18 * s, y); c.lineTo(x + 6 * s + k * 18 * s, y + 30 * s); }
          wires.forEach((wy) => { c.moveTo(x - 30 * s, wy); c.lineTo(x + 30 * s, wy); });
          c.stroke();
        }
        wires.forEach((wy) => { c.beginPath(); for (let x = 0; x <= w; x += 8) x ? c.lineTo(x, sag(x, wy)) : c.moveTo(x, sag(x, wy)); c.stroke(); });
        const keep = c.fillStyle;
        c.fillStyle = LIME;
        for (const pl of pulses) {
          const x = ((pl.off + t * pl.sp) % 1) * w;
          c.beginPath(); c.arc(x, sag(x, wires[pl.wire]), 4 * s, 0, TAU); c.fill();
        }
        c.fillStyle = keep;
      };
    },

    // Chapter 4: a halftone camouflage that hides a word. The deeper you read, the clearer it gets.
    halftone(w, h, s, word) {
      const step = 13 * s, off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(w / step)); off.height = Math.max(1, Math.round(h / step));
      const o = off.getContext("2d");
      o.fillStyle = "#000";
      o.textAlign = "center"; o.textBaseline = "middle";
      // Fit the word into a box; vertical boxes get the word turned on its side.
      const fit = (bx, by, bw, bh) => {
        const vertical = bh > bw * 1.4, len = vertical ? bh : bw, thick = vertical ? bw : bh;
        let fs = thick * 0.8;
        o.font = `900 ${fs}px Geologica, sans-serif`;
        while (o.measureText(word).width > len * 0.94 && fs > 3) { fs -= 0.5; o.font = `900 ${fs}px Geologica, sans-serif`; }
        o.save(); o.translate(bx + bw / 2, by + bh / 2);
        if (vertical) o.rotate(-Math.PI / 2);
        o.fillText(word, 0, 0); o.restore();
      };
      // In the margins the text column covers the middle, so the word goes into each side field.
      const colL = Math.max(56, (w - 640) * 0.36), colR = colL + Math.min(640, w - 112);
      if (s === 1 && w > 960) {
        if (colL > 160) fit(0, 0, (colL - 48) / step, off.height);
        fit((colR + 48) / step, 0, (w - colR - 48) / step, off.height);
      } else fit(0, 0, off.width, off.height);
      const mask = o.getImageData(0, 0, off.width, off.height).data;
      return (c, t, p) => {
        const reveal = clamp(p * 1.3);
        for (let j = 0; j < off.height; j++) for (let i = 0; i < off.width; i++) {
          const inWord = mask[(j * off.width + i) * 4 + 3] > 128 ? 1 : 0;
          const noise = 0.5 + 0.5 * Math.sin(i * 0.7 + t * 1.3) * Math.cos(j * 0.6 - t);
          const v = (1 - reveal) * noise + reveal * (inWord ? 1 : 0.12);
          const rad = v * step * 0.45;
          if (rad < 0.4) continue;
          c.beginPath(); c.arc(i * step + step / 2, j * step + step / 2, rad, 0, TAU); c.fill();
        }
      };
    },

    // Chapter 5: storytelling and video — film strips sliding past.
    film(w, h, s) {
      const fh = 110 * s, strips = Math.max(2, Math.round(h / (fh * 1.9)));
      return (c, t) => {
        for (let k = 0; k < strips; k++) {
          const y = (k + 0.5) * (h / strips) - fh / 2, dir = k % 2 ? 1 : -1, fw = 150 * s;
          const shift = ((t * 40 * s * dir) % fw + fw) % fw;
          c.strokeRect(-10, y, w + 20, fh);
          for (let x = -fw + shift; x < w + fw; x += fw) {
            c.strokeRect(x + 10 * s, y + 18 * s, fw - 20 * s, fh - 36 * s);
            for (let hp = 0; hp < 5; hp++) {
              c.fillRect(x + 12 * s + hp * 28 * s, y + 5 * s, 12 * s, 8 * s);
              c.fillRect(x + 12 * s + hp * 28 * s, y + fh - 13 * s, 12 * s, 8 * s);
            }
          }
        }
        const px = (t * 60 * s) % w;
        c.fillRect(px, 0, 2 * s, h);
      };
    },

    // Chapter 6: can trust be measured — a field of ticking counters.
    numbers(w, h, s) {
      const cw = 42 * s, chh = 30 * s, cols = Math.ceil(w / cw), rows = Math.ceil(h / chh);
      const r = rng(5), cells = Array.from({ length: cols * rows }, () => ({ v: Math.floor(r() * 100), rate: 0.3 + r() * 2.5, ph: r() * 10 }));
      return (c, t, p) => {
        c.font = `600 ${13 * s}px Geologica, sans-serif`;
        c.textAlign = "center"; c.textBaseline = "middle";
        cells.forEach((cell, i) => {
          const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * chh + chh / 2;
          const v = Math.floor(cell.v + t * cell.rate + cell.ph) % 100;
          // As the chapter goes on, more counters freeze into "≠": a number is not trust.
          const frozen = ((i * 2654435761) % 997) / 997 < p * 0.35;
          c.fillText(frozen ? "≠" : String(v).padStart(2, "0"), x, y);
        });
      };
    },

    // Chapter 7: information overload — notifications pile up faster and faster.
    overload(w, h, s) {
      const r = rng(31), items = [];
      let acc = 0, last = 0;
      return (c, t, p) => {
        const A = c.globalAlpha;
        const dt = Math.min(0.1, t - last); last = t;
        acc += dt * (1.5 + p * 14);
        while (acc > 1) {
          acc -= 1;
          items.push({ x: r() * (w - 140 * s), y: -40 * s, vy: (30 + r() * 50) * s, bw: (80 + r() * 90) * s, born: t });
          if (items.length > 160) items.shift();
        }
        for (const it of items) {
          it.y += it.vy * dt;
          const a = clamp(1 - (t - it.born) / 9);
          if (a <= 0 || it.y > h + 40) continue;
          c.globalAlpha = A * (a);
          rrect(c, it.x, it.y, it.bw, 30 * s, 15 * s); c.stroke();
          c.beginPath(); c.arc(it.x + 15 * s, it.y + 15 * s, 6 * s, 0, TAU); c.fill();
          c.fillRect(it.x + 28 * s, it.y + 13 * s, it.bw - 40 * s, 3 * s);
        }
        c.globalAlpha = A * (1);
      };
    },

    // Conclusion: the noise clears; one point of clarity, slow ripples.
    clarity(w, h, s) {
      return (c, t) => {
        const A = c.globalAlpha;
        const cx = w * 0.5, cy = h * 0.5;
        for (let k = 0; k < 5; k++) {
          const rr = (((t * 26 + k * 90) % 450) * s);
          c.globalAlpha = A * (clamp(1 - rr / (450 * s)));
          c.beginPath(); c.arc(cx, cy, rr, 0, TAU); c.stroke();
        }
        c.globalAlpha = A * (1);
        const keep = c.fillStyle;
        c.fillStyle = LIME;
        c.beginPath(); c.arc(cx, cy, 9 * s, 0, TAU); c.fill();
        c.fillStyle = keep;
      };
    },
  };

  function lerp(a, b, t) { return a + (b - a) * t; }

  const MODE_BY_CHAPTER = {
    intro: "feed", ch1: "story", ch2: "network", ch3: "power", ch4: "halftone",
    ch5: "film", ch6: "numbers", ch7: "overload", conclusion: "clarity",
  };
  const WORD = document.documentElement.lang === "ru" ? "РЕКЛАМА" : "ADVERT";

  /** A canvas that runs one painter at a time and crossfades between painters. */
  class Stage {
    constructor(canvas, { scale, color, alpha }) {
      this.canvas = canvas;
      this.c = canvas.getContext("2d");
      this.scale = scale; this.color = color; this.alpha = alpha;
      this.layers = []; // { mode, draw, fade }
      this.resize();
    }
    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const r = this.canvas.getBoundingClientRect();
      this.w = r.width; this.h = r.height;
      this.canvas.width = Math.max(1, Math.round(r.width * dpr));
      this.canvas.height = Math.max(1, Math.round(r.height * dpr));
      this.c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const modes = this.layers.map((l) => l.mode);
      this.layers = [];
      modes.slice(-1).forEach((m) => this.set(m, true));
    }
    set(mode, instant) {
      const top = this.layers[this.layers.length - 1];
      if (top && top.mode === mode) return;
      const make = PAINTERS[mode];
      if (!make) return;
      this.layers.push({ mode, draw: make(this.w, this.h, this.scale, WORD), fade: instant ? 1 : 0 });
    }
    frame(t, p) {
      const c = this.c;
      c.clearRect(0, 0, this.w, this.h);
      c.strokeStyle = c.fillStyle = this.color;
      c.lineWidth = 1.25;
      const n = this.layers.length;
      this.layers.forEach((l, i) => {
        const isTop = i === n - 1;
        l.fade = clamp(l.fade + (isTop ? 0.04 : -0.04));
        c.save();
        c.globalAlpha = this.alpha * l.fade;
        c.lineWidth = 1.25 * this.scale;
        l.draw(c, t, isTop ? p : 1);
        c.restore();
      });
      this.layers = this.layers.filter((l, i) => i === this.layers.length - 1 || l.fade > 0);
    }
  }

  function boot() {
    const chapters = [...document.querySelectorAll(".longread .ch")];
    if (!chapters.length) return;

    // 1) Margin layer behind the reading column.
    const field = document.createElement("canvas");
    field.className = "ambient";
    field.setAttribute("aria-hidden", "true");
    document.body.prepend(field);
    const narrow = matchMedia("(max-width: 60rem)").matches;
    const margin = new Stage(field, { scale: 1, color: "#1e2be8", alpha: narrow ? 0.07 : 0.2 });
    addEventListener("resize", () => margin.resize());

    // 2) One layer inside each chapter opener.
    const openers = chapters.map((ch) => {
      const op = ch.querySelector(".opener");
      if (!op) return null;
      const cv = document.createElement("canvas");
      cv.className = "opener__ambient";
      cv.setAttribute("aria-hidden", "true");
      op.prepend(cv);
      const st = new Stage(cv, { scale: 1.8, color: "#f3f4f7", alpha: 0.22 });
      st.set(MODE_BY_CHAPTER[ch.id], true);
      st.visible = false;
      new IntersectionObserver(([en]) => { st.visible = en.isIntersecting; }).observe(op);
      addEventListener("resize", () => st.resize());
      return st;
    }).filter(Boolean);

    const state = () => {
      const line = innerHeight * 0.5;
      let cur = null;
      for (const ch of chapters) if (ch.getBoundingClientRect().top < line) cur = ch;
      if (!cur) return { mode: null, p: 0 };
      const r = cur.getBoundingClientRect();
      return { mode: MODE_BY_CHAPTER[cur.id], p: clamp((line - r.top) / r.height) };
    };

    // Hide the margin layer over the hero and the final recap, where cobalt fields own the screen.
    const hero = document.querySelector(".hero"), recap = document.querySelector(".recap");
    const t0 = performance.now();
    const loop = (now) => {
      const t = (now - t0) / 1000;
      const s = state();
      const heroIn = hero && hero.getBoundingClientRect().bottom > innerHeight * 0.4;
      const recapIn = recap && recap.getBoundingClientRect().top < innerHeight * 0.6;
      field.style.opacity = s.mode && !heroIn && !recapIn ? 1 : 0;
      if (s.mode) margin.set(s.mode);
      if (field.style.opacity === "1") margin.frame(t, s.p);
      openers.forEach((st) => { if (st.visible) st.frame(t, 0.5); });
      if (!reduced) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  const ready = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
  ready.then(boot);
})();
