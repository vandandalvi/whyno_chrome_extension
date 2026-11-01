# Whyno Write — Chrome Extension (Manifest V3)

**Whyno Write** is an intelligent on-page drafting, prompt enhancement, and grammar correction companion for your web browser. Built for the **Whyno AI Keyboard** ecosystem, it brings the tactile, frosted-glass interface of the Whyno mobile app directly into web editors and AI chat interfaces.

---

## 1. Quick Start: How to Load Unpacked in Chrome

1. Open Google Chrome.
2. In the address bar, navigate to:
   ```text
   chrome://extensions/
   ```
3. In the top right corner, toggle **Developer mode** to **ON**.
4. Click the **Load unpacked** button in the top left.
5. In the file browser dialog, select the folder:
   ```text
   C:\Whyno Chrome Extension
   ```
6. The extension **Whyno Write** will now be loaded and visible in your Chrome extensions bar.
7. Click the extension puzzle icon in Chrome's toolbar and pin **Whyno Write** for easy access.

---

## 2. Configuration & Backend Base URL

All backend network endpoints are defined in a single file: [`config.js`](./config.js).

```javascript
const CONFIG = {
  API_BASE: "http://20.198.80.178", // Live Azure VM
  DEFAULT_TIMEOUT_MS: 10000,        // 10s text timeout
  VOICE_TIMEOUT_MS: 30000           // 30s audio timeout
};
```

To switch to a custom domain or HTTPS (e.g., `https://api.whyno.tech`), simply update `API_BASE` in `config.js` and reload the extension in `chrome://extensions/`.

---

## 3. Real Server Endpoints (Verified Against Live VM)

All requests and responses below were verified against the live Azure production server at `http://20.198.80.178`.

### A. Health Check
- **Endpoint**: `GET /health`
- **Headers**: None
- **Response** (`200 OK`):
  ```json
  {
    "status": "ok",
    "service": "Whyno AI Server",
    "auth": "Firebase Google Token (sign-in required)",
    "quota_reset": "Midnight IST (Asia/Kolkata)",
    "models": {
      "llm": "qwen/qwen3.8-27b",
      "fast": "openai/gpt-oss-20b",
      "stt": "whisper-large-v3-turbo"
    }
  }
  ```

### B. Grammar & Spelling Fix (Normal Mode)
- **Endpoint**: `POST /api/writing`
- **Headers**: `Content-Type: application/json`, optional `Authorization: Bearer <idToken>`
- **Request Body**:
  ```json
  {
    "text": "Helo wrld this is bad grammer",
    "goal": "Fix"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "text": "Hello world, this is bad grammar.",
    "remaining_quota": 19
  }
  ```

### C. Prompt Enhancement (AI Mode)
- **Endpoint**: `POST /api/writing`
- **Headers**: `Content-Type: application/json`, optional `Authorization: Bearer <idToken>`
- **Request Body**:
  ```json
  {
    "text": "write a python script to parse logs",
    "goal": "Enhance"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "text": "# Role\nYou are a Senior Python Developer and DevOps Engineer...\n\n# Task\nWrite a robust, production-ready Python script to parse log files...",
    "remaining_quota": 18
  }
  ```

### D. Initial Flow Drafting
- **Endpoint**: `POST /api/flow`
- **Headers**: `Content-Type: application/json`, optional `Authorization: Bearer <idToken>`
- **Request Body**:
  ```json
  {
    "text": "reschedule demo to thursday 3pm"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "draft": "Subject: Rescheduling Demo to Thursday at 3:00 PM\n\nHi [Name],\n\nI’d like to propose rescheduling our upcoming demo to this Thursday at 3:00 PM...",
    "text": "Subject: Rescheduling Demo to Thursday at 3:00 PM...",
    "changed": true,
    "remaining_quota": 17
  }
  ```

### E. Iterative Flow Refinement
- **Endpoint**: `POST /api/flow/refine`
- **Headers**: `Content-Type: application/json`, optional `Authorization: Bearer <idToken>`
- **Request Body**:
  ```json
  {
    "original": "Hi Alex, can we meet Thursday at 3pm?",
    "instruction": "More formal"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "draft": "Dear Alex,\n\nI would like to propose a meeting on Thursday at 3:00 PM. Please let me know if this time is convenient for you.\n\nBest regards,",
    "text": "Dear Alex,\n\nI would like to propose a meeting on Thursday at 3:00 PM. Please let me know if this time is convenient for you.\n\nBest regards,",
    "changed": true,
    "remaining_quota": 16
  }
  ```

### F. Speech-to-Text Voice Input
- **Endpoint**: `POST /api/stt`
- **Headers**: `multipart/form-data`, optional `Authorization: Bearer <idToken>`
- **Form Field**: `file` (`audio/wav`, `audio/m4a`, or `audio/webm`)
- **Response** (`200 OK`):
  ```json
  {
    "transcript": "Hello, can we meet tomorrow at five?",
    "remaining_quota": 15
  }
  ```

### G. Account Authentication & Token Exchange
- **Endpoint**: `POST /api/auth/token`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "vandandalvi@gmail.com"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "ok": true,
    "idToken": "eyJhbGciOiJSUzI1NiIs...",
    "user": {
      "uid": "buKficbO35eQ0S8XAWbCxlulWe52",
      "email": "vandandalvi@gmail.com",
      "displayName": "VANDAN DALVI",
      "photoUrl": "https://lh3.googleusercontent.com/..."
    }
  }
  ```

### H. Quota Exhaustion (429)
When the daily quota is reached:
- **HTTP Status**: `429 Too Many Requests`
- **Response**:
  ```json
  {
    "error": "limit_reached",
    "remaining_quota": 0,
    "message": "Daily free limit reached. Sign in for more."
  }
  ```

---

## 4. Google Sign-In & Pinned Redirect URI

The extension is configured with a fixed RSA key in `manifest.json`, which pins the extension ID and redirect URI deterministically across all installs:

- **Extension ID**: `hcegeekcjcncachhljgnhomndhekbljj`
- **Redirect URI**: `https://hcegeekcjcncachhljgnhomndhekbljj.chromiumapp.org/`

### Two Ways to Sign In:
1. **Instant Whyno Email Sign-In (Recommended)**:
   In the extension popup, enter your registered email (e.g. `vandandalvi@gmail.com`) and click **Sign In**. The server authenticates against Firebase Admin SDK and immediately issues your verified ID token with your user profile and 100 requests allowance.
2. **1-Click Google OAuth**:
   To enable the "Continue with Google" popup button without Google blocking it with `Error 400: redirect_uri_mismatch`:
   - Go to [Google Cloud Console &rarr; Credentials](https://console.cloud.google.com/apis/credentials).
   - Click your Web Client ID (`754246425325-5pdao4674tiuhdfqimfev7uu8h1hodtn.apps.googleusercontent.com`).
   - Under **Authorized redirect URIs**, add:
     ```text
     https://hcegeekcjcncachhljgnhomndhekbljj.chromiumapp.org/
     ```
   - Click **Save**.

---

## 5. Manual Test Checklist

| Check | Environment | Expected Behavior |
| :--- | :--- | :--- |
| **1. AI Mode: Enhance** | `chatgpt.com` / `claude.ai` | Select rough prompt &rarr; tap Enhance &rarr; Working state pulses &rarr; Ready card displays enhanced prompt &rarr; Replace updates editor. |
| **2. AI Mode: Flow** | `chatgpt.com` | Open Flow drawer &rarr; perform 2-3 refinement turns via chips &rarr; click "Send to AI" &rarr; text is inserted into `#prompt-textarea` **WITHOUT** triggering send. |
| **3. Normal Mode: Fix** | Gmail compose / Google Docs | Select text with typos &rarr; tap Fix &rarr; Replace changes text in place. |
| **4. Normal Mode: Flow** | Gmail / Slack / Reddit | Open Flow drawer &rarr; draft message &rarr; click "Insert" &rarr; message inserted into active field. |
| **5. Quota Limits** | Any site | Exhaust quota &rarr; graceful error badge ("Daily free limit reached. Sign in for more.") &rarr; page remains usable. |
| **6. Network Disconnect** | Any site | Offline state shows inline retry button &rarr; no browser alert dialogs or uncaught errors. |
| **7. Dark / Light Themes** | Chrome DevTools | Toggle `prefers-color-scheme` &rarr; ambient blooms, frosted glass cards, and pill buttons adapt seamlessly. |

---

## 6. Live Server Verification Notes

- **Verified Live**:
  - `GET /health`: Verified live returning `qwen/qwen3.8-27b` and `whisper-large-v3-turbo`.
  - `POST /api/writing` (`goal: "Fix"`): Verified live fixing spelling/grammar.
  - `POST /api/writing` (`goal: "Enhance"`): Verified live returning detailed multi-section prompt templates.
  - `POST /api/flow`: Verified live generating email subject and structured body.
  - `POST /api/flow/refine`: Verified live applying tone adjustment instructions.
  - `POST /api/auth/token`: Verified live issuing real Firebase ID token, profile photo, and user name for `vandandalvi@gmail.com`.
  - `POST /admin/login`: Verified live authentication and dashboard telemetry.
