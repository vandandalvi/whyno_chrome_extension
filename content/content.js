// Whyno Write content script.
//
// Draws a small Whyno button next to the text field you are typing in, and one
// card for everything that follows: working, the result, follow-ups, errors and
// sign-in. Everything lives in a closed-off shadow root fixed to the viewport, so
// the page's styles cannot reach it and it never shifts the page's layout.

(function () {
  if (window.__whynoWriteInjected) return;
  window.__whynoWriteInjected = true;

  // Whyno's own site hosts the sign-in page, and sign-in pages (Google's included)
  // are left alone. The dev harness sets __WHYNO_HARNESS__ to run on localhost.
  const host = window.location.hostname;
  const SKIP_HOSTS = ["whyno.tech", "localhost", "127.0.0.1", "accounts.google.com", "myaccount.google.com", "accounts.youtube.com"];
  const isPracticePage = host.replace(/^www\./, "") === "whyno.tech" && window.location.pathname.startsWith("/try");
  if (!window.__WHYNO_HARNESS__ && !isPracticePage && SKIP_HOSTS.some((h) => host === h || host.endsWith("." + h))) return;
  const siteKey = host.replace(/^www\./, "");
  const KEYS = CONFIG.STORAGE_KEYS;

  // ---------------------------------------------------------------- icons

  const svg = (d, extra = "") =>
    `<svg class="wn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}/></svg>`;
  const ICONS = {
    wand: svg("M4 20 L14.5 9.5 M14 4 v3 M12.5 5.5 h3 M19 9 v2 M18 10 h2"),
    wave: svg("M4 10 v4 M8 7 v10 M12 4 v16 M16 7 v10 M20 10 v4"),
    close: svg("M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5"),
    send: svg("M5 12 h13 M13 6 l6 6 -6 6"),
    mic: svg("M12 3.5 a3 3 0 0 1 3 3 v5 a3 3 0 0 1 -6 0 v-5 a3 3 0 0 1 3 -3 Z M5.5 11 a6.5 6.5 0 0 0 13 0 M12 17.5 v3"),
    check: svg("M5 12.5 L10 17.5 L19 7"),
    dots: svg("M5 12 h.01 M12 12 h.01 M19 12 h.01"),
    thumbDown: svg("M17 14V2 M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"),
    snippet: svg("M5 5 h14 v14 h-14 Z M8.5 9.5 h7 M8.5 13 h5"),
    reset: svg("M4 12 a8 8 0 1 0 2.6 -5.9 M4 4 v5 h5"),
    hide: svg("M3 3 l18 18 M10.6 6.1 A9.5 9.5 0 0 1 12 6 c5 0 9 6 9 6 a16 16 0 0 1 -3 3.6 M6.6 6.6 A16 16 0 0 0 3 12 s4 6 9 6 a9 9 0 0 0 3.4 -.7"),
    alert: svg("M12 8 v5 M12 16.5 v.5 M10.3 3.9 L2.5 18 a2 2 0 0 0 1.7 3 h15.6 a2 2 0 0 0 1.7 -3 L13.7 3.9 a2 2 0 0 0 -3.4 0 Z"),
    google:
      '<svg class="wn-icon wn-google" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.95l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>'
  };
  const LOGO_URL = chrome.runtime.getURL("icons/icon48.png");
  const SIGN_IN_URL = "https://whyno.tech/extension";

  const QUICK_CHANGES = [
    ["Shorter", "Make it shorter and more to the point. Keep every important detail."],
    ["More formal", "Make the tone more formal and professional."],
    ["Friendlier", "Make the tone warmer and more casual."],
    ["Bullet points", "Turn it into short bullet points."],
    ["Translate", "__translate__"]
  ];

  // One-tap tones under a Fix result.
  const QUICK_FIX = [
    ["Casual", "Make the tone more casual and relaxed. Keep the meaning and every detail."],
    ["Professional", "Make the tone more professional and polished. Keep the meaning and every detail."],
    ["Shorter", "Make it shorter and more to the point. Keep every important detail."],
    ["Translate", "__translate__"]
  ];

  // The languages Translate offers.
  const LANGUAGES = ["English", "Hindi", "Marathi", "Gujarati", "Spanish", "French"];

  // On AI apps Flow writes a prompt for the assistant instead of a message to a person,
  // so its one-tap changes are about the prompt too.
  const QUICK_CHANGES_AI = [
    ["Shorter", "Make the prompt shorter and more direct. Keep every important requirement."],
    ["More detail", "Add more useful detail: context, constraints and the output format wanted."],
    ["Examples", "Ask for concrete examples in the answer."],
    ["Step by step", "Ask for the answer as clear numbered steps."],
    ["Translate", "__translate__"]
  ];

  // ---------------------------------------------------------------- shadow root

  const hostEl = document.createElement("whyno-write-host");
  // Fixed, zero-size and above everything: it never takes space in the page.
  hostEl.style.cssText = "position:fixed!important;top:0!important;left:0!important;width:0!important;height:0!important;z-index:2147483647!important;display:none!important;";
  document.documentElement.appendChild(hostEl);
  // Closed in real use; open on the dev test page so it can be inspected.
  const shadow = hostEl.attachShadow({ mode: window.__WHYNO_HARNESS__ ? "open" : "closed" });

  // Stay invisible until the styles have loaded. Some sites' security policies block
  // them, and an unstyled panel would spill raw text over the page; then nothing shows.
  let stylesLoaded = 0;
  for (const href of ["styles/tokens.css", "content/content.css"]) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL(href);
    link.addEventListener("load", () => {
      stylesLoaded += 1;
      if (stylesLoaded === 2) hostEl.style.setProperty("display", "block", "important");
    }, { once: true });
    shadow.appendChild(link);
  }

  const root = document.createElement("div");
  root.className = "wn-root";
  root.innerHTML = `
    <div class="wn-launcher" part="launcher" hidden>
      <img class="wn-logo wn-grip" src="${LOGO_URL}" alt="" draggable="false" title="Drag to move. Double-click to put it back.">
      <button class="wn-chip wn-primary-action" type="button" data-action="write"></button>
      <button class="wn-chip" type="button" data-action="flow" title="Flow (Alt+Shift+V)">${ICONS.wave}<span>Flow</span></button>
      <button class="wn-more" type="button" data-action="more" aria-label="More options">${ICONS.dots}</button>
      <div class="wn-done"><span class="wn-toast-tick">${ICONS.check}</span><span class="wn-done-text">Done</span><button class="wn-btn wn-btn-quiet wn-undo" type="button" data-action="undo">Undo</button></div>
    </div>
    <div class="wn-menu" role="menu" hidden></div>
    <div class="wn-toast" role="status" hidden></div>
    <section class="wn-card" role="dialog" aria-label="Whyno Write" hidden>
      <header class="wn-card-head">
        <img class="wn-logo" src="${LOGO_URL}" alt="">
        <div class="wn-title"></div>
        <div class="wn-quota"></div>
        <button class="wn-icon-btn" type="button" data-action="close" aria-label="Close">${ICONS.close}</button>
      </header>
      <div class="wn-card-body"></div>
    </section>
  `;
  shadow.appendChild(root);

  const launcher = root.querySelector(".wn-launcher");
  const primaryChip = root.querySelector(".wn-primary-action");
  const card = root.querySelector(".wn-card");
  const cardTitle = root.querySelector(".wn-title");
  const cardQuota = root.querySelector(".wn-quota");
  const cardBody = root.querySelector(".wn-card-body");
  const menu = root.querySelector(".wn-menu");
  const toast = root.querySelector(".wn-toast");
  const doneText = root.querySelector(".wn-done-text");
  const undoBtn = root.querySelector(".wn-undo");

  // ---------------------------------------------------------------- state

  let field = null;          // the text field the person is working in
  let saved = null;          // what was selected when they tapped, so it can be replaced exactly
  let mode = "normal";       // "ai" shows Enhance, "normal" shows Fix
  let draft = "";            // the current proposal
  let feature = "Fix";       // "Fix" | "Enhance" | "Flow"
  let busy = false;
  let hideTimer = null;
  let listening = null;      // { followUp, startedAt } while Flow is recording
  let caret = null;          // where the cursor was, for inserting a spoken draft
  let replaceField = false;  // Flow from the field's own text replaces it; spoken Flow inserts
  let listenTimer = null;
  let micJustAllowed = false; // true from "Microphone is on" until Flow listens, to catch a grant that did not stick
  const BARS = 28;
  const prefs = { hidden: false, offset: null, sounds: false, historyOn: true, calm: false, reply: true, snippets: [] };
  let replyTo = "";           // the message being answered, read from the page when Flow starts, shown on the card
  let lastInput = "";         // what the last result was made from, for a report
  let viaKeyboard = false;    // started with a shortcut: focus follows the card, so Enter and Esc work
  let peeking = false;
  let session = 0;            // changes whenever the card opens, so a slow reply for an earlier card is ignored
  let original = "";          // the text Fix or Enhance started from, to mark what changed
  let currentKind = "message"; // what a one-tap change should produce: a message, or a prompt for an AI app
  let currentQuick = null;    // the tone chips under the result
  let resultOpts = { isFlow: false };
  let showChanges = true;
  let launcherWanted = false; // the box is focused, so the button belongs on screen
  let dragging = false;
  let justDragged = false;
  let toastTimer = null;
  let focusTimer = null;
  let pillNoteTimer = null;   // how long the button shows "Done, Undo"
  let pillUndo = null;
  let pillNoteSince = 0;

  const writeLabel = () => (mode === "ai" ? "Enhance" : "Fix");
  const quickChanges = () => (mode === "ai" ? QUICK_CHANGES_AI : QUICK_CHANGES);
  // What Flow should produce: a prompt for an AI app, a message for everywhere else.
  const flowKind = () => (mode === "ai" ? "prompt" : "message");

  function refreshMode() {
    send({ type: "GET_USER" }).then((res) => {
      mode = SITES_REGISTRY.getMode(window.location.hostname, (res && res.modeOverride) || "auto");
      primaryChip.innerHTML = `${ICONS.wand}<span>${writeLabel()}</span>`;
      primaryChip.title = `${writeLabel()} (Alt+Shift+F)`;
    });
  }
  refreshMode();
  chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.addListener(() => {
    refreshMode();
    loadPrefs();
  });

  function send(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (res) => {
          void chrome.runtime.lastError;
          resolve(res);
        });
      } catch (_) {
        // The extension was reloaded; this page's copy of the script is now orphaned.
        resolve({ ok: false, error: "extension_reloaded", message: "Whyno Write was updated. Reload this page to keep using it." });
      }
    });
  }

  // ---------------------------------------------------------------- placement

  /** Where [el] goes next to [rect]: above if there is room, else below, else tucked inside its top corner. */
  function spot(el, rect, { gap = 8, preferAbove = true, alignRight = true, offset = null } = {}) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = alignRight ? rect.right - w : rect.left;
    left = Math.max(12, Math.min(left, vw - w - 12));
    const roomAbove = rect.top - gap - 12;
    const roomBelow = vh - rect.bottom - gap - 12;
    let top;
    if (preferAbove && roomAbove >= h) top = rect.top - gap - h;
    else if (roomBelow >= h) top = rect.bottom + gap;
    else if (roomAbove >= h) top = rect.top - gap - h;
    else top = rect.top + gap; // a field that fills the window: sit inside it, top corner
    top = Math.max(12, Math.min(top, vh - h - 12));
    if (offset) {
      // Where the person dragged it to, as a distance from the normal spot, so it still follows the box.
      left = Math.max(8, Math.min(left + offset.dx, vw - w - 8));
      top = Math.max(8, Math.min(top + offset.dy, vh - h - 8));
    }
    return { left, top };
  }

  function place(el, rect, opts) {
    const at = spot(el, rect, opts);
    el.style.left = `${Math.round(at.left)}px`;
    el.style.top = `${Math.round(at.top)}px`;
  }

  /**
   * The box the person sees around the field. Chat sites type into a thin inner element and draw the
   * rounded composer one or two levels up; placing the button against the inner element leaves it
   * overlapping the text and the site's own buttons. So climb to the visible box, within sensible limits.
   */
  function anchorRect() {
    if (!field || !document.contains(field)) return null;
    const base = field.getBoundingClientRect();
    let best = base;
    let node = field.parentElement;
    for (let i = 0; i < 6 && node && node !== document.body && node !== document.documentElement; i++, node = node.parentElement) {
      const r = node.getBoundingClientRect();
      if (r.width < base.width - 2 || r.height < base.height - 2) break;
      if (r.width > base.width + 280 || r.width > window.innerWidth * 0.96 || r.height > Math.max(base.height * 4, 320)) break;
      const cs = getComputedStyle(node);
      const hasBackground = cs.backgroundColor && !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(cs.backgroundColor);
      const boxy = parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== "none" || hasBackground || parseFloat(cs.borderTopLeftRadius) >= 10;
      if (boxy) best = r;
    }
    return best;
  }

  function fieldRect() {
    return anchorRect();
  }

  function reposition() {
    const rect = fieldRect();
    if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
      launcher.hidden = true;
      closeMenu();
      return;
    }
    if (!card.hidden) place(card, rect, { preferAbove: true, alignRight: false });
    else {
      // Scrolled back into view: the button returns by itself.
      if (launcherWanted && launcher.hidden && !prefs.hidden) launcher.hidden = false;
      if (!launcher.hidden && !dragging) place(launcher, rect, { gap: 6, preferAbove: true, alignRight: true, offset: prefs.offset });
    }
    if (!menu.hidden) placeMenu();
    if (!toast.hidden) placeToast(rect);
  }

  let rafPending = false;
  const scheduleReposition = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      reposition();
    });
  };
  window.addEventListener("scroll", scheduleReposition, true);
  window.addEventListener("resize", scheduleReposition);
  // The box grows as people type, and sites animate their layout: follow it while something is showing.
  document.addEventListener("input", () => {
    scheduleReposition();
    // Typing again means they have moved on: the normal button returns (a moment's grace for the editor's own echo of our text).
    if (launcher.classList.contains("show-done") && Date.now() - pillNoteSince > 1000) endPillNote();
  }, true);
  setInterval(() => {
    if (!launcher.hidden || !card.hidden) scheduleReposition();
  }, 250);

  // ---------------------------------------------------------------- launcher

  function showLauncher() {
    if (!field || !card.hidden || prefs.hidden) return;
    clearTimeout(hideTimer);
    launcherWanted = true;
    detectTheme();
    launcher.hidden = false;
    reposition();
  }

  function hideLauncherSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      launcherWanted = false;
      launcher.hidden = true;
      closeMenu();
    }, 150);
  }

  function fieldHasText(el) {
    const value = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : el.innerText;
    return !!(value && value.trim());
  }

  document.addEventListener("focusin", (e) => {
    const el = e.composedPath ? e.composedPath()[0] : e.target;
    if (SITES_REGISTRY.isEditable(el) && !isSensitive(el)) {
      field = el;
      clearTimeout(focusTimer);
      if (prefs.hidden) return;
      // A box that already has text gets the button at once. An empty one waits half a second,
      // so it does not flash up while a page is still loading or tabbing past.
      focusTimer = setTimeout(() => {
        if (field === el) showLauncher();
      }, fieldHasText(el) ? 120 : 500);
    }
  }, true);

  document.addEventListener("focusout", (e) => {
    clearTimeout(focusTimer);
    if (e.target === field) hideLauncherSoon();
  }, true);

  // Fields where AI help would be wrong or unsafe.
  function isSensitive(el) {
    if (el instanceof HTMLInputElement) {
      const type = (el.type || "").toLowerCase();
      if (["password", "email", "tel", "number", "url"].includes(type)) return true;
      const ac = (el.autocomplete || "").toLowerCase();
      if (ac.includes("cc-") || ac.includes("password") || ac.includes("one-time-code")) return true;
    }
    return false;
  }

  // Tapping inside our UI must not take focus or the selection away from the page's field.
  root.addEventListener("mousedown", (e) => {
    const target = e.composedPath()[0];
    if (!(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) e.preventDefault();
  });

  launcher.addEventListener("click", (e) => {
    if (justDragged) return;
    // While it says "Done", a tap anywhere on it other than Undo puts the normal button back.
    if (launcher.classList.contains("show-done") && !e.target.closest(".wn-undo")) {
      endPillNote();
      return;
    }
    const button = e.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "more") return menu.hidden ? openMenu() : closeMenu();
    if (button.dataset.action === "undo") {
      const run = pillUndo;
      endPillNote();
      if (run) run();
      return;
    }
    closeMenu();
    capture();
    if (button.dataset.action === "flow") startFlow();
    else startWriting(writeLabel());
  });

  // Drag the logo to move the button. The place is remembered for this site, and the button still follows the box.
  launcher.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !e.target.closest(".wn-grip")) return;
    const start = { x: e.clientX, y: e.clientY };
    const box = launcher.getBoundingClientRect();
    const grab = { x: e.clientX - box.left, y: e.clientY - box.top };
    let moved = false;
    try { launcher.setPointerCapture(e.pointerId); } catch (_) {}

    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
      moved = true;
      dragging = true;
      closeMenu();
      launcher.classList.add("is-dragging");
      const w = launcher.offsetWidth;
      const h = launcher.offsetHeight;
      launcher.style.left = `${Math.max(8, Math.min(ev.clientX - grab.x, window.innerWidth - w - 8))}px`;
      launcher.style.top = `${Math.max(8, Math.min(ev.clientY - grab.y, window.innerHeight - h - 8))}px`;
    };
    const up = (ev) => {
      launcher.removeEventListener("pointermove", move);
      launcher.removeEventListener("pointerup", up);
      launcher.removeEventListener("pointercancel", up);
      try { launcher.releasePointerCapture(ev.pointerId); } catch (_) {}
      launcher.classList.remove("is-dragging");
      dragging = false;
      if (!moved) return;
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 60);
      const rect = fieldRect();
      if (!rect) return;
      const home = spot(launcher, rect, { gap: 6, preferAbove: true, alignRight: true });
      const now = launcher.getBoundingClientRect();
      prefs.offset = { dx: Math.round(now.left - home.left), dy: Math.round(now.top - home.top) };
      saveOffset();
    };
    launcher.addEventListener("pointermove", move);
    launcher.addEventListener("pointerup", up);
    launcher.addEventListener("pointercancel", up);
  });

  launcher.addEventListener("dblclick", (e) => {
    if (e.target.closest(".wn-grip")) resetPosition();
  });

  function saveOffset() {
    try {
      chrome.storage.local.get([KEYS.PILL_OFFSETS], (r) => {
        const all = (r && r[KEYS.PILL_OFFSETS]) || {};
        if (prefs.offset) all[siteKey] = prefs.offset;
        else delete all[siteKey];
        chrome.storage.local.set({ [KEYS.PILL_OFFSETS]: all });
      });
    } catch (_) {}
  }

  function resetPosition() {
    prefs.offset = null;
    saveOffset();
    launcher.classList.add("settle");
    reposition();
    setTimeout(() => launcher.classList.remove("settle"), 340);
  }

  // A small menu on the button: hide it on this site, put it back.
  function openMenu() {
    menu.innerHTML = `
      ${prefs.snippets.length ? `<div class="wn-menu-note">Snippets</div>` + prefs.snippets.slice(0, 5).map((sn, i) => `<button class="wn-menu-item" type="button" data-snippet="${i}">${ICONS.snippet}<span>${escape(sn.name)}</span></button>`).join("") + `<div class="wn-menu-sep"></div>` : ""}
      <button class="wn-menu-item" type="button" data-menu="hide">${ICONS.hide}<span>Hide on this site</span></button>
      <button class="wn-menu-item" type="button" data-menu="reset">${ICONS.reset}<span>Reset position</span></button>
      <div class="wn-menu-note">Drag the logo to move this button anywhere. Shortcuts: Alt+Shift+F to ${writeLabel()}, Alt+Shift+V for Flow. Save snippets in the Whyno popup.</div>`;
    menu.hidden = false;
    launcher.classList.add("menu-open");
    placeMenu();
  }

  function closeMenu() {
    menu.hidden = true;
    launcher.classList.remove("menu-open");
  }

  function placeMenu() {
    const r = launcher.getBoundingClientRect();
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    const left = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12));
    let top = r.top - h - 8;
    if (top < 12) top = r.bottom + 8;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }

  menu.addEventListener("click", (e) => {
    const item = e.target.closest("button");
    if (!item) return;
    closeMenu();
    if (item.dataset.snippet !== undefined) return insertSnippet(prefs.snippets[Number(item.dataset.snippet)]);
    if (item.dataset.menu === "reset") resetPosition();
    if (item.dataset.menu === "hide") hideOnThisSite();
  });

  /** A saved snippet goes in where the cursor is, with the same Done and Undo as any other text. */
  function insertSnippet(snippet) {
    if (!snippet || !snippet.text) return;
    capture();
    const target = liveField();
    if (!target) return;
    const before = fieldText(target);
    if (insertAtCaret(snippet.text)) afterReplace({ field: target, before, after: snippet.text });
    else copyInstead(snippet.text);
  }

  function hideOnThisSite() {
    prefs.hidden = true;
    launcher.hidden = true;
    try {
      chrome.storage.local.get([KEYS.HIDDEN_SITES], (r) => {
        const list = (r && r[KEYS.HIDDEN_SITES]) || [];
        if (!list.includes(siteKey)) list.push(siteKey);
        chrome.storage.local.set({ [KEYS.HIDDEN_SITES]: list });
      });
    } catch (_) {}
    showToast({ text: "Hidden on this site. Turn it back on from the Whyno icon in your toolbar.", ms: 6000, tick: false });
  }

  /** The button turns into "Done, Undo" for a few seconds, right where the person is looking. */
  function pillNote(text, undoFn, ms) {
    clearTimeout(pillNoteTimer);
    clearTimeout(hideTimer);
    pillUndo = undoFn || null;
    doneText.textContent = text;
    undoBtn.hidden = !undoFn;
    launcherWanted = true;
    detectTheme();
    pillNoteSince = Date.now();
    launcher.classList.add("show-done");
    launcher.hidden = false;
    reposition();
    pillNoteTimer = setTimeout(endPillNote, ms);
  }

  function endPillNote() {
    clearTimeout(pillNoteTimer);
    pillUndo = null;
    launcher.classList.remove("show-done");
    if (field && document.activeElement !== field && !field.contains(document.activeElement)) {
      launcherWanted = false;
      launcher.hidden = true;
    }
    reposition();
  }

  // A short note near the box, for things the button cannot say: a nudge, or "hidden on this site".
  function showToast({ text, actions = [], ms = 6000, tick = true }) {
    clearTimeout(toastTimer);
    toast.innerHTML =
      (tick ? `<span class="wn-toast-tick">${ICONS.check}</span>` : "") +
      `<span>${escape(text)}</span>` +
      actions.map((a, i) => `<button class="wn-btn ${a.primary ? "wn-btn-primary" : "wn-btn-quiet"}" type="button" data-toast="${i}">${escape(a.label)}</button>`).join("") +
      `<button class="wn-icon-btn" type="button" data-toast="x" aria-label="Dismiss">${ICONS.close}</button>`;
    toast._actions = actions;
    toast.hidden = false;
    placeToast(fieldRect());
    toastTimer = setTimeout(hideToast, ms);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toast.hidden = true;
  }

  function placeToast(rect) {
    const at = rect || { top: window.innerHeight - 90, bottom: window.innerHeight - 50, left: 12, right: window.innerWidth - 12 };
    place(toast, at, { gap: 10, preferAbove: false, alignRight: true });
  }

  toast.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const which = b.dataset.toast;
    const action = which === "x" ? null : (toast._actions || [])[Number(which)];
    hideToast();
    if (action) action.fn();
  });

  /** Follow the page's own light or dark, so the button never looks out of place. */
  function detectTheme() {
    let dark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    let el = field && document.contains(field) ? field : document.body;
    while (el && el.nodeType === 1) {
      const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const [r, g, b, a = 1] = m[1].split(",").map(Number);
        if (a > 0.5) {
          dark = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
          break;
        }
      }
      el = el.parentElement;
    }
    root.dataset.theme = dark ? "dark" : "light";
  }

  /** Little extras that make a replace feel finished: a glow on the box, an optional soft tick. */
  function flashField() {
    const r = anchorRect();
    if (!r) return;
    const glow = document.createElement("div");
    glow.className = "wn-flash";
    glow.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`;
    root.appendChild(glow);
    setTimeout(() => glow.remove(), 1200);
  }

  function tick() {
    if (!prefs.sounds) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1500;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      setTimeout(() => ctx.close(), 300);
    } catch (_) {}
  }

  /** Remembers the field and what is selected in it at the moment of the tap. */
  function capture() {
    if (!field) field = SITES_REGISTRY.findTargetInput(document, window.location.hostname);
    saved = null;
    caret = null;
    if (!field) return;
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      const { selectionStart: s, selectionEnd: e } = field;
      if (typeof s === "number") caret = { kind: "input", start: s, end: typeof e === "number" ? e : s };
      if (typeof s === "number" && typeof e === "number" && s !== e) {
        saved = { kind: "input", start: s, end: e, text: field.value.slice(s, e) };
      }
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && field.contains(sel.anchorNode)) {
        // Keep the position as a character count, not a live Range: rich editors such as WhatsApp's
        // rebuild their nodes while the person speaks, and a stored Range then points at nothing.
        const range = sel.getRangeAt(0);
        caret = { kind: "offset", offset: textOffset(field, range.startContainer, range.startOffset) };
        if (!sel.isCollapsed) saved = { kind: "range", range: range.cloneRange(), text: sel.toString() };
      }
    }
  }

  /** Characters of text before a point inside [root]. Counted the same way pointAt() walks them back. */
  function textOffset(root, node, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (text === node) return count + Math.min(offset, text.length);
      count += text.length;
    }
    return count;
  }

  /** The point [offset] characters into [root]'s text, or the end if the text has got shorter. */
  function pointAt(root, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let left = offset;
    let last = null;
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (left <= text.length) return { node: text, offset: left };
      left -= text.length;
      last = text;
    }
    return last ? { node: last, offset: last.length } : { node: root, offset: root.childNodes.length };
  }

  /** True when there is at least one letter or digit: not empty, and not just a full stop from a silent recording. */
  const hasWords = (text) => /[\p{L}\p{N}]/u.test(text || "");

  // The model sometimes answers the person ("please provide the notes") instead of writing. Never show that as a result.
  const NON_ANSWER = /(it looks like you (sent|provided|entered|have not|haven't)|empty message|i am ready to help|i'm ready to help|please provide (the |your )?(speech |rough )?(notes|text|thoughts|instructions|input)|no (usable )?(content|notes|text) (was|were|has been) provided)/i;
  const looksLikeNonAnswer = (out) => !out || !out.trim() || out.trim().toUpperCase() === "NO_CONTENT" || NON_ANSWER.test(out.slice(0, 220));

  const same = (a, b) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

  /** All the text in the box, however the site builds it. */
  function fieldText(f = field) {
    if (!f) return "";
    return f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement ? f.value : f.innerText || "";
  }

  function currentText() {
    if (saved) return saved.text;
    return field ? (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.value : field.innerText || "") : "";
  }

  /** The field to write into: the one captured, or, if the site rebuilt it while Flow was listening, the one that is there now. */
  function liveField() {
    if (field && field.isConnected) return field;
    const active = document.activeElement;
    if (active && SITES_REGISTRY.isEditable(active)) return active;
    return SITES_REGISTRY.findTargetInput(document, window.location.hostname);
  }

  /** Puts [text] in at the remembered cursor (or over the selection), leaving the rest of the field alone. */
  function insertAtCaret(text) {
    field = liveField();
    if (!field) return false;
    field.focus();
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      const value = field.value || "";
      // A cursor sitting at the very start of a box that has text is almost never a choice: add to the end, not on top.
      const atTop = caret && caret.start === 0 && caret.end === 0 && value.trim().length > 0;
      const start = caret && !atTop ? caret.start : value.length;
      const end = caret && !atTop ? caret.end : value.length;
      const before = value.slice(0, start);
      const spacer = before && !/\s$/.test(before) ? " " : "";
      const updated = before + spacer + text + value.slice(end);
      const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(field, updated);
      const pos = before.length + spacer.length + text.length;
      field.setSelectionRange(pos, pos);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    const explicit = !!(caret && caret.kind === "offset" && !(caret.offset === 0 && fieldHasText(field)));
    const at = explicit ? pointAt(field, caret.offset) : ownEnd(field);
    const range = document.createRange();
    range.setStart(at.node, at.offset);
    range.collapse(true);
    sel.addRange(range);
    // insertText keeps the site's editor (React, ProseMirror, Lexical) and its undo history in step.
    // Only trust execCommand's own answer: rich editors like WhatsApp's update their DOM a moment later,
    // so checking the field's text right away reports a success as a failure.
    // Added after what is already there, so start it on a new line instead of gluing it on.
    const lead = !explicit && fieldHasText(field) ? "\n\n" : "";
    return SITES_REGISTRY.typeIntoEditable(field, lead + text);
  }

  /** The end of what the person wrote, before any quoted thread (a Gmail reply carries one inside the box). */
  function ownEnd(root) {
    const quote = root.querySelector("blockquote, .gmail_quote, .gmail_extra");
    if (quote && quote.parentNode) {
      return { node: quote.parentNode, offset: Array.prototype.indexOf.call(quote.parentNode.childNodes, quote) };
    }
    return { node: root, offset: root.childNodes.length };
  }

  /** Puts [text] back where it came from: over the saved selection, or over the whole field. */
  function putBack(text) {
    if (feature === "Flow" && !replaceField && !(saved && saved.kind === "copy")) return insertAtCaret(text);
    if (saved && saved.kind === "copy") {
      navigator.clipboard && navigator.clipboard.writeText(text);
      return true;
    }
    field = liveField();
    if (!field) return false;
    if (saved && saved.kind === "input") {
      field.focus();
      field.setSelectionRange(saved.start, saved.end);
      return SITES_REGISTRY.insertText(field, text, false);
    }
    if (saved && saved.kind === "range") {
      field.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(saved.range);
      return SITES_REGISTRY.insertText(field, text, false);
    }
    return SITES_REGISTRY.insertText(field, text, true);
  }

  // ---------------------------------------------------------------- card

  function openCard(title) {
    session += 1;
    closeMenu();
    hideToast();
    detectTheme();
    launcher.hidden = true;
    cardTitle.textContent = title;
    card.hidden = false;
    reposition();
  }

  function closeCard() {
    if (listening) cancelListening();
    card.hidden = true;
    busy = false;
    draft = "";
    peeking = false;
    cardBody.innerHTML = "";
    if (viaKeyboard && field && field.isConnected) {
      try { field.focus({ preventScroll: true }); } catch (_) {}
    }
    viaKeyboard = false;
    if (field && document.activeElement === field) showLauncher();
  }

  function render(html) {
    cardBody.innerHTML = html;
    reposition();
  }

  function showWorking(text) {
    busy = true;
    render(`<div class="wn-working"><span class="wn-dots"><i></i><i></i><i></i></span><span>${escape(text)}</span></div><div class="wn-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>`);
  }

  function showMessage({ title, body, primary, onPrimary, secondary, icon = ICONS.alert, google = false }) {
    busy = false;
    render(`
      <div class="wn-message">
        <div class="wn-message-icon">${icon}</div>
        <div class="wn-message-title">${escape(title)}</div>
        <div class="wn-message-body">${escape(body)}</div>
      </div>
      <footer class="wn-actions">
        ${secondary ? "" : `<button class="wn-btn wn-btn-quiet" type="button" data-action="close">Close</button>`}
        ${secondary ? `<button class="wn-btn wn-btn-quiet" type="button" data-action="message-secondary">${escape(secondary.label)}</button>` : ""}
        ${primary ? `<button class="wn-btn ${google ? "wn-btn-google" : "wn-btn-primary"}" type="button" data-action="message-primary">${primary}</button>` : ""}
      </footer>`);
    messagePrimary = onPrimary || null;
    messageSecondary = secondary ? secondary.fn : null;
  }
  let messagePrimary = null;
  let messageSecondary = null;

  function showSignIn() {
    showMessage({
      title: "Sign in to use Whyno Write",
      body: "It's free. Sign in with Google once and Fix, Enhance and Flow work on every site.",
      primary: `${ICONS.google}<span>Continue with Google</span>`,
      onPrimary: () => {
        window.open(SIGN_IN_URL, "_blank", "noopener");
        closeCard();
      },
      icon: `<img class="wn-logo wn-logo-lg" src="${LOGO_URL}" alt="">`,
      google: true
    });
  }

  function showFailure(res, retry) {
    if (res && (res.status === 401 || res.error === "sign_in_required")) return showSignIn();
    if (res && res.status === 429) {
      return showMessage({ title: "Today's free AI is used up", body: "It resets at midnight. Your typing works as usual." });
    }
    if (res && res.error === "extension_reloaded") {
      return showMessage({ title: "Whyno Write was updated", body: res.message, primary: "Reload page", onPrimary: () => location.reload() });
    }
    const offline = res && (res.status === 0 || res.status === 408);
    showMessage({
      title: offline ? "Couldn't reach Whyno" : "Something went wrong",
      body: offline ? "Check your connection and try again. Your text wasn't changed." : "Your text wasn't changed. Please try again.",
      primary: "Try again",
      onPrimary: retry
    });
  }

  /** The page would not take the text, so put it on the clipboard and say so, rather than closing silently. */
  function copyInstead(text) {
    const done = () => showMessage({ title: "Copied instead", body: "Whyno couldn't place the text in this box. It is copied: click where you want it and press Ctrl+V." });
    const failed = () => showMessage({ title: "Couldn't insert the text", body: "Select the text in the draft and copy it by hand." });
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, failed);
    else failed();
  }

  /** Word-level difference: which words of [next] are new or changed compared with [prev]. */
  function diffMarks(prev, next) {
    const A = prev.split(/\s+/).filter(Boolean);
    const B = next.split(/\s+/).filter(Boolean);
    const marks = new Set();
    if (A.length * B.length > 160000) return marks;
    const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
    for (let i = 1; i <= A.length; i++) {
      for (let j = 1; j <= B.length; j++) {
        dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const keep = new Set();
    let i = A.length;
    let j = B.length;
    while (i > 0 && j > 0) {
      if (A[i - 1] === B[j - 1]) { keep.add(j - 1); i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
      else j--;
    }
    for (let k = 0; k < B.length; k++) if (!keep.has(k)) marks.add(k);
    return marks;
  }

  /** The proposed text, one word at a time so it arrives like typing, with changed words marked. */
  function draftHTML(text, marks) {
    const tokens = text.split(/(\s+)/);
    const words = tokens.filter((t) => t && !/^\s+$/.test(t)).length;
    if (words > 400) return escape(text);
    const step = Math.max(6, Math.min(26, Math.floor(700 / Math.max(1, words))));
    let k = 0;
    const html = tokens.map((t) => {
      if (!t) return "";
      if (/^\s+$/.test(t)) return t;
      const changed = marks && marks.has(k) ? " wn-chg" : "";
      return `<span class="wn-w${changed}" style="--i:${k++}">${escape(t)}</span>`;
    }).join("");
    return `<span style="--step:${step}ms">${html}</span>`;
  }

  function showResult(text, opts = {}) {
    busy = false;
    draft = text;
    resultOpts = opts;
    const isFlow = !!opts.isFlow;
    const primaryLabel = saved && saved.kind === "copy" ? "Copy" : isFlow && !replaceField ? "Insert" : "Replace";
    currentQuick = opts.quick || (isFlow ? quickChanges() : null);
    const marks = opts.marks && original ? diffMarks(original, text) : null;
    const scopeNote = saved && saved.auto && feature === "Fix"
      ? `<div class="wn-scope">Fixed this paragraph only. <button class="wn-link" type="button" data-action="fix-all">Fix everything</button></div>`
      : "";
    render(`
      ${scopeNote}
      <div class="wn-draft${showChanges ? "" : " wn-nochg"}" tabindex="0">${draftHTML(text, marks)}</div>
      ${currentQuick ? `<div class="wn-quick">${currentQuick.map(([label], i) => `<button class="wn-chip" type="button" data-quick="${i}">${label}</button>`).join("")}</div>` : ""}
      ${isFlow ? `
        <form class="wn-ask">
          <button class="wn-icon-btn wn-icon-btn-soft" type="button" data-action="voice-followup" aria-label="Say a change">${ICONS.mic}</button>
          <input class="wn-ask-input" type="text" placeholder="Ask for a change, or tap the mic" aria-label="Ask for a change" autocomplete="off">
          <button class="wn-icon-btn wn-icon-btn-solid" type="submit" aria-label="Send">${ICONS.send}</button>
        </form>` : ""}
      <footer class="wn-actions">
        <span class="wn-links">
          ${marks && marks.size ? `<button class="wn-link" type="button" data-action="toggle-changes">${showChanges ? "Hide changes" : "Show changes"}</button>` : ""}
          ${original && !isFlow ? `<button class="wn-link" type="button" data-action="peek">See original</button>` : ""}
          <button class="wn-icon-btn wn-report" type="button" data-action="report" title="Report a bad result" aria-label="Report a bad result">${ICONS.thumbDown}</button>
        </span>
        <button class="wn-btn wn-btn-quiet" type="button" data-action="close">Discard</button>
        <button class="wn-btn wn-btn-primary" type="button" data-action="accept">${primaryLabel}</button>
      </footer>`);
    peeking = false;
    if (viaKeyboard) {
      const main = cardBody.querySelector('[data-action="accept"]');
      if (main) main.focus({ preventScroll: true });
    }
    rememberResult(text);
  }

  /** Before anything is sent: say exactly what a report contains. */
  function confirmReport() {
    render(`
      <div class="wn-message">
        <div class="wn-message-icon">${ICONS.thumbDown}</div>
        <div class="wn-message-title">Report this result?</div>
        <div class="wn-message-body">This sends your original text and this result to Whyno, so we can fix what went wrong. Nothing else is sent.</div>
      </div>
      <footer class="wn-actions">
        <button class="wn-btn wn-btn-quiet" type="button" data-action="report-cancel">Cancel</button>
        <button class="wn-btn wn-btn-primary" type="button" data-action="report-send">Send report</button>
      </footer>`);
  }

  /** Swaps the tone chips for the languages Translate offers. */
  function showLanguages() {
    const row = cardBody.querySelector(".wn-quick");
    if (!row) return;
    row.innerHTML = `<button class="wn-chip" type="button" data-action="langs-back" aria-label="Back">←</button>` +
      LANGUAGES.map((l) => `<button class="wn-chip" type="button" data-lang="${l}">${l}</button>`).join("");
  }

  /** The last few results, kept only in this browser, so a lost Replace is never lost. */
  function rememberResult(text) {
    if (!prefs.historyOn || !text) return;
    try {
      chrome.storage.local.get([KEYS.HISTORY], (r) => {
        const list = (r && r[KEYS.HISTORY]) || [];
        if (list[0] && list[0].text === text) return;
        list.unshift({ goal: feature, text: text.slice(0, 2000), at: Date.now() });
        chrome.storage.local.set({ [KEYS.HISTORY]: list.slice(0, 5) });
      });
    } catch (_) {}
  }

  function setQuota(data) {
    if (data && typeof data.remaining_quota === "number") cardQuota.textContent = `${data.remaining_quota} left today`;
  }

  // ---------------------------------------------------------------- actions

  async function ensureSignedIn() {
    const res = await send({ type: "GET_USER" });
    return !!(res && res.user && res.user.idToken);
  }

  /**
   * Nothing selected: Fix works on the paragraph the cursor is in, so a long email (or a Gmail reply with the whole
   * thread under it) is not sent off and rewritten as one lump. "Fix everything" is one tap away.
   */
  function scopeToParagraph() {
    if (saved || !field || field instanceof HTMLInputElement) return;
    if (field instanceof HTMLTextAreaElement) {
      const value = field.value;
      if (!/\S\s*\n\s*\S/.test(value)) return; // one paragraph: the whole text
      const pos = caret && caret.kind === "input" ? caret.start : value.length;
      const start = value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
      let end = value.indexOf("\n", pos);
      if (end === -1) end = value.length;
      const piece = value.slice(start, end);
      if (piece.trim()) saved = { kind: "input", start, end, text: piece, auto: true };
      return;
    }
    const at = caret && caret.kind === "offset" ? pointAt(field, caret.offset) : ownEnd(field);
    let node = at.node;
    while (node && node.parentNode !== field && node !== field) node = node.parentNode;
    if (!node || node === field || node.nodeType !== 1) return; // text sitting directly in the box: the whole text
    const filled = Array.prototype.filter.call(field.children, (c) => (c.innerText || "").trim());
    if (filled.length < 2 || !(node.innerText || "").trim()) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    saved = { kind: "range", range, text: node.innerText.trim(), auto: true };
  }

  async function startWriting(goal, all = false) {
    feature = goal;
    openCard(goal);
    if (!(await ensureSignedIn())) return showSignIn();
    if (goal === "Fix" && !all) scopeToParagraph();
    const text = currentText();
    if (!text.trim()) {
      return showMessage({
        title: goal === "Enhance" ? "Write a prompt to enhance" : "Write something to fix",
        body: goal === "Enhance" ? "Type your prompt first, then tap Enhance." : "Type a message first, then tap Fix.",
        icon: ICONS.wand
      });
    }
    showWorking(goal === "Enhance" ? "Enhancing…" : "Fixing…");
    original = text;
    lastInput = text;
    currentKind = goal === "Enhance" ? "prompt" : "message";
    const s = session;
    const res = await send({ type: "CALL_WRITING", payload: { text, goal } });
    if (card.hidden || feature !== goal || s !== session) return; // closed meanwhile
    // "failed" or no text means the AI did not really answer. Say so and offer a retry, instead of showing the original as a result.
    if (!res || !res.ok || !res.data || res.data.failed || !(res.data.text || "").trim()) {
      return showFailure(res && res.ok ? { ok: false, status: 502 } : res, () => startWriting(goal));
    }
    setQuota(res.data);
    if (same(res.data.text, text)) {
      return showMessage({
        title: goal === "Fix" ? "Looks good already" : "Already clear",
        body: goal === "Fix" ? "There is nothing to fix in this text." : "This prompt is already clear and specific.",
        icon: ICONS.check
      });
    }
    showResult(res.data.text, { isFlow: false, marks: goal === "Fix", quick: goal === "Fix" ? QUICK_FIX : QUICK_CHANGES_AI });
  }

  async function startFlow() {
    feature = "Flow";
    original = "";
    currentKind = flowKind();
    replaceField = false;
    // On a few sites, the message being answered is read now and shown on the card, where it can be dropped.
    replyTo = prefs.reply && mode !== "ai" ? SITES_REGISTRY.getReplyContext(window.location.hostname, liveField()) : "";
    openCard("Flow");
    if (!(await ensureSignedIn())) return showSignIn();
    startListening(false);
  }

  /** A small line on the card: which message the reply is for, with a way to leave it out. */
  function replyChipHTML() {
    if (!replyTo) return "";
    const snippet = replyTo.replace(/\s+/g, " ").slice(0, 70) + (replyTo.length > 70 ? "…" : "");
    return `<div class="wn-replying"><span>Replying to “${escape(snippet)}”</span><button class="wn-icon-btn" type="button" data-action="drop-reply" aria-label="Do not use this message" title="Do not use this message">${ICONS.close}</button></div>`;
  }

  /** Typed notes instead of speech. */
  function showCompose() {
    busy = false;
    render(`
      ${replyChipHTML()}
      <form class="wn-compose">
        <textarea class="wn-compose-input" rows="4" placeholder="${mode === "ai" ? "What do you want to ask the AI? Rough notes are fine." : "What do you want to write? Rough notes are fine."}" aria-label="Your notes"></textarea>
        <footer class="wn-actions">
          <button class="wn-btn wn-btn-quiet" type="button" data-action="speak">${ICONS.mic}<span>Speak</span></button>
          <span class="wn-hint">Ctrl + Enter</span>
          <button class="wn-btn wn-btn-primary" type="submit">${mode === "ai" ? "Write my prompt" : "Write it"}</button>
        </footer>
      </form>`);
    const input = cardBody.querySelector(".wn-compose-input");
    setTimeout(() => {
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  }

  // ---------------------------------------------------------------- listening

  async function startListening(followUp) {
    busy = true;
    const res = await send({ type: "VOICE_START" });
    if (card.hidden || feature !== "Flow") {
      if (res && res.ok) send({ type: "VOICE_CANCEL" });
      return;
    }
    if (!res || !res.ok) {
      busy = false;
      const error = res && res.error;
      if (error === "mic_permission") {
        const justAllowed = micJustAllowed;
        micJustAllowed = false;
        const retry = { primary: `${ICONS.mic}<span>Try again</span>`, onPrimary: () => startListening(followUp), icon: ICONS.mic };
        // Chrome has it blocked for this extension: sending the person to the allow page again changes nothing.
        if (res.permission === "denied") {
          return showMessage({ title: "Chrome has the microphone blocked", body: "Open the microphone settings, set Whyno Write to Allow, then tap Try again.", ...retry, secondary: { label: "Open settings", fn: () => send({ type: "OPEN_MIC_SETTINGS" }) } });
        }
        // Chrome says it is allowed, but the microphone still refuses: the system (Windows) is blocking it.
        // Looping through the allow page again would not help either.
        if (res.permission === "granted" || justAllowed) {
          return showMessage({ title: "Windows is blocking the microphone", body: "Go to Settings, Privacy & security, Microphone, and turn on Let desktop apps access your microphone. Then tap Try again.", ...retry });
        }
        // Allowed before but forgotten (usually "Allow this time"): the same one-tap page, with a way to make it permanent.
        const before = await micWasAllowedBefore();
        return showMessage({
          title: before ? "Allow the microphone again" : "Let Flow hear you",
          body: before
            ? "Your browser let go of the permission. Tap Allow and choose “Allow” (not “this time”) and it stays on for good."
            : "Allow the microphone once for Whyno Write, and Flow turns what you say into a polished message, or a sharp prompt on AI apps. Choose “Allow”, not “this time”.",
          primary: `${ICONS.mic}<span>Allow microphone</span>`,
          onPrimary: () => {
            pendingFollowUp = followUp;
            send({ type: "OPEN_MIC_SETUP" });
          },
          secondary: { label: "Open settings", fn: () => send({ type: "OPEN_MIC_SETTINGS" }) },
          icon: ICONS.mic
        });
      }
      if (error === "no_mic") {
        return showMessage({ title: "No microphone found", body: "Connect a microphone or headset and try again, or type your notes instead.", primary: "Type instead", onPrimary: showCompose, icon: ICONS.mic });
      }
      if (error === "extension_reloaded") return showFailure(res);
      return showMessage({ title: "The microphone is busy", body: "Another tab or app may be using it. Close it and try again, or type instead.", primary: "Try again", onPrimary: () => startListening(followUp), icon: ICONS.mic });
    }

    micJustAllowed = false;
    listening = { followUp, startedAt: Date.now() };
    const hasText = !followUp && currentText().trim().length > 0;
    render(`
      <div class="wn-listen">
        <div class="wn-wave" aria-hidden="true">${"<i></i>".repeat(BARS)}</div>
        <div class="wn-listen-meta">
          <span class="wn-rec-dot" aria-hidden="true"></span>
          <span class="wn-timer">0:00</span>
        </div>
        ${followUp ? "" : replyChipHTML()}
        <div class="wn-listen-hint">${followUp ? (mode === "ai" ? "Say what should change, like “make it shorter” or “ask for examples”." : "Say what should change, like “make it shorter” or “add that I'll be late”.") : (mode === "ai" ? "Say what you want to ask. Rough is fine, Flow will turn it into a clear prompt." : "Say what's on your mind. Rough is fine, Flow will tidy it up.")}</div>
      </div>
      <footer class="wn-actions">
        ${followUp ? `<button class="wn-btn wn-btn-quiet" type="button" data-action="back-to-draft">Back</button>` : `<button class="wn-btn wn-btn-quiet" type="button" data-action="type">Type instead</button>`}
        ${hasText ? `<button class="wn-btn wn-btn-quiet" type="button" data-action="use-field" title="Write from the text already in the box">Use my text</button>` : ""}
        <button class="wn-btn wn-btn-primary" type="button" data-action="done">${ICONS.check}<span>Done</span></button>
      </footer>`);
    cardTitle.textContent = followUp ? "Flow · follow-up" : "Flow · listening";
    if (viaKeyboard) {
      const done = cardBody.querySelector('[data-action="done"]');
      if (done) done.focus({ preventScroll: true });
    }
    clearInterval(listenTimer);
    const timer = cardBody.querySelector(".wn-timer");
    listenTimer = setInterval(() => {
      if (!listening || !timer) return;
      const s = Math.floor((Date.now() - listening.startedAt) / 1000);
      timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }, 250);
  }
  let pendingFollowUp = false;

  /** True once the one-time microphone page has been completed on this browser. */
  function micWasAllowedBefore() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["whyno_mic_setup_done"], (r) => resolve(!!(r && r.whyno_mic_setup_done)));
      } catch (_) {
        resolve(false);
      }
    });
  }

  function setLevel(level) {
    if (!listening) return;
    const bars = cardBody.querySelectorAll(".wn-wave i");
    if (!bars.length) return;
    // Newest loudness on the right; older bars shift left.
    for (let i = 0; i < bars.length - 1; i++) bars[i].style.transform = bars[i + 1].style.transform;
    bars[bars.length - 1].style.transform = `scaleY(${(0.12 + Math.min(1, level) * 0.88).toFixed(3)})`;
    const glow = cardBody.querySelector(".wn-listen");
    if (glow) glow.style.setProperty("--lvl", Math.min(1, level).toFixed(2));
  }

  function cancelListening() {
    clearInterval(listenTimer);
    listening = null;
    send({ type: "VOICE_CANCEL" });
  }

  async function finishListening() {
    if (!listening) return;
    const { followUp } = listening;
    clearInterval(listenTimer);
    listening = null;
    cardTitle.textContent = "Flow";
    const base = draft;
    showWorking(followUp ? "Got it. Making the change…" : mode === "ai" ? "Got it. Writing your prompt…" : "Got it. Writing…");
    const res = await send({ type: "VOICE_STOP" });
    if (card.hidden || feature !== "Flow") return;
    if (res && res.ok && res.data) setQuota(res.data);
    const heardNothing = (res && res.error === "too_short") || (res && res.ok && !hasWords(res.transcript));
    if (heardNothing) {
      return showMessage({
        title: "Didn't catch that",
        body: "Nothing was heard. Speak a little closer to the microphone and try again.",
        primary: `${ICONS.mic}<span>Try again</span>`,
        onPrimary: () => startListening(followUp),
        icon: ICONS.mic
      });
    }
    if (!res || !res.ok) return showFailure(res, () => (followUp ? showResult(base, { isFlow: true }) : startListening(false)));
    if (followUp) {
      draft = base;
      return changeDraft(res.transcript);
    }
    return writeFlow(res.transcript);
  }

  async function writeFlow(notes, { fromField = false } = {}) {
    replaceField = fromField;
    showWorking(mode === "ai" ? "Writing your prompt…" : "Writing…");
    // What is already in the box lets "add my name after best regards" work on that text instead of starting a new message.
    const context = fromField ? "" : fieldText(liveField()).trim().slice(0, 3000);
    lastInput = notes;
    const res = await send({ type: "CALL_FLOW", payload: { text: notes, kind: flowKind(), context, reply_to: fromField ? "" : replyTo } });
    if (card.hidden || feature !== "Flow") return;
    if (!res || !res.ok) return showFailure(res, () => writeFlow(notes));
    setQuota(res.data);
    const written = (res.data.draft || res.data.text || "").trim();
    if (res.data.empty || looksLikeNonAnswer(written)) return nothingToWrite(fromField);
    if (res.data.edit && !(saved && saved.kind === "copy")) {
      // The notes changed the text that was already there: the result replaces it, not adds to it.
      replaceField = true;
      saved = null;
    }
    showResult(written, { isFlow: true });
  }

  /** Flow had nothing to work with (a silent recording, a stray full stop). A plain note, never a chat reply. */
  function nothingToWrite(fromField) {
    showMessage({
      title: "Didn't catch that",
      body: fromField ? "There was nothing to write from. Type or say a little more." : "Nothing usable was heard. Speak a little closer to the microphone, or type your notes instead.",
      primary: `${ICONS.mic}<span>Try again</span>`,
      onPrimary: () => startListening(false),
      secondary: { label: "Type instead", fn: showCompose },
      icon: ICONS.mic
    });
  }

  async function changeDraft(instruction) {
    const base = draft;
    const s = session;
    showWorking("Making the change…");
    const res = await send({ type: "CALL_REFINE", payload: { original: base, instruction, kind: currentKind } });
    if (card.hidden || s !== session) return;
    if (!res || !res.ok) return showFailure(res, () => showResult(base, resultOpts));
    setQuota(res.data);
    const changed = (res.data.draft || res.data.text || "").trim();
    showResult(looksLikeNonAnswer(changed) ? base : changed, resultOpts);
  }

  // One listener for everything inside the card.
  card.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "close") return closeCard();
    if (action === "accept") {
      const before = fieldText();
      const toClipboard = !!(saved && saved.kind === "copy");
      const target = field;
      const placed = draft;
      if (draft && !putBack(draft)) return copyInstead(draft);
      closeCard();
      if (!toClipboard) afterReplace({ field: target, before, after: placed });
      return;
    }
    if (action === "fix-all") {
      saved = null;
      return startWriting("Fix", true);
    }
    if (action === "drop-reply") {
      replyTo = "";
      const chip = cardBody.querySelector(".wn-replying");
      if (chip) chip.remove();
      return;
    }
    if (action === "peek") {
      const well = cardBody.querySelector(".wn-draft");
      if (!well) return;
      peeking = !peeking;
      if (peeking) {
        well.dataset.keep = well.innerHTML;
        well.textContent = original;
        well.classList.add("wn-peek");
        button.textContent = "See result";
      } else {
        well.innerHTML = well.dataset.keep || "";
        well.classList.remove("wn-peek");
        button.textContent = "See original";
      }
      return;
    }
    if (action === "report") return confirmReport();
    if (action === "report-cancel") return showResult(draft, resultOpts);
    if (action === "report-send") {
      send({ type: "REPORT_RESULT", payload: { goal: feature, input: lastInput, output: draft } });
      showResult(draft, resultOpts);
      showToast({ text: "Thanks, the report was sent.", ms: 3500 });
      return;
    }
    if (action === "langs-back") return showResult(draft, resultOpts);
    if (button.dataset.lang && !busy) {
      return changeDraft(`Translate the whole text into ${button.dataset.lang}. Keep the meaning, tone, names, numbers and formatting exactly.`);
    }
    if (action === "toggle-changes") {
      showChanges = !showChanges;
      const well = cardBody.querySelector(".wn-draft");
      if (well) well.classList.toggle("wn-nochg", !showChanges);
      button.textContent = showChanges ? "Hide changes" : "Show changes";
      return;
    }
    if (action === "message-secondary" && messageSecondary) return messageSecondary();
    if (action === "message-primary" && messagePrimary) return messagePrimary();
    if (action === "done") return finishListening();
    if (action === "type") {
      cancelListening();
      return showCompose();
    }
    if (action === "speak") return startListening(false);
    if (action === "use-field") {
      cancelListening();
      return writeFlow(currentText().trim(), { fromField: true });
    }
    if (action === "back-to-draft") {
      const base = draft;
      cancelListening();
      return showResult(base, { isFlow: true });
    }
    if (action === "voice-followup" && !busy) return startListening(true);
    if (button.dataset.quick !== undefined && !busy) {
      const [, instruction] = (currentQuick || quickChanges())[Number(button.dataset.quick)];
      if (instruction === "__translate__") return showLanguages();
      changeDraft(instruction);
    }
  });

  card.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    const ask = cardBody.querySelector(".wn-ask-input");
    if (e.target.classList.contains("wn-ask") && ask && ask.value.trim()) return changeDraft(ask.value.trim());
    const notes = cardBody.querySelector(".wn-compose-input");
    if (e.target.classList.contains("wn-compose") && notes && notes.value.trim()) return writeFlow(notes.value.trim());
  });

  card.addEventListener("keydown", (e) => {
    // Keys typed in our inputs belong to us, not to the page's shortcuts.
    e.stopPropagation();
    if (e.key === "Escape") closeCard();
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target.classList.contains("wn-compose-input")) {
      e.preventDefault();
      cardBody.querySelector(".wn-compose").requestSubmit();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !card.hidden) closeCard();
    if (e.key === "Escape" && !menu.hidden) closeMenu();
    // Ctrl+Enter takes the result, without reaching for the mouse.
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !card.hidden && draft && !busy) {
      e.preventDefault();
      const accept = cardBody.querySelector('[data-action="accept"]');
      if (accept) accept.click();
    }
  });

  // A click elsewhere on the page closes the card unless it is mid-request.
  document.addEventListener("mousedown", (e) => {
    if (!menu.hidden && !e.composedPath().includes(menu) && !e.composedPath().includes(launcher)) closeMenu();
    if (card.hidden || busy) return;
    if (e.composedPath().includes(hostEl)) return;
    closeCard();
  }, true);

  /** After text lands in the page: a glow, an optional tick, a way back, and, now and then, a friendly ask. */
  function afterReplace(info) {
    flashField();
    tick();
    // The button says it. Only if the person turned the button off on this site does a small note do it instead.
    if (prefs.hidden) showToast({ text: "Done", ms: 6000, actions: [{ label: "Undo", fn: () => undoReplace(info) }] });
    else pillNote("Done", () => undoReplace(info), 6000);
    try {
      chrome.storage.local.get([KEYS.USE_COUNT, KEYS.REVIEW_STATE], (r) => {
        const count = ((r && r[KEYS.USE_COUNT]) || 0) + 1;
        chrome.storage.local.set({ [KEYS.USE_COUNT]: count });
        const state = r && r[KEYS.REVIEW_STATE];
        if ((count === 3 || count === 20) && state !== "done") {
          setTimeout(offerReview, 6600);
        }
      });
    } catch (_) {}
  }

  function undoReplace(info) {
    const f = info.field;
    if (!f || !document.contains(f)) return;
    f.focus();
    if (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) {
      const proto = f instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(f, info.before);
      f.setSelectionRange(info.before.length, info.before.length);
      f.dispatchEvent(new Event("input", { bubbles: true }));
      f.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // The browser's own undo keeps the site's editor and its formatting in step; fall back to putting the old text back.
      document.execCommand("undo");
      const same = (a, b) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
      if (!same(fieldText(f), info.before)) SITES_REGISTRY.insertText(f, info.before, true);
    }
    if (prefs.hidden) showToast({ text: "Back to what you had", ms: 2500, tick: false });
    else pillNote("Back to what you had", null, 2500);
  }

  function offerReview() {
    showToast({
      text: "Enjoying Whyno Write? A quick review helps a lot.",
      ms: 14000,
      tick: false,
      actions: [
        {
          label: "Review",
          primary: true,
          fn: () => {
            send({ type: "OPEN_URL", payload: { url: `${CONFIG.STORE_URL}/reviews` } });
            try { chrome.storage.local.set({ [KEYS.REVIEW_STATE]: "done" }); } catch (_) {}
          }
        },
        {
          label: "Copy link",
          fn: () => {
            if (navigator.clipboard) navigator.clipboard.writeText(CONFIG.STORE_URL);
            try { chrome.storage.local.set({ [KEYS.REVIEW_STATE]: "asked" }); } catch (_) {}
          }
        }
      ]
    });
  }

  function escape(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  // Never leave the microphone on when the page goes away.
  window.addEventListener("pagehide", () => {
    if (listening) cancelListening();
  });

  // Right-click menu entries, and voice updates from the background worker.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "VOICE_LEVEL") return setLevel(msg.level);
    if (msg.type === "VOICE_AUTO_STOPPED") return finishListening();
    if (msg.type === "RESUME_FLOW_VOICE") {
      // Back from allowing the microphone: carry on listening.
      feature = "Flow";
      micJustAllowed = true;
      if (card.hidden) openCard("Flow");
      if (pendingFollowUp && draft) return startListening(true);
      return startListening(false);
    }
    if (!/^TRIGGER_/.test(msg.type || "")) return; // not a request to start something
    capture();
    // Text selected outside any field (an article, an email) can't be replaced; the result is copied instead.
    if (!saved && msg.selectionText && (!field || !currentText().includes(msg.selectionText))) {
      saved = { kind: "copy", text: msg.selectionText };
    }
    viaKeyboard = msg.type === "TRIGGER_WRITE" || msg.type === "TRIGGER_FLOW";
    if (msg.type === "TRIGGER_WRITE") startWriting(writeLabel());
    else if (msg.type === "TRIGGER_FIX") startWriting("Fix");
    else if (msg.type === "TRIGGER_ENHANCE") startWriting("Enhance");
    else if (msg.type === "TRIGGER_FLOW") startFlow();
  });

  // What the person chose on this site and in the popup.
  function loadPrefs() {
    try {
      chrome.storage.local.get([KEYS.HIDDEN_SITES, KEYS.PILL_OFFSETS, KEYS.SOUNDS, KEYS.HISTORY_ON, KEYS.CALM, KEYS.REPLY_CONTEXT, KEYS.SNIPPETS], (r) => {
        r = r || {};
        prefs.hidden = (r[KEYS.HIDDEN_SITES] || []).includes(siteKey);
        prefs.offset = (r[KEYS.PILL_OFFSETS] || {})[siteKey] || null;
        prefs.sounds = r[KEYS.SOUNDS] === true;
        prefs.historyOn = r[KEYS.HISTORY_ON] !== false;
        prefs.calm = r[KEYS.CALM] === true;
        prefs.reply = r[KEYS.REPLY_CONTEXT] !== false;
        prefs.snippets = Array.isArray(r[KEYS.SNIPPETS]) ? r[KEYS.SNIPPETS].filter((x) => x && x.name && x.text) : [];
        root.classList.toggle("wn-calm", prefs.calm);
        if (prefs.hidden) {
          launcher.hidden = true;
          closeMenu();
        }
        scheduleReposition();
      });
    } catch (_) {}
  }
  loadPrefs();

  // The popup asks which site this is, to show its "on this site" switch.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "GET_HOST") sendResponse({ host: siteKey, hidden: prefs.hidden });
  });
})();
