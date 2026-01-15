// Main entry point for solar system visualization
import { config } from "./config.js";
import { Camera } from "./camera.js";
import { mat4 } from "./utils/math.js";
import {
  createShaderProgram,
  vertexShaderSource,
  fragmentShaderSource,
  pointVertexShaderSource,
  pointFragmentShaderSource,
  particleVertexShaderSource,
  particleFragmentShaderSource,
} from "./utils/shaders.js";
import { createSphere, createRing, createOrbitPath } from "./geometry.js";
import {
  renderOrbitPath,
  renderRing,
  renderSphere,
  project3DTo2D,
} from "./renderer.js";
import { loadTextures } from "./utils/textures.js";

/**
 * Validates and sanitizes URL parameters for embed mode
 * @param {URLSearchParams} urlParams - URL parameters to validate
 * @returns {Object} Object containing validated parameters
 * @property {number|null} zoom - Camera zoom level (1-3000)
 * @property {number|string|null} focus - Focus target index or moon identifier
 * @property {number|null} timeScale - Time scale multiplier (0-100)
 * @property {string} [controls] - Controls visibility setting
 * @property {string} [instructions] - Instructions visibility setting
 * @property {string} [labels] - Labels visibility setting
 * @property {string} [orbits] - Orbit lines visibility setting
 * @property {string} [performance] - Performance monitor visibility setting
 */
function validateURLParams(urlParams) {
  const validated = {};

  // Validate zoom (1-3000)
  if (urlParams.has("zoom")) {
    const zoom = parseFloat(urlParams.get("zoom"));
    validated.zoom = !isNaN(zoom) && zoom >= 1 && zoom <= 3000 ? zoom : null;
  }

  // Validate focus (-1 to 7, or moon format)
  if (urlParams.has("focus")) {
    const focus = urlParams.get("focus");
    if (focus.startsWith("moon-")) {
      const parts = focus.split("-");
      if (parts.length === 3) {
        const pIndex = parseInt(parts[1]);
        const mIndex = parseInt(parts[2]);
        if (!isNaN(pIndex) && !isNaN(mIndex) && pIndex >= 0 && pIndex < 8) {
          validated.focus = focus;
        }
      }
    } else {
      const focusNum = parseInt(focus);
      validated.focus =
        !isNaN(focusNum) && focusNum >= -1 && focusNum <= 7 ? focusNum : null;
    }
  }

  // Validate timeScale (0-100)
  if (urlParams.has("timeScale")) {
    const timeScale = parseFloat(urlParams.get("timeScale"));
    validated.timeScale =
      !isNaN(timeScale) && timeScale >= 0 && timeScale <= 100
        ? timeScale
        : null;
  }

  // Validate boolean parameters
  ["controls", "instructions", "labels", "orbits", "performance"].forEach(
    (param) => {
      if (urlParams.has(param)) {
        validated[param] = urlParams.get(param);
      }
    }
  );

  return validated;
}

// Initialize WebGL and start application
window.addEventListener("load", function () {
  const canvas = document.getElementById("webgl-canvas");

  // Feature detection: Check WebGL support
  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

  if (!gl) {
    // Show user-friendly fallback
    const fallback = document.createElement("div");
    fallback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: #fff;
      padding: 40px;
      border-radius: 12px;
      max-width: 500px;
      text-align: center;
      font-family: Arial, sans-serif;
    `;
    fallback.innerHTML = `
      <h2 style="color: #ff6b6b; margin-bottom: 20px;">WebGL Not Supported</h2>
      <p style="margin-bottom: 15px;">Your browser doesn't support WebGL, which is required to run this solar system simulation.</p>
      <p style="font-size: 14px; color: #ccc;">Please try:</p>
      <ul style="text-align: left; margin: 15px 0; color: #ccc;">
        <li>Updating your browser to the latest version</li>
        <li>Enabling hardware acceleration in browser settings</li>
        <li>Using a modern browser like Chrome, Firefox, or Edge</li>
      </ul>
    `;
    document.body.appendChild(fallback);
    return;
  }

  // Handle WebGL context loss/restore
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    console.warn("WebGL context lost");
    // Show notification to user
    const notice = document.createElement("div");
    notice.id = "context-lost-notice";
    notice.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 107, 107, 0.95);
      color: #fff;
      padding: 15px 30px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      z-index: 10000;
    `;
    notice.textContent = "Graphics context lost. Attempting to recover...";
    document.body.appendChild(notice);
  });

  canvas.addEventListener("webglcontextrestored", () => {
    console.warn("WebGL context restored, reloading page...");
    const notice = document.getElementById("context-lost-notice");
    if (notice) notice.remove();
    // Reload page to reinitialize
    window.location.reload();
  });

  // Load textures
  const textures = loadTextures(gl, config);

  // Setup canvas and WebGL
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  // Handle window resize
  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  });

  // Create shader programs
  const shaderProgram = createShaderProgram(
    gl,
    vertexShaderSource,
    fragmentShaderSource
  );
  const pointShaderProgram = createShaderProgram(
    gl,
    pointVertexShaderSource,
    pointFragmentShaderSource
  );
  const particleShaderProgram = createShaderProgram(
    gl,
    particleVertexShaderSource,
    particleFragmentShaderSource
  );

  // Cache uniform and attribute locations for main shader
  const mainUniforms = {
    projection: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
    view: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
    model: gl.getUniformLocation(shaderProgram, "uModelMatrix"),
    color: gl.getUniformLocation(shaderProgram, "uColor"),
    lightPos: gl.getUniformLocation(shaderProgram, "uLightPosition"),
    emissive: gl.getUniformLocation(shaderProgram, "uEmissive"),
    moonPos: gl.getUniformLocation(shaderProgram, "uMoonPosition"),
    moonRadius: gl.getUniformLocation(shaderProgram, "uMoonRadius"),
    checkShadow: gl.getUniformLocation(shaderProgram, "uCheckShadow"),
    useTexture: gl.getUniformLocation(shaderProgram, "uUseTexture"),
    texture: gl.getUniformLocation(shaderProgram, "uTexture"),
    showTerminator: gl.getUniformLocation(shaderProgram, "uShowTerminator"),
    useClouds: gl.getUniformLocation(shaderProgram, "uUseClouds"),
    cloudTexture: gl.getUniformLocation(shaderProgram, "uCloudTexture"),
    cloudRotation: gl.getUniformLocation(shaderProgram, "uCloudRotation"),
    useSpecular: gl.getUniformLocation(shaderProgram, "uUseSpecular"),
    specularMap: gl.getUniformLocation(shaderProgram, "uSpecularMap"),
    useNormal: gl.getUniformLocation(shaderProgram, "uUseNormal"),
    normalMap: gl.getUniformLocation(shaderProgram, "uNormalMap"),
    useNight: gl.getUniformLocation(shaderProgram, "uUseNight"),
    nightMap: gl.getUniformLocation(shaderProgram, "uNightMap"),
    time: gl.getUniformLocation(shaderProgram, "uTime"),
    planetPos: gl.getUniformLocation(shaderProgram, "uPlanetPosition"),
    planetRadius: gl.getUniformLocation(shaderProgram, "uPlanetRadius"),
    checkPlanetShadow: gl.getUniformLocation(
      shaderProgram,
      "uCheckPlanetShadow"
    ),
  };
  const mainAttribs = {
    position: gl.getAttribLocation(shaderProgram, "aPosition"),
    normal: gl.getAttribLocation(shaderProgram, "aNormal"),
    texCoord: gl.getAttribLocation(shaderProgram, "aTexCoord"),
  };

  // Cache uniform and attribute locations for point shader
  const pointUniforms = {
    projection: gl.getUniformLocation(pointShaderProgram, "uProjectionMatrix"),
    view: gl.getUniformLocation(pointShaderProgram, "uViewMatrix"),
    color: gl.getUniformLocation(pointShaderProgram, "uColor"),
    pointSize: gl.getUniformLocation(pointShaderProgram, "uPointSize"),
  };
  const pointAttribs = {
    position: gl.getAttribLocation(pointShaderProgram, "aPosition"),
  };

  // Cache uniform and attribute locations for particle shader
  const particleUniforms = {
    projection: gl.getUniformLocation(
      particleShaderProgram,
      "uProjectionMatrix"
    ),
    view: gl.getUniformLocation(particleShaderProgram, "uViewMatrix"),
  };
  const particleAttribs = {
    position: gl.getAttribLocation(particleShaderProgram, "aPosition"),
    size: gl.getAttribLocation(particleShaderProgram, "aSize"),
    alpha: gl.getAttribLocation(particleShaderProgram, "aAlpha"),
  };

  // Create geometry buffers
  const sphereBuffers = createSphere(gl, 1, 32, 32);
  const orbitBuffers = config.planets.map((planet) =>
    createOrbitPath(
      gl,
      planet.orbitRadius,
      128,
      planet.eccentricity,
      planet.inclination
    )
  );

  // Pre-create ring geometry buffers (one per planet with rings)
  const ringBuffersCache = new Map();
  config.planets.forEach((planet, planetIndex) => {
    if (planet.hasRings && planet.rings) {
      const planetRingBuffers = planet.rings.map((ring) => {
        const innerRatio = ring.inner / ring.outer;
        return createRing(gl, innerRatio, 1.0, 64);
      });
      ringBuffersCache.set(planetIndex, planetRingBuffers);
    }
  });

  // Matrix pool for reuse (avoid allocations)
  const matrixPool = {
    model: mat4.create(),
    temp: mat4.create(),
    combined: mat4.create(),
    spotTranslate: mat4.create(),
    withSpotPos: mat4.create(),
    orientMatrix: mat4.create(),
    withOrientation: mat4.create(), // Fix #4: Add pooled matrix for Great Red Spot
  };

  // Generate asteroid belt data
  const asteroidData = [];
  const belt = config.asteroidBelt;
  for (let i = 0; i < belt.count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius =
      belt.innerRadius + Math.random() * (belt.outerRadius - belt.innerRadius);
    const height = (Math.random() - 0.5) * belt.thickness;
    asteroidData.push({ angle, radius, height });
  }
  const asteroidBuffer = gl.createBuffer();

  // Generate Kuiper Belt data
  const kuiperData = [];
  const kuiper = config.kuiperBelt;
  for (let i = 0; i < kuiper.count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius =
      kuiper.innerRadius +
      Math.random() * (kuiper.outerRadius - kuiper.innerRadius);
    const height = (Math.random() - 0.5) * kuiper.thickness;
    kuiperData.push({ angle, radius, height });
  }
  const kuiperBuffer = gl.createBuffer();

  // Pre-allocate belt position arrays (avoid GC pressure)
  const asteroidPositions = new Float32Array(config.asteroidBelt.count * 3);
  const kuiperPositions = new Float32Array(config.kuiperBelt.count * 3);

  // CME Particle system
  const cmeParticles = [];
  const maxParticles = 200;
  let nextCMETime = Math.random() * 5 + 3; // First CME in 3-8 seconds

  // Fix #5: Pre-allocate typed arrays to reduce GC pressure
  const cmePreallocated = {
    positions: new Float32Array(maxParticles * 3),
    sizes: new Float32Array(maxParticles),
    alphas: new Float32Array(maxParticles),
  };

  // Pre-create reusable buffers for CME particles (performance optimization)
  const cmeBuffers = {
    position: gl.createBuffer(),
    size: gl.createBuffer(),
    alpha: gl.createBuffer(),
  };

  /**
   * Spawns a Coronal Mass Ejection particle burst from the sun's surface
   * Creates 20-50 particles ejected from a random point on the sun
   */
  function spawnCME() {
    // Spawn particles from random point on sun surface
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const sunRadius = config.sun.radius;

    const spawnX = sunRadius * Math.sin(phi) * Math.cos(theta);
    const spawnY = sunRadius * Math.sin(phi) * Math.sin(theta);
    const spawnZ = sunRadius * Math.cos(phi);

    // Create burst of particles
    const particleCount = 20 + Math.floor(Math.random() * 30);
    for (let i = 0; i < particleCount; i++) {
      if (cmeParticles.length >= maxParticles) break;

      // Random velocity outward from spawn point
      const spread = 0.3;
      const vx = spawnX / sunRadius + (Math.random() - 0.5) * spread;
      const vy = spawnY / sunRadius + (Math.random() - 0.5) * spread;
      const vz = spawnZ / sunRadius + (Math.random() - 0.5) * spread;
      const speed = 0.5 + Math.random() * 1.0;

      cmeParticles.push({
        x: spawnX,
        y: spawnY,
        z: spawnZ,
        vx: vx * speed,
        vy: vy * speed,
        vz: vz * speed,
        life: 1.0,
        size: 2 + Math.random() * 4,
      });
    }
  }

  /**
   * Updates positions and lifecycle of all active CME particles
   * @param {number} deltaTime - Time elapsed since last frame (seconds)
   */
  function updateCMEParticles(deltaTime) {
    // Update existing particles
    for (let i = cmeParticles.length - 1; i >= 0; i--) {
      const p = cmeParticles[i];
      p.x += p.vx * deltaTime * 10;
      p.y += p.vy * deltaTime * 10;
      p.z += p.vz * deltaTime * 10;
      p.life -= deltaTime * 0.3;

      if (p.life <= 0) {
        cmeParticles.splice(i, 1);
      }
    }
  }

  // Create and setup camera
  const camera = new Camera();

  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const validParams = validateURLParams(urlParams);

  // Apply URL parameters
  if (validParams.zoom !== undefined && validParams.zoom !== null) {
    camera.zoom = validParams.zoom;
  }
  if (validParams.focus !== undefined && validParams.focus !== null) {
    camera.focusTarget = validParams.focus;
  }

  // Save timeScale from URL to reapply after setupControls
  let urlTimeScale = null;
  if (validParams.timeScale !== undefined && validParams.timeScale !== null) {
    const sliderValue = validParams.timeScale;
    // Use same logarithmic conversion as the slider
    const minSeconds = 0.01;
    const maxSeconds = 30;
    const logMin = Math.log(minSeconds);
    const logMax = Math.log(maxSeconds);
    const secondsPerDay = Math.exp(
      logMax - (sliderValue / 100) * (logMax - logMin)
    );
    urlTimeScale = 62.83 / 365.25 / secondsPerDay;
  }

  if (validParams.orbits !== undefined) {
    camera.showOrbits = validParams.orbits === "true";
  }

  // Handle label visibility
  const showLabels =
    validParams.labels === undefined || validParams.labels === "true";

  camera.setupControls(canvas);

  // Reapply timeScale from URL after setupControls (which may have overwritten it)
  if (urlTimeScale !== null) {
    camera.timeScale = urlTimeScale;
  }

  // Handle control visibility (do this after setupControls)
  if (validParams.controls === "hidden") {
    const controlPanel = document.getElementById("controls");
    if (controlPanel) {
      controlPanel.remove();
    }
  }

  // Handle instructions visibility separately
  if (validParams.instructions === "hidden") {
    const instructionsPanel = document.getElementById("instructions");
    if (instructionsPanel) {
      instructionsPanel.remove();
    }
  }

  // Create labels
  const labelsContainer = document.getElementById("labels-container");
  if (!showLabels) {
    labelsContainer.style.display = "none";
  }
  const sunLabel = document.createElement("div");
  sunLabel.className = "planet-label";
  sunLabel.id = "label-sun";
  sunLabel.textContent = config.sun.name;
  labelsContainer.appendChild(sunLabel);

  config.planets.forEach((planet, index) => {
    const label = document.createElement("div");
    label.className = "planet-label";
    label.id = `label-planet-${index}`;
    label.textContent = planet.name;
    labelsContainer.appendChild(label);

    // Add planet to focus dropdown
    const focusSelect = document.getElementById("focus-select");
    if (focusSelect) {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = planet.name;
      focusSelect.appendChild(option);
    }

    // Create labels for moons
    if (planet.moons) {
      planet.moons.forEach((moon, moonIndex) => {
        const moonLabel = document.createElement("div");
        moonLabel.className = "planet-label";
        moonLabel.id = `label-moon-${index}-${moonIndex}`;
        moonLabel.textContent = moon.name;
        labelsContainer.appendChild(moonLabel);

        // Add all moons to focus dropdown
        if (focusSelect) {
          const moonOption = document.createElement("option");
          moonOption.value = `moon-${index}-${moonIndex}`;
          moonOption.textContent = `    ↳ ${moon.name}`;
          focusSelect.appendChild(moonOption);
        }
      });
    }
  });

  // Cache label DOM references to avoid repeated getElementById calls
  const labelCache = {
    sun: sunLabel,
    planets: config.planets.map((planet, index) =>
      document.getElementById(`label-planet-${index}`)
    ),
    moons: config.planets.map((planet, pIndex) =>
      planet.moons
        ? planet.moons.map((moon, mIndex) =>
            document.getElementById(`label-moon-${pIndex}-${mIndex}`)
          )
        : []
    ),
  };

  /**
   * Converts exponential zoom value to linear slider position
   * @param {number} zoomValue - Camera zoom distance (1-3000)
   * @returns {number} Slider position (1-3000)
   */
  const zoomToSlider = (zoomValue) => {
    const min = 1;
    const max = 3000;
    return 1 + 2999 * (Math.log(zoomValue / min) / Math.log(max / min));
  };

  // Update UI controls to reflect URL parameter values (only if they exist)
  const zoomEl = document.getElementById("zoom");
  const focusSelectEl = document.getElementById("focus-select");
  const showOrbitsEl = document.getElementById("show-orbits");
  const timeScaleEl = document.getElementById("time-scale");

  if (zoomEl) {
    zoomEl.value = 3001 - zoomToSlider(camera.zoom);
  }
  if (focusSelectEl) {
    focusSelectEl.value = camera.focusTarget;
  }
  if (showOrbitsEl) {
    showOrbitsEl.checked = camera.showOrbits;
  }
  if (timeScaleEl && urlParams.has("timeScale")) {
    timeScaleEl.value = parseFloat(urlParams.get("timeScale"));
  }

  // Animation state
  let accumulatedTime = 0;
  let lastFrameTime = 0;

  // Performance monitoring
  const perfMonitor = {
    fps: 0,
    frameTime: 0,
    frames: 0,
    lastUpdate: 0,
    frameTimes: [],
    maxSamples: 60,
  };

  // Create performance overlay
  const perfDiv = document.createElement("div");
  perfDiv.id = "performance-monitor";
  perfDiv.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.75);
    color: #0f0;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.4;
    z-index: 9999;
    pointer-events: none;
    min-width: 120px;
  `;
  perfDiv.innerHTML = `
    <div>FPS: <span id="perf-fps">--</span></div>
    <div>MS: <span id="perf-ms">--</span></div>
    <div>MEM: <span id="perf-mem">--</span></div>
  `;
  document.body.appendChild(perfDiv);

  // Hide performance monitor by default (show with ?performance=true)
  const showPerformance = validParams.performance === "true";
  if (!showPerformance) {
    perfDiv.style.display = "none";
  }

  // Fix #6: Cache DOM references (avoid repeated getElementById calls)
  const perfDOMCache = {
    fps: document.getElementById("perf-fps"),
    ms: document.getElementById("perf-ms"),
    mem: document.getElementById("perf-mem"),
  };

  /**
   * Updates the performance monitor display with FPS, frame time, and memory stats
   * @param {number} currentTime - Current animation time in seconds
   */
  function updatePerfMonitor(currentTime) {
    perfMonitor.frames++;
    const elapsed = currentTime - perfMonitor.lastUpdate;

    // Update every 500ms
    if (elapsed >= 0.5) {
      perfMonitor.fps = Math.round(perfMonitor.frames / elapsed);

      // Calculate average frame time
      const avgFrameTime =
        perfMonitor.frameTimes.reduce((a, b) => a + b, 0) /
        perfMonitor.frameTimes.length;
      perfMonitor.frameTime = avgFrameTime.toFixed(2);

      // Update display using cached DOM references
      perfDOMCache.fps.textContent = perfMonitor.fps;
      perfDOMCache.ms.textContent = perfMonitor.frameTime;

      // Memory info (if available)
      if (performance.memory) {
        const memMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
        perfDOMCache.mem.textContent = memMB + " MB";
      } else {
        perfDOMCache.mem.textContent = "N/A";
      }

      perfMonitor.frames = 0;
      perfMonitor.lastUpdate = currentTime;
      perfMonitor.frameTimes = [];
    }
  }

  // Planet click tracking
  const planetScreenPositions = {
    sun: null,
    planets: new Array(config.planets.length),
  };

  // Camera transition state
  let cameraTransition = {
    active: false,
    startZoom: camera.zoom,
    targetZoom: camera.zoom,
    startFocus: camera.focusTarget,
    targetFocus: camera.focusTarget,
    startFocusPos: { x: 0, y: 0, z: 0 },
    targetFocusPos: { x: 0, y: 0, z: 0 },
    progress: 0,
    duration: 1.5, // seconds
  };

  /**
   * Calculates the 3D position of a focus target (sun, planet, or moon)
   * @param {number|string} focusIndex - Index of focus target (-1=sun, 0-7=planets, "moon-p-m"=moon)
   * @param {number} time - Current accumulated animation time
   * @returns {{x: number, y: number, z: number}} 3D position coordinates
   */
  function calculateFocusPosition(focusIndex, time) {
    if (focusIndex === -1) {
      // Sun at origin
      return { x: camera.panX, y: camera.panY, z: camera.panZ };
    } else if (
      typeof focusIndex === "string" &&
      focusIndex.startsWith("moon-")
    ) {
      // Moon focus: format is "moon-planetIndex-moonIndex"
      const parts = focusIndex.split("-");
      const planetIndex = parseInt(parts[1]);
      const moonIndex = parseInt(parts[2]);
      const planet = config.planets[planetIndex];
      const moon = planet.moons[moonIndex];

      // First get planet position
      const planetPos = calculateFocusPosition(planetIndex, time);
      const rotationAngle = planet.rotationSpeed
        ? time * planet.rotationSpeed
        : 0;
      const moonAngle = time * moon.orbitSpeed * 0.1;

      let moonX, moonY, moonZ;
      if (moon.orbitalTilt !== undefined) {
        // Moon has specific orbital tilt (e.g., Earth's Moon)
        const tiltRad = (moon.orbitalTilt * Math.PI) / 180;
        const baseX = moon.orbitRadius * Math.cos(moonAngle);
        const baseY =
          moon.orbitRadius * Math.sin(moonAngle) * Math.sin(tiltRad);
        const baseZ =
          moon.orbitRadius * Math.sin(moonAngle) * Math.cos(tiltRad);
        moonX = planetPos.x + baseX;
        moonY = planetPos.y + baseY;
        moonZ = planetPos.z + baseZ;
      } else if (planet.axialTilt !== undefined) {
        // Align moon orbit with planet's equatorial plane
        const tiltRad = (planet.axialTilt * Math.PI) / 180;
        const cosTilt = Math.cos(tiltRad);
        const sinTilt = Math.sin(tiltRad);
        const cosRot = Math.cos(rotationAngle);
        const sinRot = Math.sin(rotationAngle);

        const localX = moon.orbitRadius * Math.cos(moonAngle);
        const localY = 0;
        const localZ = moon.orbitRadius * Math.sin(moonAngle);

        const transformedX = localX * cosRot + localZ * sinRot;
        const transformedY =
          localX * sinRot * sinTilt +
          localY * cosTilt -
          localZ * cosRot * sinTilt;
        const transformedZ =
          -localX * sinRot * cosTilt +
          localY * sinTilt +
          localZ * cosRot * cosTilt;

        moonX = planetPos.x + transformedX;
        moonY = planetPos.y + transformedY;
        moonZ = planetPos.z + transformedZ;
      } else {
        // Default: orbit in horizontal plane
        moonX = planetPos.x + moon.orbitRadius * Math.cos(moonAngle);
        moonY = planetPos.y;
        moonZ = planetPos.z + moon.orbitRadius * Math.sin(moonAngle);
      }
      return { x: moonX, y: moonY, z: moonZ };
    } else if (focusIndex >= 0 && focusIndex < config.planets.length) {
      const planet = config.planets[focusIndex];
      const startAngleRad = ((planet.startAngle || 0) * Math.PI) / 180;
      const angle = time * planet.orbitSpeed * 0.1 + startAngleRad;
      const incRad = ((planet.inclination || 0) * Math.PI) / 180;
      const sinInc = Math.sin(incRad);
      const cosInc = Math.cos(incRad);

      let x, y, z;
      if (planet.eccentricity && planet.eccentricity > 0) {
        const e = planet.eccentricity;
        const a = planet.orbitRadius;
        const r = (a * (1 - e * e)) / (1 + e * Math.cos(angle));
        x = r * Math.cos(angle);
        const zFlat = r * Math.sin(angle);
        y = -zFlat * sinInc;
        z = zFlat * cosInc;
      } else {
        x = planet.orbitRadius * Math.cos(angle);
        const zFlat = planet.orbitRadius * Math.sin(angle);
        y = -zFlat * sinInc;
        z = zFlat * cosInc;
      }
      return { x, y, z };
    }
    return { x: camera.panX, y: camera.panY, z: camera.panZ };
  }

  /**
   * Initiates smooth camera transition to focus on a specific celestial body
   * @param {number|string} planetIndex - Target index (-1=sun, 0-7=planets, "moon-p-m"=moon)
   */
  function transitionToPlanet(planetIndex) {
    // Calculate appropriate zoom based on object size
    let targetRadius;
    if (planetIndex === -1) {
      // Sun
      targetRadius = config.sun.radius;
    } else if (
      typeof planetIndex === "string" &&
      planetIndex.startsWith("moon-")
    ) {
      // Moon
      const parts = planetIndex.split("-");
      const pIndex = parseInt(parts[1]);
      const mIndex = parseInt(parts[2]);
      targetRadius = config.planets[pIndex].moons[mIndex].radius;
    } else {
      // Planet
      targetRadius = config.planets[planetIndex].radius;
    }

    // Set zoom to make the object nicely visible (about 1/4 of screen height)
    const targetZoom = targetRadius * 8;
    const clampedZoom = Math.max(10, Math.min(3000, targetZoom));

    // Calculate current and target focus positions
    const startPos = calculateFocusPosition(
      camera.focusTarget,
      accumulatedTime
    );
    const targetPos = calculateFocusPosition(planetIndex, accumulatedTime);

    // Start smooth transition
    cameraTransition.active = true;
    cameraTransition.startZoom = camera.zoom;
    cameraTransition.targetZoom = clampedZoom;
    cameraTransition.startFocus = camera.focusTarget;
    cameraTransition.targetFocus = planetIndex;
    cameraTransition.startFocusPos = startPos;
    cameraTransition.targetFocusPos = targetPos;
    cameraTransition.progress = 0;
  }

  // Set up dropdown focus change callback
  camera.onFocusChange = transitionToPlanet;

  // Click handler for selecting planets
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Find closest planet to click
    let closestPlanet = -1;
    let closestDistance = Infinity;

    // Check sun
    if (planetScreenPositions.sun && planetScreenPositions.sun.visible) {
      const dx = clickX - planetScreenPositions.sun.x;
      const dy = clickY - planetScreenPositions.sun.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 30 && distance < closestDistance) {
        closestPlanet = -1;
        closestDistance = distance;
      }
    }

    // Check planets
    if (planetScreenPositions.planets) {
      planetScreenPositions.planets.forEach((planet, index) => {
        if (planet && planet.visible) {
          const dx = clickX - planet.x;
          const dy = clickY - planet.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 30 && distance < closestDistance) {
            closestPlanet = index;
            closestDistance = distance;
          }
        }
      });
    }

    if (closestDistance < Infinity) {
      transitionToPlanet(closestPlanet);
    }
  });

  // Main render loop
  function render(time) {
    time *= 0.001;
    const frameStart = performance.now();

    if (lastFrameTime === 0) lastFrameTime = time;
    const deltaTime = time - lastFrameTime;
    lastFrameTime = time;
    accumulatedTime += deltaTime * camera.timeScale;

    // Fix #7: Update camera for smooth movement
    camera.update();

    // Update camera transition
    if (cameraTransition.active) {
      cameraTransition.progress += deltaTime / cameraTransition.duration;

      if (cameraTransition.progress >= 1.0) {
        // Transition complete
        cameraTransition.progress = 1.0;
        cameraTransition.active = false;
        camera.focusTarget = cameraTransition.targetFocus;
        const focusSelectEl = document.getElementById("focus-select");
        if (focusSelectEl) {
          focusSelectEl.value = camera.focusTarget;
        }
      }

      // Smooth easing function (ease-in-out)
      const t = cameraTransition.progress;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      // Interpolate zoom
      camera.zoom =
        cameraTransition.startZoom +
        (cameraTransition.targetZoom - cameraTransition.startZoom) * eased;
      const zoomEl = document.getElementById("zoom");
      if (zoomEl) {
        zoomEl.value = 3001 - zoomToSlider(camera.zoom);
      }
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shaderProgram);

    const projectionMatrix = mat4.perspective(
      45,
      gl.canvas.width / gl.canvas.height,
      0.1,
      5000
    );

    // Set projection and view matrices once (cached uniforms)
    gl.uniformMatrix4fv(mainUniforms.projection, false, projectionMatrix);

    // Calculate focus target position
    let focusX = camera.panX;
    let focusY = camera.panY;
    let focusZ = camera.panZ;

    // If transitioning, interpolate between start and target positions
    if (cameraTransition.active) {
      const t = cameraTransition.progress;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      // Update target position for moving planets
      cameraTransition.targetFocusPos = calculateFocusPosition(
        cameraTransition.targetFocus,
        accumulatedTime
      );

      focusX =
        cameraTransition.startFocusPos.x +
        (cameraTransition.targetFocusPos.x - cameraTransition.startFocusPos.x) *
          eased;
      focusY =
        cameraTransition.startFocusPos.y +
        (cameraTransition.targetFocusPos.y - cameraTransition.startFocusPos.y) *
          eased;
      focusZ =
        cameraTransition.startFocusPos.z +
        (cameraTransition.targetFocusPos.z - cameraTransition.startFocusPos.z) *
          eased;
    } else if (
      typeof camera.focusTarget === "string" &&
      camera.focusTarget.startsWith("moon-")
    ) {
      // Moon focus
      const focusPos = calculateFocusPosition(
        camera.focusTarget,
        accumulatedTime
      );
      focusX = focusPos.x;
      focusY = focusPos.y;
      focusZ = focusPos.z;
    } else if (
      camera.focusTarget >= 0 &&
      camera.focusTarget < config.planets.length
    ) {
      const planet = config.planets[camera.focusTarget];
      const startAngleRad = ((planet.startAngle || 0) * Math.PI) / 180;
      const angle = accumulatedTime * planet.orbitSpeed * 0.1 + startAngleRad;
      const incRad = ((planet.inclination || 0) * Math.PI) / 180;
      const sinInc = Math.sin(incRad);
      const cosInc = Math.cos(incRad);

      if (planet.eccentricity && planet.eccentricity > 0) {
        const e = planet.eccentricity;
        const a = planet.orbitRadius;
        const r = (a * (1 - e * e)) / (1 + e * Math.cos(angle));
        focusX = r * Math.cos(angle);
        const zFlat = r * Math.sin(angle);
        focusY = -zFlat * sinInc;
        focusZ = zFlat * cosInc;
      } else {
        focusX = planet.orbitRadius * Math.cos(angle);
        const zFlat = planet.orbitRadius * Math.sin(angle);
        focusY = -zFlat * sinInc;
        focusZ = zFlat * cosInc;
      }
    }

    const cameraAngleRad = (camera.angle * Math.PI) / 180;
    const cameraPitchRad = (camera.height * Math.PI) / 180;
    const horizontalDistance = camera.zoom * Math.cos(cameraPitchRad);
    const cameraX = horizontalDistance * Math.cos(cameraAngleRad) + focusX;
    const cameraY = camera.zoom * Math.sin(cameraPitchRad);
    const cameraZ = horizontalDistance * Math.sin(cameraAngleRad) + focusZ;

    const viewMatrix = mat4.lookAt(
      [cameraX, cameraY, cameraZ],
      [focusX, focusY, focusZ],
      [0, 1, 0]
    );

    gl.uniformMatrix4fv(mainUniforms.view, false, viewMatrix);

    // Render orbit paths
    if (camera.showOrbits) {
      orbitBuffers.forEach((orbitBuffer) => {
        renderOrbitPath(gl, shaderProgram, mainUniforms, orbitBuffer);
      });
    }

    // Render asteroid belt
    gl.useProgram(pointShaderProgram);
    gl.uniformMatrix4fv(pointUniforms.projection, false, projectionMatrix);
    gl.uniformMatrix4fv(pointUniforms.view, false, viewMatrix);
    gl.uniform3fv(pointUniforms.color, config.asteroidBelt.color);
    gl.uniform1f(pointUniforms.pointSize, 2.0);

    // Use pre-allocated buffer (no GC allocations)
    for (let i = 0; i < config.asteroidBelt.count; i++) {
      const asteroid = asteroidData[i];
      const orbitSpeed =
        config.asteroidBelt.orbitSpeed * Math.sqrt(125 / asteroid.radius);
      const currentAngle = asteroid.angle + accumulatedTime * orbitSpeed * 0.1;
      const x = asteroid.radius * Math.cos(currentAngle);
      const z = asteroid.radius * Math.sin(currentAngle);
      const idx = i * 3;
      asteroidPositions[idx] = x;
      asteroidPositions[idx + 1] = asteroid.height;
      asteroidPositions[idx + 2] = z;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, asteroidBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, asteroidPositions, gl.DYNAMIC_DRAW);

    gl.enableVertexAttribArray(pointAttribs.position);
    gl.vertexAttribPointer(pointAttribs.position, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, config.asteroidBelt.count);

    // Render Kuiper Belt
    gl.uniform3fv(pointUniforms.color, config.kuiperBelt.color);
    gl.uniform1f(pointUniforms.pointSize, 2.5);

    // Use pre-allocated buffer (no GC allocations)
    for (let i = 0; i < config.kuiperBelt.count; i++) {
      const object = kuiperData[i];
      const orbitSpeed =
        config.kuiperBelt.orbitSpeed * Math.sqrt(1400 / object.radius);
      const currentAngle = object.angle + accumulatedTime * orbitSpeed * 0.1;
      const x = object.radius * Math.cos(currentAngle);
      const z = object.radius * Math.sin(currentAngle);
      const idx = i * 3;
      kuiperPositions[idx] = x;
      kuiperPositions[idx + 1] = object.height;
      kuiperPositions[idx + 2] = z;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, kuiperBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, kuiperPositions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pointAttribs.position);
    gl.vertexAttribPointer(pointAttribs.position, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, config.kuiperBelt.count);

    // Switch back to main shader (matrices already set)
    gl.useProgram(shaderProgram);

    const sunVisible = true;

    // Update Sun label
    if (sunVisible) {
      const sunScreenPos = project3DTo2D(
        0,
        0,
        0,
        viewMatrix,
        projectionMatrix,
        canvas
      );

      // Store sun position for click detection
      planetScreenPositions.sun = sunScreenPos;

      if (sunScreenPos.visible) {
        sunLabel.style.display = "block";
        sunLabel.style.left = sunScreenPos.x + "px";
        sunLabel.style.top = sunScreenPos.y - 15 + "px";
      } else {
        sunLabel.style.display = "none";
      }
    } else {
      sunLabel.style.display = "none";
      planetScreenPositions.sun = { visible: false };
    }

    // Render Sun
    if (sunVisible) {
      const sunRotationAngle = accumulatedTime * config.sun.rotationSpeed;
      renderSphere(
        gl,
        shaderProgram,
        mainUniforms,
        mainAttribs,
        sphereBuffers,
        config.sun,
        [0, 0, 0],
        null,
        null,
        config.sun.axialTilt,
        sunRotationAngle,
        textures.sun,
        null, // No clouds for Sun
        0, // No cloud rotation
        null, // No specular map for Sun
        null, // No normal map for Sun
        null, // No night map for Sun
        null, // No planet shadow for Sun
        null, // No planet radius for Sun
        accumulatedTime // Time for sun spots
      );
    }

    // Render planets
    config.planets.forEach((planet, index) => {
      const startAngleRad = ((planet.startAngle || 0) * Math.PI) / 180;
      const angle = accumulatedTime * planet.orbitSpeed * 0.1 + startAngleRad;
      const incRad = ((planet.inclination || 0) * Math.PI) / 180;
      const sinInc = Math.sin(incRad);
      const cosInc = Math.cos(incRad);

      let x, y, z;
      if (planet.eccentricity && planet.eccentricity > 0) {
        const e = planet.eccentricity;
        const a = planet.orbitRadius;
        const r = (a * (1 - e * e)) / (1 + e * Math.cos(angle));
        x = r * Math.cos(angle);
        const zFlat = r * Math.sin(angle);
        y = -zFlat * sinInc;
        z = zFlat * cosInc;
      } else {
        x = planet.orbitRadius * Math.cos(angle);
        const zFlat = planet.orbitRadius * Math.sin(angle);
        y = -zFlat * sinInc;
        z = zFlat * cosInc;
      }

      const planetVisible = true;

      // Update label position
      if (planetVisible) {
        const screenPos = project3DTo2D(
          x,
          y + planet.radius + 1,
          z,
          viewMatrix,
          projectionMatrix,
          canvas
        );

        // Store planet screen position for click detection
        planetScreenPositions.planets[index] = {
          x: screenPos.x,
          y: screenPos.y,
          visible: screenPos.visible,
        };

        const label = labelCache.planets[index];
        if (screenPos.visible) {
          label.style.display = "block";
          label.style.left = screenPos.x + "px";
          label.style.top = screenPos.y + "px";
        } else {
          label.style.display = "none";
        }
      } else {
        // Planet culled - hide label and skip position storage
        const label = labelCache.planets[index];
        label.style.display = "none";
        planetScreenPositions.planets[index] = { visible: false };
      }

      // Only render planet if visible in frustum
      if (planetVisible) {
        // Calculate rotation angle first (needed for moon shadow calculation and rings)
        const rotationAngle = planet.rotationSpeed
          ? accumulatedTime * planet.rotationSpeed
          : 0;

        // Calculate moon position for shadow
        let moonPosition = null;
        let moonRadius = null;
        if (planet.moons && planet.moons.length > 0) {
          const moon = planet.moons[0];
          const moonAngle = accumulatedTime * moon.orbitSpeed * 0.1;

          let moonX, moonY, moonZ;
          if (moon.orbitalTilt !== undefined) {
            // Moon has specific orbital tilt (e.g., Earth's Moon)
            const tiltRad = (moon.orbitalTilt * Math.PI) / 180;
            const baseX = moon.orbitRadius * Math.cos(moonAngle);
            const baseY =
              moon.orbitRadius * Math.sin(moonAngle) * Math.sin(tiltRad);
            const baseZ =
              moon.orbitRadius * Math.sin(moonAngle) * Math.cos(tiltRad);
            moonX = x + baseX;
            moonY = y + baseY;
            moonZ = z + baseZ;
          } else if (planet.axialTilt !== undefined) {
            // Align moon orbit with planet's equatorial plane
            // Use same transformation as rings (equatorial plane rotates with planet)
            const tiltRad = (planet.axialTilt * Math.PI) / 180;
            const cosTilt = Math.cos(tiltRad);
            const sinTilt = Math.sin(tiltRad);
            const cosRot = Math.cos(rotationAngle);
            const sinRot = Math.sin(rotationAngle);

            // Calculate position in orbital plane
            const localX = moon.orbitRadius * Math.cos(moonAngle);
            const localY = 0;
            const localZ = moon.orbitRadius * Math.sin(moonAngle);

            // Apply same transformation as rings
            moonX = x + localX * cosRot + localZ * sinRot;
            moonY =
              y +
              localX * sinRot * sinTilt +
              localY * cosTilt -
              localZ * cosRot * sinTilt;
            moonZ =
              z -
              localX * sinRot * cosTilt +
              localY * sinTilt +
              localZ * cosRot * cosTilt;
          } else {
            // Default: orbit in horizontal plane
            moonX = x + moon.orbitRadius * Math.cos(moonAngle);
            moonY = y;
            moonZ = z + moon.orbitRadius * Math.sin(moonAngle);
          }

          moonPosition = [moonX, moonY, moonZ];
          moonRadius = moon.radius;
        }

        const planetTexture = textures[planet.name] || null;
        const cloudTexture =
          planet.name === "Earth" ? textures.earthClouds : null;
        // Clouds rotate slightly faster than Earth (about 1.2x speed)
        const cloudRotation =
          planet.name === "Earth"
            ? (accumulatedTime * planet.rotationSpeed * 1.2) / (Math.PI * 2)
            : 0;
        const specularTexture =
          planet.name === "Earth" ? textures.earthSpecular : null;
        const normalTexture =
          planet.name === "Earth" ? textures.earthNormal : null;
        const nightTexture =
          planet.name === "Earth" ? textures.earthNight : null;
        renderSphere(
          gl,
          shaderProgram,
          mainUniforms,
          mainAttribs,
          sphereBuffers,
          planet,
          [x, y, z],
          moonPosition,
          moonRadius,
          planet.axialTilt,
          rotationAngle,
          planetTexture,
          cloudTexture,
          cloudRotation,
          specularTexture,
          normalTexture,
          nightTexture,
          null, // No planet shadow for planets
          null, // No planet radius for planets
          accumulatedTime // Time for effects
        );

        // Render planetary spot (Great Red Spot)
        if (planet.spot) {
          const spot = planet.spot;
          const latRad = (spot.latitude * Math.PI) / 180;
          const lonRad =
            ((spot.longitude + rotationAngle * 57.2958) * Math.PI) / 180;

          const localX = Math.cos(latRad) * Math.cos(lonRad);
          const localY = Math.sin(latRad);
          const localZ = Math.cos(latRad) * Math.sin(lonRad);

          const tangentLon = [-Math.sin(lonRad), 0, Math.cos(lonRad)];
          const tangentLat = [
            -Math.sin(latRad) * Math.cos(lonRad),
            Math.cos(latRad),
            -Math.sin(latRad) * Math.sin(lonRad),
          ];

          // Reuse matrix from pool
          const modelMatrix = matrixPool.model;
          for (let i = 0; i < 16; i++) modelMatrix[i] = i % 5 === 0 ? 1 : 0;
          modelMatrix[12] = x;
          modelMatrix[13] = y;
          modelMatrix[14] = z;

          if (planet.axialTilt !== undefined && rotationAngle !== undefined) {
            const tiltRad = (planet.axialTilt * Math.PI) / 180;
            const cosTilt = Math.cos(tiltRad);
            const sinTilt = Math.sin(tiltRad);
            const cosRot = Math.cos(rotationAngle);
            const sinRot = Math.sin(rotationAngle);

            const tempMatrix = matrixPool.temp;
            for (let i = 0; i < 16; i++) tempMatrix[i] = i % 5 === 0 ? 1 : 0;
            tempMatrix[0] = cosRot;
            tempMatrix[2] = sinRot;
            tempMatrix[4] = sinRot * sinTilt;
            tempMatrix[5] = cosTilt;
            tempMatrix[6] = -cosRot * sinTilt;
            tempMatrix[8] = -sinRot * cosTilt;
            tempMatrix[9] = sinTilt;
            tempMatrix[10] = cosRot * cosTilt;

            const combined = matrixPool.combined;
            for (let i = 0; i < 4; i++) {
              for (let j = 0; j < 4; j++) {
                combined[i + j * 4] = 0;
                for (let k = 0; k < 4; k++) {
                  combined[i + j * 4] +=
                    modelMatrix[i + k * 4] * tempMatrix[k + j * 4];
                }
              }
            }
            for (let i = 0; i < 16; i++) modelMatrix[i] = combined[i];
          }

          const spotTranslate = matrixPool.spotTranslate;
          for (let i = 0; i < 16; i++) spotTranslate[i] = i % 5 === 0 ? 1 : 0;
          spotTranslate[12] = localX * planet.radius * 1.001;
          spotTranslate[13] = localY * planet.radius * 1.001;
          spotTranslate[14] = localZ * planet.radius * 1.001;

          const withSpotPos = matrixPool.withSpotPos;
          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
              withSpotPos[i + j * 4] = 0;
              for (let k = 0; k < 4; k++) {
                withSpotPos[i + j * 4] +=
                  modelMatrix[i + k * 4] * spotTranslate[k + j * 4];
              }
            }
          }

          const orientMatrix = matrixPool.orientMatrix;
          for (let i = 0; i < 16; i++) orientMatrix[i] = i % 5 === 0 ? 1 : 0;
          orientMatrix[0] = tangentLon[0];
          orientMatrix[1] = tangentLon[1];
          orientMatrix[2] = tangentLon[2];
          orientMatrix[4] = tangentLat[0];
          orientMatrix[5] = tangentLat[1];
          orientMatrix[6] = tangentLat[2];
          orientMatrix[8] = localX;
          orientMatrix[9] = localY;
          orientMatrix[10] = localZ;

          // Fix #4: Reuse pooled matrix instead of creating new one
          const withOrientation = matrixPool.withOrientation;
          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
              withOrientation[i + j * 4] = 0;
              for (let k = 0; k < 4; k++) {
                withOrientation[i + j * 4] +=
                  withSpotPos[i + k * 4] * orientMatrix[k + j * 4];
              }
            }
          }

          mat4.scale(withOrientation, withOrientation, [
            spot.width,
            spot.height,
            0.01,
          ]);

          gl.uniformMatrix4fv(mainUniforms.model, false, withOrientation);
          gl.uniform3fv(mainUniforms.color, spot.color);
          gl.uniform3fv(mainUniforms.lightPos, [0, 0, 0]);
          gl.uniform1i(mainUniforms.emissive, false);
          gl.uniform1i(mainUniforms.checkShadow, false);

          gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.position);
          gl.enableVertexAttribArray(mainAttribs.position);
          gl.vertexAttribPointer(
            mainAttribs.position,
            3,
            gl.FLOAT,
            false,
            0,
            0
          );

          gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.normal);
          gl.enableVertexAttribArray(mainAttribs.normal);
          gl.vertexAttribPointer(mainAttribs.normal, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereBuffers.indices);
          gl.drawElements(
            gl.TRIANGLES,
            sphereBuffers.indexCount,
            gl.UNSIGNED_SHORT,
            0
          );
        }

        // Render moons
        if (planet.moons) {
          const distToPlanet = Math.sqrt(
            (cameraX - x) * (cameraX - x) +
              (cameraY - y) * (cameraY - y) +
              (cameraZ - z) * (cameraZ - z)
          );
          // Only show moon labels when focused on this planet or very close to it
          const isFocused =
            camera.focusTarget === index ||
            (cameraTransition.active && cameraTransition.targetFocus === index);
          const showMoonLabels = isFocused || distToPlanet < 50;

          planet.moons.forEach((moon, moonIndex) => {
            const moonAngle = accumulatedTime * moon.orbitSpeed * 0.1;

            let moonX, moonY, moonZ;
            if (moon.orbitalTilt !== undefined) {
              // Moon has specific orbital tilt (e.g., Earth's Moon)
              const tiltRad = (moon.orbitalTilt * Math.PI) / 180;
              const baseX = moon.orbitRadius * Math.cos(moonAngle);
              const baseY =
                moon.orbitRadius * Math.sin(moonAngle) * Math.sin(tiltRad);
              const baseZ =
                moon.orbitRadius * Math.sin(moonAngle) * Math.cos(tiltRad);
              moonX = x + baseX;
              moonY = y + baseY;
              moonZ = z + baseZ;
            } else if (planet.axialTilt !== undefined) {
              // Align moon orbit with planet's equatorial plane
              // Use same transformation as rings to stay in same plane
              const tiltRad = (planet.axialTilt * Math.PI) / 180;
              const cosTilt = Math.cos(tiltRad);
              const sinTilt = Math.sin(tiltRad);
              const cosRot = Math.cos(rotationAngle);
              const sinRot = Math.sin(rotationAngle);

              // Calculate position in orbital plane
              const localX = moon.orbitRadius * Math.cos(moonAngle);
              const localY = 0;
              const localZ = moon.orbitRadius * Math.sin(moonAngle);

              // Apply same transformation as rings (axial tilt + rotation)
              const transformedX = localX * cosRot + localZ * sinRot;
              const transformedY =
                localX * sinRot * sinTilt +
                localY * cosTilt -
                localZ * cosRot * sinTilt;
              const transformedZ =
                -localX * sinRot * cosTilt +
                localY * sinTilt +
                localZ * cosRot * cosTilt;

              moonX = x + transformedX;
              moonY = y + transformedY;
              moonZ = z + transformedZ;
            } else {
              // Default: orbit in horizontal plane
              moonX = x + moon.orbitRadius * Math.cos(moonAngle);
              moonY = y;
              moonZ = z + moon.orbitRadius * Math.sin(moonAngle);
            }

            const moonVisible = true;

            const moonScreenPos = moonVisible
              ? project3DTo2D(
                  moonX,
                  moonY + moon.radius + 0.5,
                  moonZ,
                  viewMatrix,
                  projectionMatrix,
                  canvas
                )
              : { visible: false };
            const moonLabel = labelCache.moons[index][moonIndex];
            if (moonVisible) {
              if (moonScreenPos.visible && showMoonLabels) {
                moonLabel.style.display = "block";
                moonLabel.style.left = moonScreenPos.x + "px";
                moonLabel.style.top = moonScreenPos.y + "px";
              } else {
                moonLabel.style.display = "none";
              }
            } else {
              moonLabel.style.display = "none";
            }

            // Only render moon if visible
            if (moonVisible) {
              const moonTexture = textures[moon.name] || null;

              // Calculate tidal locking rotation - same face always toward planet
              // The rotation angle should match the orbital angle so the moon "shows"
              // the same face to its planet (like Earth's Moon)
              const tidalLockRotation = moonAngle + Math.PI / 2; // Add 90° to align texture properly

              renderSphere(
                gl,
                shaderProgram,
                mainUniforms,
                mainAttribs,
                sphereBuffers,
                moon,
                [moonX, moonY, moonZ],
                null,
                null,
                0, // No axial tilt for moons (for simplicity)
                tidalLockRotation,
                moonTexture,
                null, // No clouds for moons
                0, // No cloud rotation
                null, // No specular map for moons
                null, // No normal map for moons
                null, // No night map for moons
                [x, y, z], // Planet position for shadow casting (lunar eclipse)
                planet.radius, // Planet radius for shadow
                accumulatedTime // Time for effects
              );
            } // End moonVisible check
          });
        }

        // Render rings
        if (planet.hasRings && planet.rings) {
          const ringTexture =
            planet.name === "Saturn" ? textures.saturnRing : null;
          const cachedRingBuffers = ringBuffersCache.get(index);
          planet.rings.forEach((ring, ringIndex) => {
            renderRing(
              gl,
              shaderProgram,
              mainUniforms,
              mainAttribs,
              ring,
              [x, y, z],
              planet.axialTilt,
              rotationAngle,
              ringTexture,
              cachedRingBuffers[ringIndex]
            );
          });
        }
      } // End planetVisible check
    });

    // Update and render CME particles
    updateCMEParticles(deltaTime);

    // Check if it's time to spawn new CME
    if (accumulatedTime > nextCMETime) {
      spawnCME();
      nextCMETime = accumulatedTime + Math.random() * 8 + 5; // Next CME in 5-13 seconds
    }

    // Render CME particles
    if (cmeParticles.length > 0) {
      gl.useProgram(particleShaderProgram);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending
      gl.depthMask(false); // Don't write to depth buffer

      gl.uniformMatrix4fv(particleUniforms.projection, false, projectionMatrix);
      gl.uniformMatrix4fv(particleUniforms.view, false, viewMatrix);

      // Fix #5: Use pre-allocated arrays (no GC allocations)
      const count = cmeParticles.length;
      for (let i = 0; i < count; i++) {
        const p = cmeParticles[i];
        const idx = i * 3;
        cmePreallocated.positions[idx] = p.x;
        cmePreallocated.positions[idx + 1] = p.y;
        cmePreallocated.positions[idx + 2] = p.z;
        cmePreallocated.sizes[i] = p.size;
        cmePreallocated.alphas[i] = p.life;
      }

      // Reuse buffers - just update data
      gl.bindBuffer(gl.ARRAY_BUFFER, cmeBuffers.position);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        cmePreallocated.positions.subarray(0, count * 3),
        gl.DYNAMIC_DRAW
      );
      gl.enableVertexAttribArray(particleAttribs.position);
      gl.vertexAttribPointer(
        particleAttribs.position,
        3,
        gl.FLOAT,
        false,
        0,
        0
      );

      gl.bindBuffer(gl.ARRAY_BUFFER, cmeBuffers.size);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        cmePreallocated.sizes.subarray(0, count),
        gl.DYNAMIC_DRAW
      );
      gl.enableVertexAttribArray(particleAttribs.size);
      gl.vertexAttribPointer(particleAttribs.size, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, cmeBuffers.alpha);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        cmePreallocated.alphas.subarray(0, count),
        gl.DYNAMIC_DRAW
      );
      gl.enableVertexAttribArray(particleAttribs.alpha);
      gl.vertexAttribPointer(particleAttribs.alpha, 1, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, cmeParticles.length);

      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // Update performance metrics
    const frameEnd = performance.now();
    const frameTime = frameEnd - frameStart;
    perfMonitor.frameTimes.push(frameTime);
    if (perfMonitor.frameTimes.length > perfMonitor.maxSamples) {
      perfMonitor.frameTimes.shift();
    }
    updatePerfMonitor(time);

    requestAnimationFrame(render);
  }

  render(0);
});
