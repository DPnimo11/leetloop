(() => {
  "use strict";

  const ACTIVATION_PARAM = "leetloop";
  const ACTIVATION_VALUES = new Set(["review", "shield", "fresh"]);
  const ROOT_CLASS = "leetloop-spoiler-shield-active";
  const UNLOCKED_CLASS = "leetloop-spoiler-shield-unlocked";
  const OVERLAY_ID = "leetloop-spoiler-overlay";
  const MIN_EDITOR_WIDTH = 260;
  const MIN_EDITOR_HEIGHT = 160;
  const CONFIRM_RESET_TIMEOUT_MS = 3000;

  let overlay;
  let editorTarget;
  let observer;
  let confirmObserver;
  let unlocked = false;
  let mode = "initial";

  function isProblemUrl(url) {
    return /^\/problems\/[^/]+\/?/.test(url.pathname);
  }

  function activationValue(url) {
    return url.searchParams.get(ACTIVATION_PARAM);
  }

  function shouldActivate() {
    const url = new URL(window.location.href);
    return isProblemUrl(url) && ACTIVATION_VALUES.has(activationValue(url));
  }

  function sessionKey() {
    return `leetloop-spoiler-shield:${window.location.pathname}`;
  }

  function isSessionUnlocked() {
    try {
      return window.sessionStorage.getItem(sessionKey()) === "unlocked";
    } catch {
      return false;
    }
  }

  function setSessionUnlocked() {
    try {
      window.sessionStorage.setItem(sessionKey(), "unlocked");
    } catch {
      // Session storage can be blocked; the in-memory flag still prevents re-shielding.
    }
  }

  function deactivate(persistSession) {
    unlocked = true;
    if (persistSession) {
      setSessionUnlocked();
    }
    document.documentElement.classList.add(UNLOCKED_CLASS);
    document.documentElement.classList.remove(ROOT_CLASS);
    overlay?.remove();
    overlay = undefined;
    observer?.disconnect();
    confirmObserver?.disconnect();
    observer = undefined;
    confirmObserver = undefined;
    window.removeEventListener("resize", positionOverlay);
    window.removeEventListener("scroll", positionOverlay, true);
  }

  function unlock() {
    deactivate(true);
  }

  function clickElement(element) {
    element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    if (typeof element.click === "function") {
      element.click();
      return;
    }

    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  function elementLabel(element) {
    return [
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-cy"),
      element.getAttribute("data-testid"),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isShieldElement(element) {
    return Boolean(overlay?.contains(element));
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function visibleActionElements(root) {
    return Array.from(root.querySelectorAll("button, [role='button'], [role='menuitem'], a")).filter(
      (candidate) => isVisible(candidate) && !isShieldElement(candidate),
    );
  }

  function findTextResetControl() {
    const candidates = Array.from(document.querySelectorAll("button, [role='button'], [role='menuitem'], a"));
    return candidates.find((candidate) => {
      if (!isVisible(candidate) || isShieldElement(candidate)) {
        return false;
      }

      const label = elementLabel(candidate);
      return /reset\s+(to\s+)?default\s+code/i.test(label) || /reset\s+code/i.test(label);
    });
  }

  function findEditorRoot() {
    return document.getElementById("editor") ?? editorTarget?.closest("#editor") ?? undefined;
  }

  function isUnsafeToolbarCandidate(element) {
    const label = elementLabel(element);

    if (!label || /reset/i.test(label)) {
      return false;
    }

    return /\b(run|submit|debug|console|settings|format|layout|fullscreen|language)\b/i.test(label);
  }

  function findIconResetControl() {
    const editor = findEditorRoot();

    if (!editor) {
      return undefined;
    }

    const toolbarContainers = Array.from(editor.getElementsByClassName("flex items-center gap-1"));

    for (const container of toolbarContainers) {
      const buttons = visibleActionElements(container).filter((button) => button.tagName === "BUTTON");

      if (buttons.length < 4) {
        continue;
      }

      const candidate = buttons[3];

      if (candidate && !isUnsafeToolbarCandidate(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  function findResetControl() {
    return findTextResetControl() ?? findIconResetControl();
  }

  function findResetConfirmControl() {
    const dialogs = Array.from(
      document.querySelectorAll("[role='dialog'], [data-state='open'], .fixed, .modal, .popover"),
    ).filter((candidate) => isVisible(candidate) && !isShieldElement(candidate));
    const roots = dialogs.length ? dialogs : [document.body].filter(Boolean);

    for (const root of roots) {
      const candidates = visibleActionElements(root);
      const confirm = candidates.find((candidate) => {
        const label = elementLabel(candidate);
        return /^(confirm|reset|yes)$/i.test(label) || /reset\s+(code|editor|default)/i.test(label);
      });

      if (confirm) {
        return confirm;
      }

      const greenConfirm = root.querySelector(".text-label-r.bg-green-s");

      if (greenConfirm && isVisible(greenConfirm) && !isShieldElement(greenConfirm)) {
        return greenConfirm;
      }
    }

    return undefined;
  }

  function tryClickResetConfirm() {
    const confirmControl = findResetConfirmControl();

    if (!confirmControl) {
      return false;
    }

    clickElement(confirmControl);
    return true;
  }

  function observeResetConfirm() {
    confirmObserver?.disconnect();

    const stopAt = Date.now() + CONFIRM_RESET_TIMEOUT_MS;

    confirmObserver = new MutationObserver(() => {
      if (tryClickResetConfirm() || Date.now() > stopAt) {
        confirmObserver?.disconnect();
        confirmObserver = undefined;
      }
    });

    confirmObserver.observe(document.body ?? document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => {
      if (tryClickResetConfirm() || confirmObserver) {
        confirmObserver?.disconnect();
        confirmObserver = undefined;
      }
    }, CONFIRM_RESET_TIMEOUT_MS);
  }

  function tryClickResetControl() {
    const resetControl = findResetControl();

    if (!resetControl) {
      return false;
    }

    clickElement(resetControl);
    observeResetConfirm();
    return true;
  }

  function setMode(nextMode) {
    mode = nextMode;
    renderOverlay();
  }

  function handleStartFresh() {
    if (tryClickResetControl()) {
      setMode("reset-clicked");
      return;
    }

    setMode("manual-reset");
  }

  function panelCopy() {
    if (mode === "reset-clicked") {
      return {
        title: "Reset requested",
        copy:
          "If LeetCode asks for confirmation, confirm it while this shield keeps the old code hidden. Reveal the editor once the starter template is back.",
        primary: "Reveal Fresh Editor",
        secondary: "Try Reset Again",
      };
    }

    if (mode === "manual-reset") {
      return {
        title: "Reset control not found",
        copy:
          "The editor is still hidden. Use LeetCode's editor toolbar to reset to default code, then reveal the editor when the starter template is back.",
        primary: "Reveal Editor",
        secondary: "Try Reset Again",
      };
    }

    return {
      title: "Previous code hidden",
      copy:
        "LeetLoop opened this problem in review mode. Start fresh to reset toward LeetCode's starter template, or reveal your previous code on purpose.",
      primary: "Start Fresh",
      secondary: "Reveal Previous",
    };
  }

  function renderOverlay() {
    if (unlocked || !shouldActivate()) {
      return;
    }

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      document.documentElement.appendChild(overlay);
    }

    const copy = panelCopy();
    const primaryAction = mode === "initial" ? handleStartFresh : unlock;
    const secondaryAction = mode === "initial" ? unlock : handleStartFresh;

    overlay.innerHTML = "";

    const panel = document.createElement("div");
    panel.className = "leetloop-panel";

    const kicker = document.createElement("p");
    kicker.className = "leetloop-kicker";
    kicker.textContent = "LeetLoop Shield";

    const title = document.createElement("h2");
    title.textContent = copy.title;

    const body = document.createElement("p");
    body.textContent = copy.copy;

    const actions = document.createElement("div");
    actions.className = "leetloop-actions";

    const primary = document.createElement("button");
    primary.className = "leetloop-primary";
    primary.type = "button";
    primary.textContent = copy.primary;
    primary.addEventListener("click", primaryAction);

    const secondary = document.createElement("button");
    secondary.className = "leetloop-secondary";
    secondary.type = "button";
    secondary.textContent = copy.secondary;
    secondary.addEventListener("click", secondaryAction);

    const dismiss = document.createElement("button");
    dismiss.className = "leetloop-link";
    dismiss.type = "button";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", unlock);

    actions.append(primary, secondary, dismiss);
    panel.append(kicker, title, body, actions);
    overlay.appendChild(panel);

    positionOverlay();
  }

  function findEditorTarget() {
    const selectors = [
      ".monaco-editor",
      ".cm-editor",
      "[data-cy='code-editor']",
      "[data-testid='code-editor']",
      "[class*='code-editor']",
    ];

    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      const match = elements.find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width >= MIN_EDITOR_WIDTH && rect.height >= MIN_EDITOR_HEIGHT && isVisible(element);
      });

      if (match) {
        return match;
      }
    }

    return undefined;
  }

  function positionOverlay() {
    if (!overlay) {
      return;
    }

    editorTarget = findEditorTarget() ?? editorTarget;

    if (!editorTarget) {
      overlay.classList.add("leetloop-floating");
      overlay.style.top = "88px";
      overlay.style.right = "24px";
      overlay.style.left = "auto";
      overlay.style.width = "min(420px, calc(100vw - 48px))";
      overlay.style.height = "auto";
      return;
    }

    const rect = editorTarget.getBoundingClientRect();
    const left = Math.max(8, rect.left);
    const top = Math.max(8, rect.top);
    const width = Math.max(Math.min(rect.width, window.innerWidth - left - 8), MIN_EDITOR_WIDTH);
    const height = Math.max(Math.min(rect.height, window.innerHeight - top - 8), MIN_EDITOR_HEIGHT);

    overlay.classList.remove("leetloop-floating");
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
    overlay.style.right = "auto";
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
  }

  function startObserver() {
    if (observer || !document.documentElement) {
      return;
    }

    observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        if (!overlay) {
          renderOverlay();
        }
        positionOverlay();
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("resize", positionOverlay);
    window.addEventListener("scroll", positionOverlay, true);
  }

  function activate() {
    if (!shouldActivate() || isSessionUnlocked()) {
      return;
    }

    document.documentElement.classList.add(ROOT_CLASS);
    document.documentElement.classList.remove(UNLOCKED_CLASS);

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          renderOverlay();
          startObserver();
        },
        { once: true },
      );
      return;
    }

    renderOverlay();
    startObserver();
  }

  function handleLocationChange() {
    if (shouldActivate() && !isSessionUnlocked()) {
      unlocked = false;
      mode = "initial";
      activate();
      return;
    }

    deactivate(false);
  }

  function patchHistory(methodName) {
    const original = window.history[methodName];
    window.history[methodName] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      window.setTimeout(handleLocationChange, 0);
      return result;
    };
  }

  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", handleLocationChange);

  activate();
})();
