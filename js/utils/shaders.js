// Shader utilities and sources

export const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vTexCoord;
    void main() {
        vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
        vPosition = worldPosition.xyz;
        vNormal = mat3(uModelMatrix) * aNormal;
        vTexCoord = aTexCoord;
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
    uniform bool uUseTexture;
    uniform sampler2D uTexture;
    uniform bool uShowTerminator;
    uniform bool uUseClouds;
    uniform sampler2D uCloudTexture;
    uniform float uCloudRotation;
    uniform bool uUseSpecular;
    uniform sampler2D uSpecularMap;
    uniform bool uUseNormal;
    uniform sampler2D uNormalMap;
    uniform bool uUseNight;
    uniform sampler2D uNightMap;
    uniform float uTime;
    uniform vec3 uPlanetPosition;
    uniform float uPlanetRadius;
    uniform bool uCheckPlanetShadow;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vTexCoord;
    
    // Simple 2D noise function for sun spots
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    void main() {
        vec3 baseColor = uColor;
        if (uUseTexture) {
            baseColor = texture2D(uTexture, vTexCoord).rgb;
        }
        
        // Add sun spots for emissive objects (sun)
        if (uEmissive) {
            // Spots stay fixed to rotating sun surface
            vec2 spotCoord = vTexCoord;
            
            // Low frequency noise for clustering regions
            float clusterNoise = noise(spotCoord * 8.0 + uTime * 0.03);
            
            // Only create spots in cluster regions
            if (clusterNoise > 0.55) {
                // Very high frequency for small, sharp spots within clusters
                float n = noise(spotCoord * 100.0);
                n += 0.3 * noise(spotCoord * 200.0);
                n /= 1.3;
                
                // Add slow temporal variation to make spots appear and disappear
                float timeFactor = noise(vec2(spotCoord.x * 10.0 + uTime * 0.05, spotCoord.y * 10.0));
                float threshold = 0.88 + timeFactor * 0.1; // Higher threshold for fewer spots
                
                // Create rare, small, very dark spots
                if (n > threshold) {
                    float spotDarkness = smoothstep(threshold, threshold + 0.05, n);
                    baseColor *= (1.0 - spotDarkness * 0.92); // Almost black
                }
            }
        }
        
        // Blend in night map on dark side
        vec3 nightColor = baseColor;
        if (uUseNight) {
            nightColor = texture2D(uNightMap, vTexCoord).rgb;
        }
        
        if (uEmissive) {
            gl_FragColor = vec4(baseColor, 1.0);
        } else {
            vec3 normal = normalize(vNormal);
            
            // Apply normal map if enabled
            if (uUseNormal) {
                // Sample normal map and convert from [0,1] to [-1,1]
                vec3 normalMap = texture2D(uNormalMap, vTexCoord).rgb * 2.0 - 1.0;
                // For simplicity, just perturb the normal in tangent space
                // This is a simplified normal mapping (proper implementation would use TBN matrix)
                normal = normalize(normal + normalMap * 0.3);
            }
            
            vec3 lightDir = normalize(uLightPosition - vPosition);
            float diff = max(dot(normal, lightDir), 0.0);
            
            // Day/night terminator effect
            float terminator = 1.0;
            if (uShowTerminator) {
                // Sharp transition at day/night boundary
                float threshold = 0.02;
                if (diff < threshold) {
                    // Night side - significantly darker
                    terminator = 0.05;
                } else if (diff < threshold + 0.05) {
                    // Twilight zone - smooth transition
                    float t = (diff - threshold) / 0.05;
                    terminator = mix(0.05, 1.0, t);
                }
            }
            
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
            
            // Check if moon is in planet's shadow (lunar eclipse)
            if (uCheckPlanetShadow) {
                vec3 toLight = uLightPosition - vPosition;
                float distToLight = length(toLight);
                vec3 toLightDir = toLight / distToLight;
                
                vec3 toPlanet = uPlanetPosition - vPosition;
                float t = dot(toPlanet, toLightDir);
                
                if (t > 0.0 && t < distToLight) {
                    vec3 closestPoint = vPosition + toLightDir * t;
                    float distToPlanetCenter = length(closestPoint - uPlanetPosition);
                    
                    // Umbra (full shadow)
                    if (distToPlanetCenter < uPlanetRadius) {
                        shadow = min(shadow, 0.1);
                    }
                    // Penumbra (partial shadow)
                    else if (distToPlanetCenter < uPlanetRadius * 1.5) {
                        float penumbra = (distToPlanetCenter - uPlanetRadius) / (uPlanetRadius * 0.5);
                        shadow = min(shadow, mix(0.1, 1.0, penumbra));
                    }
                }
            }
            
            float ambient = 0.1;
            float lighting = max(diff * shadow * terminator, ambient * terminator);
            
            // Blend between day and night textures based on lighting
            vec3 dayColor = baseColor * lighting;
            vec3 color = dayColor;
            if (uUseNight) {
                // Smooth transition from night to day
                float nightBlend = 1.0 - smoothstep(-0.1, 0.3, diff);
                color = mix(dayColor, nightColor, nightBlend * (1.0 - terminator * 0.5));
            }
            
            // Add specular highlights if enabled
            if (uUseSpecular) {
                float specularIntensity = texture2D(uSpecularMap, vTexCoord).r;
                vec3 viewDir = normalize(-vPosition); // Camera at origin
                vec3 reflectDir = reflect(-lightDir, normal);
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
                vec3 specular = vec3(1.0) * spec * specularIntensity * diff;
                color += specular * shadow * terminator;
            }
            
            // Blend cloud layer if enabled
            if (uUseClouds) {
                // Apply cloud rotation to UV coordinates
                vec2 cloudUV = vec2(vTexCoord.x + uCloudRotation, vTexCoord.y);
                // Wrap UV coordinates
                cloudUV.x = fract(cloudUV.x);
                vec4 cloudColor = texture2D(uCloudTexture, cloudUV);
                // Use cloud texture's grayscale as alpha (white = opaque clouds, black = transparent)
                float cloudAlpha = (cloudColor.r + cloudColor.g + cloudColor.b) / 3.0;
                // Apply lighting to clouds
                vec3 litClouds = cloudColor.rgb * lighting;
                // Blend clouds over surface
                color = mix(color, litClouds, cloudAlpha * 0.7);
            }
            
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

// CME Particle shaders
export const particleVertexShaderSource = `
    attribute vec3 aPosition;
    attribute float aSize;
    attribute float aAlpha;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying float vAlpha;
    void main() {
        vAlpha = aAlpha;
        vec4 viewPosition = uViewMatrix * vec4(aPosition, 1.0);
        gl_Position = uProjectionMatrix * viewPosition;
        gl_PointSize = aSize / -viewPosition.z * 500.0; // Scale with distance
    }
`;

export const particleFragmentShaderSource = `
    precision mediump float;
    varying float vAlpha;
    void main() {
        // Circular particle with soft edges
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        float alpha = (1.0 - dist * 2.0) * vAlpha;
        // Bright orange/yellow glow for plasma
        gl_FragColor = vec4(1.0, 0.6, 0.2, alpha);
    }
`;

/**
 * Compiles and links a WebGL shader program from vertex and fragment source
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {string} vertexSource - GLSL vertex shader source code
 * @param {string} fragmentSource - GLSL fragment shader source code
 * @returns {WebGLProgram|null} Compiled shader program or null on error
 */
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
