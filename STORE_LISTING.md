# Chrome Web Store: Whyno Write

Everything the Developer Dashboard asks for, ready to copy. Files are in
`C:\Whyno Write builds\` (the zip) and `C:\Whyno Write builds\store\` (images).

## Before you submit (must be done first)

1. **HTTPS for the API: code side done.** `config.js` and `manifest.json` already point at
   `https://api.whyno.tech`, and `whyno-write-1.1.0.zip` has been rebuilt with that.
   Still needed, in this order:
   - **DNS:** add `A  api  ->  20.198.80.178` at the registrar. As of 2026-10-19 the domain's
     own name servers still return "does not exist" for `api.whyno.tech`.
   - **Azure firewall:** the VM currently blocks SSH (22) and HTTPS (443) from outside.
     Open 443 for everyone, and 22 for your IP only.
   - **Server:** once DNS resolves and SSH works, run `deploy/setup-https.sh` (in the
     backend folder) on the VM. It installs the nginx site, gets the certificate, and checks it.
2. **Push the website** so the privacy link works (already live at
   `https://www.whyno.tech/privacy-policy/whyno-write`).
3. **Developer account:** https://chrome.google.com/webstore/devconsole. Pay the one-time
   US$5 fee and verify the contact email.

## Upload

Developer Dashboard → **New item** → upload `whyno-write-1.1.0.zip`.

After the first upload the Store shows the item's **ID** (32 letters). Add it at the top of
`EXTENSION_IDS` in `C:\projects\whyno\app\extension\page.tsx` and push, so whyno.tech can sign
the Store version in.

## Store listing tab

**Name:** Whyno Write

**Summary** (132 characters max):
Fix, Enhance and Flow on any website: fix your writing, sharpen AI prompts, and turn a spoken brain dump into a polished message.

**Description:**

Whyno Write puts three writing tools next to any text box on the web.

FIX
Tap Fix to correct spelling, grammar and clarity in an email, a message or a form. You see the suggestion first and choose whether to replace your text.

ENHANCE
On AI chat sites like ChatGPT, Claude and Gemini, the same button becomes Enhance. It turns a rough prompt into a clear, specific one so you get better answers.

FLOW
Tap Flow and just talk. Say what you want to write, however it comes out, and Flow turns it into a clear message ready to send. Not happy with it? Tap Shorter, More formal, Friendlier or Bullet points, or say what to change. Then insert it where your cursor is. Prefer typing? Flow works with typed notes too.

HOW IT WORKS
• Click into any text box and the Whyno button appears beside it.
• Select part of your text to work on just that part.
• Nothing on the page changes until you choose Replace or Insert.
• Right-click any text box or selection for the same tools.

PRIVACY
• Your text is read only when you tap Fix, Enhance or Flow.
• The microphone is used only while Flow shows it is listening.
• Your text and recordings are not stored.
• Never shown on password, email, phone or card-number fields.

Sign in with your Google account to start. Free daily allowance included.

**Category:** Productivity → Tools (or "Communication" if offered)
**Language:** English

**Graphic assets:**
- Store icon: `icons/icon128.png` (128×128)
- Screenshots (1280×800), in this order:
  1. `screenshot-launcher.png`
  2. `screenshot-fix.png`
  3. `screenshot-flow-listen.png`
  4. `screenshot-flow-result.png`
  5. `screenshot-signin.png`
- Small promo tile (440×280): `promo-small-440x280.png`

**Official URL:** https://www.whyno.tech
**Homepage URL:** https://www.whyno.tech
**Support URL / email:** privacy@whyno.tech (or a support address you prefer)

## Privacy practices tab

**Single purpose:**
Helps you write on any website: corrects text you have written (Fix), improves prompts on AI chat sites (Enhance), and turns your spoken or typed notes into a polished message (Flow), inserted only when you choose.

**Permission justifications:**
- `storage`: Keeps the user signed in (account name, email, photo and sign-in tokens), their Fix/Enhance button preference, and the last daily allowance number shown in the popup.
- `contextMenus`: Adds "Whyno Write" to the right-click menu on text boxes and selected text, offering Fix, Enhance and Flow.
- `offscreen`: Flow records the user's voice after they tap Flow and allow the microphone. Chrome only allows extensions to use the microphone from an offscreen document; recording stops when the user taps Done, closes the card or leaves the page.
- **Host permission (`https://api.whyno.tech/*`)**: The extension's own server, which turns the text or recording the user chose to send into the result.
- **Content script on all sites (`http://*/*`, `https://*/*`)**: The tools are for writing anywhere on the web (email, chat, forms, AI chat sites), so the Whyno button must be able to appear next to whichever text box the user is typing in. It reads a text box only when the user taps Fix, Enhance or Flow, and never on password, email, phone or card-number fields.

**Are you using remote code?** No. (All JavaScript is in the package. The extension only exchanges data with its API and Google's sign-in services.)

**Data usage** (tick these):
- Personally identifiable information: **Yes** (name, email address from Google sign-in)
- Authentication information: **Yes** (sign-in tokens)
- Personal communications: **Yes** (the text and voice the user chooses to send to Fix, Enhance or Flow)
- Website content: **Yes** (the text in the text box or selection, when the user taps a tool)
- Health, financial and payment, location, web history, user activity: **No**

Certify all three:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://www.whyno.tech/privacy-policy/whyno-write

## Distribution tab

- Visibility: **Public** (or **Unlisted** for a quiet first release: only people with the link can install).
- Regions: All regions.

## Notes for the reviewer (Test instructions field)

Sign in by clicking the extension icon → Continue with Google (any Google account works; it opens https://whyno.tech/extension). Then click into any text box (for example a Gmail draft or the ChatGPT prompt box): a small Whyno button appears at the top right of the box with Fix (Enhance on AI chat sites) and Flow. Flow asks for the microphone once through an extension page; you can also tap "Type instead". Nothing on the page changes until you press Replace or Insert.

## Review time

Usually a few days; extensions with access to all sites can take longer. If rejected, the
email names the policy; fix and resubmit with a higher version number in `manifest.json`.
