// Development only: fake extension APIs and server replies for the test pages.
    window.__WHYNO_HARNESS__ = true;
    const params = new URLSearchParams(location.search);
    const signedIn = params.get("signedIn") !== "0" && params.get("demo") !== "signin";
    const fail = params.get("fail");
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    // A small in-memory chrome.storage.local, so settings, history and offsets can be tried.
    const store = {};
    const storageListeners = [];
    const storageArea = {
      get(keys, cb) {
        const out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (k in store) out[k] = JSON.parse(JSON.stringify(store[k])); });
        cb && setTimeout(() => cb(out), 0);
      },
      set(items, cb) {
        const changes = {};
        for (const k of Object.keys(items)) { changes[k] = { oldValue: store[k], newValue: items[k] }; store[k] = JSON.parse(JSON.stringify(items[k])); }
        cb && setTimeout(cb, 0);
        setTimeout(() => storageListeners.forEach((fn) => fn(changes, "local")), 0);
      }
    };
    window.__wnStore = store;

    window.chrome = {
      runtime: {
        lastError: undefined,
        getURL: (p) => "/" + p,
        getManifest: () => ({ version: "1.3.0" }),
        onMessage: { addListener(fn) { (window.__wnListeners ||= []).push(fn); } },
        async sendMessage(msg, cb) {
          let res = { ok: false };
          const emit = (m) => (window.__wnListeners || []).forEach((fn) => fn(m));
          if (msg.type === "VOICE_START") {
            if (params.get("mic") === "denied") res = { ok: false, error: "mic_permission" };
            else {
              res = { ok: true };
              // Fake speech: loudness rising and falling.
              let n = 0;
              clearInterval(window.__wnLevels);
              window.__wnLevels = setInterval(() => emit({ type: "VOICE_LEVEL", level: Math.abs(Math.sin(n++ / 3)) * (0.4 + Math.random() * 0.6) }), 70);
            }
            return cb && cb(res);
          }
          if (msg.type === "VOICE_STOP" || msg.type === "VOICE_CANCEL") clearInterval(window.__wnLevels);
          if (["VOICE_CANCEL", "OPEN_MIC_SETUP", "OPEN_MIC_SETTINGS", "OPEN_URL", "OPEN_SHORTCUTS", "REPORT_RESULT"].includes(msg.type)) {
            (window.__wnSent ||= []).push(msg);
            return cb && cb({ ok: true });
          }
          if (msg.type === "VOICE_STOP") {
            await delay(600);
            return cb && cb({ ok: true, transcript: "um so tell the team standup moves to eleven tomorrow not ten because dentist, cameras optional", data: { remaining_quota: 86 } });
          }
          if (msg.type === "GET_USER") res = { ok: true, modeOverride: params.get("mode") || "auto", user: signedIn ? { idToken: "t", displayName: "Test", email: "test@example.com" } : null };
          else {
            await delay(700);
            if (fail === "401") res = { ok: false, status: 401, error: "sign_in_required" };
            else if (fail === "offline") res = { ok: false, status: 0, error: "network_error" };
            else if (msg.type === "CALL_WRITING" && params.get("fix") === "failed") res = { ok: true, data: { text: msg.payload.text, failed: true } };
            else if (msg.type === "CALL_WRITING" && params.get("fix") === "same") res = { ok: true, data: { text: msg.payload.text, changed: false, remaining_quota: 80 } };
            else if (msg.type === "CALL_FLOW" && params.get("flow") === "empty") res = { ok: true, data: { draft: "", empty: true, remaining_quota: 80 } };
            else if (msg.type === "CALL_FLOW" && params.get("flow") === "chatter") res = { ok: true, data: { draft: "It looks like you sent an empty message or just a period. Please provide the speech notes you would like me to convert.", remaining_quota: 80 } };
            else if (msg.type === "CALL_WRITING") res = { ok: true, data: { text: msg.payload.goal === "Enhance" ? "Write a friendly 300-word blog post about saving money for college students, with five practical tips." : (location.pathname.includes("showcase") ? "Hi Priya, I finished the quarterly report yesterday and will send it tomorrow morning after a final check. Let me know if you need anything else." : "I finished the report yesterday and will send it tomorrow morning."), remaining_quota: 87 } };
            else if (msg.type === "CALL_FLOW") res = { ok: true, data: { draft: "Hi team,\n\nTomorrow's standup moves to 11:00 AM instead of 10:00 AM because I have a dentist appointment. Cameras are optional.\n\nThanks!", remaining_quota: 86 } };
            else if (msg.type === "CALL_REFINE") res = { ok: true, data: { draft: "Hey team, standup's at 11 tomorrow, not 10 (dentist). Cameras optional!", remaining_quota: 85 } };
          }
          cb && cb(res);
        }
      },
      storage: { local: storageArea, onChanged: { addListener(fn) { storageListeners.push(fn); } } }
    };
