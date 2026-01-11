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

export function renderOrbitPath(gl, shaderProgram, orbitBuffer) {
  const modelMatrix = mat4.create();
  const modelLoc = gl.getUniformLocation(shaderProgram, "uModelMatrix");
  const colorLoc = gl.getUniformLocation(shaderProgram, "uColor");
  const emissiveLoc = gl.getUniformLocation(shaderProgram, "uEmissive");

  gl.uniformMatrix4fv(modelLoc, false, modelMatrix);
  gl.uniform3fv(colorLoc, [0.5, 0.5, 0.5]);
  gl.uniform1i(emissiveLoc, true);

  gl.bindBuffer(gl.ARRAY_BUFFER, orbitBuffer.position);
  const positionLoc = gl.getAttribLocation(shaderProgram, "aPosition");
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.LINE_LOOP, 0, orbitBuffer.vertexCount);
}

export function renderRing(
  gl,
  shaderProgram,
  ring,
  position,
  axialTilt,
  orbitalAngle,
  texture
) {
  const modelMatrix = mat4.create();
  modelMatrix[12] = position[0];
  modelMatrix[13] = position[1];
  modelMatrix[14] = position[2];

  const scale = ring.outer;
  const innerRatio = ring.inner / ring.outer;

  if (axialTilt) {
    const tiltRad = (axialTilt * Math.PI) / 180;
    const cosTilt = Math.cos(tiltRad);
    const sinTilt = Math.sin(tiltRad);
    const cosOrbit = Math.cos(orbitalAngle);
    const sinOrbit = Math.sin(orbitalAngle);

    modelMatrix[0] = scale * cosOrbit;
    modelMatrix[1] = 0;
    modelMatrix[2] = -scale * sinOrbit;
    modelMatrix[4] = sinOrbit * sinTilt;
    modelMatrix[5] = cosTilt;
    modelMatrix[6] = cosOrbit * sinTilt;
    modelMatrix[8] = sinOrbit * cosTilt * scale;
    modelMatrix[9] = -sinTilt * scale;
    modelMatrix[10] = cosOrbit * cosTilt * scale;
  } else {
    modelMatrix[0] = scale;
    modelMatrix[5] = 1;
    modelMatrix[10] = scale;
  }

  const modelLoc = gl.getUniformLocation(shaderProgram, "uModelMatrix");
  const colorLoc = gl.getUniformLocation(shaderProgram, "uColor");
  const lightPosLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
  const emissiveLoc = gl.getUniformLocation(shaderProgram, "uEmissive");

  gl.uniformMatrix4fv(modelLoc, false, modelMatrix);
  gl.uniform3fv(colorLoc, ring.color);
  gl.uniform3fv(lightPosLoc, [0, 0, 0]);
  gl.uniform1i(emissiveLoc, false);

  const ringBuffer = createRing(gl, innerRatio, 1.0, 64);
  gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffer.position);
  const positionLoc = gl.getAttribLocation(shaderProgram, "aPosition");
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffer.normal);
  const normalLoc = gl.getAttribLocation(shaderProgram, "aNormal");
  gl.enableVertexAttribArray(normalLoc);
  gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);

  // Texture support
  const texCoordLoc = gl.getAttribLocation(shaderProgram, "aTexCoord");
  if (texCoordLoc !== -1) {
    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffer.texCoord);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);
  }

  const useTextureLoc = gl.getUniformLocation(shaderProgram, "uUseTexture");
  const textureLoc = gl.getUniformLocation(shaderProgram, "uTexture");

  if (texture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureLoc, 0);
    gl.uniform1i(useTextureLoc, 1);
  } else {
    gl.uniform1i(useTextureLoc, 0);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ringBuffer.indices);
  gl.drawElements(gl.TRIANGLES, ringBuffer.indexCount, gl.UNSIGNED_SHORT, 0);
}

export function renderSphere(
  gl,
  shaderProgram,
  sphereBuffers,
  object,
  position,
  moonPos,
  moonRadius,
  axialTilt,
  rotationAngle,
  texture
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

  const modelLoc = gl.getUniformLocation(shaderProgram, "uModelMatrix");
  const colorLoc = gl.getUniformLocation(shaderProgram, "uColor");
  const lightPosLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
  const emissiveLoc = gl.getUniformLocation(shaderProgram, "uEmissive");
  const moonPosLoc = gl.getUniformLocation(shaderProgram, "uMoonPosition");
  const moonRadiusLoc = gl.getUniformLocation(shaderProgram, "uMoonRadius");
  const checkShadowLoc = gl.getUniformLocation(shaderProgram, "uCheckShadow");

  gl.uniformMatrix4fv(modelLoc, false, modelMatrix);
  gl.uniform3fv(colorLoc, object.color);
  gl.uniform3fv(lightPosLoc, [0, 0, 0]);
  gl.uniform1i(emissiveLoc, object.emissive || false);

  if (moonPos && moonRadius) {
    gl.uniform3fv(moonPosLoc, moonPos);
    gl.uniform1f(moonRadiusLoc, moonRadius);
    gl.uniform1i(checkShadowLoc, true);
  } else {
    gl.uniform1i(checkShadowLoc, false);
  }

  // Texture support
  const useTextureLoc = gl.getUniformLocation(shaderProgram, "uUseTexture");
  if (texture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(shaderProgram, "uTexture"), 0);
    gl.uniform1i(useTextureLoc, true);
  } else {
    gl.uniform1i(useTextureLoc, false);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.position);
  const positionLoc = gl.getAttribLocation(shaderProgram, "aPosition");
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.normal);
  const normalLoc = gl.getAttribLocation(shaderProgram, "aNormal");
  gl.enableVertexAttribArray(normalLoc);
  gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.texCoord);
  const texCoordLoc = gl.getAttribLocation(shaderProgram, "aTexCoord");
  gl.enableVertexAttribArray(texCoordLoc);
  gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereBuffers.indices);
  gl.drawElements(gl.TRIANGLES, sphereBuffers.indexCount, gl.UNSIGNED_SHORT, 0);
}
