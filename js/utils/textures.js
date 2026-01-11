// Texture loading utilities

export function loadTexture(gl, url) {
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
  };

  image.onerror = function () {
    console.warn(`Failed to load texture: ${url}`);
  };

  image.src = url;
  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

export function loadTextures(gl, config) {
  const textures = {};

  // Load sun texture
  if (config.sun.texture) {
    textures.sun = loadTexture(gl, config.sun.texture);
  }

  // Load Saturn ring texture
  textures.saturnRing = loadTexture(gl, "textures/2k_saturn_ring_alpha.png");

  // Load Earth clouds texture
  textures.earthClouds = loadTexture(gl, "textures/earth_clouds_2k.jpg");
  console.log(
    "Loading Earth clouds texture from: textures/earth_clouds_2k.jpg"
  );

  // Load Earth specular map
  textures.earthSpecular = loadTexture(
    gl,
    "textures/2k_earth_specular_map.tif"
  );

  // Load Earth normal map
  textures.earthNormal = loadTexture(gl, "textures/2k_earth_normal_map.tif");

  // Load Earth night map
  textures.earthNight = loadTexture(gl, "textures/2k_earth_nightmap-2.jpg");

  config.planets.forEach((planet) => {
    if (planet.texture) {
      textures[planet.name] = loadTexture(gl, planet.texture);
    }
    if (planet.moons) {
      planet.moons.forEach((moon) => {
        if (moon.texture) {
          textures[moon.name] = loadTexture(gl, moon.texture);
        }
      });
    }
  });

  return textures;
}
