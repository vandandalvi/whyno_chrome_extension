// Whyno Write recorder (offscreen document).
//
// Records speech for Flow while the person talks, reports how loud it is so the
// card can draw a live waveform, and hands back the recording when they tap Done.
// Audio stays in memory and is dropped as soon as it has been handed back.

const MAX_RECORDING_MS = 3 * 60 * 1000;

let stream = null;
let recorder = null;
let chunks = [];
let levelTimer = null;
let stopTimer = null;
let audioContext = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.target !== "offscreen") return false;

  if (message.type === "START") {
    start().then(sendResponse);
    return true;
  }
  if (message.type === "STOP") {
    stop().then(sendResponse);
    return true;
  }
  if (message.type === "CANCEL") {
    cleanup();
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

async function start() {
  cleanup();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
  } catch (e) {
    const name = e && e.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      // Say why it was refused: Chrome has it blocked, Chrome allows it but the system is blocking it,
      // or it was never allowed. The card shows a different fix for each.
      return { ok: false, error: "mic_permission", permission: await microphoneState() };
    }
    return { ok: false, error: name === "NotFoundError" ? "no_mic" : "mic_busy" };
  }

  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(250);

  // Loudness, several times a second, for the waveform on the card.
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  levelTimer = setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) {
      const v = (s - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / samples.length);
    const level = Math.min(1, Math.sqrt(rms * 4));
    chrome.runtime.sendMessage({ type: "VOICE_LEVEL", level }).catch(() => {});
  }, 70);

  // A forgotten recording stops itself.
  stopTimer = setTimeout(() => {
    chrome.runtime.sendMessage({ type: "VOICE_AUTO_STOPPED" }).catch(() => {});
  }, MAX_RECORDING_MS);

  return { ok: true, startedAt: Date.now() };
}

async function stop() {
  if (!recorder) return { ok: false, error: "not_recording" };
  const active = recorder;
  const done = new Promise((resolve) => {
    active.onstop = resolve;
  });
  if (active.state !== "inactive") active.stop();
  await done;
  const blob = new Blob(chunks, { type: active.mimeType || "audio/webm" });
  cleanup();
  // Under half a second is a stray tap, not speech.
  if (blob.size < 4000) return { ok: false, error: "too_short" };
  return { ok: true, audio: await toBase64(blob), mimeType: blob.type };
}

/** "granted", "denied" or "prompt" for the microphone, or "unknown" if Chrome will not say. */
async function microphoneState() {
  try {
    const status = await navigator.permissions.query({ name: "microphone" });
    return status.state;
  } catch (_) {
    return "unknown";
  }
}

function cleanup() {
  clearInterval(levelTimer);
  clearTimeout(stopTimer);
  levelTimer = null;
  stopTimer = null;
  if (recorder && recorder.state !== "inactive") {
    try {
      recorder.stop();
    } catch (_) {}
  }
  recorder = null;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  if (audioContext) audioContext.close().catch(() => {});
  audioContext = null;
  chunks = [];
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
