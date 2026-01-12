// Camera state and controls

export class Camera {
  constructor() {
    this.zoom = 800;
    this.angle = 0;
    this.height = 20;
    this.panX = 0;
    this.panY = 0;
    this.panZ = 0;
    this.focusTarget = -1;
    this.showOrbits = true;
    this.timeScale = 1.0;
  }

  setupControls(canvas) {
    const mouseState = { isDragging: false, lastX: 0, lastY: 0, button: -1 };

    // Hamburger menu toggle
    const menuToggle = document.getElementById("menu-toggle");
    const controls = document.getElementById("controls");
    if (menuToggle && controls) {
      menuToggle.addEventListener("click", () => {
        menuToggle.classList.toggle("active");
        controls.classList.toggle("visible");
      });
    }

    // UI Controls - only set up if elements exist (v2.0)
    // Helper function to convert linear slider to exponential zoom
    const sliderToZoom = (sliderValue) => {
      // Convert 1-3000 slider to exponential zoom range 1-3000
      // Using exponential scale: zoom = min * (max/min)^(t)
      // where t = (sliderValue - 1) / (3000 - 1)
      const min = 1;
      const max = 3000;
      const t = (sliderValue - 1) / 2999;
      return min * Math.pow(max / min, t);
    };

    const zoomToSlider = (zoomValue) => {
      // Inverse: slider = 1 + (3000-1) * log(zoom/min) / log(max/min)
      const min = 1;
      const max = 3000;
      return 1 + 2999 * (Math.log(zoomValue / min) / Math.log(max / min));
    };

    const zoomEl = document.getElementById("zoom");
    if (zoomEl) {
      zoomEl.addEventListener("input", (e) => {
        const sliderValue = 3001 - parseFloat(e.target.value);
        this.zoom = sliderToZoom(sliderValue);
      });
    }

    const angleEl = document.getElementById("camera-angle");
    if (angleEl) {
      angleEl.addEventListener("input", (e) => {
        this.angle = parseFloat(e.target.value);
      });
    }

    const heightEl = document.getElementById("camera-height");
    if (heightEl) {
      heightEl.addEventListener("input", (e) => {
        this.height = parseFloat(e.target.value);
      });
    }

    const focusEl = document.getElementById("focus-select");
    if (focusEl) {
      focusEl.addEventListener("change", (e) => {
        const value = e.target.value;
        // Check if value is a moon (starts with "moon-") or a number
        let newFocus;
        if (typeof value === "string" && value.indexOf("moon-") === 0) {
          newFocus = value;
        } else {
          newFocus = parseInt(value, 10);
        }
        // Trigger camera transition callback if it exists
        if (this.onFocusChange) {
          this.onFocusChange(newFocus);
        } else {
          this.focusTarget = newFocus;
        }
      });
    }

    const orbitsEl = document.getElementById("show-orbits");
    if (orbitsEl) {
      orbitsEl.addEventListener("change", (e) => {
        this.showOrbits = e.target.checked;
      });
    }

    const timeScaleEl = document.getElementById("time-scale");
    if (timeScaleEl) {
      timeScaleEl.addEventListener("input", (e) => {
        const sliderValue = parseFloat(e.target.value);
        const minSeconds = 0.01;
        const maxSeconds = 30;
        const logMin = Math.log(minSeconds);
        const logMax = Math.log(maxSeconds);
        const secondsPerDay = Math.exp(
          logMax - (sliderValue / 100) * (logMax - logMin)
        );

        this.timeScale = 62.83 / 365.25 / secondsPerDay;
        const multiplier = 86400 / secondsPerDay;
        const labelEl = document.getElementById("time-scale-label");
        const multiplierEl = document.getElementById("time-multiplier-label");
        if (labelEl) {
          labelEl.textContent = `1 Earth day = ${secondsPerDay.toFixed(2)} sec`;
        }
        if (multiplierEl) {
          multiplierEl.textContent = `${multiplier.toFixed(0)}x (${(
            86400 / secondsPerDay
          ).toLocaleString("en-US", { maximumFractionDigits: 0 })}:1)`;
        }
      });
    }

    // Initialize time scale label with default value
    if (timeScaleEl) {
      const initialSliderValue = parseFloat(timeScaleEl.value);
      const minSeconds = 0.01;
      const maxSeconds = 30;
      const logMin = Math.log(minSeconds);
      const logMax = Math.log(maxSeconds);
      const initialSecondsPerDay = Math.exp(
        logMax - (initialSliderValue / 100) * (logMax - logMin)
      );
      this.timeScale = 62.83 / 365.25 / initialSecondsPerDay;
      const initialMultiplier = 86400 / initialSecondsPerDay;
      const labelEl = document.getElementById("time-scale-label");
      const multiplierEl = document.getElementById("time-multiplier-label");
      if (labelEl) {
        labelEl.textContent = `1 Earth day = ${initialSecondsPerDay.toFixed(
          2
        )} sec`;
      }
      if (multiplierEl) {
        multiplierEl.textContent = `${initialMultiplier.toFixed(0)}x (${(
          86400 / initialSecondsPerDay
        ).toLocaleString("en-US", { maximumFractionDigits: 0 })}:1)`;
      }
    }

    // Mouse controls
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0 || e.button === 2) {
        e.preventDefault();
        mouseState.isDragging = true;
        mouseState.button = e.button;
        mouseState.lastX = e.clientX;
        mouseState.lastY = e.clientY;
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      if (mouseState.isDragging) {
        const deltaX = e.clientX - mouseState.lastX;
        const deltaY = e.clientY - mouseState.lastY;

        if (mouseState.button === 0) {
          const rotateSpeed = 0.5;
          this.angle += deltaX * rotateSpeed;
          this.height -= deltaY * rotateSpeed;
          this.height = Math.max(-90, Math.min(90, this.height));

          document.getElementById("camera-angle").value = this.angle % 360;
          document.getElementById("camera-height").value = this.height;
        } else if (mouseState.button === 2) {
          const panSpeed = 0.1;
          this.panX += deltaX * panSpeed;
          this.panZ += deltaY * panSpeed;
        }

        mouseState.lastX = e.clientX;
        mouseState.lastY = e.clientY;
      }
    });

    canvas.addEventListener("mouseup", (e) => {
      if (e.button === mouseState.button) {
        mouseState.isDragging = false;
        mouseState.button = -1;
      }
    });

    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      this.zoom += e.deltaY * zoomSpeed;
      this.zoom = Math.max(1, Math.min(3000, this.zoom));
      const zoomEl = document.getElementById("zoom");
      if (zoomEl) zoomEl.value = 3001 - zoomToSlider(this.zoom);
    });

    // Touch controls
    const touchState = {
      touches: [],
      lastDistance: 0,
      lastX: 0,
      lastY: 0,
      isTwoFingerGesture: false,
    };

    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      touchState.touches = Array.from(e.touches);

      if (touchState.touches.length === 1) {
        touchState.lastX = touchState.touches[0].clientX;
        touchState.lastY = touchState.touches[0].clientY;
        touchState.isTwoFingerGesture = false;
      } else if (touchState.touches.length === 2) {
        // Two-finger gesture for pinch-zoom or pan
        const dx =
          touchState.touches[0].clientX - touchState.touches[1].clientX;
        const dy =
          touchState.touches[0].clientY - touchState.touches[1].clientY;
        touchState.lastDistance = Math.sqrt(dx * dx + dy * dy);
        touchState.lastX =
          (touchState.touches[0].clientX + touchState.touches[1].clientX) / 2;
        touchState.lastY =
          (touchState.touches[0].clientY + touchState.touches[1].clientY) / 2;
        touchState.isTwoFingerGesture = true;
      }
    });

    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      touchState.touches = Array.from(e.touches);

      if (touchState.touches.length === 1 && !touchState.isTwoFingerGesture) {
        // Single finger - rotate camera
        const deltaX = touchState.touches[0].clientX - touchState.lastX;
        const deltaY = touchState.touches[0].clientY - touchState.lastY;

        const rotateSpeed = 0.5;
        this.angle += deltaX * rotateSpeed;
        this.height -= deltaY * rotateSpeed;
        this.height = Math.max(-90, Math.min(90, this.height));

        const angleEl = document.getElementById("camera-angle");
        const heightEl = document.getElementById("camera-height");
        if (angleEl) angleEl.value = this.angle % 360;
        if (heightEl) heightEl.value = this.height;

        touchState.lastX = touchState.touches[0].clientX;
        touchState.lastY = touchState.touches[0].clientY;
      } else if (touchState.touches.length === 2) {
        // Two fingers - pinch to zoom and pan
        const dx =
          touchState.touches[0].clientX - touchState.touches[1].clientX;
        const dy =
          touchState.touches[0].clientY - touchState.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        // Pinch to zoom
        if (touchState.lastDistance > 0) {
          const zoomDelta = touchState.lastDistance - currentDistance;
          const zoomSpeed = 2.0;
          this.zoom += zoomDelta * zoomSpeed;
          this.zoom = Math.max(1, Math.min(3000, this.zoom));
          const zoomEl = document.getElementById("zoom");
          if (zoomEl) zoomEl.value = 3001 - zoomToSlider(this.zoom);
        }

        // Two-finger pan
        const centerX =
          (touchState.touches[0].clientX + touchState.touches[1].clientX) / 2;
        const centerY =
          (touchState.touches[0].clientY + touchState.touches[1].clientY) / 2;
        const panDeltaX = centerX - touchState.lastX;
        const panDeltaY = centerY - touchState.lastY;

        const panSpeed = 0.1;
        this.panX += panDeltaX * panSpeed;
        this.panZ += panDeltaY * panSpeed;

        touchState.lastDistance = currentDistance;
        touchState.lastX = centerX;
        touchState.lastY = centerY;
      }
    });

    canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      touchState.touches = Array.from(e.touches);

      if (touchState.touches.length === 0) {
        touchState.lastDistance = 0;
        touchState.isTwoFingerGesture = false;
      } else if (touchState.touches.length === 1) {
        // Switched from two fingers to one
        touchState.lastX = touchState.touches[0].clientX;
        touchState.lastY = touchState.touches[0].clientY;
        touchState.lastDistance = 0;
        touchState.isTwoFingerGesture = false;
      }
    });

    canvas.addEventListener("touchcancel", (e) => {
      e.preventDefault();
      touchState.touches = [];
      touchState.lastDistance = 0;
      touchState.isTwoFingerGesture = false;
    });
  }
}
