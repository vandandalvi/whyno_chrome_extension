// Live animated demos for the welcome tutorial. Each demo is a small looping story played with the
// extension's own button and card markup, so what people see here is what they get on a real page.
(function () {
  const W = 760;
  const H = 520;
  const demo = document.getElementById("demo");
  const wrap = demo.parentElement;
  const stage = document.getElementById("stage");

  // ------------------------------------------------------------ helpers
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const eOut = (x) => 1 - Math.pow(1 - x, 3);
  const eInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const eBack = (x) => { const c1 = 1.4; const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const lerp = (a, b, x) => a + (b - a) * x;
  const rnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const typed = (text, u, a, b) => text.slice(0, Math.floor(text.length * seg(u, a, b)));

  const icon = (d) => `<svg class="wn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON = {
    wand: icon("M4 20 L14.5 9.5 M14 4 v3 M12.5 5.5 h3 M19 9 v2 M18 10 h2"),
    wave: icon("M4 10 v4 M8 7 v10 M12 4 v16 M16 7 v10 M20 10 v4"),
    close: icon("M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5"),
    send: icon("M5 12 h13 M13 6 l6 6 -6 6"),
    mic: icon("M12 3.5 a3 3 0 0 1 3 3 v5 a3 3 0 0 1 -6 0 v-5 a3 3 0 0 1 3 -3 Z M5.5 11 a6.5 6.5 0 0 0 13 0 M12 17.5 v3"),
    check: icon("M5 12.5 L10 17.5 L19 7")
  };
  const ARROW_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const ARROW_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';

  let scale = 1;
  // The demo is drawn at one fixed size and scaled to the biggest size that fits the space, so it never scrolls.
  function fit() {
    scale = Math.max(0.1, Math.min(stage.clientWidth / W, stage.clientHeight / H));
    wrap.style.width = `${Math.floor(W * scale)}px`;
    wrap.style.height = `${Math.floor(H * scale)}px`;
    demo.style.transform = `scale(${scale})`;
  }
  new ResizeObserver(fit).observe(stage);
  fit();

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    const d = demo.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - d.left) / scale, y: (r.top + r.height / 2 - d.top) / scale };
  }

  // ------------------------------------------------------------ shared cursor
  const cursor = document.createElement("div");
  cursor.className = "d-cursor";
  cursor.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 3l14 8-6 1.8L10.5 19z" fill="#16161A" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const ripple = document.createElement("div");
  ripple.className = "d-ripple";
  demo.append(ripple, cursor);

  function pathPos(u, moves, from) {
    let pos = from, prev = from;
    for (const m of moves) {
      const target = m.to();
      if (u >= m.t[1]) { prev = target; pos = target; continue; }
      if (u > m.t[0]) { const k = eInOut(seg(u, m.t[0], m.t[1])); pos = { x: lerp(prev.x, target.x, k), y: lerp(prev.y, target.y, k) }; }
      else pos = prev;
      break;
    }
    return pos;
  }
  function drawCursor(pos, alpha) {
    cursor.style.opacity = alpha;
    cursor.style.transform = `translate(${pos.x - 4}px, ${pos.y - 3}px)`;
  }
  function drawRipple(u, clicks, pos) {
    let k = -1;
    for (const c of clicks) { const x = (u - c) / 0.45; if (x >= 0 && x <= 1) k = x; }
    ripple.style.opacity = k < 0 ? 0 : (1 - k) * 0.8;
    ripple.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${0.35 + 0.9 * Math.max(0, k)})`;
  }
  function hover(buttons, pos) {
    for (const [el, press] of buttons) {
      if (!el) continue;
      const c = el.getBoundingClientRect(), d = demo.getBoundingClientRect();
      const x = (pos.x * scale) + d.left, y = (pos.y * scale) + d.top;
      const inside = x >= c.left && x <= c.right && y >= c.top && y <= c.bottom;
      el.classList.toggle("hov", inside);
      el.classList.toggle("press", inside && press);
    }
  }
  const pressed = (u, times) => times.some((c) => u >= c && u <= c + 0.18);

  // ------------------------------------------------------------ the Whyno UI (real markup)
  function makeUI(scene, primaryLabel) {
    const ui = document.createElement("div");
    ui.className = "wn-root";
    ui.style.cssText = "position:absolute;inset:0;pointer-events:none;";
    ui.innerHTML = `
      <div class="wn-launcher">
        <img class="wn-logo" src="../icons/icon48.png" alt="">
        <button class="wn-chip wn-primary-action" type="button">${ICON.wand}<span>${primaryLabel}</span></button>
        <button class="wn-chip flowchip" type="button">${ICON.wave}<span>Flow</span></button>
      </div>
      <section class="wn-card">
        <header class="wn-card-head">
          <img class="wn-logo" src="../icons/icon48.png" alt="">
          <div class="wn-title"></div><div class="wn-quota"></div>
          <button class="wn-icon-btn" type="button">${ICON.close}</button>
        </header>
        <div class="wn-card-body"></div>
      </section>`;
    scene.appendChild(ui);
    return {
      launcher: ui.querySelector(".wn-launcher"), primary: ui.querySelector(".wn-primary-action"), flowchip: ui.querySelector(".flowchip"),
      card: ui.querySelector(".wn-card"), title: ui.querySelector(".wn-title"), body: ui.querySelector(".wn-card-body"), key: ""
    };
  }
  const workingHTML = (text) => `<div class="wn-working"><span class="wn-dots"><i></i><i></i><i></i></span><span>${text}</span></div>`;
  function setBody(h, key, html) { if (h.key !== key) { h.key = key; h.body.innerHTML = html; } }
  function animateDots(h, u) {
    h.body.querySelectorAll(".wn-dots i").forEach((d, i) => {
      const k = Math.max(0, Math.sin((u * 0.9 - i * 0.18) * Math.PI * 2));
      d.style.opacity = 0.3 + 0.7 * k; d.style.transform = `translateY(${-3 * k}px)`;
    });
  }
  const QUICK_NORMAL = ["Shorter", "More formal", "Friendlier", "Bullet points"];
  const QUICK_AI = ["Shorter", "More detail", "Examples", "Step by step"];
  function setResult(h, id, text, quick, primary, u, a, b) {
    const shown = Math.floor(text.length * eOut(seg(u, a, b)));
    const key = `res:${id}:${shown}`;
    if (h.key === key) return;
    h.key = key;
    h.body.innerHTML = `<div class="wn-draft">${esc(text.slice(0, shown))}<span style="visibility:hidden">${esc(text.slice(shown))}</span></div>` +
      (quick ? `<div class="wn-quick">${quick.map((q) => `<button class="wn-chip" type="button">${q}</button>`).join("")}</div>
        <form class="wn-ask"><button type="button" class="wn-icon-btn wn-icon-btn-soft">${ICON.mic}</button><input class="wn-ask-input" placeholder="Ask for a change, or tap the mic"><button type="button" class="wn-icon-btn wn-icon-btn-solid">${ICON.send}</button></form>` : "") +
      `<footer class="wn-actions"><button class="wn-btn wn-btn-quiet" type="button">Discard</button><button class="wn-btn wn-btn-primary" type="button">${primary}</button></footer>`;
  }
  function placeCard(h, anchor, alpha, rise) {
    const c = h.card; c.style.opacity = alpha;
    const height = c.offsetHeight;
    const top = anchor.mode === "above" ? anchor.y - height : anchor.y;
    c.style.left = anchor.x + "px";
    c.style.top = (top + (1 - rise) * 12) + "px";
    c.style.transform = `scale(${0.97 + 0.03 * rise})`;
    c.style.transformOrigin = anchor.mode === "above" ? "0 100%" : "0 0";
  }
  function placeLauncher(h, right, y, alpha, rise) {
    const l = h.launcher; l.style.opacity = alpha;
    l.style.left = (right - l.offsetWidth) + "px";
    l.style.top = (y + (1 - rise) * 8) + "px";
    l.style.transform = `scale(${0.94 + 0.06 * rise})`;
    l.style.transformOrigin = "100% 100%";
  }

  // ------------------------------------------------------------ mock pages
  const barHTML = (title, appIcon) => `<div class="d-bar"><i></i><i></i><i></i>${appIcon ? `<img src="apps/${appIcon}" alt="">` : ""}<span>${title}</span></div>`;
  function mailPage(scene) {
    scene.insertAdjacentHTML("afterbegin", `${barHTML("Gmail · New message", "gmail.svg")}<div class="d-row">To <b>Priya Sharma</b></div><div class="d-row">Subject <b>Quarterly report</b></div><div class="d-text" style="top:140px"></div>`);
    return { text: scene.querySelector(".d-text"), launcher: { right: W - 24, y: 312 }, card: { x: 24, y: 276, mode: "below" } };
  }
  function aiPage(scene, withTitle, bar) {
    scene.insertAdjacentHTML("afterbegin", `${barHTML(bar[0], bar[1])}
      ${withTitle ? '<div class="d-title" style="top:50px">What can I help you with?<small>Describe it however it comes to mind</small></div>' : ""}
      <div class="d-composer" style="left:70px;top:${withTitle ? 350 : 396}px;width:620px;height:${withTitle ? 130 : 104}px"><div class="d-text"></div><div class="d-send">${ARROW_UP}</div></div>`);
    // Without the page heading the box sits lower, leaving room above it for the "You say" note and the card.
    return { text: scene.querySelector(".d-text"), launcher: { right: 682, y: withTitle ? 298 : 344 }, card: { x: 70, y: withTitle ? 338 : 384, mode: "above" } };
  }
  function chatPage(scene) {
    scene.insertAdjacentHTML("afterbegin", `${barHTML("Slack · #team", "slack.svg")}
      <div class="d-bubble">Can you send me the update by tonight?</div>
      <div class="d-composer" style="left:24px;top:414px;width:712px;height:86px"><div class="d-text"></div><div class="d-send">${ARROW_RIGHT}</div></div>`);
    return { text: scene.querySelector(".d-text"), launcher: { right: 726, y: 362 }, card: { x: 24, y: 402, mode: "above" } };
  }
  const caretOn = (u) => Math.floor(u * 2.2) % 2 === 0;
  function setFieldText(el, shown, hl, caret, placeholder) {
    el.innerHTML = shown
      ? `<span class="d-hl" style="background:rgba(255,204,51,${0.55 * hl})">${esc(shown)}</span>${caret ? '<span class="d-caret"></span>' : ""}`
      : `${caret ? '<span class="d-caret"></span>' : ""}<span style="color:#B5B5B0">${placeholder || ""}</span>`;
  }

  // ------------------------------------------------------------ scenes
  const scenes = [];
  function newScene() {
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;inset:0;opacity:0;visibility:hidden;";
    demo.insertBefore(el, ripple);
    return el;
  }
  function envelope(u, L) { return eOut(seg(u, 0, 0.35)) * (1 - eInOut(seg(u, L - 0.45, L))); }

  // Fix on a normal page, and Enhance on an AI page: type, tap, review, replace.
  function writeScene(kind) {
    const scene = newScene();
    const isAi = kind === "enhance";
    const page = isAi ? aiPage(scene, true, ["ChatGPT", "chatgpt.png"]) : mailPage(scene);
    const h = makeUI(scene, isAi ? "Enhance" : "Fix");
    const goalWord = isAi ? "Enhance" : "Fix";
    const IN = isAi ? "write blog about saving money for college students" : "hi priya, i has finish the quarterly report yesterday and will sending it tomoro morning after final check. let me know if u need anything else";
    const OUT = isAi ? "Write a friendly 600-word blog post for college students about saving money. Give five practical tips with real examples, and end with a short checklist." : "Hi Priya, I finished the quarterly report yesterday and will send it tomorrow morning after a final check. Let me know if you need anything else.";
    const T = { type: [0.5, 2.6], pill: 2.9, move1: [3.3, 3.9], click1: 4.0, result: 4.9, move2: [5.7, 6.3], click2: 6.4, replaced: 6.45, cardOut: [6.6, 6.95] };
    const L = 9.4;
    const clicks = [T.click1, T.click2];
    scenes.push({
      L, scene,
      update(u) {
        const a = envelope(u, L);
        scene.style.opacity = a; scene.style.visibility = a > 0.001 ? "visible" : "hidden";
        const replaced = u >= T.replaced;
        const hl = replaced ? 1 - seg(u, T.replaced, T.replaced + 1.0) : 0;
        const shown = replaced ? OUT : typed(IN, u, T.type[0], T.type[1]);
        setFieldText(page.text, shown, hl, (!replaced && u < T.click1 + 0.2 && (u < T.type[1] || caretOn(u))) || (replaced && caretOn(u)), isAi ? "Ask anything" : "");
        const lAlpha = eOut(seg(u, T.pill, T.pill + 0.35)) * (1 - seg(u, T.click1 + 0.02, T.click1 + 0.18));
        placeLauncher(h, page.launcher.right, page.launcher.y, lAlpha * a, eBack(seg(u, T.pill, T.pill + 0.45)));
        h.title.textContent = goalWord;
        const cardIn = eOut(seg(u, T.click1 + 0.05, T.click1 + 0.4));
        const cardA = cardIn * (1 - eInOut(seg(u, T.cardOut[0], T.cardOut[1])));
        if (u < T.result) { setBody(h, "work", workingHTML(isAi ? "Enhancing…" : "Fixing…")); animateDots(h, u); }
        else setResult(h, "r", OUT, null, "Replace", u, T.result, T.result + 0.9);
        placeCard(h, page.card, cardA * a, cardIn);
        const moves = [
          { t: T.move1, to: () => centerOf(h.primary) },
          { t: T.move2, to: () => centerOf(h.card.querySelector(".wn-btn-primary") || h.card) }
        ];
        const pos = pathPos(u, moves, { x: W - 120, y: H - 80 });
        drawCursor(pos, eOut(seg(u, T.move1[0] - 0.4, T.move1[0])) * (1 - eInOut(seg(u, T.cardOut[0], T.cardOut[1]))) * a);
        drawRipple(u, clicks, pos);
        hover([[h.primary, pressed(u, [T.click1])], [h.card.querySelector(".wn-btn-primary"), pressed(u, [T.click2])]], pos);
      }
    });
  }

  // Flow: listen, tidy, change, insert. On AI apps the result is a prompt; elsewhere a message.
  function flowScene(kind) {
    const scene = newScene();
    const isAi = kind === "flow-ai";
    const page = isAi ? aiPage(scene, false, ["Claude", "claude.png"]) : chatPage(scene);
    const h = makeUI(scene, isAi ? "Enhance" : "Fix");
    const BARS = 28;
    const SPEECH = isAi
      ? [{ w: "um", f: 1 }, { w: "so i want a blog about saving money" }, { w: "for like college students," }, { w: "make it friendly," }, { w: "five tips and a checklist at the end" }]
      : [{ w: "um", f: 1 }, { w: "tell priya i'll send the update" }, { w: "by six tonight," }, { w: "sorry for the delay" }];
    const DRAFT = isAi
      ? "Write a friendly blog post for college students about saving money. Give five practical tips with real examples, and end with a short checklist."
      : "Hi Priya, I'll send you the update by 6:00 PM tonight. Sorry for the delay, and thanks for your patience.";
    const SHORT = isAi
      ? "Write a short, friendly blog post for college students with five money-saving tips and a closing checklist."
      : "I'll send the update by 6 PM tonight. Sorry for the delay!";
    const QUICK = isAi ? QUICK_AI : QUICK_NORMAL;
    const T = { pill: 0.5, move1: [0.95, 1.55], click1: 1.65, listen: [1.7, 6.3], speech: [2.0, 5.7], move2: [5.9, 6.4], click2: 6.5, result: 7.4, move3: [8.4, 9.0], click3: 9.1, result2: 9.9, move4: [10.6, 11.2], click4: 11.3, inserted: 11.35, cardOut: [11.5, 11.85] };
    const L = 14.0;
    const total = SPEECH.reduce((n, x) => n + x.w.length, 0);
    let acc = 0;
    const words = SPEECH.map((x) => { const a = acc / total; acc += x.w.length; return { a, b: acc / total, x }; });
    const say = document.createElement("div");
    say.className = "d-say";
    say.innerHTML = '<div class="lbl">You say</div><div class="txt"></div>';
    say.style.cssText = isAi ? "left:70px;top:24px;width:620px;" : "left:430px;top:150px;width:306px;";
    scene.appendChild(say);
    const sayTxt = say.querySelector(".txt");
    const level = (u) => {
      const p = (u - T.speech[0]) / (T.speech[1] - T.speech[0]);
      if (p < 0 || p > 1) return 0.04 + 0.03 * rnd(Math.floor(u * 9));
      let env = 0.12;
      for (const w of words) { const m = (w.a + w.b) / 2, half = (w.b - w.a) / 2, d = Math.abs(p - m) / half; if (d < 1) env = Math.max(env, 0.35 + 0.65 * (1 - d * d) * (0.75 + 0.25 * Math.sin(u * 26 + w.a * 40))); }
      return clamp(env * (0.8 + 0.2 * rnd(Math.floor(u * 22))));
    };
    const listenHTML = `
      <div class="wn-listen"><div class="wn-wave">${"<i></i>".repeat(BARS)}</div>
        <div class="wn-listen-meta"><span class="wn-rec-dot"></span><span class="wn-timer">0:00</span></div>
        <div class="wn-listen-hint">${isAi ? "Say what you want to ask. Rough is fine, Flow will turn it into a clear prompt." : "Say what's on your mind. Rough is fine, Flow will tidy it up."}</div></div>
      <footer class="wn-actions"><button class="wn-btn wn-btn-quiet" type="button">Type instead</button><button class="wn-btn wn-btn-primary" type="button">${ICON.check}<span>Done</span></button></footer>`;
    const clicks = [T.click1, T.click2, T.click3, T.click4];

    scenes.push({
      L, scene,
      update(u) {
        const a = envelope(u, L);
        scene.style.opacity = a; scene.style.visibility = a > 0.001 ? "visible" : "hidden";
        const ins = u >= T.inserted;
        const hl = ins ? 1 - seg(u, T.inserted, T.inserted + 1.0) : 0;
        setFieldText(page.text, ins ? SHORT : "", hl, caretOn(u) || ins, isAi ? "Ask anything" : "Message Priya…");

        // the "You say" note
        const sayA = eOut(seg(u, T.speech[0] - 0.4, T.speech[0])) * (1 - eInOut(seg(u, T.result, T.result + 0.5)));
        say.style.opacity = sayA * a;
        const sp = seg(u, T.speech[0], T.speech[1]);
        let html = "";
        words.forEach((w, idx) => {
          const word = w.x.w + (idx === words.length - 1 ? "”" : "");
          const n = clamp(Math.floor(word.length * seg(sp, w.a, w.a + (w.b - w.a) * 0.95)), 0, word.length);
          const inner = `${esc(word.slice(0, n))}<span class="rest">${esc(word.slice(n))}</span>`;
          html += (w.x.f && u >= T.result - 0.3 ? `<s>${inner}</s>` : inner) + " ";
        });
        sayTxt.innerHTML = "“" + html.trimEnd();

        const lAlpha = eOut(seg(u, T.pill, T.pill + 0.35)) * (1 - seg(u, T.click1 + 0.02, T.click1 + 0.18));
        placeLauncher(h, page.launcher.right, page.launcher.y, lAlpha * a, eBack(seg(u, T.pill, T.pill + 0.45)));

        const cardIn = eOut(seg(u, T.click1 + 0.05, T.click1 + 0.4));
        const cardA = cardIn * (1 - eInOut(seg(u, T.cardOut[0], T.cardOut[1])));
        if (u < T.listen[1] + 0.1) {
          h.title.textContent = "Flow · listening";
          setBody(h, "listen", listenHTML);
          h.body.querySelectorAll(".wn-wave i").forEach((b, i) => { b.style.transform = `scaleY(${0.12 + 0.88 * level(u - (BARS - 1 - i) * 0.06)})`; b.style.opacity = i < 8 ? 0.55 : 1; });
          const sec = Math.max(0, Math.floor(u - T.listen[0]));
          h.body.querySelector(".wn-timer").textContent = `0:${String(sec).padStart(2, "0")}`;
          h.body.querySelector(".wn-rec-dot").style.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(u * 5));
        } else if (u < T.result) {
          h.title.textContent = "Flow";
          setBody(h, "w1", workingHTML(isAi ? "Got it. Writing your prompt…" : "Got it. Writing…")); animateDots(h, u);
        } else if (u < T.click3 + 0.05) {
          h.title.textContent = "Flow";
          setResult(h, "f1", DRAFT, QUICK, isAi ? "Insert" : "Insert", u, T.result, T.result + 1.0);
        } else if (u < T.result2) {
          h.title.textContent = "Flow";
          setBody(h, "w2", workingHTML("Making the change…")); animateDots(h, u);
        } else {
          h.title.textContent = "Flow";
          setResult(h, "f2", SHORT, QUICK, "Insert", u, T.result2, T.result2 + 0.7);
        }
        placeCard(h, page.card, cardA * a, cardIn);

        const at = (sel, nth = 0) => () => centerOf(h.card.querySelectorAll(sel)[nth] || h.card);
        const moves = [
          { t: T.move1, to: () => centerOf(h.flowchip) },
          { t: T.move2, to: at(".wn-btn-primary") },
          { t: T.move3, to: at(".wn-quick .wn-chip", 0) },
          { t: T.move4, to: at(".wn-btn-primary") }
        ];
        const pos = pathPos(u, moves, { x: W - 120, y: H - 80 });
        drawCursor(pos, eOut(seg(u, T.move1[0] - 0.4, T.move1[0])) * (1 - eInOut(seg(u, T.cardOut[0], T.cardOut[1]))) * a);
        drawRipple(u, clicks, pos);
        hover([
          [h.flowchip, pressed(u, [T.click1])],
          [h.card.querySelector(".wn-btn-primary"), pressed(u, [T.click2, T.click4])],
          [h.card.querySelector(".wn-quick .wn-chip"), pressed(u, [T.click3])]
        ], pos);
      }
    });
  }

  writeScene("fix");
  writeScene("enhance");
  flowScene("flow-ai");
  flowScene("flow-normal");

  // ------------------------------------------------------------ player
  let current = -1;
  let startedAt = 0;
  let raf = 0;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hooks = { onProgress: null, onLoop: null };
  let looped = false;

  function frame(now) {
    const s = scenes[current];
    if (!s) return;
    const t = (now - startedAt) / 1000;
    s.update(t % s.L);
    if (hooks.onProgress) hooks.onProgress(Math.min(1, t / s.L));
    // One full run of the story has played: the tour may move on by itself.
    if (t >= s.L && !looped) {
      looped = true;
      if (hooks.onLoop) hooks.onLoop();
    }
    raf = requestAnimationFrame(frame);
  }

  function show(i) {
    cancelAnimationFrame(raf);
    if (current >= 0) { scenes[current].scene.style.visibility = "hidden"; scenes[current].scene.style.opacity = 0; }
    current = i;
    startedAt = performance.now();
    looped = false;
    cursor.style.opacity = 0; ripple.style.opacity = 0;
    if (reduced) {
      // A still frame of the finished result, instead of motion.
      const s = scenes[i];
      s.update(i < 2 ? 7.2 : 11.9);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  // seek() draws one still frame; used for testing the story at a chosen second.
  function seek(i, u) {
    cancelAnimationFrame(raf);
    if (current >= 0 && current !== i) { scenes[current].scene.style.visibility = "hidden"; scenes[current].scene.style.opacity = 0; }
    current = i;
    scenes[i].update(u);
  }

  window.WhynoDemo = {
    show, seek,
    set onProgress(fn) { hooks.onProgress = fn; },
    set onLoop(fn) { hooks.onLoop = fn; }
  };
})();
