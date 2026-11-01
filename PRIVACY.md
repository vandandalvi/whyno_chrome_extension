# Whyno Write — Privacy Policy & Architecture

Last updated: October 2026

**Whyno Write** was engineered from day one with a strict privacy-first architecture. It functions as an on-demand typing companion, not a background keylogger or tracking engine.

---

## 1. What Whyno Write DOES NOT Do

- **NO Keystroke Monitoring**: Whyno Write never listens to, captures, or transmits arbitrary keystrokes (`keydown`, `keypress`, `keyup`).
- **NO Background Scanning**: The extension does not read or inspect background page contents unless you explicitly interact with a focused input or select text.
- **NO Third-Party Analytics**: Whyno Write does not load Google Analytics, Mixpanel, Segment, or any other tracking scripts.
- **NO Plaintext Storage**: Authentication tokens are stored securely in local browser storage (`chrome.storage.local`). The extension holds no secret keys or passwords.

---

## 2. When Does Text Leave Your Browser?

Text leaves your browser **ONLY** when you explicitly perform one of the following intentional actions:
1. **Click "Fix"**: The selected text or active field text is sent to `POST /api/writing` with `goal: "Fix"` to correct spelling, grammar, and disfluency.
2. **Click "Enhance"**: The prompt text is sent to `POST /api/writing` with `goal: "Enhance"` to generate a structured AI prompt.
3. **Click "Flow"**: The draft text is sent to `POST /api/flow` to generate an initial draft.
4. **Click a Refine Chip or Send a Follow-Up**: The current draft and your specific instruction are sent to `POST /api/flow/refine`.

---

## 3. What Server Receives the Data?

- All requests are routed through your configured backend:
  ```text
  http://20.198.80.178 (or your custom HTTPS domain configured in config.js)
  ```
- **Authentication**: If signed in, an `Authorization: Bearer <Firebase ID token>` header is included so your requests count against your 100/day user quota. If signed out, an anonymous quota (20/day) is tracked by client IP.
- **Zero Audio Storage**: Any audio captured for voice transcription is streamed in memory, transcribed via Whisper, and immediately discarded. Audio is never stored on disk or logged.

---

## 4. Session Storage & Lifecycle

- Conversation turns in the **Flow** discussion drawer are saved exclusively in:
  ```text
  chrome.storage.session
  ```
- `chrome.storage.session` is an in-memory browser storage mechanism that **automatically wipes clean whenever your browser closes**. Flow conversations do not persist across browser sessions. Separately, the extension can keep your last five results in `chrome.storage.local` so a result is never lost. They stay on your device, are never sent anywhere, and can be turned off or cleared in the popup. Small settings (sites where the button is hidden, where you moved the button, sounds) are stored the same way. Snippets you save are stored the same way and never sent anywhere.

- **Reply context**: on Gmail, WhatsApp Web, LinkedIn and Slack, when you tap Flow, the extension reads the latest message you are replying to (up to 1,500 characters) and sends it with your request so the reply fits it. It is shown on the card, you can remove it before speaking, it is not stored, and it can be switched off in the popup.
- **Reports**: if you tap the thumbs-down on a result and confirm, your original text and that result are sent to Whyno to improve the service. Nothing is sent unless you confirm.
- **Uninstall page**: when the extension is removed, the browser opens https://whyno.tech/uninstalled?v=<version> so you can say why. Answering is optional and sends only what you type and tick; an email is stored only if you ask to be contacted.

---

## 5. Chrome Permissions Explanation

| Permission | Purpose |
| :--- | :--- |
| `activeTab` | Grants temporary access to the active page solely when you interact with the extension, without requiring broad permissions across all websites. |
| `storage` | Stores your optional Google sign-in token and mode preference (`chrome.storage.local`), and temporary Flow conversations (`chrome.storage.session`). |
| `contextMenus` | Adds quick right-click context options ("Fix grammar", "Enhance prompt", "Open Flow") for highlighted text. |
| `scripting` | Coordinates text replacement and floating toolbar insertion inside editable fields. |
| `identity` | Facilitates optional Google OAuth2 login via `chrome.identity.launchWebAuthFlow`. |
