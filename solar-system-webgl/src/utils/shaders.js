// Shader utilities and sources

export const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
        vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
        vPosition = worldPosition.xyz;
        vNormal = mat3(uModelMatrix) * aNormal;
        gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    }
`;

export const fragmentShaderSource = `
    precision mediump float;
    uniform vec3 uColor;
    uniform vec3 uLightPosition;
    uniform bool uEmissive;
    uniform vec3 uMoonPosition;
    uniform float uMoonRadius;
    uniform bool uCheckShadow;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
        if (uEmissive) {
            gl_FragColor = vec4(uColor, 1.0);
        } else {
            vec3 normal = normalize(vNormal);
            vec3 lightDir = normalize(uLightPosition - vPosition);
            float diff = max(dot(normal, lightDir), 0.0);
            
            float shadow = 1.0;
            if (uCheckShadow && diff > 0.1) {
                vec3 toLight = uLightPosition - vPosition;
                float distToLight = length(toLight);
                vec3 toLightDir = toLight / distToLight;
                
                vec3 toMoon = uMoonPosition - vPosition;
                float t = dot(toMoon, toLightDir);
                
                if (t > 0.0 && t < distToLight) {
                    vec3 closestPoint = vPosition + toLightDir * t;
                    float distToMoonCenter = length(closestPoint - uMoonPosition);
                    
                    if (distToMoonCenter < uMoonRadius) {
                        shadow = 0.2;
                    }
                }
            }
            
            float ambient = 0.1;
            float lighting = max(diff * shadow, ambient);
            vec3 color = uColor * lighting;
            gl_FragColor = vec4(color, 1.0);
        }
    }
`;

export const pointVertexShaderSource = `
    attribute vec3 aPosition;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform float uPointSize;
    void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
        gl_PointSize = uPointSize;
    }
`;

export const pointFragmentShaderSource = `
    precision mediump float;
    uniform vec3 uColor;
    void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        if (length(coord) > 0.5) discard;
        gl_FragColor = vec4(uColor, 1.0);
    }
`;

export function createShaderProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
