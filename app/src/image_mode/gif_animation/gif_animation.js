// ============================================================================
// gif_animation.js — Controls GIF placeholders for loading states
// ============================================================================

(() => {
  "use strict";

  const sections = {
    dataContent: { gifId: "dataContentGif", contentId: "dataContentBody" },
    dataCheck: { gifId: "dataCheckGif", contentId: "dataCheckBody" },
    visualization: { gifId: "vizGif", contentId: "vizContent" },
  };

  function setSectionReady(sectionKey, ready) {
    const config = sections[sectionKey];
    if (!config) return;

    const gifEl = document.getElementById(config.gifId);
    const contentEl = document.getElementById(config.contentId);

    if (gifEl) gifEl.classList.toggle("is-hidden", ready);
    if (contentEl) contentEl.classList.toggle("is-hidden", !ready);
  }

  function initPlaceholders() {
    Object.keys(sections).forEach((key) => setSectionReady(key, false));
  }

  window.setGifSectionReady = setSectionReady;

  window.addEventListener("DOMContentLoaded", initPlaceholders);
})();
