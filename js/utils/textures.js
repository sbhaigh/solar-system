// Texture loading utilities

export function loadTexture(gl, url, onProgress) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Put a single pixel in the texture while it loads
  const pixel = new Uint8Array([128, 128, 128, 255]);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixel
  );

  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Check if the image is a power of 2
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    if (onProgress) onProgress();
  };

  image.onerror = function () {
    console.warn(`Failed to load texture: ${url}`);
    if (onProgress) onProgress(); // Count as loaded even if failed
  };

  image.src = url;
  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

export function loadTextures(gl, config) {
  const textures = {};

  // Count actual textures that will be loaded
  let totalTextures = 6; // sun, saturnRing, earthClouds, earthSpecular, earthNormal, earthNight

  config.planets.forEach((planet) => {
    if (planet.texture) totalTextures++;
    if (planet.moons) {
      planet.moons.forEach((moon) => {
        if (moon.texture) totalTextures++;
      });
    }
  });

  // Create loading indicator
  const loadingDiv = document.createElement("div");
  loadingDiv.id = "texture-loading";
  loadingDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: #fff;
    padding: 30px 50px;
    border-radius: 12px;
    font-family: Arial, sans-serif;
    text-align: center;
    z-index: 10000;
  `;
  loadingDiv.innerHTML = `
    <h3 style="margin: 0 0 15px 0; color: #4a9eff;">Loading Solar System</h3>
    <div style="font-size: 14px; color: #ccc;">Preparing textures...</div>
    <div style="margin-top: 15px; font-size: 24px; color: #4a9eff;">0%</div>
  `;
  document.body.appendChild(loadingDiv);

  let loadedCount = 0;

  function updateProgress() {
    loadedCount++;
    const percent = Math.min(
      100,
      Math.round((loadedCount / totalTextures) * 100)
    );
    const percentDiv = loadingDiv.querySelector("div:last-child");
    if (percentDiv) {
      percentDiv.textContent = `${percent}%`;
    }
    if (loadedCount >= totalTextures) {
      setTimeout(() => {
        loadingDiv.style.opacity = "0";
        loadingDiv.style.transition = "opacity 0.5s";
        setTimeout(() => loadingDiv.remove(), 500);
      }, 300);
    }
  }

  // Load sun texture
  if (config.sun.texture) {
    textures.sun = loadTexture(gl, config.sun.texture, updateProgress);
  }

  // Load Saturn ring texture
  textures.saturnRing = loadTexture(
    gl,
    "textures/2k_saturn_ring_alpha.png",
    updateProgress
  );

  // Load Earth clouds texture
  textures.earthClouds = loadTexture(
    gl,
    "textures/earth_clouds_2k.jpg",
    updateProgress
  );

  // Load Earth specular map
  textures.earthSpecular = loadTexture(
    gl,
    "textures/2k_earth_specular_map.tif",
    updateProgress
  );

  // Load Earth normal map
  textures.earthNormal = loadTexture(
    gl,
    "textures/2k_earth_normal_map.tif",
    updateProgress
  );

  // Load Earth night map
  textures.earthNight = loadTexture(
    gl,
    "textures/2k_earth_nightmap-2.jpg",
    updateProgress
  );

  config.planets.forEach((planet) => {
    if (planet.texture) {
      textures[planet.name] = loadTexture(gl, planet.texture, updateProgress);
    }
    if (planet.moons) {
      planet.moons.forEach((moon) => {
        if (moon.texture) {
          textures[moon.name] = loadTexture(gl, moon.texture, updateProgress);
        }
      });
    }
  });

  return textures;
}
