"""
Builds the Chrome Web Store upload: a zip of only the files the extension runs.

    python tools/package.py

Writes ../Whyno Write builds/whyno-write-<version>.zip, next to this folder (never
inside it, so a build is never packed into the next build).

Left out: dev test pages, tools, notes (*.md), key.txt, and the manifest's "key"
field. The "key" pins the extension ID for local testing; the Web Store rejects
it and assigns the extension its own ID.
"""

import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT_DIR = ROOT.parent / "Whyno Write builds"

INCLUDE = [
    "manifest.json",
    "background.js",
    "config.js",
    "sites.js",
    "content/content.js",
    "content/content.css",
    "styles/tokens.css",
    "popup/popup.html",
    "popup/popup.css",
    "popup/popup.js",
    "mic/mic.html",
    "mic/mic.css",
    "mic/mic.js",
    "offscreen/offscreen.html",
    "offscreen/offscreen.js",
    "welcome/welcome.html",
    "welcome/welcome.css",
    "welcome/welcome.js",
    "welcome/demo.js",
    "welcome/apps/chatgpt.png",
    "welcome/apps/claude.png",
    "welcome/apps/gemini.png",
    "welcome/apps/perplexity.png",
    "welcome/apps/copilot.png",
    "welcome/apps/deepseek.png",
    "welcome/apps/gmail.svg",
    "welcome/apps/whatsapp.svg",
    "welcome/apps/slack.svg",
    "welcome/apps/linkedin.svg",
    "welcome/apps/notion.svg",
    "welcome/apps/googledocs.svg",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
]


def main():
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    manifest.pop("key", None)
    version = manifest["version"]

    missing = [f for f in INCLUDE if not (ROOT / f).is_file()]
    if missing:
        raise SystemExit(f"Missing files: {missing}")

    # Every file the manifest and pages point at must be in the zip.
    referenced = {manifest["background"]["service_worker"], manifest["action"]["default_popup"]}
    for script in manifest["content_scripts"]:
        referenced.update(script.get("js", []))
    for group in manifest["web_accessible_resources"]:
        referenced.update(group["resources"])
    referenced.update(manifest["icons"].values())
    unlisted = sorted(r for r in referenced if r not in INCLUDE)
    if unlisted:
        raise SystemExit(f"Referenced by the manifest but not packaged: {unlisted}")

    OUT_DIR.mkdir(exist_ok=True)
    target = OUT_DIR / f"whyno-write-{version}.zip"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        for rel in INCLUDE:
            if rel != "manifest.json":
                z.write(ROOT / rel, rel)
    print(f"{target}  ({target.stat().st_size // 1024} KB, {len(INCLUDE)} files, version {version})")


if __name__ == "__main__":
    main()
