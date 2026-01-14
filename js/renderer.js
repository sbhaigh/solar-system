import { mat4 } from "./utils/math.js";
import { createRing } from "./geometry.js";

// Fix #1 & #2: WebGL state cache to avoid redundant state changes
const glStateCache = {
  boundTextures: new Map(), // Track texture bindings per unit
  lastEmissive: null,
  lastUseTexture: null,
  lastUseClouds: null,
  lastUseSpecular: null,
  lastUseNormal: null,
  lastUseNight: null,
  lastCheckShadow: null,
  lastCheckPlanetShadow: null,
};

/**
 * Binds a texture only if it's not already bound to the specified unit
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {number} unit - Texture unit (0-7)
 * @param {WebGLTexture} texture - Texture to bind
 */
function bindTextureOptimized(gl, unit, texture) {
  const cached = glStateCache.boundTextures.get(unit);
  if (cached !== texture) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    glStateCache.boundTextures.set(unit, texture);
  }
}

/**
 * Sets a uniform only if the value has changed
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {WebGLUniformLocation} location - Uniform location
 * @param {number} value - Boolean value (0 or 1)
 * @param {string} cacheName - Cache key name
 */
function setUniform1iCached(gl, location, value, cacheName) {
  if (glStateCache[cacheName] !== value) {
    gl.uniform1i(location, value);
    glStateCache[cacheName] = value;
  }
}

/**
 * Projects a 3D world position to 2D screen coordinates
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @param {number} z - World Z coordinate
 * @param {Float32Array} viewMatrix - Camera view matrix
 * @param {Float32Array} projectionMatrix - Projection matrix
 * @param {HTMLCanvasElement} canvas - WebGL canvas element
 * @returns {{x: number, y: number, z: number, visible: boolean}} Screen position and visibility
 */
export function project3DTo2D(x, y, z, viewMatrix, projectionMatrix, canvas) {
  const worldPos = [x, y, z, 1];
  const viewPos = [0, 0, 0, 0];
  const clipPos = [0, 0, 0, 0];

  for (let i = 0; i < 4; i++) {
    viewPos[i] = 0;
    for (let j = 0; j < 4; j++) {
      viewPos[i] += viewMatrix[i + j * 4] * worldPos[j];
    }
  }

  for (let i = 0; i < 4; i++) {
    clipPos[i] = 0;
    for (let j = 0; j < 4; j++) {
      clipPos[i] += projectionMatrix[i + j * 4] * viewPos[j];
    }
  }

  const ndcX = clipPos[0] / clipPos[3];
  const ndcY = clipPos[1] / clipPos[3];
  const ndcZ = clipPos[2] / clipPos[3];

  const screenX = (ndcX + 1) * 0.5 * canvas.width;
  const screenY = (1 - ndcY) * 0.5 * canvas.height;

  return {
    x: screenX,
    y: screenY,
    z: ndcZ,
    visible: ndcZ > -1 && ndcZ < 1,
  };
}

/**
 * Renders an orbital path as a line loop
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {WebGLProgram} shaderProgram - Active shader program
 * @param {Object} uniforms - Cached uniform locations
 * @param {Object} orbitBuffer - Orbit path vertex buffer
 */
export function renderOrbitPath(gl, shaderProgram, uniforms, orbitBuffer) {
  const modelMatrix = mat4.create();

  gl.uniformMatrix4fv(uniforms.model, false, modelMatrix);
  gl.uniform3fv(uniforms.color, [0.5, 0.5, 0.5]);
  gl.uniform1i(uniforms.emissive, true);

  // Disable vertex attributes that orbit paths don't use
  const normalLoc = gl.getAttribLocation(shaderProgram, "aNormal");
  const texCoordLoc = gl.getAttribLocation(shaderProgram, "aTexCoord");
  if (normalLoc !== -1) {
    gl.disableVertexAttribArray(normalLoc);
  }
  if (texCoordLoc !== -1) {
    gl.disableVertexAttribArray(texCoordLoc);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, orbitBuffer.position);
  const positionLoc = gl.getAttribLocation(shaderProgram, "aPosition");
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.LINE_LOOP, 0, orbitBuffer.vertexCount);
}

/**
 * Renders a planetary ring system (e.g., Saturn's rings)
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {WebGLProgram} shaderProgram - Active shader program
 * @param {Object} uniforms - Cached uniform locations
 * @param {Object} attribs - Cached attribute locations
 * @param {Object} ring - Ring configuration (inner/outer radius, color)
 * @param {number[]} position - Planet position [x, y, z]
 * @param {number} axialTilt - Planet's axial tilt in degrees
 * @param {number} rotationAngle - Current rotation angle in radians
 * @param {WebGLTexture} texture - Optional ring texture
 * @param {Object} ringBuffer - Pre-created ring geometry buffers
 */
export function renderRing(
  gl,
  shaderProgram,
  uniforms,
  attribs,
  ring,
  position,
  axialTilt,
  rotationAngle,
  texture,
  ringBuffer
) {
  const modelMatrix = mat4.create();
  modelMatrix[12] = position[0];
  modelMatrix[13] = position[1];
  modelMatrix[14] = position[2];

  const scale = ring.outer;
  const innerRatio = ring.inner / ring.outer;

  if (axialTilt) {
    // Rings must align with planet's equatorial plane
    // Use same tilt transformation as planet with same rotation
    const tiltRad = (axialTilt * Math.PI) / 180;
    const cosTilt = Math.cos(tiltRad);
    const sinTilt = Math.sin(tiltRad);
    const cosRot = Math.cos(rotationAngle);
    const sinRot = Math.sin(rotationAngle);

    // Apply same transformation matrix as planet (from renderSphere)
    modelMatrix[0] = scale * cosRot;
    modelMatrix[1] = 0;
    modelMatrix[2] = scale * sinRot;
    modelMatrix[4] = sinRot * sinTilt;
    modelMatrix[5] = cosTilt;
    modelMatrix[6] = -cosRot * sinTilt;
    modelMatrix[8] = -sinRot * cosTilt * scale;
    modelMatrix[9] = sinTilt * scale;
    modelMatrix[10] = cosRot * cosTilt * scale;
  } else {
    modelMatrix[0] = scale;
    modelMatrix[5] = 1;
    modelMatrix[10] = scale;
  }

  gl.uniformMatrix4fv(uniforms.model, false, modelMatrix);
  gl.uniform3fv(uniforms.color, ring.color);
  gl.uniform3fv(uniforms.lightPos, [0, 0, 0]);
  gl.uniform1i(uniforms.emissive, false);

  // Use pre-created ring buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffer.position);
  gl.enableVertexAttribArray(attribs.position);
  gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffer.normal);
  gl.enableVertexAttribArray(attribs.normal);
  gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);

  // Texture support
  if (attribs.texCoord !== -1) {
    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffer.texCoord);
    gl.enableVertexAttribArray(attribs.texCoord);
    gl.vertexAttribPointer(attribs.texCoord, 2, gl.FLOAT, false, 0, 0);
  }

  if (texture) {
    bindTextureOptimized(gl, 0, texture);
    gl.uniform1i(uniforms.texture, 0);
    setUniform1iCached(gl, uniforms.useTexture, 1, "lastUseTexture");
  } else {
    setUniform1iCached(gl, uniforms.useTexture, 0, "lastUseTexture");
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ringBuffer.indices);
  gl.drawElements(gl.TRIANGLES, ringBuffer.indexCount, gl.UNSIGNED_SHORT, 0);
}

/**
 * Renders a celestial body (sun, planet, or moon) as a textured sphere
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {WebGLProgram} shaderProgram - Active shader program
 * @param {Object} uniforms - Cached uniform locations
 * @param {Object} attribs - Cached attribute locations
 * @param {Object} sphereBuffers - Sphere geometry buffers (position, normal, texCoord, indices)
 * @param {Object} object - Celestial body configuration (radius, color, emissive, etc.)
 * @param {number[]} position - World position [x, y, z]
 * @param {number[]|null} moonPos - Moon position for shadow calculation (or null)
 * @param {number|null} moonRadius - Moon radius for shadow calculation (or null)
 * @param {number} axialTilt - Axial tilt in degrees
 * @param {number} rotationAngle - Current rotation angle in radians
 * @param {WebGLTexture|null} texture - Surface texture
 * @param {WebGLTexture|null} cloudTexture - Cloud layer texture (Earth only)
 * @param {number} cloudRotation - Cloud rotation offset (0-1)
 * @param {WebGLTexture|null} specularTexture - Specular/reflectivity map (Earth only)
 * @param {WebGLTexture|null} normalTexture - Normal map for terrain detail (Earth only)
 * @param {WebGLTexture|null} nightTexture - Night lights texture (Earth only)
 * @param {number[]|null} planetPos - Parent planet position for lunar eclipse (or null)
 * @param {number|null} planetRadius - Parent planet radius for lunar eclipse (or null)
 * @param {number} time - Current animation time for effects
 */
export function renderSphere(
  gl,
  shaderProgram,
  uniforms,
  attribs,
  sphereBuffers,
  object,
  position,
  moonPos,
  moonRadius,
  axialTilt,
  rotationAngle,
  texture,
  cloudTexture,
  cloudRotation,
  specularTexture,
  normalTexture,
  nightTexture,
  planetPos,
  planetRadius,
  time
) {
  const modelMatrix = mat4.create();
  mat4.translate(modelMatrix, modelMatrix, position);

  if (axialTilt !== undefined && rotationAngle !== undefined) {
    const tiltRad = (axialTilt * Math.PI) / 180;
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
          combined[i + j * 4] += modelMatrix[i + k * 4] * tempMatrix[k + j * 4];
        }
      }
    }
    for (let i = 0; i < 16; i++) modelMatrix[i] = combined[i];
  }

  mat4.scale(modelMatrix, modelMatrix, [
    object.radius,
    object.radius,
    object.radius,
  ]);

  gl.uniformMatrix4fv(uniforms.model, false, modelMatrix);
  gl.uniform3fv(uniforms.color, object.color);
  gl.uniform3fv(uniforms.lightPos, [0, 0, 0]);
  const emissive = object.emissive || false;
  setUniform1iCached(gl, uniforms.emissive, emissive ? 1 : 0, "lastEmissive");
  gl.uniform1f(uniforms.time, time || 0);
  gl.uniform1i(uniforms.showTerminator, object.name === "Earth");

  if (moonPos && moonRadius) {
    gl.uniform3fv(uniforms.moonPos, moonPos);
    gl.uniform1f(uniforms.moonRadius, moonRadius);
    setUniform1iCached(gl, uniforms.checkShadow, 1, "lastCheckShadow");
  } else {
    setUniform1iCached(gl, uniforms.checkShadow, 0, "lastCheckShadow");
  }

  // Planet shadow on moon (lunar eclipse)
  if (planetPos && planetRadius) {
    gl.uniform3fv(uniforms.planetPos, planetPos);
    gl.uniform1f(uniforms.planetRadius, planetRadius);
    setUniform1iCached(
      gl,
      uniforms.checkPlanetShadow,
      1,
      "lastCheckPlanetShadow"
    );
  } else {
    setUniform1iCached(
      gl,
      uniforms.checkPlanetShadow,
      0,
      "lastCheckPlanetShadow"
    );
  }

  // Texture support with optimized binding
  if (texture) {
    bindTextureOptimized(gl, 0, texture);
    gl.uniform1i(uniforms.texture, 0);
    setUniform1iCached(gl, uniforms.useTexture, 1, "lastUseTexture");
  } else {
    setUniform1iCached(gl, uniforms.useTexture, 0, "lastUseTexture");
  }

  // Cloud texture support (for Earth)
  if (cloudTexture && object.name === "Earth") {
    bindTextureOptimized(gl, 1, cloudTexture);
    gl.uniform1i(uniforms.cloudTexture, 1);
    setUniform1iCached(gl, uniforms.useClouds, 1, "lastUseClouds");
    gl.uniform1f(uniforms.cloudRotation, cloudRotation || 0.0);
  } else {
    setUniform1iCached(gl, uniforms.useClouds, 0, "lastUseClouds");
    gl.uniform1f(uniforms.cloudRotation, 0.0);
  }

  // Specular map support (for Earth)
  if (specularTexture && object.name === "Earth") {
    bindTextureOptimized(gl, 2, specularTexture);
    gl.uniform1i(uniforms.specularMap, 2);
    setUniform1iCached(gl, uniforms.useSpecular, 1, "lastUseSpecular");
  } else {
    setUniform1iCached(gl, uniforms.useSpecular, 0, "lastUseSpecular");
  }

  // Normal map support (for Earth)
  if (normalTexture && object.name === "Earth") {
    bindTextureOptimized(gl, 3, normalTexture);
    gl.uniform1i(uniforms.normalMap, 3);
    setUniform1iCached(gl, uniforms.useNormal, 1, "lastUseNormal");
  } else {
    setUniform1iCached(gl, uniforms.useNormal, 0, "lastUseNormal");
  }

  // Night map support (for Earth)
  if (nightTexture && object.name === "Earth") {
    bindTextureOptimized(gl, 4, nightTexture);
    gl.uniform1i(uniforms.nightMap, 4);
    setUniform1iCached(gl, uniforms.useNight, 1, "lastUseNight");
  } else {
    setUniform1iCached(gl, uniforms.useNight, 0, "lastUseNight");
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.position);
  gl.enableVertexAttribArray(attribs.position);
  gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.normal);
  gl.enableVertexAttribArray(attribs.normal);
  gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.texCoord);
  gl.enableVertexAttribArray(attribs.texCoord);
  gl.vertexAttribPointer(attribs.texCoord, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereBuffers.indices);
  gl.drawElements(gl.TRIANGLES, sphereBuffers.indexCount, gl.UNSIGNED_SHORT, 0);
}
