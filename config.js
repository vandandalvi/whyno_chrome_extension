// Whyno Write Configuration
// Central configuration for all API endpoints, timeouts, and auth settings.

const CONFIG = {
  // Live Azure VM Backend
  API_BASE: "https://api.whyno.tech",
  
  // Network Timeouts
  DEFAULT_TIMEOUT_MS: 16000, // 16 seconds for text generation: the server may retry once before it answers
  VOICE_TIMEOUT_MS: 30000,   // 30 seconds for speech-to-text audio upload

  // Storage Keys
  STORAGE_KEYS: {
    USER: "whyno_user",
    MODE_OVERRIDE: "whyno_mode_override", // "auto" | "ai" | "normal"
    THEME: "whyno_theme",                // "system" | "light" | "dark"
    QUOTA: "whyno_quota",                // { value, at }: the last allowance the server reported
    HIDDEN_SITES: "whyno_hidden_sites",  // ["example.com"]: sites where the person turned the button off
    PILL_OFFSETS: "whyno_pill_offsets",  // { "example.com": { dx, dy } }: where the person dragged the button
    SOUNDS: "whyno_sounds",              // true: a soft tick when text is replaced
    HISTORY_ON: "whyno_history_on",      // false: do not keep recent results on this device
    HISTORY: "whyno_history",            // the last few results, kept only in this browser
    USE_COUNT: "whyno_use_count",        // how many times text was replaced, for the review nudge
    REVIEW_STATE: "whyno_review_state",  // "asked" | "done"
    WHATS_NEW: "whyno_whats_new",        // version whose notes have not been seen yet
    MIC_SETUP_DONE: "whyno_mic_setup_done",
    SNIPPETS: "whyno_snippets",              // [{ id, name, text }]: short texts the person saved, kept only in this browser
    CALM: "whyno_calm",                      // true: no animations
    REPLY_CONTEXT: "whyno_reply_context"     // false: do not read the message being replied to
  },

  STORE_URL: "https://chromewebstore.google.com/detail/whyno-write/edaakbeimhjjjljalhnkaeonbfnlaeoj",
  DAILY_ALLOWANCE: 100,

  // Firebase Web Client Config for Google Sign-in
  FIREBASE: {
    PROJECT_ID: "whyno-2026",
    CLIENT_ID: "754246425325-5pdao4674tiuhdfqimfev7uu8h1hodtn.apps.googleusercontent.com",
    API_KEY: "AIzaSyD94H987yxOPv-e4wRNXUQuQrdO-KWhk6I"
  }
};

// Export for ES modules / service worker importScripts / window globals
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
} else if (typeof globalThis !== "undefined") {
  globalThis.CONFIG = CONFIG;
}
