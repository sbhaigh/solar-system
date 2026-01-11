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
    uniform vec3 uPlanetPosition;
    uniform float uPlanetRadius;
    uniform bool uCheckPlanetShadow;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vTexCoord;
    void main() {
        vec3 baseColor = uColor;
        if (uUseTexture) {
            baseColor = texture2D(uTexture, vTexCoord).rgb;
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
