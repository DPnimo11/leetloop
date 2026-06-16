(() => {
  "use strict";

  const ACTIVATION_PARAM = "leetloop";
  const ACTIVATION_VALUES = new Set(["review", "shield", "fresh"]);
  const ROOT_CLASS = "leetloop-spoiler-shield-active";
  const UNLOCKED_CLASS = "leetloop-spoiler-shield-unlocked";
  const OVERLAY_ID = "leetloop-spoiler-overlay";
  const MIN_EDITOR_WIDTH = 260;
  const MIN_EDITOR_HEIGHT = 160;
  const POSITION_RETRY_DURATION_MS = 4000;
  const POSITION_RETRY_INTERVAL_MS = 120;
  const STABLE_POSITION_FRAMES = 2;
  const STABLE_POSITION_TOLERANCE_PX = 2;
  const RESET_CONFIRM_GRACE_MS = 500;
  const RESET_CONFIRMED_REVEAL_DELAY_MS = 50;
  const RESET_REVEAL_DELAY_MS = 1000;
  const LOCATION_CHECK_INTERVAL_MS = 250;
  const HOST_CLASS = "leetloop-spoiler-shield-host";

  let overlay;
  let overlayParts;
  let editorTarget;
  let observer;
  let editorResizeObserver;
  let observedEditorTarget;
  let confirmObserver;
  let positionFrame;
  let positionRetryTimer;
  let pendingEditorTarget;
  let pendingEditorRect;
  let stablePositionFrames = 0;
  let resetRevealTimer;
  let resetConfirmGraceTimer;
  let resetConfirmSeen = false;
  let hasAnchoredOverlay = false;
  let lastHref = window.location.href;
  let locationCheckTimer;
  let overlayHost;
  let unlocked = false;
  let mode = "initial";

  function problemSlug(url) {
    return url.pathname.match(/^\/problems\/([^/]+)\/?/)?.[1];
  }

  function isProblemUrl(url) {
    return Boolean(problemSlug(url));
  }

  function activationValue(url) {
    return url.searchParams.get(ACTIVATION_PARAM);
  }

  function shouldActivate() {
    const url = new URL(window.location.href);
    return isProblemUrl(url) && ACTIVATION_VALUES.has(activationValue(url));
  }

  function sessionKey() {
    const url = new URL(window.location.href);
    return `leetloop-spoiler-shield:${problemSlug(url) ?? url.pathname}`;
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
    overlayParts = undefined;
    overlayHost?.classList.remove(HOST_CLASS);
    overlayHost = undefined;
    observer?.disconnect();
    editorResizeObserver?.disconnect();
    confirmObserver?.disconnect();
    observer = undefined;
    editorResizeObserver = undefined;
    observedEditorTarget = undefined;
    confirmObserver = undefined;
    editorTarget = undefined;
    hasAnchoredOverlay = false;
    resetStablePosition();
    if (positionFrame) {
      window.cancelAnimationFrame(positionFrame);
      positionFrame = undefined;
    }
    window.clearTimeout(positionRetryTimer);
    positionRetryTimer = undefined;
    clearResetRevealTimer();
    clearResetConfirmMonitor();
    window.removeEventListener("resize", queuePositionOverlay);
    window.removeEventListener("scroll", queuePositionOverlay, true);
    window.visualViewport?.removeEventListener("resize", queuePositionOverlay);
    window.visualViewport?.removeEventListener("scroll", queuePositionOverlay);
  }

  function unlock() {
    deactivate(true);
  }

  function clearResetRevealTimer() {
    window.clearTimeout(resetRevealTimer);
    resetRevealTimer = undefined;
  }

  function quietClickElement(element) {
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

  function isUsableEditorTarget(element) {
    if (!element?.isConnected || !isVisible(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return (
      rect.width >= MIN_EDITOR_WIDTH &&
      rect.height >= MIN_EDITOR_HEIGHT &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight
    );
  }

  function rectSnapshot(rect) {
    return {
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    };
  }

  function areRectsClose(first, second) {
    return (
      Math.abs(first.height - second.height) <= STABLE_POSITION_TOLERANCE_PX &&
      Math.abs(first.left - second.left) <= STABLE_POSITION_TOLERANCE_PX &&
      Math.abs(first.top - second.top) <= STABLE_POSITION_TOLERANCE_PX &&
      Math.abs(first.width - second.width) <= STABLE_POSITION_TOLERANCE_PX
    );
  }

  function resetStablePosition() {
    pendingEditorTarget = undefined;
    pendingEditorRect = undefined;
    stablePositionFrames = 0;
  }

  function hasStablePosition(target, rect) {
    const nextRect = rectSnapshot(rect);

    if (pendingEditorTarget === target && pendingEditorRect && areRectsClose(pendingEditorRect, nextRect)) {
      stablePositionFrames += 1;
      pendingEditorRect = nextRect;
      return stablePositionFrames >= STABLE_POSITION_FRAMES;
    }

    pendingEditorTarget = target;
    pendingEditorRect = nextRect;
    stablePositionFrames = 1;
    return false;
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
    const roots = Array.from(
      document.querySelectorAll("[role='dialog'], [aria-modal='true'], [data-state='open'], .modal, .popover"),
    ).filter((candidate) => {
      if (!isVisible(candidate) || isShieldElement(candidate)) {
        return false;
      }

      const text = elementLabel(candidate).toLowerCase();
      return /reset/.test(text) && /(code|editor|default|confirm|discard|changes?)/.test(text);
    });

    for (const root of roots) {
      const candidates = visibleActionElements(root);
      const confirm = candidates.find((candidate) => {
        const label = elementLabel(candidate);
        return /^(confirm|reset|yes)$/i.test(label) || /reset\s+(code|editor|default)/i.test(label);
      });

      if (confirm) {
        return confirm;
      }
    }

    return undefined;
  }

  function clearResetConfirmMonitor() {
    confirmObserver?.disconnect();
    confirmObserver = undefined;
    window.clearTimeout(resetConfirmGraceTimer);
    resetConfirmGraceTimer = undefined;
    resetConfirmSeen = false;
  }

  function isResetFlowMode(value) {
    return value === "reset-waiting" || value === "reset-confirm";
  }

  function checkResetConfirmation() {
    const hasConfirmation = Boolean(findResetConfirmControl());

    if (hasConfirmation) {
      resetConfirmSeen = true;
      clearResetRevealTimer();
      if (mode !== "reset-confirm") {
        setMode("reset-confirm");
      }
      suspendOverlayForNativeDialog();
      return;
    }

    if (resetConfirmSeen) {
      clearResetConfirmMonitor();
      scheduleRevealAfterReset(RESET_CONFIRMED_REVEAL_DELAY_MS);
    }
  }

  function observeResetConfirmation() {
    clearResetConfirmMonitor();

    confirmObserver = new MutationObserver(checkResetConfirmation);
    confirmObserver.observe(document.body ?? document.documentElement, { childList: true, subtree: true });

    resetConfirmGraceTimer = window.setTimeout(() => {
      checkResetConfirmation();

      if (!resetConfirmSeen && mode === "reset-waiting") {
        scheduleRevealAfterReset();
      }
    }, RESET_CONFIRM_GRACE_MS);
  }

  function tryClickResetControl() {
    const resetControl = findResetControl();

    if (!resetControl) {
      return false;
    }

    quietClickElement(resetControl);
    return true;
  }

  function setMode(nextMode) {
    if (!isResetFlowMode(nextMode)) {
      clearResetRevealTimer();
      clearResetConfirmMonitor();
    }

    mode = nextMode;
    renderOverlay();
  }

  function scheduleRevealAfterReset(delayMs = RESET_REVEAL_DELAY_MS) {
    clearResetRevealTimer();
    resetRevealTimer = window.setTimeout(() => {
      if (!unlocked && shouldActivate() && isResetFlowMode(mode)) {
        unlock();
      }
    }, delayMs);
  }

  function handleStartFresh() {
    if (tryClickResetControl()) {
      setMode("reset-waiting");
      observeResetConfirmation();
      return;
    }

    setMode("manual-reset");
  }

  function panelCopy() {
    if (mode === "reset-waiting") {
      return {
        title: "Reset requested",
        copy:
          "The shield is staying up while LeetCode restores the starter template.",
        hint: "Keep covered until LeetCode finishes resetting.",
        primary: "Resetting...",
        primaryDisabled: true,
        secondary: "Try Reset Again",
      };
    }

    if (mode === "reset-confirm") {
      return {
        title: "Confirm reset",
        copy:
          "LeetCode is asking you to confirm the reset. Click its reset or confirm button while this shield keeps the editor hidden.",
        hint: "The shield will reveal automatically after the confirmation closes.",
        primary: "Waiting...",
        primaryDisabled: true,
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

  function createOverlayParts() {
    const panel = document.createElement("div");
    panel.className = "leetloop-panel";

    const kicker = document.createElement("p");
    kicker.className = "leetloop-kicker";
    kicker.textContent = "LeetLoop";

    const title = document.createElement("h2");
    const body = document.createElement("p");

    const hint = document.createElement("p");
    hint.className = "leetloop-hint";

    const actions = document.createElement("div");
    actions.className = "leetloop-actions";

    const primary = document.createElement("button");
    primary.className = "leetloop-primary";
    primary.type = "button";

    const secondary = document.createElement("button");
    secondary.className = "leetloop-secondary";
    secondary.type = "button";

    const dismiss = document.createElement("button");
    dismiss.className = "leetloop-link";
    dismiss.type = "button";
    dismiss.textContent = "Dismiss";

    actions.append(primary, secondary, dismiss);
    panel.append(kicker, title, body, hint, actions);
    overlay.appendChild(panel);

    return {
      body,
      dismiss,
      hint,
      primary,
      secondary,
      title,
    };
  }

  function updateOverlayContent() {
    const copy = panelCopy();
    const primaryAction = mode === "initial" ? handleStartFresh : unlock;
    const secondaryAction = mode === "initial" ? unlock : handleStartFresh;

    overlayParts.title.textContent = copy.title;
    overlayParts.body.textContent = copy.copy;
    overlayParts.hint.hidden = !copy.hint;
    overlayParts.hint.textContent = copy.hint ?? "";
    overlayParts.primary.textContent = copy.primary;
    overlayParts.primary.disabled = Boolean(copy.primaryDisabled);
    overlayParts.primary.onclick = primaryAction;
    overlayParts.secondary.textContent = copy.secondary;
    overlayParts.secondary.onclick = secondaryAction;
    overlayParts.dismiss.onclick = unlock;
  }

  function renderOverlay() {
    if (unlocked || !shouldActivate()) {
      return;
    }

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.hidden = true;
    }

    overlayParts ??= createOverlayParts();
    updateOverlayContent();

    queuePositionOverlay();
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

  function observeEditorTarget(target) {
    if (!("ResizeObserver" in window) || observedEditorTarget === target) {
      return;
    }

    editorResizeObserver?.disconnect();
    editorResizeObserver = new ResizeObserver(queuePositionOverlay);
    editorResizeObserver.observe(target);
    observedEditorTarget = target;
  }

  function hideOverlayUntilAnchored() {
    editorTarget = undefined;
    editorResizeObserver?.disconnect();
    observedEditorTarget = undefined;
    overlay.hidden = true;
  }

  function overlayHostForEditor(target) {
    return target.closest("#editor") ?? target.parentElement;
  }

  function mountOverlayInHost(host) {
    if (!host || !overlay) {
      return false;
    }

    if (overlayHost !== host) {
      overlayHost?.classList.remove(HOST_CLASS);
      overlayHost = host;
      overlayHost.classList.add(HOST_CLASS);
    }

    if (overlay.parentElement !== host) {
      host.appendChild(overlay);
    }

    return true;
  }

  function clearOverlayHost() {
    overlayHost?.classList.remove(HOST_CLASS);
    overlayHost = undefined;
  }

  function suspendOverlayForNativeDialog() {
    if (overlay) {
      overlay.hidden = true;
      overlay.remove();
    }
    clearOverlayHost();
  }

  function keepAnchoredOverlayVisible() {
    if (hasAnchoredOverlay && overlay && !overlay.hidden) {
      return true;
    }

    return false;
  }

  function queuePositionOverlay() {
    if (positionFrame) {
      return;
    }

    positionFrame = window.requestAnimationFrame(() => {
      positionFrame = undefined;
      positionOverlay();
    });
  }

  function retryPositioningUntilSettled() {
    const stopAt = Date.now() + POSITION_RETRY_DURATION_MS;

    window.clearTimeout(positionRetryTimer);

    function retry() {
      queuePositionOverlay();

      if (overlay && Date.now() < stopAt) {
        positionRetryTimer = window.setTimeout(retry, POSITION_RETRY_INTERVAL_MS);
        return;
      }

      positionRetryTimer = undefined;
    }

    retry();
  }

  function positionOverlay() {
    if (!overlay) {
      return;
    }

    if (mode === "reset-confirm") {
      suspendOverlayForNativeDialog();
      return;
    }

    const nextTarget = findEditorTarget();
    editorTarget = isUsableEditorTarget(nextTarget)
      ? nextTarget
      : isUsableEditorTarget(editorTarget)
        ? editorTarget
        : undefined;

    if (!editorTarget) {
      if (keepAnchoredOverlayVisible()) {
        return;
      }

      resetStablePosition();
      hideOverlayUntilAnchored();
      return;
    }

    const rect = editorTarget.getBoundingClientRect();
    const host = overlayHostForEditor(editorTarget);

    if (!mountOverlayInHost(host)) {
      resetStablePosition();
      hideOverlayUntilAnchored();
      return;
    }

    if (overlay.hidden && !hasStablePosition(editorTarget, rect)) {
      hideOverlayUntilAnchored();
      return;
    }

    const hostRect = host.getBoundingClientRect();
    const left = Math.max(0, rect.left - hostRect.left + host.scrollLeft);
    const top = Math.max(0, rect.top - hostRect.top + host.scrollTop);
    const width = Math.max(rect.width, MIN_EDITOR_WIDTH);
    const height = Math.max(rect.height, MIN_EDITOR_HEIGHT);

    if (width < MIN_EDITOR_WIDTH || height < MIN_EDITOR_HEIGHT) {
      if (keepAnchoredOverlayVisible()) {
        return;
      }

      resetStablePosition();
      hideOverlayUntilAnchored();
      return;
    }

    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
    overlay.style.right = "auto";
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    overlay.hidden = false;
    hasAnchoredOverlay = true;
    observeEditorTarget(editorTarget);
  }

  function startObserver() {
    if (observer || !document.documentElement) {
      return;
    }

    observer = new MutationObserver(() => {
      if (!overlay) {
        renderOverlay();
      }
      queuePositionOverlay();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("resize", queuePositionOverlay);
    window.addEventListener("scroll", queuePositionOverlay, true);
    window.visualViewport?.addEventListener("resize", queuePositionOverlay);
    window.visualViewport?.addEventListener("scroll", queuePositionOverlay);
    retryPositioningUntilSettled();
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

  function checkLocationChange() {
    if (window.location.href === lastHref) {
      return;
    }

    lastHref = window.location.href;
    handleLocationChange();
  }

  function startLocationWatcher() {
    if (locationCheckTimer) {
      return;
    }

    locationCheckTimer = window.setInterval(checkLocationChange, LOCATION_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", checkLocationChange);
    window.addEventListener("focus", checkLocationChange);
  }

  function patchHistory(methodName) {
    const original = window.history[methodName];
    window.history[methodName] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      window.setTimeout(checkLocationChange, 0);
      return result;
    };
  }

  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", checkLocationChange);
  startLocationWatcher();

  activate();
})();
