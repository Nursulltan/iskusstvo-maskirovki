/* Native advertising longread v2 "Under the marker":
   3D feed + lens in the hero, marker highlights, iris chapter openers, pinned scroll scenes. */
(() => {
  "use strict";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = matchMedia("(hover: none)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const COBALT = 0x1e2be8;
  const hasGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";

  /* ---------- Marker-glow heat (for gaze plots and the reading map) ---------- */

  const LUT = (() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 1;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "rgba(212,255,58,0)");
    g.addColorStop(0.3, "rgba(212,255,58,0.45)");
    g.addColorStop(0.7, "rgba(212,255,58,0.85)");
    g.addColorStop(1, "rgba(30,43,232,0.9)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 1);
    return x.getImageData(0, 0, 256, 1).data;
  })();

  class Heat {
    constructor(canvas, scale = 0.5) {
      this.canvas = canvas;
      this.scale = scale;
      this.ctx = canvas.getContext("2d");
      this.buf = document.createElement("canvas");
      this.bctx = this.buf.getContext("2d", { willReadFrequently: true });
      this.resize();
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.w = Math.max(1, Math.round(r.width * this.scale));
      this.h = Math.max(1, Math.round(r.height * this.scale));
      this.canvas.width = this.buf.width = this.w;
      this.canvas.height = this.buf.height = this.h;
      this.cssW = r.width; this.cssH = r.height;
    }
    clear() { this.bctx.clearRect(0, 0, this.w, this.h); }
    add(x, y, r, w) {
      const s = this.scale, cx = x * s, cy = y * s, rr = Math.max(2, r * s);
      const g = this.bctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, `rgba(0,0,0,${clamp(w)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      this.bctx.fillStyle = g;
      this.bctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    render() {
      const img = this.bctx.getImageData(0, 0, this.w, this.h), d = img.data;
      for (let i = 3; i < d.length; i += 4) {
        const a = d[i];
        if (!a) continue;
        const o = a * 4;
        d[i - 3] = LUT[o]; d[i - 2] = LUT[o + 1]; d[i - 1] = LUT[o + 2]; d[i] = LUT[o + 3];
      }
      this.ctx.putImageData(img, 0, 0);
    }
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function drawGaze(svg, pts, count) {
    while (svg.firstChild) svg.firstChild.remove();
    const n = Math.min(count, pts.length);
    for (let i = 1; i < n; i++) {
      const l = document.createElementNS(SVGNS, "line");
      l.setAttribute("x1", pts[i - 1].x); l.setAttribute("y1", pts[i - 1].y);
      l.setAttribute("x2", pts[i].x); l.setAttribute("y2", pts[i].y);
      svg.appendChild(l);
    }
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.setAttribute("r", p.r);
      svg.appendChild(c);
      const t = document.createElementNS(SVGNS, "text");
      t.setAttribute("x", p.x); t.setAttribute("y", p.y); t.textContent = i + 1;
      svg.appendChild(t);
    }
  }

  const place = (box, list) =>
    list.map(([fx, fy, dur = 1]) => ({ x: fx * box.width, y: fy * box.height, r: 6 + dur * 5, dur }));

  /* ---------- Smooth scroll ---------- */

  let lenis = null;
  function initScroll() {
    if (!hasGsap) return;
    gsap.registerPlugin(ScrollTrigger);
    if (reduced || typeof Lenis === "undefined") return;
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    const bar = document.querySelector(".bar").offsetHeight;
    document.querySelectorAll('a[href^="#"]').forEach((a) =>
      a.addEventListener("click", (ev) => {
        const id = a.getAttribute("href").slice(1);
        const target = id === "top" ? 0 : document.getElementById(id);
        if (target === null) return;
        ev.preventDefault();
        lenis.scrollTo(target, { offset: id === "top" ? 0 : -bar, duration: 1.4 });
        history.replaceState(null, "", "#" + id);
      })
    );
  }

  /* ---------- Hero: title, lens, 3D feed ---------- */

  const lens = { x: 0, y: 0, r: 0, tx: 0, ty: 0, tr: 0 };

  function heroTitle() {
    const words = document.querySelectorAll(".hero__title .w");
    words.forEach((w) => {
      const text = w.textContent;
      w.textContent = "";
      for (const ch of text) {
        const s = document.createElement("span");
        s.className = "c";
        s.textContent = ch;
        w.appendChild(s);
      }
    });
    if (!hasGsap || reduced) return;
    gsap.from(".hero__title .c", { yPercent: 115, duration: 1.2, ease: "expo.out", stagger: 0.03, delay: 0.15 });
    gsap.from([".hero__subtitle", ".hero__lede", ".hero__hint", ".hero__cue"], {
      y: 24, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.08, delay: 0.7,
    });
  }

  function heroLens(hero) {
    if (reduced) return;
    const R = () => (innerWidth < 640 ? 84 : 130);
    const local = (e) => {
      const b = hero.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };
    hero.addEventListener("pointermove", (e) => {
      [lens.tx, lens.ty] = local(e);
      lens.tr = R();
    });
    hero.addEventListener("pointerdown", (e) => { [lens.tx, lens.ty] = local(e); lens.tr = R(); });
    hero.addEventListener("pointerleave", () => { lens.tr = 0; });

    // On touch screens the lens sweeps across the title once by itself, then follows the finger.
    if (touch && hasGsap) {
      const t = document.querySelector(".hero__title").getBoundingClientRect();
      const b = hero.getBoundingClientRect();
      const y0 = t.top - b.top + t.height * 0.3, y1 = t.top - b.top + t.height * 0.75;
      Object.assign(lens, { x: t.left - b.left, y: y0, tx: t.left - b.left, ty: y0 });
      gsap.timeline({ delay: 1.6 })
        .to(lens, { tr: R(), duration: 0.5, ease: "power2.out" })
        .to(lens, { tx: t.right - b.left - 30, duration: 1.4, ease: "sine.inOut" })
        .to(lens, { ty: y1, tx: t.left - b.left + 40, duration: 1.2, ease: "sine.inOut" })
        .to(lens, { tr: 0, duration: 0.5, ease: "power2.in" });
    }
  }

  function updateLensCss(hero) {
    lens.x = lerp(lens.x, lens.tx, 0.2);
    lens.y = lerp(lens.y, lens.ty, 0.2);
    lens.r = lerp(lens.r, lens.tr, 0.14);
    if (lens.r < 0.5 && lens.tr === 0) lens.r = 0;
    hero.style.setProperty("--lx", lens.x.toFixed(1) + "px");
    hero.style.setProperty("--ly", lens.y.toFixed(1) + "px");
    hero.style.setProperty("--lr", lens.r.toFixed(1) + "px");
  }

  function cardTextures(backWords) {
    const W = 512, H = 640;
    const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
    const round = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect(a, b, w, h, r); x.fill(); };
    const fronts = [], backs = [];
    for (let v = 0; v < 3; v++) {
      const c = mk(), x = c.getContext("2d");
      x.fillStyle = "#4a56f6"; round(x, 0, 0, W, H, 36);
      x.fillStyle = "rgba(243,244,247,.35)"; x.beginPath(); x.arc(64, 64, 26, 0, Math.PI * 2); x.fill();
      x.fillStyle = "rgba(243,244,247,.4)"; round(x, 104, 52, 170, 22, 6);
      x.fillStyle = "rgba(243,244,247,.16)"; round(x, 28, 112, W - 56, 330, 18);
      x.fillStyle = "rgba(243,244,247,.32)";
      if (v === 0) { x.beginPath(); x.arc(W / 2, 270, 80, 0, Math.PI * 2); x.fill(); }
      if (v === 1) { round(x, 196, 190, 120, 170, 14); }
      if (v === 2) { x.beginPath(); x.moveTo(110, 410); x.lineTo(230, 230); x.lineTo(320, 340); x.lineTo(380, 280); x.lineTo(420, 410); x.closePath(); x.fill(); }
      x.fillStyle = "rgba(243,244,247,.3)";
      [470, 512, 554].forEach((y, i) => round(x, 28, y, i === 2 ? 260 : W - 56, 20, 6));
      fronts.push(new THREE.CanvasTexture(c));

      const b = mk(), y = b.getContext("2d");
      y.fillStyle = "#d4ff3a"; round(y, 0, 0, W, H, 36);
      y.fillStyle = "#0b1050";
      y.font = "800 96px Geologica, sans-serif";
      let size = 96;
      while (y.measureText(backWords[0]).width > W - 64 && size > 40) { size -= 4; y.font = `800 ${size}px Geologica, sans-serif`; }
      y.fillText(backWords[0], 32, 330);
      y.font = "500 30px Geologica, sans-serif";
      y.fillText(backWords[1], 32, 390);
      y.font = "700 30px Geologica, sans-serif";
      y.fillText(`${backWords[2]} ${["0417", "1129", "0886"][v]}`, 32, 580);
      y.fillRect(32, 96, 120, 10);
      backs.push(new THREE.CanvasTexture(b));
    }
    return { fronts, backs };
  }

  function hero3D(hero) {
    const canvas = hero.querySelector(".hero__stage");
    if (typeof THREE === "undefined" || !canvas) return () => {};
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch (err) {
      return () => {};
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(COBALT, 1);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COBALT, 9, 26);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
    camera.position.set(0, 0, 10);

    const { fronts, backs } = cardTextures(hero.dataset.cardBack.split("|"));
    const geo = new THREE.PlaneGeometry(1.6, 2);
    const count = innerWidth < 640 ? 12 : 26;
    const cards = [];
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const v = i % 3;
      const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: fronts[v], transparent: true }));
      const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: backs[v], transparent: true }));
      back.rotation.y = Math.PI;
      g.add(front, back);
      const z = -2 - Math.random() * 10;
      g.position.set((Math.random() * 2 - 1) * (7 + -z * 0.45), (Math.random() * 2 - 1) * 6, z);
      g.userData = {
        speed: 0.18 + Math.random() * 0.25,
        tilt: (Math.random() - 0.5) * 0.5,
        sway: Math.random() * Math.PI * 2,
        flip: 0,
      };
      g.rotation.z = g.userData.tilt * 0.4;
      scene.add(g);
      cards.push(g);
    }

    const size = () => {
      const w = hero.clientWidth, h = hero.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    size();
    addEventListener("resize", size);

    const v = new THREE.Vector3();
    let last = performance.now();
    return function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = hero.clientWidth, h = hero.clientHeight;
      for (const c of cards) {
        const u = c.userData;
        if (!reduced) {
          c.position.y += u.speed * dt;
          const top = 6.5 + -c.position.z * 0.4;
          if (c.position.y > top) c.position.y = -top;
        }
        // Cards under the lens turn over and show what they are.
        v.copy(c.position).project(camera);
        const sx = (v.x + 1) / 2 * w, sy = (1 - v.y) / 2 * h;
        const near = lens.r > 4 && Math.hypot(sx - lens.x, sy - lens.y) < lens.r + 70;
        u.flip = lerp(u.flip, near ? Math.PI : 0, 0.09);
        c.rotation.y = u.flip + Math.sin(now / 1400 + u.sway) * 0.18;
        c.rotation.x = Math.cos(now / 1700 + u.sway) * 0.12;
      }
      renderer.render(scene, camera);
    };
  }

  function initHero() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    heroTitle();
    heroLens(hero);
    const frame3d = hero3D(hero);
    let visible = true, raf = 0;
    const loop = (now) => {
      raf = 0;
      if (!visible) return;
      updateLensCss(hero);
      frame3d(now);
      if (!reduced) raf = requestAnimationFrame(loop);
    };
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }).observe(hero);
    raf = requestAnimationFrame(loop);
  }

  /* ---------- Markers, openers, recap ---------- */

  function initMarkers() {
    const marks = [...document.querySelectorAll(".longread .hl:not(.hl--static)")];
    if (!hasGsap || reduced) { marks.forEach((m) => m.classList.add("is-on")); return; }
    marks.forEach((m) =>
      ScrollTrigger.create({ trigger: m, start: "top 72%", once: true, onEnter: () => m.classList.add("is-on") })
    );
    const recap = [...document.querySelectorAll(".recap__list .hl")];
    ScrollTrigger.create({
      trigger: ".recap__list", start: "top 75%", once: true,
      onEnter: () => recap.forEach((m, i) => setTimeout(() => m.classList.add("is-on"), i * 160)),
    });
  }

  function initOpeners() {
    if (!hasGsap || reduced) return;
    document.querySelectorAll(".opener").forEach((op) => {
      // Straight after a cobalt interlude the colour is already cobalt: no iris, or white would flash between them.
      const prev = op.closest(".ch")?.previousElementSibling;
      if (prev && prev.matches(".inter")) op.style.setProperty("--iris", "150%");
      else gsap.fromTo(op, { "--iris": "0%" }, {
        "--iris": "150%", ease: "none",
        scrollTrigger: { trigger: op, start: "top bottom", end: "top 10%", scrub: true },
      });
      const num = op.querySelector(".opener__num");
      gsap.fromTo(num, { yPercent: 35 }, {
        yPercent: -15, ease: "none",
        scrollTrigger: { trigger: op, start: "top bottom", end: "bottom top", scrub: true },
      });
    });
  }

  /* ---------- Sideways: text arrives from the right as you scroll ---------- */

  // Wrap every word of the visible text in a span, leaving hidden labels and markers intact.
  function splitWords(el, cls) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((t) => {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.append(t); return; }
            const w = document.createElement("span");
            w.className = cls; w.textContent = t;
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains("visually-hidden")) walk(n);
      });
    };
    walk(el);
    return [...el.querySelectorAll("." + cls)];
  }

  function initSideways() {
    if (!hasGsap || reduced) return;
    const narrow = matchMedia("(max-width: 60rem)").matches;

    // Chapter titles: words fly in from the right one after another.
    document.querySelectorAll(".opener").forEach((op) => {
      const title = op.querySelector(".opener__title");
      const words = splitWords(title, "sw");
      gsap.fromTo(words, { xPercent: 160, opacity: 0, rotate: 6 }, {
        xPercent: 0, opacity: 1, rotate: 0, ease: "power3.out", stagger: 0.12,
        scrollTrigger: { trigger: op, start: "top 70%", end: "top 5%", scrub: 0.6 },
      });

      // A giant running line with the chapter title, moving right to left.
      const text = title.textContent.replace(/^.*?\.\s/, "").trim();
      const run = document.createElement("div");
      run.className = "opener__run";
      run.setAttribute("aria-hidden", "true");
      run.innerHTML = `<span>${[text, text, text].map((t) => t.replace(/[<&]/g, "")).join('<i></i>')}</span>`;
      op.prepend(run);
      gsap.fromTo(run.firstChild, { xPercent: 0 }, {
        xPercent: -45, ease: "none",
        scrollTrigger: { trigger: op, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    // Paragraphs: slide in from the right and wipe open from the right edge.
    document.querySelectorAll(".read > p").forEach((p) => {
      gsap.fromTo(p,
        { x: narrow ? 40 : 160, opacity: 0 },
        {
          x: 0, opacity: 1, ease: "power2.out",
          scrollTrigger: { trigger: p, start: "top 102%", end: "top 84%", scrub: 0.4 },
        });
    });

    // Quotes: words come in from the right, the portrait from the left.
    document.querySelectorAll(".quote").forEach((q) => {
      const words = splitWords(q.querySelector("blockquote p"), "sw");
      gsap.fromTo(words, { x: () => innerWidth * 0.5, opacity: 0, rotate: 8, scale: 0.8 }, {
        x: 0, opacity: 1, rotate: 0, scale: 1, ease: "expo.out", stagger: 0.05,
        scrollTrigger: { trigger: q, start: "top 85%", end: "top 25%", scrub: 0.6 },
      });
      const cap = q.querySelector("figcaption");
      if (cap) gsap.fromTo(cap, { x: 120, opacity: 0 }, {
        x: 0, opacity: 1, ease: "power2.out",
        scrollTrigger: { trigger: q, start: "top 45%", end: "top 15%", scrub: 0.6 },
      });
      const img = q.querySelector(".quote__photo");
      if (img) gsap.fromTo(img, { x: -160, opacity: 0, clipPath: "inset(0% 100% 0% 0%)" }, {
        x: 0, opacity: 1, clipPath: "inset(0% 0% 0% 0%)", ease: "power2.out",
        scrollTrigger: { trigger: q, start: "top 85%", end: "top 30%", scrub: 0.6 },
      });
    });
  }

  /* ---------- Interludes: pinned, the page travels sideways ---------- */

  function initInterludes() {
    if (!hasGsap || reduced) return;
    // Cobalt blocks open as a circle growing from the bottom edge, like the chapter openers.
    document.querySelectorAll(".inter, .scene").forEach((sec) =>
      gsap.fromTo(sec, { "--iris": "8%" }, {
        "--iris": "150%", ease: "power1.in",
        scrollTrigger: { trigger: sec, start: "top bottom", end: "top 5%", scrub: true },
      })
    );
    const clamp01 = gsap.utils.clamp(0, 1);
    const clampSkew = gsap.utils.clamp(-9, 9);
    document.querySelectorAll(".inter").forEach((sec) => {
      if (sec.dataset.inter === "label") return interLabel(sec);
      const track = sec.querySelector(".inter__track");
      const dist = () => Math.max(0, track.offsetWidth - innerWidth);
      const skew = gsap.quickTo(track, "skewX", { duration: 0.5, ease: "power3" });
      const st = gsap.to(track, {
        x: () => -dist(), ease: "none",
        scrollTrigger: {
          trigger: sec, pin: true, start: "top top", scrub: 0.8, anticipatePin: 1,
          end: () => "+=" + Math.round(dist() * 1.15), invalidateOnRefresh: true,
        },
      }).scrollTrigger;
      // Fast scrolling leans the whole strip, like it is being dragged; it straightens when you stop.
      let lastY = scrollY;
      const lean = () => {
        const moved = scrollY !== lastY; lastY = scrollY;
        skew(st.isActive && moved ? clampSkew(st.getVelocity() / -260) : 0);
      };

      let visible = false;
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(sec);
      const tx = () => gsap.getProperty(track, "x");
      const centre = (el, x) => (x + el.offsetLeft + el.offsetWidth / 2) / innerWidth;
      let frame = () => {};

      if (sec.dataset.inter === "feed") {
        // Coverflow: posts turn towards the middle, then flip to show what they really are.
        const posts = [...sec.querySelectorAll(".ipost")];
        frame = () => {
          const x = tx();
          posts.forEach((pst) => {
            const c = centre(pst, x) - 0.5;
            const ry = gsap.utils.clamp(-65, 65)(c * -110);
            const z = -Math.abs(c) * 420;
            pst.style.transform = `translateZ(${z.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg)`;
            const flip = clamp01((0.06 - c) * 5);
            pst.firstElementChild.style.transform = `rotateY(${(flip * 180).toFixed(1)}deg) scale(${1 + Math.sin(flip * Math.PI) * 0.12})`;
          });
        };
      } else if (sec.dataset.inter === "plain") {
        // Each bureaucratic chunk is struck out as it crosses the middle; its plain version appears below.
        const chunks = [...sec.querySelectorAll(".pchunk")];
        const words = [...sec.querySelectorAll(".pplain__w")];
        frame = () => {
          const x = tx();
          chunks.forEach((ch, i) => {
            const k = clamp01((0.62 - centre(ch, x)) * 3);
            ch.style.setProperty("--strike", clamp01(k * 1.8).toFixed(3));
            ch.style.opacity = (1 - clamp01((k - 0.6) * 2.5) * 0.65).toFixed(3);
            const w = words[i], on = clamp01((k - 0.35) * 2.5);
            w.style.opacity = on.toFixed(3);
            w.style.transform = `translateY(${((1 - on) * 60).toFixed(1)}%) rotate(${((1 - on) * 6).toFixed(1)}deg)`;
          });
        };
      } else if (sec.dataset.inter === "noise") {
        // Metrics fly past at three depths; the claims get struck out; then the noise clears.
        const back = sec.querySelector(".nlayer--back"), front = sec.querySelector(".nlayer--front");
        const words = [...sec.querySelectorAll(".nword")];
        frame = () => {
          const x = tx(), d = dist() || 1, p = clamp01(-x / d);
          back.style.transform = `translateX(${(x * 0.45).toFixed(1)}px)`;
          front.style.transform = `translateX(${(x * 1.7).toFixed(1)}px)`;
          const fade = 1 - clamp01((p - 0.72) * 4);
          back.style.opacity = (0.35 * fade).toFixed(3);
          front.style.opacity = fade.toFixed(3);
          words.forEach((w) => w.style.setProperty("--strike", clamp01((0.55 - centre(w, x)) * 3).toFixed(3)));
        };
      }
      gsap.ticker.add(() => { if (visible) { lean(); frame(); } });
    });
  }

  // The label: letters tumble in from the right, lock into a lime tag, then the tag shrinks and a post hides it.
  function interLabel(sec) {
    const word = sec.querySelector(".lword"), letters = [...word.children];
    const post = sec.querySelector(".lpost"), end = sec.querySelector(".lend");
    const rnd = gsap.utils.random;
    const tl = gsap.timeline({
      scrollTrigger: { trigger: sec, pin: true, start: "top top", end: "+=260%", scrub: 1, anticipatePin: 1 },
    });
    tl.fromTo(letters, {
      x: (i) => innerWidth * (0.7 + i * 0.12), y: () => rnd(-innerHeight * 0.4, innerHeight * 0.4),
      rotationX: () => rnd(-180, 180), rotationY: () => rnd(-180, 180), rotationZ: () => rnd(-120, 120),
      scale: () => rnd(1.6, 3.2), opacity: 0,
    }, { x: 0, y: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, opacity: 1, ease: "power3.out", duration: 1.4, stagger: 0.08 })
      .fromTo(word, { "--fill": 0 }, { "--fill": 1, duration: 0.35, ease: "power2.inOut" })
      .to(letters, { color: "#0b1050", duration: 0.2 }, "<0.15")
      .to(word, { scale: 1.08, duration: 0.15, ease: "power2.out" })
      .to(word, { scale: 0.16, y: () => -innerHeight * 0.12, duration: 0.6, ease: "power3.inOut" })
      .fromTo(post, { x: () => innerWidth, rotation: 14, opacity: 1 }, { x: 0, rotation: -2, duration: 0.7, ease: "power3.out" }, "<0.3")
      .fromTo(end, { x: () => innerWidth * 0.6, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, "<0.35")
      // The post lifts a corner: the tag is still underneath.
      .to(post, { rotation: 9, y: () => innerHeight * 0.04, xPercent: 48, duration: 0.5, ease: "power2.inOut" })
      .to({}, { duration: 0.35 })
      .to([post, word], { x: () => -innerWidth * 1.1, rotation: -12, opacity: 0, duration: 0.6, stagger: 0.08, ease: "power3.in" });
  }

  /* ---------- Scenes ---------- */

  function setStep(el, p, n = 3) {
    const step = Math.min(n - 1, Math.floor(p * n));
    el.querySelectorAll(".scene__steps li").forEach((li, i) => li.classList.toggle("is-active", i === step));
  }

  function sceneBanner(el) {
    const paths = [
      [[0.5, 0.55, 1.4], [0.3, 0.5, 1], [0.7, 0.6, 1.2], [0.4, 0.72, 0.9], [0.25, 0.83, 0.8], [0.6, 0.86, 0.7], [0.5, 0.95, 0.6], [0.92, 0.12, 0.25]],
      [[0.5, 0.3, 1.6], [0.45, 0.4, 2], [0.55, 0.36, 1.8], [0.3, 0.12, 0.8], [0.5, 0.48, 1.6], [0.35, 0.58, 1.2], [0.62, 0.62, 1], [0.48, 0.34, 1.4]],
    ];
    const units = [...el.querySelectorAll(".phone__screen")].map((screen, i) => ({
      screen, heat: new Heat(screen.querySelector(".heat"), 0.5), svg: screen.querySelector(".gaze"), path: paths[i], pts: [],
    }));
    const num = el.querySelector(".stage__num");
    let last = -1;
    const layout = () => {
      last = -1;
      units.forEach((u) => {
        u.heat.resize();
        const b = u.screen.getBoundingClientRect();
        u.svg.setAttribute("viewBox", `0 0 ${b.width} ${b.height}`);
        u.pts = place(b, u.path);
      });
    };
    layout();
    return {
      el, layout,
      update(p) {
        setStep(el, p);
        const k = Math.round(clamp(p / 0.66) * 8);
        if (k !== last) {
          last = k;
          units.forEach((u) => {
            u.heat.clear();
            u.pts.slice(0, k).forEach((pt) => u.heat.add(pt.x, pt.y, 26 + pt.dur * 16, 0.42 * pt.dur));
            u.heat.render();
            drawGaze(u.svg, u.pts, k);
          });
        }
        el.classList.toggle("is-final", p > 0.66);
        num.textContent = "+" + Math.round(53 * easeOut(clamp((p - 0.66) / 0.22))) + "%";
      },
    };
  }

  function sceneInfl(el) {
    return { el, layout() {}, update(p) { setStep(el, p); el.classList.toggle("is-final", p > 0.66); } };
  }

  function sceneDisc(el) {
    const mock = el.querySelector(".article-mock");
    const heat = new Heat(mock.querySelector(".heat"), 0.5);
    const svg = mock.querySelector(".gaze");
    const num = el.querySelector(".meter__num"), where = el.querySelector(".meter__where"), meter = el.querySelector(".meter");
    let pts = { top: [], mid: [] }, lastKey = "";
    const layout = () => {
      lastKey = "";
      heat.resize();
      const b = mock.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${b.width} ${b.height}`);
      const l = mock.querySelector(".disc-label--mid").getBoundingClientRect();
      const ly = (l.top - b.top + l.height / 2) / b.height, lx = (l.left - b.left + l.width / 2) / b.width;
      pts.top = place(b, [[0.3, 0.12, 1.2], [0.6, 0.14, 1], [0.2, 0.3, 1], [0.55, 0.33, 0.9], [0.3, 0.42, 0.8], [0.7, 0.56, 0.8], [0.25, 0.7, 0.7], [0.6, 0.84, 0.6]]);
      pts.mid = place(b, [[0.3, 0.12, 1.2], [0.6, 0.14, 1], [0.2, 0.3, 1], [0.55, 0.33, 0.9], [lx, ly, 2], [lx + 0.06, ly + 0.02, 1.4], [0.3, 0.7, 0.8], [0.6, 0.84, 0.7]]);
    };
    layout();
    return {
      el, layout,
      update(p) {
        setStep(el, p);
        const mid = p >= 0.4;
        el.classList.toggle("is-mid", mid);
        const set = mid ? pts.mid : pts.top;
        const k = Math.round((mid ? clamp((p - 0.4) / 0.4) : clamp(p / 0.35)) * set.length);
        const key = (mid ? "m" : "t") + k;
        if (key !== lastKey) {
          lastKey = key;
          heat.clear();
          set.slice(0, k).forEach((pt) => heat.add(pt.x, pt.y, 30 + pt.dur * 18, 0.42 * pt.dur));
          heat.render();
          drawGaze(svg, set, k);
        }
        const value = mid ? lerp(7, 40, easeOut(clamp((p - 0.55) / 0.3))) : 7;
        meter.style.setProperty("--m", value.toFixed(1));
        num.textContent = Math.round(value) + (value >= 39.5 ? "%+" : "%");
        where.textContent = mid ? el.dataset.midLabel : el.dataset.topLabel;
      },
    };
  }

  function initScenes() {
    const make = { banner: sceneBanner, infl: sceneInfl, disc: sceneDisc };
    const scenes = [];
    document.querySelectorAll("[data-scene]").forEach((el) => {
      const kind = el.dataset.scene;
      if (kind === "levels") return initLevels(el);
      const s = make[kind](el);
      scenes.push(s);
      if (!hasGsap || reduced) { el.style.setProperty("--p", 1); s.update(1); return; }
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "+=220%",
        pin: true,
        scrub: true,
        onUpdate: (self) => { el.style.setProperty("--p", self.progress.toFixed(4)); s.update(self.progress); },
        onRefresh: (self) => { s.layout(); s.update(self.progress); },
      });
      s.update(0);
    });
    return scenes;
  }

  function initLevels(el) {
    const track = el.querySelector(".levels");
    if (!hasGsap || reduced) { track.style.flexWrap = "wrap"; track.style.width = "auto"; return; }
    // offsetWidth is the laid-out width; scrollWidth would also count cards that are still flying in.
    const dist = () => Math.max(0, track.offsetWidth - innerWidth);
    const cards = [...track.children];
    // Cards fly in from the right one by one; the strip only travels if they do not fit.
    gsap.timeline({
      scrollTrigger: {
        trigger: el, start: "top top", end: () => "+=" + Math.round(innerHeight * 1.3 + dist()),
        pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
      },
    })
      .fromTo(cards, { x: () => innerWidth * 0.9, rotation: 9, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, ease: "power3.out", duration: 1, stagger: 0.3 })
      .to(track, { x: () => -dist(), ease: "none", duration: 1.2 }, ">-0.4")
      .to({}, { duration: 0.3 });
  }

  /* ---------- Reading dwell, map, nav ---------- */

  const BIN = 24;
  const dwell = [];
  function initDwell() {
    setInterval(() => {
      if (document.hidden) return;
      const i = Math.floor((scrollY + innerHeight * 0.38) / BIN);
      for (let d = -6; d <= 6; d++) if (i + d >= 0) dwell[i + d] = (dwell[i + d] || 0) + 0.25 * Math.exp(-(d * d) / 12);
    }, 250);
  }

  function renderReadmap() {
    const canvas = document.querySelector(".readmap__canvas");
    const cap = document.querySelector(".readmap__caption");
    const heat = canvas._heat || (canvas._heat = new Heat(canvas, 1));
    heat.resize();
    heat.clear();
    const total = document.documentElement.scrollHeight, bins = Math.ceil(total / BIN);
    let sum = 0;
    for (let i = 0; i < bins; i++) {
      const v = dwell[i] || 0;
      if (v < 0.05) continue;
      sum += v;
      heat.add((i / bins) * heat.cssW, heat.cssH / 2, heat.cssH * 0.9, clamp(v / 10) * 0.5);
    }
    heat.render();
    if (!cap.dataset.full) cap.dataset.full = cap.textContent;
    cap.textContent = sum < 2 ? cap.dataset.empty : cap.dataset.full;
    const ticks = document.querySelector(".readmap__ticks");
    if (!ticks.childElementCount) {
      document.querySelectorAll(".longread .ch").forEach((ch) => {
        const n = ch.querySelector(".opener__num:not(.opener__num--word)");
        if (!n) return;
        const li = document.createElement("li");
        li.textContent = parseInt(n.textContent, 10);
        li._ch = ch;
        ticks.appendChild(li);
      });
    }
    ticks.querySelectorAll("li").forEach((li) => {
      li.style.left = ((li._ch.getBoundingClientRect().top + scrollY) / total) * 100 + "%";
    });
  }

  function initNav() {
    const links = [...document.querySelectorAll(".chapters a")];
    const secs = links.map((a) => document.getElementById(a.dataset.target));
    const bar = document.querySelector(".bar");
    document.querySelectorAll("a.lang").forEach((a) => a.addEventListener("click", () => {
      const cur = links.find((l) => l.getAttribute("aria-current"));
      if (cur) a.href = a.getAttribute("href").split("#")[0] + "#" + cur.dataset.target;
    }));
    return () => {
      const line = innerHeight * 0.4;
      let cur = -1;
      secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < line) cur = i; });
      links.forEach((a, i) => {
        a.classList.toggle("is-read", i < cur);
        if (i === cur) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty("--read", max > 0 ? (scrollY / max).toFixed(4) : 0);
    };
  }

  /* ---------- Boot ---------- */

  function boot() {
    initScroll();
    initHero();
    initMarkers();
    initOpeners();
    initScenes();
    initSideways();
    initInterludes();
    if (hasGsap) {
      // Pins must be measured top to bottom, otherwise a pin further down ignores the space
      // taken by a pin above it. Sort by position in the document, pins first on the same element.
      const order = new Map(ScrollTrigger.getAll().map((st, i) => [st, i]));
      ScrollTrigger.sort((a, b) => {
        const ea = a.pin || a.trigger, eb = b.pin || b.trigger;
        if (ea && eb && ea !== eb) {
          const rel = ea.compareDocumentPosition(eb);
          if (rel & Node.DOCUMENT_POSITION_FOLLOWING && !(rel & Node.DOCUMENT_POSITION_CONTAINED_BY)) return -1;
          if (rel & Node.DOCUMENT_POSITION_PRECEDING && !(rel & Node.DOCUMENT_POSITION_CONTAINS)) return 1;
        }
        if (!!a.pin !== !!b.pin) return a.pin ? -1 : 1;
        return order.get(a) - order.get(b);
      });
      ScrollTrigger.refresh();
    }
    initDwell();
    const navUpdate = initNav();
    addEventListener("scroll", navUpdate, { passive: true });
    navUpdate();

    let mapTimer = null;
    new IntersectionObserver(([en]) => {
      clearInterval(mapTimer);
      if (en.isIntersecting) { renderReadmap(); mapTimer = setInterval(renderReadmap, 1000); }
    }).observe(document.querySelector(".readmap__canvas"));

    if (hasGsap) {
      addEventListener("load", () => ScrollTrigger.refresh());
      // Deep links (e.g. from the language switch) land after pins have been measured.
      if (location.hash.length > 1) {
        const t = document.getElementById(location.hash.slice(1));
        if (t) requestAnimationFrame(() => t.scrollIntoView());
      }
    }
  }

  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
  fontsReady.then(boot);
})();
