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

  // Create and setup camera
  const camera = new Camera();
  camera.setupControls(canvas);

  // Create labels
  const labelsContainer = document.getElementById("labels-container");
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
    const option = document.createElement("option");
    option.value = index;
    option.textContent = planet.name;
    document.getElementById("focus-select").appendChild(option);

    // Create labels for moons
    if (planet.moons) {
      planet.moons.forEach((moon, moonIndex) => {
        const moonLabel = document.createElement("div");
        moonLabel.className = "planet-label";
        moonLabel.id = `label-moon-${index}-${moonIndex}`;
        moonLabel.textContent = moon.name;
        labelsContainer.appendChild(moonLabel);
      });
    }
  });

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
    progress: 0,
    duration: 1.5, // seconds
  };

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
      // Calculate appropriate zoom based on object size
      let targetRadius;
      if (closestPlanet === -1) {
        // Sun
        targetRadius = config.sun.radius;
      } else {
        // Planet
        targetRadius = config.planets[closestPlanet].radius;
      }

      // Set zoom to make the object nicely visible (about 1/4 of screen height)
      const targetZoom = targetRadius * 8;
      const clampedZoom = Math.max(10, Math.min(3000, targetZoom));

      // Start smooth transition
      cameraTransition.active = true;
      cameraTransition.startZoom = camera.zoom;
      cameraTransition.targetZoom = clampedZoom;
      cameraTransition.startFocus = camera.focusTarget;
      cameraTransition.targetFocus = closestPlanet;
      cameraTransition.progress = 0;
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
      }

      // Smooth easing function (ease-in-out)
      const t = cameraTransition.progress;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      // Interpolate zoom
      camera.zoom =
        cameraTransition.startZoom +
        (cameraTransition.targetZoom - cameraTransition.startZoom) * eased;
      document.getElementById("zoom").value = camera.zoom;

      // Switch focus halfway through transition
      if (
        cameraTransition.progress >= 0.5 &&
        camera.focusTarget !== cameraTransition.targetFocus
      ) {
        camera.focusTarget = cameraTransition.targetFocus;
        document.getElementById("focus-select").value = camera.focusTarget;
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

    if (camera.focusTarget >= 0 && camera.focusTarget < config.planets.length) {
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
      0 // No cloud rotation
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
        if (moon.orbitalTilt) {
          const tiltRad = (moon.orbitalTilt * Math.PI) / 180;
          const baseX = moon.orbitRadius * Math.cos(moonAngle);
          const baseY =
            moon.orbitRadius * Math.sin(moonAngle) * Math.sin(tiltRad);
          const baseZ =
            moon.orbitRadius * Math.sin(moonAngle) * Math.cos(tiltRad);
          moonX = x + baseX;
          moonY = y + baseY;
          moonZ = z + baseZ;
        } else {
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
      const cloudRotation = planet.name === "Earth" 
        ? (accumulatedTime * planet.rotationSpeed * 1.2) / (Math.PI * 2)
        : 0;
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
        cloudRotation
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
        const showMoonLabels = distToPlanet < 100;

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
            const tiltRad = (planet.axialTilt * Math.PI) / 180;
            const cosTilt = Math.cos(tiltRad);
            const sinTilt = Math.sin(tiltRad);

            // Calculate position in equatorial plane
            const localX = moon.orbitRadius * Math.cos(moonAngle);
            const localY = 0;
            const localZ = moon.orbitRadius * Math.sin(moonAngle);

            // Apply axial tilt rotation
            moonX = x + localX;
            moonY = y + localY * cosTilt - localZ * sinTilt;
            moonZ = z + localY * sinTilt + localZ * cosTilt;
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
          renderSphere(
            gl,
            shaderProgram,
            sphereBuffers,
            moon,
            [moonX, moonY, moonZ],
            null,
            null,
            undefined,
            undefined,
            moonTexture,
            null, // No clouds for moons
            0 // No cloud rotation
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

    requestAnimationFrame(render);
  }

  render(0);
});
