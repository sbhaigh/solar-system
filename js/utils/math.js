// Matrix and vector math utilities

export const mat4 = {
  create() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  },

  perspective(fov, aspect, near, far) {
    const f = 1.0 / Math.tan((fov * Math.PI) / 180 / 2);
    const rangeInv = 1 / (near - far);
    return new Float32Array([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (near + far) * rangeInv,
      -1,
      0,
      0,
      near * far * rangeInv * 2,
      0,
    ]);
  },

  lookAt(eye, center, up) {
    const z = normalize([
      eye[0] - center[0],
      eye[1] - center[1],
      eye[2] - center[2],
    ]);
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    return new Float32Array([
      x[0],
      y[0],
      z[0],
      0,
      x[1],
      y[1],
      z[1],
      0,
      x[2],
      y[2],
      z[2],
      0,
      -dot(x, eye),
      -dot(y, eye),
      -dot(z, eye),
      1,
    ]);
  },

  translate(out, a, v) {
    out[12] = a[0] * v[0] + a[4] * v[1] + a[8] * v[2] + a[12];
    out[13] = a[1] * v[0] + a[5] * v[1] + a[9] * v[2] + a[13];
    out[14] = a[2] * v[0] + a[6] * v[1] + a[10] * v[2] + a[14];
    out[15] = a[3] * v[0] + a[7] * v[1] + a[11] * v[2] + a[15];
    return out;
  },

  scale(out, a, v) {
    out[0] = a[0] * v[0];
    out[1] = a[1] * v[0];
    out[2] = a[2] * v[0];
    out[3] = a[3] * v[0];
    out[4] = a[4] * v[1];
    out[5] = a[5] * v[1];
    out[6] = a[6] * v[1];
    out[7] = a[7] * v[1];
    out[8] = a[8] * v[2];
    out[9] = a[9] * v[2];
    out[10] = a[10] * v[2];
    out[11] = a[11] * v[2];
    return out;
  },
};

export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function normalize(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}
