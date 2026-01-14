// WebGL rendering functions
import { mat4 } from "./utils/math.js";
import { createRing } from "./geometry.js";

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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.texture, 0);
    gl.uniform1i(uniforms.useTexture, 1);
  } else {
    gl.uniform1i(uniforms.useTexture, 0);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ringBuffer.indices);
  gl.drawElements(gl.TRIANGLES, ringBuffer.indexCount, gl.UNSIGNED_SHORT, 0);
}

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
  gl.uniform1i(uniforms.emissive, object.emissive || false);
  gl.uniform1f(uniforms.time, time || 0);
  gl.uniform1i(uniforms.showTerminator, object.name === "Earth");

  if (moonPos && moonRadius) {
    gl.uniform3fv(uniforms.moonPos, moonPos);
    gl.uniform1f(uniforms.moonRadius, moonRadius);
    gl.uniform1i(uniforms.checkShadow, true);
  } else {
    gl.uniform1i(uniforms.checkShadow, false);
  }

  // Planet shadow on moon (lunar eclipse)
  if (planetPos && planetRadius) {
    gl.uniform3fv(uniforms.planetPos, planetPos);
    gl.uniform1f(uniforms.planetRadius, planetRadius);
    gl.uniform1i(uniforms.checkPlanetShadow, true);
  } else {
    gl.uniform1i(uniforms.checkPlanetShadow, false);
  }

  // Texture support
  if (texture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.texture, 0);
    gl.uniform1i(uniforms.useTexture, true);
  } else {
    gl.uniform1i(uniforms.useTexture, false);
  }

  // Cloud texture support (for Earth)
  if (cloudTexture && object.name === "Earth") {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cloudTexture);
    gl.uniform1i(uniforms.cloudTexture, 1);
    gl.uniform1i(uniforms.useClouds, 1);
    gl.uniform1f(uniforms.cloudRotation, cloudRotation || 0.0);
  } else {
    gl.uniform1i(uniforms.useClouds, 0);
    gl.uniform1f(uniforms.cloudRotation, 0.0);
  }

  // Specular map support (for Earth)
  if (specularTexture && object.name === "Earth") {
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, specularTexture);
    gl.uniform1i(uniforms.specularMap, 2);
    gl.uniform1i(uniforms.useSpecular, 1);
  } else {
    gl.uniform1i(uniforms.useSpecular, 0);
  }

  // Normal map support (for Earth)
  if (normalTexture && object.name === "Earth") {
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, normalTexture);
    gl.uniform1i(uniforms.normalMap, 3);
    gl.uniform1i(uniforms.useNormal, 1);
  } else {
    gl.uniform1i(uniforms.useNormal, 0);
  }

  // Night map support (for Earth)
  if (nightTexture && object.name === "Earth") {
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, nightTexture);
    gl.uniform1i(uniforms.nightMap, 4);
    gl.uniform1i(uniforms.useNight, 1);
  } else {
    gl.uniform1i(uniforms.useNight, 0);
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
