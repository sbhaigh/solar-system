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

// Initialize WebGL and start application
window.addEventListener("load", function () {
  const canvas = document.getElementById("webgl-canvas");
  const gl = canvas.getContext("webgl");

  if (!gl) {
    alert("WebGL not supported");
    return;
  }

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

  // CME Particle system
  const cmeParticles = [];
  const maxParticles = 200;
  let nextCMETime = Math.random() * 5 + 3; // First CME in 3-8 seconds

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
  console.log("URL params:", window.location.search);
  console.log("controls param:", urlParams.get("controls"));

  // Apply URL parameters
  if (urlParams.has("zoom")) {
    camera.zoom = parseFloat(urlParams.get("zoom"));
  }
  if (urlParams.has("focus")) {
    camera.focusTarget = parseInt(urlParams.get("focus"));
  }

  // Save timeScale from URL to reapply after setupControls
  let urlTimeScale = null;
  if (urlParams.has("timeScale")) {
    const sliderValue = parseFloat(urlParams.get("timeScale"));
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

  if (urlParams.has("orbits")) {
    camera.showOrbits = urlParams.get("orbits") === "true";
  }

  // Handle label visibility
  const showLabels =
    !urlParams.has("labels") || urlParams.get("labels") === "true";

  camera.setupControls(canvas);

  // Reapply timeScale from URL after setupControls (which may have overwritten it)
  if (urlTimeScale !== null) {
    camera.timeScale = urlTimeScale;
  }

  // Handle control visibility (do this after setupControls)
  if (urlParams.get("controls") === "hidden") {
    const controlPanel = document.getElementById("controls");
    if (controlPanel) {
      controlPanel.remove();
    }
  }

  // Handle instructions visibility separately
  if (urlParams.get("instructions") === "hidden") {
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

        // Add only Earth's Moon to focus dropdown
        if (focusSelect && planet.name === "Earth" && moon.name === "Moon") {
          const moonOption = document.createElement("option");
          moonOption.value = `moon-${index}-${moonIndex}`;
          moonOption.textContent = `    ↳ ${moon.name}`;
          focusSelect.appendChild(moonOption);
        }
      });
    }
  });

  // Update UI controls to reflect URL parameter values (only if they exist)
  const zoomEl = document.getElementById("zoom");
  const focusSelectEl = document.getElementById("focus-select");
  const showOrbitsEl = document.getElementById("show-orbits");
  const timeScaleEl = document.getElementById("time-scale");

  if (zoomEl) {
    zoomEl.value = camera.zoom;
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

  // Planet click tracking
  const planetScreenPositions = [];

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

  // Helper function to calculate position of a focus target
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
      const rotationAngle = time * planet.rotationSpeed * 0.1;
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

  // Function to start camera transition to a planet
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

    if (lastFrameTime === 0) lastFrameTime = time;
    const deltaTime = time - lastFrameTime;
    lastFrameTime = time;
    accumulatedTime += deltaTime * camera.timeScale;

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
        zoomEl.value = camera.zoom;
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

    const projectionLoc = gl.getUniformLocation(
      shaderProgram,
      "uProjectionMatrix"
    );
    const viewLoc = gl.getUniformLocation(shaderProgram, "uViewMatrix");
    gl.uniformMatrix4fv(projectionLoc, false, projectionMatrix);
    gl.uniformMatrix4fv(viewLoc, false, viewMatrix);

    // Render orbit paths
    if (camera.showOrbits) {
      orbitBuffers.forEach((orbitBuffer) => {
        renderOrbitPath(gl, shaderProgram, orbitBuffer);
      });
    }

    // Render asteroid belt
    gl.useProgram(pointShaderProgram);
    const pointProjectionLoc = gl.getUniformLocation(
      pointShaderProgram,
      "uProjectionMatrix"
    );
    const pointViewLoc = gl.getUniformLocation(
      pointShaderProgram,
      "uViewMatrix"
    );
    const pointColorLoc = gl.getUniformLocation(pointShaderProgram, "uColor");
    const pointSizeLoc = gl.getUniformLocation(
      pointShaderProgram,
      "uPointSize"
    );

    gl.uniformMatrix4fv(pointProjectionLoc, false, projectionMatrix);
    gl.uniformMatrix4fv(pointViewLoc, false, viewMatrix);
    gl.uniform3fv(pointColorLoc, config.asteroidBelt.color);
    gl.uniform1f(pointSizeLoc, 2.0);

    const asteroidPositions = [];
    asteroidData.forEach((asteroid) => {
      const orbitSpeed =
        config.asteroidBelt.orbitSpeed * Math.sqrt(125 / asteroid.radius);
      const currentAngle = asteroid.angle + accumulatedTime * orbitSpeed * 0.1;
      const x = asteroid.radius * Math.cos(currentAngle);
      const z = asteroid.radius * Math.sin(currentAngle);
      asteroidPositions.push(x, asteroid.height, z);
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, asteroidBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(asteroidPositions),
      gl.DYNAMIC_DRAW
    );

    const pointPositionLoc = gl.getAttribLocation(
      pointShaderProgram,
      "aPosition"
    );
    gl.enableVertexAttribArray(pointPositionLoc);
    gl.vertexAttribPointer(pointPositionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, config.asteroidBelt.count);

    // Render Kuiper Belt
    gl.uniform3fv(pointColorLoc, config.kuiperBelt.color);
    gl.uniform1f(pointSizeLoc, 2.5);

    const kuiperPositions = [];
    kuiperData.forEach((object) => {
      const orbitSpeed =
        config.kuiperBelt.orbitSpeed * Math.sqrt(1400 / object.radius);
      const currentAngle = object.angle + accumulatedTime * orbitSpeed * 0.1;
      const x = object.radius * Math.cos(currentAngle);
      const z = object.radius * Math.sin(currentAngle);
      kuiperPositions.push(x, object.height, z);
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, kuiperBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(kuiperPositions),
      gl.DYNAMIC_DRAW
    );
    gl.enableVertexAttribArray(pointPositionLoc);
    gl.vertexAttribPointer(pointPositionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, config.kuiperBelt.count);

    // Switch back to main shader
    gl.useProgram(shaderProgram);
    gl.uniformMatrix4fv(projectionLoc, false, projectionMatrix);
    gl.uniformMatrix4fv(viewLoc, false, viewMatrix);

    // Update Sun label
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

    // Render Sun
    const sunRotationAngle = accumulatedTime * config.sun.rotationSpeed;
    renderSphere(
      gl,
      shaderProgram,
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

    // Render planets
    planetScreenPositions.planets = [];
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

      // Update label position
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

      const label = document.getElementById(`label-planet-${index}`);
      if (screenPos.visible) {
        label.style.display = "block";
        label.style.left = screenPos.x + "px";
        label.style.top = screenPos.y + "px";
      } else {
        label.style.display = "none";
      }

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
          // Orbital plane is tilted but doesn't rotate with planet spin
          const tiltRad = (planet.axialTilt * Math.PI) / 180;
          const cosTilt = Math.cos(tiltRad);
          const sinTilt = Math.sin(tiltRad);

          // Calculate position in orbital plane
          const localX = moon.orbitRadius * Math.cos(moonAngle);
          const localY = 0;
          const localZ = moon.orbitRadius * Math.sin(moonAngle);

          // Apply only axial tilt (not planet rotation)
          moonX = x + localX;
          moonY = y + localY * cosTilt - localZ * sinTilt;
          moonZ = z + localY * sinTilt + localZ * cosTilt;
        } else {
          // Default: orbit in horizontal plane
          moonX = x + moon.orbitRadius * Math.cos(moonAngle);
          moonY = y;
          moonZ = z + moon.orbitRadius * Math.sin(moonAngle);
        }

        moonPosition = [moonX, moonY, moonZ];
        moonRadius = moon.radius;
      }

      const rotationAngle = planet.rotationSpeed
        ? accumulatedTime * planet.rotationSpeed
        : 0;
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
      const nightTexture = planet.name === "Earth" ? textures.earthNight : null;
      renderSphere(
        gl,
        shaderProgram,
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

        const modelMatrix = mat4.create();
        modelMatrix[12] = x;
        modelMatrix[13] = y;
        modelMatrix[14] = z;

        if (planet.axialTilt !== undefined && rotationAngle !== undefined) {
          const tiltRad = (planet.axialTilt * Math.PI) / 180;
          const cosTilt = Math.cos(tiltRad);
          const sinTilt = Math.sin(tiltRad);
          const cosRot = Math.cos(rotationAngle);
          const sinRot = Math.sin(rotationAngle);

          const tempMatrix = mat4.create();
          tempMatrix[0] = cosRot;
          tempMatrix[2] = sinRot;
          tempMatrix[4] = sinRot * sinTilt;
          tempMatrix[5] = cosTilt;
          tempMatrix[6] = -cosRot * sinTilt;
          tempMatrix[8] = -sinRot * cosTilt;
          tempMatrix[9] = sinTilt;
          tempMatrix[10] = cosRot * cosTilt;

          const combined = mat4.create();
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

        const spotTranslate = mat4.create();
        spotTranslate[12] = localX * planet.radius * 1.001;
        spotTranslate[13] = localY * planet.radius * 1.001;
        spotTranslate[14] = localZ * planet.radius * 1.001;

        const withSpotPos = mat4.create();
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            withSpotPos[i + j * 4] = 0;
            for (let k = 0; k < 4; k++) {
              withSpotPos[i + j * 4] +=
                modelMatrix[i + k * 4] * spotTranslate[k + j * 4];
            }
          }
        }

        const orientMatrix = mat4.create();
        orientMatrix[0] = tangentLon[0];
        orientMatrix[1] = tangentLon[1];
        orientMatrix[2] = tangentLon[2];
        orientMatrix[4] = tangentLat[0];
        orientMatrix[5] = tangentLat[1];
        orientMatrix[6] = tangentLat[2];
        orientMatrix[8] = localX;
        orientMatrix[9] = localY;
        orientMatrix[10] = localZ;

        const withOrientation = mat4.create();
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

        const modelLoc = gl.getUniformLocation(shaderProgram, "uModelMatrix");
        const colorLoc = gl.getUniformLocation(shaderProgram, "uColor");
        const lightPosLoc = gl.getUniformLocation(
          shaderProgram,
          "uLightPosition"
        );
        const emissiveLoc = gl.getUniformLocation(shaderProgram, "uEmissive");
        const checkShadowLoc = gl.getUniformLocation(
          shaderProgram,
          "uCheckShadow"
        );

        gl.uniformMatrix4fv(modelLoc, false, withOrientation);
        gl.uniform3fv(colorLoc, spot.color);
        gl.uniform3fv(lightPosLoc, [0, 0, 0]);
        gl.uniform1i(emissiveLoc, false);
        gl.uniform1i(checkShadowLoc, false);

        gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.position);
        const positionLoc = gl.getAttribLocation(shaderProgram, "aPosition");
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.normal);
        const normalLoc = gl.getAttribLocation(shaderProgram, "aNormal");
        gl.enableVertexAttribArray(normalLoc);
        gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);

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

          const moonScreenPos = project3DTo2D(
            moonX,
            moonY + moon.radius + 0.5,
            moonZ,
            viewMatrix,
            projectionMatrix,
            canvas
          );
          const moonLabel = document.getElementById(
            `label-moon-${index}-${moonIndex}`
          );
          if (moonScreenPos.visible && showMoonLabels) {
            moonLabel.style.display = "block";
            moonLabel.style.left = moonScreenPos.x + "px";
            moonLabel.style.top = moonScreenPos.y + "px";
          } else {
            moonLabel.style.display = "none";
          }

          const moonTexture = textures[moon.name] || null;

          // Calculate tidal locking rotation - same face always toward planet
          // The rotation angle should match the orbital angle so the moon "shows"
          // the same face to its planet (like Earth's Moon)
          const tidalLockRotation = moonAngle + Math.PI / 2; // Add 90° to align texture properly

          renderSphere(
            gl,
            shaderProgram,
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
        });
      }

      // Render rings
      if (planet.hasRings && planet.rings) {
        const ringTexture =
          planet.name === "Saturn" ? textures.saturnRing : null;
        planet.rings.forEach((ring) => {
          renderRing(
            gl,
            shaderProgram,
            ring,
            [x, y, z],
            planet.axialTilt,
            rotationAngle,
            ringTexture
          );
        });
      }
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

      const particleProjectionLoc = gl.getUniformLocation(
        particleShaderProgram,
        "uProjectionMatrix"
      );
      const particleViewLoc = gl.getUniformLocation(
        particleShaderProgram,
        "uViewMatrix"
      );
      gl.uniformMatrix4fv(particleProjectionLoc, false, projectionMatrix);
      gl.uniformMatrix4fv(particleViewLoc, false, viewMatrix);

      // Create buffers for particle data
      const positions = [];
      const sizes = [];
      const alphas = [];

      cmeParticles.forEach((p) => {
        positions.push(p.x, p.y, p.z);
        sizes.push(p.size);
        alphas.push(p.life);
      });

      const posBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.DYNAMIC_DRAW
      );
      const posLoc = gl.getAttribLocation(particleShaderProgram, "aPosition");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

      const sizeBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
      const sizeLoc = gl.getAttribLocation(particleShaderProgram, "aSize");
      gl.enableVertexAttribArray(sizeLoc);
      gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);

      const alphaBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(alphas), gl.DYNAMIC_DRAW);
      const alphaLoc = gl.getAttribLocation(particleShaderProgram, "aAlpha");
      gl.enableVertexAttribArray(alphaLoc);
      gl.vertexAttribPointer(alphaLoc, 1, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, cmeParticles.length);

      // Cleanup
      gl.deleteBuffer(posBuffer);
      gl.deleteBuffer(sizeBuffer);
      gl.deleteBuffer(alphaBuffer);

      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    requestAnimationFrame(render);
  }

  render(0);
});
