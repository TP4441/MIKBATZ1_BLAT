(() => {
  const tools = document.getElementById("mobileTools");
  if (tools) {
    const toggle = tools.querySelector("summary");
    tools.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tool]");
      if (!button) return;
      tools.open = false;
      toggle?.focus({ preventScroll: true });
      document.getElementById(button.dataset.tool)?.click();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!tools.contains(event.target)) tools.open = false;
    });
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && tools.open) {
          tools.open = false;
          toggle?.focus();
          event.stopImmediatePropagation();
        }
      },
      true
    );
  }

  const stack = [];
  const controls = (modal) =>
    Array.from(
      modal.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
      )
    ).filter((control) => control.getClientRects().length);

  for (const modal of document.querySelectorAll('.modal-overlay[role="dialog"]')) {
    new MutationObserver(() => {
      const index = stack.findIndex((item) => item.modal === modal);
      if (modal.classList.contains("hidden")) {
        if (index < 0) return;
        const [closed] = stack.splice(index, 1);
        if (index === stack.length) closed.opener?.focus({ preventScroll: true });
      } else if (index < 0) {
        const active = document.activeElement;
        stack.push({ modal, opener: modal.contains(active) ? null : active });
        if (!modal.contains(active)) {
          controls(modal)[0]?.focus({ preventScroll: true });
        }
      }
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
  }

  document.addEventListener(
    "keydown",
    (event) => {
      const modal = stack.at(-1)?.modal;
      if (event.key !== "Tab" || !modal || document.querySelector("dialog[open]")) return;
      const items = controls(modal);
      if (!items.length) return;
      const edge = event.shiftKey ? items[0] : items.at(-1);
      if (edge === document.activeElement || !modal.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? items.at(-1) : items[0])?.focus();
      }
    },
    true
  );

  const tabs = document.getElementById("modeTabs");
  if (tabs) {
    new MutationObserver(() => {
      const chosen = tabs.querySelector(".active");
      if (!chosen || tabs.scrollWidth <= tabs.clientWidth) return;
      const tab = chosen.getBoundingClientRect();
      const bar = tabs.getBoundingClientRect();
      if (tab.left < bar.left) tabs.scrollBy(tab.left - bar.left, 0);
      else if (tab.right > bar.right) tabs.scrollBy(tab.right - bar.right, 0);
    }).observe(tabs, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }
})();
