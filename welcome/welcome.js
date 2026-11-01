// Welcome tutorial: step content, navigation, and the story-style progress bar. The animated demos live in demo.js.
(function () {
  const SIGN_IN_URL = "https://whyno.tech/extension";

  const AI_APPS = [
    ["ChatGPT", "chatgpt.png"], ["Claude", "claude.png"], ["Gemini", "gemini.png"],
    ["Perplexity", "perplexity.png"], ["Copilot", "copilot.png"], ["DeepSeek", "deepseek.png"]
  ];
  const EVERYDAY_APPS = [
    ["Gmail", "gmail.svg"], ["WhatsApp", "whatsapp.svg"], ["Slack", "slack.svg"],
    ["LinkedIn", "linkedin.svg"], ["Notion", "notion.svg"], ["Google Docs", "googledocs.svg"]
  ];

  const STEPS = [
    {
      tag: "Any website",
      title: "Fix it in one tap.",
      desc: "Type anything, then tap Fix. Spelling, grammar and punctuation are corrected, and it still sounds like you.",
      apps: EVERYDAY_APPS, more: "and every other site"
    },
    {
      tag: "AI apps",
      title: "Enhance your prompts.",
      desc: "On AI apps the same button becomes Enhance. It turns a rough prompt into a sharper one, so the answer you get back is better.",
      apps: AI_APPS, more: "and more"
    },
    {
      tag: "AI apps",
      title: "Just say your prompt.",
      desc: "Tap Flow and talk. Whyno turns your rambling into a clear prompt, ready to send. Change it with one tap.",
      apps: AI_APPS, more: "and more"
    },
    {
      tag: "Email, chat and docs",
      title: "Just say your message.",
      desc: "Everywhere else, Flow turns what you say into a polished message. Then tap Shorter or Friendlier, or just say what to change.",
      apps: EVERYDAY_APPS, more: "and every other site"
    }
  ];
  const TOTAL = STEPS.length;

  const $ = (id) => document.getElementById(id);
  const segs = Array.from(document.querySelectorAll(".seg"));
  const copy = $("copy");
  const backBtn = $("tourBack");
  const nextBtn = $("tourNext");
  const startBtn = $("tourStart");
  const tryBtn = $("tourTry");
  let current = 0;
  let autoplay = true; // moves on by itself until the person takes over

  function renderCopy(step, index) {
    $("stepTag").innerHTML = `<b>${index + 1}</b>${step.tag}`;
    $("stepTitle").textContent = step.title;
    $("stepDesc").textContent = step.desc;
    $("stepIcons").innerHTML =
      step.apps.map(([name, file], i) => `<span class="app-icon" style="--i:${i}" title="${name}"><img src="apps/${file}" alt="${name}"></span>`).join("") +
      `<span class="more">${step.more}</span>`;
    copy.classList.remove("enter");
    void copy.offsetWidth; // restart the entrance animation
    copy.classList.add("enter");
  }

  function go(index, byPerson) {
    if (byPerson) autoplay = false;
    current = Math.max(0, Math.min(TOTAL - 1, index));
    renderCopy(STEPS[current], current);
    segs.forEach((el, i) => {
      el.classList.toggle("is-done", i < current);
      el.setAttribute("aria-selected", i === current ? "true" : "false");
      el.firstElementChild.style.setProperty("--p", i < current ? 1 : 0);
    });
    backBtn.disabled = current === 0;
    const last = current === TOTAL - 1;
    nextBtn.hidden = last;
    startBtn.hidden = !last;
    tryBtn.hidden = !last;
    window.WhynoDemo.show(current);
  }

  window.WhynoDemo.onProgress = (p) => segs[current].firstElementChild.style.setProperty("--p", p.toFixed(3));
  window.WhynoDemo.onLoop = () => { if (autoplay && current < TOTAL - 1) go(current + 1, false); };

  function closeTab() {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.getCurrent) {
      chrome.tabs.getCurrent((tab) => {
        if (tab && tab.id != null) chrome.tabs.remove(tab.id);
        else window.close();
      });
    } else {
      window.close();
    }
  }

  function start() {
    // Sign-in is the one step left before it works everywhere, so the tutorial ends there.
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: SIGN_IN_URL, active: true }, closeTab);
    } else {
      window.location.href = SIGN_IN_URL;
    }
  }

  nextBtn.addEventListener("click", () => go(current + 1, true));
  backBtn.addEventListener("click", () => go(current - 1, true));
  startBtn.addEventListener("click", start);
  // A practice page where the real button works on sample text.
  tryBtn.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: "https://whyno.tech/try", active: true });
    else window.location.href = "https://whyno.tech/try";
  });
  $("tourClose").addEventListener("click", closeTab);
  segs.forEach((el, i) => el.addEventListener("click", () => go(i, true)));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTab();
    if (e.key === "ArrowRight") go(current + 1, true);
    if (e.key === "ArrowLeft") go(current - 1, true);
    if (e.key === "Enter" && current === TOTAL - 1) start();
  });

  go(0, false);
})();
