# Solar System WebGL - AI Coding Instructions

## Architecture Overview

This is a **pure vanilla JavaScript WebGL application** with no build system or framework dependencies. All code uses ES6 modules loaded directly by the browser.

### Module Structure

- **[js/config.js](../js/config.js)**: Central configuration defining all celestial bodies (planets, moons, belts) with orbital parameters, textures, physical properties
- **[js/main.js](../js/main.js)**: Application entry point, render loop, particle systems (CME, asteroids, Kuiper belt)
- **[js/camera.js](../js/camera.js)**: Camera class with mouse controls, focus transitions, UI event bindings
- **[js/renderer.js](../js/renderer.js)**: WebGL rendering functions for spheres, rings, orbit paths, 2D projection
- **[js/geometry.js](../js/geometry.js)**: WebGL buffer creation for spheres, rings, and elliptical orbit paths
- **[js/utils/shaders.js](../js/utils/shaders.js)**: All GLSL shader programs (vertex/fragment for celestial bodies, particles, points)
- **[js/utils/textures.js](../js/utils/textures.js)**: Texture loading with power-of-2 scaling for WebGL compatibility
- **[js/utils/math.js](../js/utils/math.js)**: Matrix math library (mat4 operations, cross/dot products)

### Key Data Flow

1. **Initialization** ([main.js](../js/main.js)): Load textures → create shader programs → generate geometry buffers → setup particle systems
2. **Render Loop**: Update time → calculate orbital positions → render celestial bodies → update particles → render UI labels
3. **Orbital Calculations**: Elliptical orbits use eccentricity + inclination, moons orbit planetary equators (tilted relative to ecliptic)

## Critical Implementation Patterns

### Texture System

Earth uses **multi-layer texturing** with 5 separate maps:
- Base surface (`earth_2k.jpg`)
- Cloud layer (`earth_clouds_2k.jpg`) - rotates 1.2x faster than surface
- Specular map (`earth_spec_2k.jpg`) - defines ocean/ice reflectivity
- Normal map (`earth_normal_2k.jpg`) - adds terrain detail
- Night lights (`earth_night_2k.jpg`) - city lights on dark side

When modifying Earth rendering in [renderer.js](../js/renderer.js) `renderSphere()`, all 5 texture units must be managed.

### Shader Convention

Fragment shaders in [utils/shaders.js](../js/utils/shaders.js) use **uniform flags** to enable features per-object:
- `uEmissive` - self-illuminated (sun)
- `uUseTexture` - apply texture vs solid color
- `uCheckShadow` - moon shadow calculations (lunar eclipses)
- `uUseClouds`, `uUseSpecular`, `uUseNormal`, `uUseNight` - Earth-specific layers

Always check which uniforms are set in [renderer.js](../js/renderer.js) when debugging visual issues.

### Particle Systems

Two distinct systems in [main.js](../js/main.js):
1. **Static Belts** (asteroids, Kuiper): Generated once at init, stored in buffers, rendered as GL_POINTS
2. **Dynamic CMEs**: Array of particle objects, updated each frame, spawned randomly every 5-13 seconds from sun surface

CME particles use **additive blending** (`gl.blendFunc(gl.SRC_ALPHA, gl.ONE)`) for plasma glow effect.

### Coordinate Systems

- **Orbital plane**: XZ plane (Y=0), orbits rotate in XZ
- **Inclination**: Rotation around X-axis to tilt orbital plane
- **Axial tilt**: Rotation of planet/moon's spin axis (e.g., Uranus 97.77°)
- **Moon orbits**: Aligned to parent planet's equator, NOT ecliptic plane

When adding celestial bodies, apply transformations in this order: orbital position → inclination → axial tilt.

## Development Workflow

### Running Locally

**Must use a web server** (ES6 modules require HTTP protocol, not `file://`):
```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx http-server -p 8000
```

Then navigate to `http://localhost:8000`

### No Build Process

- Direct file editing - refresh browser to see changes
- No transpilation, bundling, or npm scripts
- Keep ES6 module imports/exports intact
- Texture files must be in [textures/](../textures/) directory

### Debugging

- Use browser DevTools console for WebGL errors
- Check `gl.getError()` after GL calls when debugging rendering issues
- Shader compilation errors appear in console with line numbers
- Performance: Monitor frame rate with `requestAnimationFrame` timestamp deltas in [main.js](../js/main.js) `render()` function

## Embedding System

Separate embed mode via [embed.html](../embed.html) + [js/embed-init.js](../js/embed-init.js):
- URL parameters control visibility (`?controls=hidden&focus=2&zoom=50`)
- See [EMBEDDING.md](../EMBEDDING.md) for complete parameter documentation
- Embed initialization sets camera state before loading [main.js](../js/main.js)

When modifying camera behavior, test both standalone ([index.html](../index.html)) and embed ([embed.html](../embed.html)) modes.

## WebGL Compatibility Notes

- Textures auto-scaled to power-of-2 dimensions in [utils/textures.js](../js/utils/textures.js)
- Uses WebGL 1.0 (not WebGL2) for broader browser support
- All shaders use `precision mediump float` for mobile compatibility
- Maximum texture units: 8 (Earth uses 5, leaves 3 for other objects)

## Common Tasks

**Add a new planet/moon**: Edit [config.js](../js/config.js) planets array, add texture to [textures/](../textures/), no other changes needed (system auto-generates buffers)

**Modify orbital mechanics**: Edit `orbitSpeed`, `eccentricity`, `inclination` in [config.js](../js/config.js) planet objects

**Add shader effects**: Modify fragment shader in [utils/shaders.js](../js/utils/shaders.js), add uniforms, then set them in [renderer.js](../js/renderer.js) `renderSphere()`

**Change camera behavior**: Modify [camera.js](../js/camera.js) `setupControls()` for mouse/UI, `update()` for smooth transitions
