// The one-time microphone page. Asking from an extension page makes Chrome grant the
// microphone to Whyno Write itself, so Flow can then record on any site without asking again.

const show = (id) => {
  for (const section of document.querySelectorAll("main > section")) section.hidden = section.id !== id;
};

async function ask() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    show("done");
    // Tell the background worker, which brings the original tab back and starts Flow listening.
    chrome.runtime.sendMessage({ type: "MIC_GRANTED" }, (res) => {
      void chrome.runtime.lastError;
      if (!res || !res.returning) document.getElementById("doneText").textContent = "Go back to your tab and tap Flow.";
    });
  } catch (e) {
    show(e && e.name === "NotFoundError" ? "nomic" : "blocked");
  }
}

document.getElementById("allowBtn").addEventListener("click", ask);
// The browser's own page for this extension. Setting Microphone to Allow there is permanent.
for (const b of document.querySelectorAll("[data-settings]")) {
  b.addEventListener("click", () => chrome.runtime.sendMessage({ type: "OPEN_MIC_SETTINGS" }));
}
document.getElementById("retryBtn").addEventListener("click", ask);
document.getElementById("retryBtn2").addEventListener("click", ask);

// If it is already allowed (or Chrome will ask straight away), skip the extra click.
if (navigator.permissions && navigator.permissions.query) {
  navigator.permissions.query({ name: "microphone" }).then((status) => {
    if (status.state === "granted") ask();
    else if (status.state === "denied") show("blocked");
  }).catch(() => {});
}
