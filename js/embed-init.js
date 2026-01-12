// Embed initialization with URL parameter support
import { config } from "./config.js";
import { Camera } from "./camera.js";

// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);

// Apply URL parameters to page
const showControls = urlParams.get("controls") !== "hidden";
const showInstructions = urlParams.get("instructions") === "true";
const showLabels = urlParams.get("labels") !== "false";
const initialFocus = parseInt(urlParams.get("focus") || "-1");
const initialZoom = parseFloat(urlParams.get("zoom") || "800");
const initialTimeScale = parseFloat(urlParams.get("timeScale") || "50");
const showOrbits = urlParams.get("orbits") !== "false";

// Apply visibility settings
if (showControls) {
  document.body.classList.add("show-controls");
}
if (showInstructions) {
  document.body.classList.add("show-instructions");
}
if (!showLabels) {
  document.getElementById("labels-container").style.display = "none";
}

// Create camera with initial settings
const camera = new Camera();
camera.focusTarget = initialFocus;
camera.zoom = initialZoom;
camera.showOrbits = showOrbits;

// Helper function to convert zoom to slider value (inverse exponential)
const zoomToSlider = (zoomValue) => {
  const min = 1;
  const max = 3000;
  return 1 + 2999 * (Math.log(zoomValue / min) / Math.log(max / min));
};

// Update UI controls to match
document.getElementById("zoom").value = 3001 - zoomToSlider(initialZoom);
document.getElementById("focus-select").value = initialFocus;
document.getElementById("show-orbits").checked = showOrbits;
document.getElementById("time-scale").value = initialTimeScale;

// Now load and run the main application
import("./main.js").then((module) => {
  // Main.js will pick up the camera settings
  console.log("Solar System Embed initialized with params:", {
    showControls,
    showInstructions,
    showLabels,
    initialFocus,
    initialZoom,
    initialTimeScale,
    showOrbits,
  });
});
