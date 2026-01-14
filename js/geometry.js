// WebGL geometry creation functions

/**
 * Creates WebGL buffers for a UV sphere geometry
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {number} radius - Sphere radius
 * @param {number} latitudeBands - Number of horizontal divisions
 * @param {number} longitudeBands - Number of vertical divisions
 * @returns {{position: WebGLBuffer, normal: WebGLBuffer, texCoord: WebGLBuffer, indices: WebGLBuffer, indexCount: number}}
 */
export function createSphere(gl, radius, latitudeBands, longitudeBands) {
  const positions = [],
    normals = [],
    texCoords = [],
    indices = [];

  for (let lat = 0; lat <= latitudeBands; lat++) {
    const theta = (lat * Math.PI) / latitudeBands;
    const sinTheta = Math.sin(theta),
      cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longitudeBands; lon++) {
      const phi = (lon * 2 * Math.PI) / longitudeBands;
      const sinPhi = Math.sin(phi),
        cosPhi = Math.cos(phi);
      const x = cosPhi * sinTheta,
        y = cosTheta,
        z = sinPhi * sinTheta;

      positions.push(radius * x, radius * y, radius * z);
      normals.push(x, y, z);
      texCoords.push(1.0 - lon / longitudeBands, lat / latitudeBands);
    }
  }

  for (let lat = 0; lat < latitudeBands; lat++) {
    for (let lon = 0; lon < longitudeBands; lon++) {
      const first = lat * (longitudeBands + 1) + lon;
      const second = first + longitudeBands + 1;
      indices.push(first, second, first + 1, second, second + 1, first + 1);
    }
  }

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  return {
    position: positionBuffer,
    normal: normalBuffer,
    texCoord: texCoordBuffer,
    indices: indexBuffer,
    indexCount: indices.length,
  };
}

/**
 * Creates WebGL buffers for a flat ring geometry (e.g., Saturn's rings)
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {number} innerRadius - Inner radius as fraction of outer radius (0-1)
 * @param {number} outerRadius - Outer radius (typically 1.0, scaled by model matrix)
 * @param {number} segments - Number of radial segments
 * @returns {{position: WebGLBuffer, normal: WebGLBuffer, texCoord: WebGLBuffer, indices: WebGLBuffer, indexCount: number}}
 */
export function createRing(gl, innerRadius, outerRadius, segments) {
  const positions = [],
    normals = [],
    texCoords = [],
    indices = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);

    positions.push(innerRadius * cos, 0, innerRadius * sin);
    normals.push(0, 1, 0);
    texCoords.push(0, 0.5); // Inner edge at texture coordinate 0

    positions.push(outerRadius * cos, 0, outerRadius * sin);
    normals.push(0, 1, 0);
    texCoords.push(1, 0.5); // Outer edge at texture coordinate 1
  }

  for (let i = 0; i < segments; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 1, base + 3, base + 2);
  }

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  return {
    position: positionBuffer,
    normal: normalBuffer,
    texCoord: texCoordBuffer,
    indices: indexBuffer,
    indexCount: indices.length,
  };
}

/**
 * Creates WebGL buffer for an elliptical orbit path with inclination
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {number} radius - Semi-major axis length
 * @param {number} segments - Number of line segments
 * @param {number} eccentricity - Orbital eccentricity (0 = circular)
 * @param {number} inclination - Orbital plane tilt in degrees
 * @returns {{position: WebGLBuffer, vertexCount: number}}
 */
export function createOrbitPath(
  gl,
  radius,
  segments,
  eccentricity,
  inclination
) {
  const positions = [];
  const e = eccentricity || 0;
  const a = radius;
  const incRad = ((inclination || 0) * Math.PI) / 180;
  const sinInc = Math.sin(incRad);
  const cosInc = Math.cos(incRad);

  for (let i = 0; i <= segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    let x, y, z;

    if (e > 0) {
      const r = (a * (1 - e * e)) / (1 + e * Math.cos(angle));
      x = r * Math.cos(angle);
      const zFlat = r * Math.sin(angle);
      y = -zFlat * sinInc;
      z = zFlat * cosInc;
    } else {
      x = radius * Math.cos(angle);
      const zFlat = radius * Math.sin(angle);
      y = -zFlat * sinInc;
      z = zFlat * cosInc;
    }
    positions.push(x, y, z);
  }

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    vertexCount: positions.length / 3,
  };
}

/**
 * Creates a simple billboard quad for instanced rendering (asteroid/Kuiper belts)
 * Each instance will be positioned via instance matrices
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {number} size - Billboard size
 * @returns {{position: WebGLBuffer, texCoord: WebGLBuffer, indices: WebGLBuffer, indexCount: number}}
 */
export function createBillboard(gl, size) {
  const halfSize = size / 2;
  const positions = [
    -halfSize,
    -halfSize,
    0,
    halfSize,
    -halfSize,
    0,
    halfSize,
    halfSize,
    0,
    -halfSize,
    halfSize,
    0,
  ];

  const texCoords = [0, 0, 1, 0, 1, 1, 0, 1];

  const indices = [0, 1, 2, 0, 2, 3];

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  return {
    position: positionBuffer,
    texCoord: texCoordBuffer,
    indices: indexBuffer,
    indexCount: indices.length,
  };
}
