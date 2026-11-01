// Whyno Write Background Service Worker (Manifest V3)
// Handles API calls (isolated from CORS/content scripts), Google authentication, context menus, and storage.

try {
  importScripts('config.js', 'sites.js');
} catch (e) {
  console.error("Failed to load scripts in service worker:", e);
}

// Initialize Context Menus on install
// When the extension is removed, Chrome opens this page so the person can say why. Only the version is added to the address.
try {
  chrome.runtime.setUninstallURL(`https://whyno.tech/uninstalled?v=${encodeURIComponent(chrome.runtime.getManifest().version)}`);
} catch (_) {}

// Keyboard shortcuts (the person can change them at chrome://extensions/shortcuts).
chrome.commands.onCommand.addListener((command) => {
  const type = command === "whyno-write" ? "TRIGGER_WRITE" : command === "whyno-flow" ? "TRIGGER_FLOW" : null;
  if (!type) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (tab && tab.id != null) chrome.tabs.sendMessage(tab.id, { type }).catch(() => {});
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  // After an update, the popup shows a short "what's new" note once.
  if (details && details.reason === "update") {
    chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.WHATS_NEW]: chrome.runtime.getManifest().version });
  }
  // First install: show the short tutorial so people know what each button does.
  if (details && details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome/welcome.html"), active: true });
  }

  chrome.contextMenus.create({
    id: "whyno_root",
    title: "Whyno Write",
    contexts: ["selection", "editable"]
  });

  chrome.contextMenus.create({
    id: "whyno_fix",
    parentId: "whyno_root",
    title: "Fix grammar & spelling",
    contexts: ["selection", "editable"]
  });

  chrome.contextMenus.create({
    id: "whyno_enhance",
    parentId: "whyno_root",
    title: "Enhance prompt (AI mode)",
    contexts: ["selection", "editable"]
  });

  chrome.contextMenus.create({
    id: "whyno_flow",
    parentId: "whyno_root",
    title: "Open Flow discussion",
    contexts: ["selection", "editable"]
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  const actionMap = {
    whyno_fix: "TRIGGER_FIX",
    whyno_enhance: "TRIGGER_ENHANCE",
    whyno_flow: "TRIGGER_FLOW"
  };
  const action = actionMap[info.menuItemId];
  if (action) {
    chrome.tabs.sendMessage(tab.id, {
      type: action,
      selectionText: info.selectionText || ""
    }).catch(err => {
      console.warn("Could not dispatch context action to content script:", err);
    });
  }
});

// Firebase ID tokens last an hour. Refresh a little early so a request never goes out with an expired one.
const TOKEN_REFRESH_AFTER_MS = 50 * 60 * 1000;

function readUser() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CONFIG.STORAGE_KEYS.USER], (result) => resolve(result[CONFIG.STORAGE_KEYS.USER] || null));
  });
}

function saveUser(user) {
  return new Promise((resolve) => chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.USER]: user }, resolve));
}

// Exchanges the long-lived refresh token for a fresh ID token (Firebase Secure Token API).
async function refreshIdToken(user) {
  const resp = await fetch(`https://securetoken.googleapis.com/v1/token?key=${CONFIG.FIREBASE.API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(user.refreshToken)}`
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const updated = Object.assign({}, user, {
    idToken: data.id_token,
    refreshToken: data.refresh_token || user.refreshToken,
    tokenAt: Date.now()
  });
  await saveUser(updated);
  return updated;
}

// Helper: a current ID token for the signed-in user, refreshed when it is about to expire.
async function getAuthToken() {
  const user = await readUser();
  if (!user || !user.idToken) return null;
  const issuedAt = user.tokenAt || user.signedInAt || 0;
  if (user.refreshToken && Date.now() - issuedAt > TOKEN_REFRESH_AFTER_MS) {
    try {
      const fresh = await refreshIdToken(user);
      if (fresh) return fresh.idToken;
    } catch (_) {
      // Fall through to the stored token; the server answers 401 if it has expired.
    }
  }
  return user.idToken;
}

// Central API fetch helper with timeout and auth injection
async function makeApiRequest(endpoint, options = {}, timeoutMs = CONFIG.DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${CONFIG.API_BASE}${endpoint}`;
  const token = await getAuthToken();

  const headers = Object.assign(
    {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    options.headers || {}
  );

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (typeof FormData !== "undefined" && options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timer);

    if (response.status === 429) {
      return {
        ok: false,
        status: 429,
        error: "limit_reached",
        message: "Daily free limit reached. Sign in for more.",
        remaining_quota: 0
      };
    }

    if (response.status === 401) {
      return {
        ok: false,
        status: 401,
        error: "sign_in_required",
        message: "Please sign in with Google to use Whyno Write."
      };
    }

    if (!response.ok) {
      const text = await response.text();
      let parsed = {};
      try { parsed = JSON.parse(text); } catch (_) {}
      return {
        ok: false,
        status: response.status,
        error: parsed.error || `HTTP ${response.status}`,
        message: parsed.detail || parsed.message || `Server error (${response.status})`
      };
    }

    const data = await response.json();
    // Remember the real allowance the server reports, so the popup never has to guess.
    if (data && typeof data.remaining_quota === "number") {
      chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.QUOTA]: { value: data.remaining_quota, at: Date.now() } });
    }
    return {
      ok: true,
      status: response.status,
      data
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return {
        ok: false,
        status: 408,
        error: "timeout",
        message: "Request timed out. Please check your connection and retry."
      };
    }
    return {
      ok: false,
      status: 0,
      error: "network_error",
      message: "Could not reach Whyno server. Please verify your connection."
    };
  }
}

// Turns a Google credential into a Whyno (Firebase) session. Firebase checks Google's signature,
// so the identity stored here always comes from Google, never from whoever sent the message.
async function signInWithGoogleCredential(postBody, requestUri) {
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${CONFIG.FIREBASE.API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postBody, requestUri, returnIdpCredential: false, returnSecureToken: true })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    return { ok: false, error: (err.error && err.error.message) || "Google sign-in failed" };
  }
  const fb = await resp.json();
  const userData = {
    uid: fb.localId,
    email: fb.email,
    displayName: fb.displayName || (fb.email ? fb.email.split("@")[0] : "User"),
    photoUrl: fb.photoUrl || "",
    idToken: fb.idToken,
    refreshToken: fb.refreshToken,
    signedInAt: Date.now(),
    tokenAt: Date.now()
  };
  await saveUser(userData);
  return { ok: true, user: userData };
}

// Only the public parts of the profile ever leave the extension.
function publicProfile(user) {
  return { displayName: user.displayName, email: user.email, photoUrl: user.photoUrl };
}

// ---------------------------------------------------------------- voice (Flow)
//
// The microphone can only be used from an extension page, so recording happens in an
// offscreen document. This worker starts and stops it, passes the live loudness to the tab
// that is listening, and sends the finished recording to the server to be turned into text.

const OFFSCREEN_URL = "offscreen/offscreen.html";
let voiceTabId = null;      // the tab whose Flow card is listening
let micSetupForTab = null;  // the tab to return to after the one-time microphone page

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)]
  });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA"],
    justification: "Records speech while Flow is listening, so it can be turned into text."
  });
}

function toOffscreen(type) {
  return chrome.runtime.sendMessage({ target: "offscreen", type }).catch(() => ({ ok: false, error: "recorder_unavailable" }));
}

async function startVoice(tabId) {
  voiceTabId = tabId;
  await ensureOffscreen();
  return toOffscreen("START");
}

async function stopVoiceAndTranscribe() {
  const recording = await toOffscreen("STOP");
  voiceTabId = null;
  if (!recording || !recording.ok) {
    return { ok: false, error: (recording && recording.error) || "recorder_unavailable" };
  }
  const bytes = Uint8Array.from(atob(recording.audio), (c) => c.charCodeAt(0));
  const type = recording.mimeType || "audio/webm";
  const extension = type.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), `speech.${extension}`);
  // The person's own name helps the recogniser spell it ("Vandan", not "One Done"). Nothing else about the text is sent.
  const speaker = await readUser();
  if (speaker && speaker.displayName) form.append("name", speaker.displayName);
  const res = await makeApiRequest("/api/stt", { method: "POST", body: form }, CONFIG.VOICE_TIMEOUT_MS);
  if (!res.ok) return res;
  return { ok: true, transcript: ((res.data && (res.data.transcript || res.data.text)) || "").trim(), data: res.data };
}

// A tab that closes or navigates while listening must not leave the microphone on.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === voiceTabId) {
    toOffscreen("CANCEL");
    voiceTabId = null;
  }
});

// Main message router for content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  // Messages meant for the recorder page are not for this worker.
  if (message && message.target === "offscreen") return false;

  switch (type) {
    case "VOICE_START": {
      startVoice(sender.tab && sender.tab.id).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }

    case "VOICE_STOP": {
      stopVoiceAndTranscribe().then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }

    case "VOICE_CANCEL": {
      toOffscreen("CANCEL").then(() => sendResponse({ ok: true }));
      voiceTabId = null;
      return true;
    }

    case "VOICE_LEVEL": {
      // From the recorder: pass the loudness on to the listening tab, nothing else.
      if (voiceTabId !== null) chrome.tabs.sendMessage(voiceTabId, { type: "VOICE_LEVEL", level: message.level }).catch(() => {});
      return false;
    }

    case "VOICE_AUTO_STOPPED": {
      if (voiceTabId !== null) chrome.tabs.sendMessage(voiceTabId, { type: "VOICE_AUTO_STOPPED" }).catch(() => {});
      return false;
    }

    case "OPEN_MIC_SETUP": {
      micSetupForTab = sender.tab ? sender.tab.id : null;
      chrome.tabs.create({ url: chrome.runtime.getURL("mic/mic.html") });
      sendResponse({ ok: true });
      return false;
    }

    case "REPORT_RESULT": {
      // Only what the person agreed to send on the card: the original text and the result.
      const r = payload || {};
      const note = `Result report (${String(r.goal || "").slice(0, 20)})\nINPUT:\n${String(r.input || "").slice(0, 800)}\nOUTPUT:\n${String(r.output || "").slice(0, 900)}`;
      makeApiRequest("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ feedback: note, category: "bad_result", app_version: chrome.runtime.getManifest().version })
      }).then((res) => sendResponse({ ok: !!(res && res.ok) }));
      return true;
    }

    case "OPEN_URL": {
      // Only our own pages and the Store listing, so a web page cannot use this to open anything it likes.
      const allowed = /^https:\/\/(chromewebstore\.google\.com\/detail\/whyno-write\/|whyno\.tech\/)/.test(String(payload && payload.url));
      if (allowed) chrome.tabs.create({ url: payload.url });
      sendResponse({ ok: allowed });
      return false;
    }

    case "OPEN_SHORTCUTS": {
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
      sendResponse({ ok: true });
      return false;
    }

    case "OPEN_MIC_SETTINGS": {
      // The browser's own page for this extension's permissions. Setting Microphone to Allow there is permanent.
      chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=${encodeURIComponent("chrome-extension://" + chrome.runtime.id)}` });
      sendResponse({ ok: true });
      return false;
    }

    case "MIC_GRANTED": {
      chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.MIC_SETUP_DONE]: true });
      // Back to where the person was, with Flow listening, and the setup tab closed.
      const returnTo = micSetupForTab;
      micSetupForTab = null;
      if (returnTo !== null) {
        chrome.tabs.update(returnTo, { active: true }).then(() => {
          chrome.tabs.sendMessage(returnTo, { type: "RESUME_FLOW_VOICE" }).catch(() => {});
          if (sender.tab) setTimeout(() => chrome.tabs.remove(sender.tab.id).catch(() => {}), 600);
        }).catch(() => {});
      }
      sendResponse({ ok: true, returning: returnTo !== null });
      return false;
    }

    case "CHECK_HEALTH": {
      makeApiRequest("/health", { method: "GET" }, 5000)
        .then(res => sendResponse(res));
      return true;
    }

    case "CALL_WRITING": {
      // payload: { text, goal: "Fix" | "Enhance" }
      makeApiRequest("/api/writing", {
        method: "POST",
        body: JSON.stringify({
          text: payload.text,
          goal: payload.goal || "Fix"
        })
      })
      .then(res => sendResponse(res));
      return true;
    }

    case "CALL_FLOW": {
      // payload: { text, kind, context }: the notes, what they should become, and what is already in the box
      readUser().then((who) => makeApiRequest("/api/flow", {
        method: "POST",
        body: JSON.stringify({
          text: payload.text,
          kind: payload.kind || "message",
          context: payload.context || null,
          reply_to: payload.reply_to || null,
          user_name: who && who.displayName ? who.displayName : null
        })
      }))
      .then(res => sendResponse(res));
      return true;
    }

    case "CALL_REFINE": {
      // payload: { original, instruction }
      makeApiRequest("/api/flow/refine", {
        method: "POST",
        body: JSON.stringify({
          base_draft: payload.original,
          instruction: payload.instruction,
          kind: payload.kind || "message"
        })
      })
      .then(res => sendResponse(res));
      return true;
    }

    case "GET_USER": {
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.USER, CONFIG.STORAGE_KEYS.MODE_OVERRIDE, CONFIG.STORAGE_KEYS.QUOTA], (data) => {
        sendResponse({
          ok: true,
          user: data[CONFIG.STORAGE_KEYS.USER] || null,
          modeOverride: data[CONFIG.STORAGE_KEYS.MODE_OVERRIDE] || "auto",
          quota: data[CONFIG.STORAGE_KEYS.QUOTA] || null
        });
      });
      return true;
    }

    case "SIGN_OUT": {
      chrome.storage.local.remove([CONFIG.STORAGE_KEYS.USER, CONFIG.STORAGE_KEYS.QUOTA], () => {
        sendResponse({ ok: true });
      });
      return true;
    }

    case "SET_MODE_OVERRIDE": {
      chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.MODE_OVERRIDE]: payload.mode }, () => {
        sendResponse({ ok: true });
      });
      return true;
    }

    case "GET_FLOW_SESSION": {
      if (chrome.storage.session) {
        chrome.storage.session.get([payload.sessionKey], (res) => {
          sendResponse({ ok: true, data: res[payload.sessionKey] || null });
        });
      } else {
        sendResponse({ ok: true, data: null });
      }
      return true;
    }

    case "SET_FLOW_SESSION": {
      if (chrome.storage.session) {
        chrome.storage.session.set({ [payload.sessionKey]: payload.data }, () => {
          sendResponse({ ok: true });
        });
      } else {
        sendResponse({ ok: true });
      }
      return true;
    }

    default:
      sendResponse({ ok: false, error: "unknown_message_type" });
      return false;
  }
});

// External messages from the sign-in page at whyno.tech/extension.
// The page sends Google's signed credential; this worker exchanges it with Firebase itself.
// A ready-made user object from a page is never accepted, because a page could make one up.
const SIGN_IN_ORIGINS = ["https://whyno.tech", "https://www.whyno.tech", "http://localhost:3000"];

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message && message.type === "PING") {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version, name: "Whyno Write" });
    return true;
  }

  if (message && message.type === "GOOGLE_CREDENTIAL" && typeof message.credential === "string") {
    const origin = sender.origin || (sender.url ? new URL(sender.url).origin : "");
    if (!SIGN_IN_ORIGINS.includes(origin)) {
      sendResponse({ ok: false, error: "origin_not_allowed" });
      return false;
    }
    signInWithGoogleCredential(`id_token=${message.credential}&providerId=google.com`, origin)
      .then((res) => sendResponse(res.ok ? { ok: true, user: publicProfile(res.user) } : { ok: false, error: res.error }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  sendResponse({ ok: false, error: "unknown_external_message" });
  return false;
});
