// Whyno Write Popup Logic

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const signedOutState = document.getElementById("signedOutState");
  const signedInState = document.getElementById("signedInState");
  const googleSignInBtn = document.getElementById("googleSignInBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const userName = document.getElementById("userName");
  const userEmail = document.getElementById("userEmail");
  const userAvatar = document.getElementById("userAvatar");

  const modeAuto = document.getElementById("modeAuto");
  const modeAi = document.getElementById("modeAi");
  const modeNormal = document.getElementById("modeNormal");
  const modeDesc = document.getElementById("modeDesc");

  const quotaRemaining = document.getElementById("quotaRemaining");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  const modeDescriptions = {
    auto: "Enhance on AI chat sites like ChatGPT, Claude and Gemini. Fix everywhere else.",
    ai: "Always show Enhance, for improving prompts.",
    normal: "Always show Fix, for grammar and clarity."
  };

  // 1. Check Server Health
  function checkHealth() {
    chrome.runtime.sendMessage({ type: "CHECK_HEALTH" }, (res) => {
      if (res && res.ok) {
        statusDot.className = "status-dot online";
        statusText.textContent = "Server Online";
      } else {
        statusDot.className = "status-dot offline";
        statusText.textContent = "Server Offline";
      }
    });
  }

  // 2. Load User State & Mode Override
  function loadState() {
    chrome.runtime.sendMessage({ type: "GET_USER" }, (res) => {
      if (!res) return;

      const user = res.user;
      if (user) {
        signedOutState.style.display = "none";
        signedInState.style.display = "block";
        userName.textContent = user.displayName || "User";
        userEmail.textContent = user.email || "";

        if (user.photoUrl) {
          const img = document.createElement("img");
          img.src = user.photoUrl;
          img.alt = "";
          img.referrerPolicy = "no-referrer";
          userAvatar.replaceChildren(img);
        } else {
          const initial = (user.displayName || user.email || "U").trim().charAt(0).toUpperCase();
          userAvatar.textContent = initial;
        }

      } else {
        signedInState.style.display = "none";
        signedOutState.style.display = "block";
      }

      // Only a number the server actually reported today; otherwise a dash.
      const q = res.quota;
      const today = new Date().toDateString();
      const known = user && q && new Date(q.at).toDateString() === today;
      quotaRemaining.textContent = known ? String(q.value) : "–";
      document.getElementById("quotaCard").style.display = user ? "block" : "none";
      // The ring shows how much of the day's allowance is left.
      const fraction = known ? Math.max(0, Math.min(1, q.value / CONFIG.DAILY_ALLOWANCE)) : 0;
      document.getElementById("ringFill").style.strokeDashoffset = String(138.2 * (1 - fraction));
      document.getElementById("quotaTitle").textContent = known ? `${q.value} of ${CONFIG.DAILY_ALLOWANCE} left today` : "AI requests left today";

      setModeActive(res.modeOverride || "auto");
    });
  }

  // 3. Mode Toggle Handling
  function setModeActive(mode) {
    [modeAuto, modeAi, modeNormal].forEach(btn => btn.classList.remove("active"));
    if (mode === "ai") modeAi.classList.add("active");
    else if (mode === "normal") modeNormal.classList.add("active");
    else modeAuto.classList.add("active");

    modeDesc.textContent = modeDescriptions[mode] || modeDescriptions.auto;
  }

  [modeAuto, modeAi, modeNormal].forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      setModeActive(mode);
      chrome.runtime.sendMessage({
        type: "SET_MODE_OVERRIDE",
        payload: { mode }
      });
    });
  });

  const authErrorMsg = document.getElementById("authErrorMsg");

  // 4. Web Sign-In on whyno.tech/extension
  const versionTag = document.getElementById("versionTag");
  if (versionTag) versionTag.textContent = `v${chrome.runtime.getManifest().version}`;
  document.getElementById("howItWorksBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome/welcome.html") });
  });

  googleSignInBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://whyno.tech/extension" });
  });

  // Listen for storage changes so popup live-updates when web login completes
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && (changes[CONFIG.STORAGE_KEYS.USER] || changes[CONFIG.STORAGE_KEYS.MODE_OVERRIDE] || changes[CONFIG.STORAGE_KEYS.QUOTA])) {
        loadState();
      }
    });
  }

  // 7. Sign Out
  signOutBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "SIGN_OUT" }, () => {
      loadState();
    });
  });

  // ---------------------------------------------------------------- new in 1.3

  const K = CONFIG.STORAGE_KEYS;
  const store = chrome.storage.local;

  // What's new, once after an update.
  store.get([K.WHATS_NEW], (r) => {
    if (r && r[K.WHATS_NEW]) {
      document.getElementById("whatsNewVersion").textContent = `v${r[K.WHATS_NEW]}`;
      document.getElementById("whatsNew").hidden = false;
    }
  });
  document.getElementById("whatsNewClose").addEventListener("click", () => {
    document.getElementById("whatsNew").hidden = true;
    store.remove(K.WHATS_NEW);
  });

  // Show the button on this site, or not. The page itself says which site it is.
  const siteRow = document.getElementById("siteRow");
  const siteSwitch = document.getElementById("siteSwitch");
  let siteHost = null;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return;
    chrome.tabs.sendMessage(tab.id, { type: "GET_HOST" }, (res) => {
      void chrome.runtime.lastError;
      if (!res || !res.host) return; // a page Whyno does not run on
      siteHost = res.host;
      document.getElementById("siteName").textContent = res.host;
      siteSwitch.checked = !res.hidden;
      siteRow.hidden = false;
    });
  });
  siteSwitch.addEventListener("change", () => {
    if (!siteHost) return;
    store.get([K.HIDDEN_SITES], (r) => {
      const list = ((r && r[K.HIDDEN_SITES]) || []).filter((h) => h !== siteHost);
      if (!siteSwitch.checked) list.push(siteHost);
      store.set({ [K.HIDDEN_SITES]: list });
    });
  });

  // The microphone, as the extension itself sees it. This is the permission that decides whether Flow asks again.
  const micTitle = document.getElementById("micTitle");
  const micSub = document.getElementById("micSub");
  const micAction = document.getElementById("micAction");
  function showMic(state) {
    micAction.hidden = false;
    micAction.className = "btn-pill";
    if (state === "granted") {
      micTitle.innerHTML = '<span class="dot-ok">●</span> On for every site';
      micSub.textContent = "Flow will not ask again.";
      micAction.textContent = "Settings";
      micAction.className = "btn-pill quiet";
      micAction.onclick = () => chrome.runtime.sendMessage({ type: "OPEN_MIC_SETTINGS" });
    } else if (state === "denied") {
      micTitle.innerHTML = '<span class="dot-bad">●</span> Blocked';
      micSub.textContent = "Set Microphone to Allow for Whyno Write.";
      micAction.textContent = "Open settings";
      micAction.onclick = () => chrome.runtime.sendMessage({ type: "OPEN_MIC_SETTINGS" });
    } else {
      micTitle.textContent = "Not allowed yet";
      micSub.textContent = "Allow it once, and choose “Allow”, not “this time”.";
      micAction.textContent = "Allow";
      micAction.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("mic/mic.html") });
    }
  }
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: "microphone" }).then((status) => {
      showMic(status.state);
      status.onchange = () => showMic(status.state);
    }).catch(() => showMic("prompt"));
  } else {
    showMic("prompt");
  }

  // Recent results, kept only on this device.
  const historyList = document.getElementById("historyList");
  function renderHistory() {
    store.get([K.HISTORY, K.HISTORY_ON], (r) => {
      const on = !r || r[K.HISTORY_ON] !== false;
      const items = on ? (r && r[K.HISTORY]) || [] : [];
      document.getElementById("historyCard").hidden = !on;
      historyList.replaceChildren();
      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = "Nothing yet. Your last results show up here.";
        historyList.append(empty);
        return;
      }
      for (const item of items) {
        const row = document.createElement("div");
        row.className = "history-item";
        const goal = document.createElement("span");
        goal.className = "history-goal";
        goal.textContent = item.goal || "Fix";
        const text = document.createElement("span");
        text.className = "history-text";
        text.textContent = item.text;
        const copy = document.createElement("button");
        copy.className = "history-copy";
        copy.type = "button";
        copy.textContent = "Copy";
        copy.addEventListener("click", () => {
          navigator.clipboard.writeText(item.text).then(() => {
            copy.textContent = "Copied";
            setTimeout(() => { copy.textContent = "Copy"; }, 1200);
          });
        });
        row.append(goal, text, copy);
        historyList.append(row);
      }
    });
  }
  document.getElementById("historyClear").addEventListener("click", () => store.set({ [K.HISTORY]: [] }, renderHistory));

  // Snippets: short texts saved on this device, inserted from the button's menu.
  const snippetList = document.getElementById("snippetList");
  function renderSnippets() {
    store.get([K.SNIPPETS], (r) => {
      const items = Array.isArray(r && r[K.SNIPPETS]) ? r[K.SNIPPETS] : [];
      snippetList.replaceChildren();
      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = "Nothing saved yet. Save a signature or a reply you use often.";
        snippetList.append(empty);
        return;
      }
      for (const item of items) {
        const row = document.createElement("div");
        row.className = "history-item";
        const name = document.createElement("span");
        name.className = "history-name";
        name.textContent = item.name;
        const text = document.createElement("span");
        text.className = "history-text";
        text.textContent = item.text;
        const del = document.createElement("button");
        del.className = "history-del";
        del.type = "button";
        del.textContent = "×";
        del.title = "Delete";
        del.setAttribute("aria-label", `Delete ${item.name}`);
        del.addEventListener("click", () => {
          store.set({ [K.SNIPPETS]: items.filter((x) => x.id !== item.id) }, renderSnippets);
        });
        row.append(name, text, del);
        snippetList.append(row);
      }
    });
  }
  document.getElementById("snippetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("snippetName").value.trim();
    const text = document.getElementById("snippetText").value.trim();
    if (!name || !text) return;
    store.get([K.SNIPPETS], (r) => {
      const items = Array.isArray(r && r[K.SNIPPETS]) ? r[K.SNIPPETS] : [];
      if (items.length >= 20) return;
      items.push({ id: String(Date.now()), name: name.slice(0, 40), text: text.slice(0, 1500) });
      store.set({ [K.SNIPPETS]: items }, () => {
        document.getElementById("snippetName").value = "";
        document.getElementById("snippetText").value = "";
        renderSnippets();
      });
    });
  });
  renderSnippets();

  // Preferences
  const replySwitch = document.getElementById("replySwitch");
  const calmSwitch = document.getElementById("calmSwitch");
  store.get([K.REPLY_CONTEXT, K.CALM], (r) => {
    replySwitch.checked = !r || r[K.REPLY_CONTEXT] !== false;
    calmSwitch.checked = !!(r && r[K.CALM] === true);
  });
  replySwitch.addEventListener("change", () => store.set({ [K.REPLY_CONTEXT]: replySwitch.checked }));
  calmSwitch.addEventListener("change", () => store.set({ [K.CALM]: calmSwitch.checked }));

  const soundSwitch = document.getElementById("soundSwitch");
  const historySwitch = document.getElementById("historySwitch");
  store.get([K.SOUNDS, K.HISTORY_ON], (r) => {
    soundSwitch.checked = r && r[K.SOUNDS] === true;
    historySwitch.checked = !r || r[K.HISTORY_ON] !== false;
  });
  soundSwitch.addEventListener("change", () => store.set({ [K.SOUNDS]: soundSwitch.checked }));
  historySwitch.addEventListener("change", () => {
    // Turning it off also forgets what was kept.
    store.set(historySwitch.checked ? { [K.HISTORY_ON]: true } : { [K.HISTORY_ON]: false, [K.HISTORY]: [] }, renderHistory);
  });

  // Shortcuts, as they are set right now.
  if (chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll((commands) => {
      for (const c of commands || []) {
        const el = document.getElementById(c.name === "whyno-write" ? "keyWrite" : c.name === "whyno-flow" ? "keyFlow" : "");
        if (el) el.textContent = c.shortcut || "not set";
      }
    });
  }
  document.getElementById("shortcutsChange").addEventListener("click", () => chrome.runtime.sendMessage({ type: "OPEN_SHORTCUTS" }));

  renderHistory();

  // Initial Run
  loadState();
  checkHealth();
});
