// Whyno Write Site Registry and Input Handlers
// Decoupled host-to-mode mapping, defensive input selectors, and reliable text replacement.

const SITES_REGISTRY = {
  // Known AI Sites (Auto Mode maps these to "ai")
  AI_HOSTS: [
    "chatgpt.com",
    "chat.openai.com",
    "claude.ai",
    "gemini.google.com",
    "perplexity.ai",
    "www.perplexity.ai",
    "copilot.microsoft.com",
    "chat.deepseek.com"
  ],

  // Specific selectors and editor patterns per site
  CONFIGS: {
    "chatgpt.com": {
      mode: "ai",
      selectors: [
        "#prompt-textarea",
        "div[contenteditable='true'][id='prompt-textarea']",
        "div[contenteditable='true']",
        "textarea"
      ],
      editorType: "contenteditable"
    },
    "chat.openai.com": {
      mode: "ai",
      selectors: [
        "#prompt-textarea",
        "div[contenteditable='true'][id='prompt-textarea']",
        "div[contenteditable='true']",
        "textarea"
      ],
      editorType: "contenteditable"
    },
    "claude.ai": {
      mode: "ai",
      selectors: [
        "div.ProseMirror[contenteditable='true']",
        "div[contenteditable='true']",
        "textarea"
      ],
      editorType: "prosemirror"
    },
    "gemini.google.com": {
      mode: "ai",
      selectors: [
        "div.ql-editor[contenteditable='true']",
        "div[contenteditable='true']",
        "rich-textarea textarea",
        "textarea"
      ],
      editorType: "quill"
    },
    "perplexity.ai": {
      mode: "ai",
      selectors: [
        "textarea[placeholder*='Ask']",
        "textarea",
        "div[contenteditable='true']"
      ],
      editorType: "textarea"
    },
    "copilot.microsoft.com": {
      mode: "ai",
      selectors: [
        "textarea#userInput",
        "textarea",
        "div[contenteditable='true']"
      ],
      editorType: "textarea"
    },
    "chat.deepseek.com": {
      mode: "ai",
      selectors: [
        "textarea[placeholder*='Send a message']",
        "textarea",
        "div[contenteditable='true']"
      ],
      editorType: "textarea"
    }
  },

  // Fallback generic selectors for any site
  GENERIC_SELECTORS: [
    "textarea:focus",
    "div[contenteditable='true']:focus",
    "input[type='text']:focus",
    "input:not([type]):focus",
    "div[role='textbox']:focus",
    "div[contenteditable='true']",
    "textarea",
    "div[role='textbox']"
  ],

  /**
   * Resolves the operational mode for a given hostname taking user manual override into account.
   * @param {string} hostname e.g. "chatgpt.com"
   * @param {string} [override="auto"] "auto" | "ai" | "normal"
   * @returns {"ai" | "normal"}
   */
  getMode(hostname = window.location.hostname, override = "auto") {
    if (override === "ai" || override === "normal") {
      return override;
    }
    const cleanHost = hostname.toLowerCase().replace(/^www\./, "");
    const isAi = this.AI_HOSTS.some(h => cleanHost === h || cleanHost.endsWith("." + h));
    return isAi ? "ai" : "normal";
  },

  /**
   * Defensively finds the active or target input element on the current page.
   * @param {Document|Element} root 
   * @param {string} hostname
   * @returns {HTMLElement|null}
   */
  findTargetInput(root = document, hostname = window.location.hostname) {
    // 1. If an editable element currently has focus, prioritize it
    const active = root.activeElement;
    if (active && (this.isEditable(active))) {
      return active;
    }

    // 2. Try site-specific selectors
    const cleanHost = hostname.toLowerCase().replace(/^www\./, "");
    for (const [host, conf] of Object.entries(this.CONFIGS)) {
      if (cleanHost === host || cleanHost.endsWith("." + host)) {
        for (const sel of conf.selectors) {
          try {
            const el = root.querySelector(sel);
            if (el && this.isElementVisible(el)) {
              return el;
            }
          } catch (_) {}
        }
      }
    }

    // 3. Fallback to generic selectors
    for (const sel of this.GENERIC_SELECTORS) {
      try {
        const el = root.querySelector(sel);
        if (el && this.isElementVisible(el)) {
          return el;
        }
      } catch (_) {}
    }

    return null;
  },

  /**
   * Checks if an element is an editable text field.
   */
  isEditable(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
    if (el instanceof HTMLInputElement) {
      const type = (el.type || "").toLowerCase();
      const textTypes = ["text", "search", "email", "url", "tel", ""];
      return textTypes.includes(type) && !el.disabled && !el.readOnly;
    }
    return el.isContentEditable || el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox";
  },

  /**
   * Ensures the element is currently visible on the screen.
   */
  isElementVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
  },

  /**
   * Extracts text safely from any input or contenteditable element.
   */
  getText(el) {
    if (!el) return "";
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      // If user has highlighted a specific range within the textarea/input
      if (typeof el.selectionStart === "number" && typeof el.selectionEnd === "number" && el.selectionStart !== el.selectionEnd) {
        return el.value.substring(el.selectionStart, el.selectionEnd);
      }
      return el.value || "";
    }
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && el.contains(sel.anchorNode)) {
        return sel.toString();
      }
      return el.innerText || el.textContent || "";
    }
    return "";
  },

  /**
   * The message the person is answering, read from the page when they tap Flow on a few well-known sites
   * (Gmail, WhatsApp Web, LinkedIn, Slack). Empty anywhere else. It is only ever the latest message, and the
   * card shows it so the person can drop it.
   */
  getReplyContext(hostname = window.location.hostname, field = null) {
    const host = hostname.toLowerCase().replace(/^www\./, "");
    const last = (selector, root = document) => {
      const nodes = Array.prototype.filter.call(root.querySelectorAll(selector), (n) => !field || !n.contains(field));
      const node = nodes[nodes.length - 1];
      return node ? (node.innerText || "").trim() : "";
    };
    let text = "";
    try {
      if (host === "mail.google.com") text = last("div.a3s.aiL") || last("div.a3s");
      else if (host === "web.whatsapp.com") text = last("div.message-in span.selectable-text") || last("div.message-in");
      else if (host === "linkedin.com") text = last(".msg-s-event-listitem__body");
      else if (host.endsWith("slack.com")) text = last(".c-message_kit__text");
    } catch (_) {}
    text = text.replace(/\n{3,}/g, "\n\n").trim().slice(0, 1500);
    return text.split(/\s+/).filter(Boolean).length >= 2 ? text : "";
  },

  /**
   * Types [text] at the cursor of a rich editor (Gmail, Notion, ChatGPT...). Tries the way that keeps the
   * editor's own undo and formatting first, then a paste (which editors handle themselves), then the plain DOM.
   * @returns {boolean} true when the text went in
   */
  typeIntoEditable(el, text) {
    try {
      if (document.execCommand("insertText", false, text)) return true;
    } catch (_) {}
    try {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      const paste = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
      el.dispatchEvent(paste);
      if (paste.defaultPrevented) return true;
    } catch (_) {}
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
        return true;
      }
    }
    return false;
  },

  /**
   * Replaces or inserts text safely into React, ProseMirror, Lexical, Quill, or native inputs.
   * Requirement 5:
   * - Contenteditable: focus, select all, document.execCommand("insertText", false, text).
   * - Textarea/input: native prototype value setter, dispatch input & change events.
   */
  insertText(el, text, isReplaceAll = true) {
    if (!el) return false;
    el.focus();

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

      if (isReplaceAll || el.selectionStart === null || el.selectionStart === el.selectionEnd) {
        // Replace entire value
        if (descriptor && descriptor.set) {
          descriptor.set.call(el, text);
        } else {
          el.value = text;
        }
        el.selectionStart = el.selectionEnd = text.length;
      } else {
        // Replace only selected slice
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const current = el.value || "";
        const updated = current.substring(0, start) + text + current.substring(end);
        if (descriptor && descriptor.set) {
          descriptor.set.call(el, updated);
        } else {
          el.value = updated;
        }
        el.selectionStart = el.selectionEnd = start + text.length;
      }

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    if (el.isContentEditable) {
      const sel = window.getSelection();
      const range = document.createRange();

      if (isReplaceAll) {
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      } else if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // Standard insertText keeps the undo stack and framework listeners in step; falls back to a paste, then the DOM.
      const success = this.typeIntoEditable(el, text);

      // Fallback for strict frameworks if execCommand fails
      if (!success && isReplaceAll) {
        el.innerText = text;
      }

      // Dispatch simulated framework events
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    return false;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = SITES_REGISTRY;
} else if (typeof globalThis !== "undefined") {
  globalThis.SITES_REGISTRY = SITES_REGISTRY;
}
