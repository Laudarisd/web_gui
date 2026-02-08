// ============================================================================
// vector_view.js  (Vectorization UI Controller)
// ============================================================================
// Manages the CAD-style vectorization view
// - Handles view toggle between Visualization and Vectorization
// - Manages vector canvas interactions (zoom, pan)
// - Coordinates with vectorize.js for rendering
// ============================================================================

(() => {
  "use strict";

  const vizToggleButtons = document.querySelectorAll("[data-view-mode]");
  const visualizationSection = document.getElementById("visualizationSection");
  const vectorizationSection = document.getElementById("vectorizationSection");
  const vectorCanvas = document.getElementById("vectorCanvas");

  if (!vizToggleButtons.length) console.warn("⚠️ No view mode toggle buttons found");
  if (!visualizationSection) console.warn("⚠️ #visualizationSection not found");
  if (!vectorizationSection) console.warn("⚠️ #vectorizationSection not found");
  if (!vectorCanvas) console.warn("⚠️ #vectorCanvas not found");

  let currentViewMode = "visualization"; // Default mode

  // ============================================================================
  // View Mode Toggle
  // ============================================================================

  function setViewMode(mode) {
    if (mode !== "visualization" && mode !== "vectorization") return;

    currentViewMode = mode;
    console.log(`🎨 Switched to ${mode} mode`);

    // Update button states
    vizToggleButtons.forEach((btn) => {
      if (btn.dataset.viewMode === mode) {
        btn.classList.add("active");
        btn.style.background = "linear-gradient(135deg, #8BA572 0%, #6B7A5A 100%)";
      } else {
        btn.classList.remove("active");
        btn.style.background = "#ccc";
      }
    });

    // Toggle sections
    if (visualizationSection) {
      visualizationSection.style.display = mode === "visualization" ? "block" : "none";
    }
    if (vectorizationSection) {
      vectorizationSection.style.display = mode === "vectorization" ? "block" : "none";
    }

    // Render appropriate view
    if (mode === "vectorization" && typeof window.renderCurrentVector === "function") {
      window.renderCurrentVector();
    } else if (mode === "visualization" && typeof window.updateView === "function") {
      window.updateView();
    }
  }

  // ============================================================================
  // Vector Canvas Interaction
  // ============================================================================

  if (vectorCanvas) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialPanX = 0;
    let initialPanY = 0;

    vectorCanvas.addEventListener("wheel", (e) => {
      e.preventDefault();

      const oldZoom = window.getVectorZoom ? window.getVectorZoom() : 1;
      const direction = e.deltaY > 0 ? -1 : 1;
      const step = direction > 0 ? 1.1 : 0.9;
      let nextZoom = oldZoom * step;

      // Clamp zoom
      nextZoom = Math.max(0.1, Math.min(nextZoom, 5));
      window.setVectorZoom(nextZoom);

      console.log(`🔍 Vector zoom: ${oldZoom.toFixed(3)} → ${nextZoom.toFixed(3)}`);

      if (typeof window.renderCurrentVector === "function") {
        window.renderCurrentVector();
      }
    });

    vectorCanvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialPanX = window.vectorPanX || 0;
      initialPanY = window.vectorPanY || 0;
      vectorCanvas.style.cursor = "grabbing";
    });

    vectorCanvas.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      window.vectorPanX = initialPanX + deltaX;
      window.vectorPanY = initialPanY + deltaY;

      if (typeof window.renderCurrentVector === "function") {
        window.renderCurrentVector();
      }
    });

    vectorCanvas.addEventListener("mouseup", () => {
      isDragging = false;
      vectorCanvas.style.cursor = "grab";
    });

    vectorCanvas.addEventListener("mouseleave", () => {
      isDragging = false;
      vectorCanvas.style.cursor = "grab";
    });

    // Double-click to reset zoom/pan
    vectorCanvas.addEventListener("dblclick", () => {
      window.setVectorZoom(1);
      window.vectorPanX = 0;
      window.vectorPanY = 0;
      console.log("🔄 Vector view reset");
      if (typeof window.renderCurrentVector === "function") {
        window.renderCurrentVector();
      }
    });
  }

  // ============================================================================
  // Attach Toggle Button Listeners
  // ============================================================================

  vizToggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.viewMode;
      setViewMode(mode);
    });
  });

  // ============================================================================
  // Public API
  // ============================================================================

  window.setViewMode = setViewMode;
  window.getCurrentViewMode = () => currentViewMode;

  // Initialize default view
  setViewMode("visualization");

})();
