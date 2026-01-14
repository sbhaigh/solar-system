# Solar System WebGL

A realistic WebGL simulation of the solar system featuring all 8 planets with accurate orbital mechanics, axial tilts, moons, rings, asteroid belt, Kuiper belt, and advanced visual effects including animated sun spots, coronal mass ejections, and Earth's night lights.

## Features

### Celestial Bodies

- **8 Planets**: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
- **13 Moons**: Including Earth's Moon (with orbital tilt and tidal locking), Mars' Phobos & Deimos, Jupiter's 4 Galilean moons, and Saturn's 7 major moons
- **Dynamic Sun**: Procedurally generated sun spots with clustering behavior and coronal mass ejections (CMEs)

### Orbital Mechanics

- **Elliptical orbits** with eccentricity and varying orbital speeds
- **Orbital inclinations** relative to the ecliptic plane
- **Axial tilts** (e.g., Uranus' extreme 97.77° tilt)
- **Moon orbital planes** aligned to planetary equators (e.g., Saturn's rings and moons share 26.73° tilt)
- **Tidal locking** - moons keep same face toward their planet

### Advanced Visual Effects

#### Earth Features

- **Multi-layer texturing**: Base surface, animated clouds, specular water reflections, normal mapping for terrain detail
- **Night map**: City lights visible on dark side with smooth day/night transition
- **Animated cloud layer**: Rotates faster than Earth (1.2x speed) with semi-transparent blending
- **Specular highlights**: Ocean and ice reflections using Phong model
- **Normal mapping**: Terrain surface detail creating realistic lighting without additional geometry

#### Sun Features

- **Procedural sun spots**: Small, dark spots that appear/disappear in clusters, rotating with sun's surface
- **Coronal Mass Ejections**: Particle-based plasma bursts with additive blending, spawning randomly every 5-13 seconds

#### Shadow & Lighting

- **Lunar eclipses**: Earth casts shadow on Moon with umbra (full shadow) and penumbra (partial shadow)
- **Day/night terminator**: Smooth twilight transition on Earth
- **Moon shadows**: Realistic shadow casting from moons onto planets

### Planetary Features

- **Jupiter's Great Red Spot**: Surface-mapped storm feature
- **Saturn's ring system**: C, B, and A rings with proper tilt and transparency
- **Particle Systems**: Asteroid belt and Kuiper belt with orbital motion

### Interactive Controls

- **Mouse controls**: Rotate, pan, and zoom camera
- **Focus tracking**: Lock camera onto any planet with smooth transitions
- **Time controls**: Adjustable time scale for orbital animation
- **Responsive design**: Automatically adjusts to window resize

## Project Structure

```
solar-system/
├── index.html          # Main HTML document with UI controls
├── css/
│   └── styles.css      # Application styles
├── js/
│   ├── config.js       # Solar system configuration (planets, moons, belts)
│   ├── main.js         # Application entry point, render loop, and particle systems
│   ├── camera.js       # Camera class with controls and smooth transitions
│   ├── renderer.js     # Rendering functions (spheres, rings, orbits)
│   ├── geometry.js     # WebGL geometry creation (spheres, rings, paths)
│   └── utils/
│       ├── math.js     # Matrix mathematics (mat4 library)
│       ├── shaders.js  # WebGL shader programs with advanced lighting
│       └── textures.js # Texture loading and management
├── textures/           # Planet, moon, and Earth layer textures
└── README.md
```

## Setup Instructions

1. Clone the repository to your local machine
2. Navigate to the project directory: `cd solar-system`
3. Start a local web server (required for ES6 modules):

   ```bash
   # Using Node.js
   npx http-server -p 8000

   # Or using Python
   python3 -m http.server 8000
   ```

4. Open your browser to `http://localhost:8000`

**Note**: ES6 modules require a web server - you cannot open `index.html` directly using the `file://` protocol.

## Usage

### Camera Controls

- **Left-click + drag**: Rotate camera around focus point
- **Right-click + drag**: Pan camera position
- **Mouse wheel**: Zoom in/out
- **Sliders**: Fine-tune camera angle, height, and zoom
- **Planet selector**: Choose a planet to smoothly transition camera focus

### View Controls

- **Focus Select**: Choose a planet to focus the camera on (with smooth animated transitions)
- **Show Orbits**: Toggle orbital path visibility
- **Show Moon Labels**: Toggle moon name labels
- **Time Scale**: Adjust simulation speed (0.01 to 30 seconds per Earth day)

### Navigation Tips

- Focus on Earth to see clouds, city lights, ocean reflections, and terrain detail
- Zoom in on the Sun to observe animated sun spots and watch for CME eruptions
- Focus on outer planets (Jupiter, Saturn) to see their moon systems
- Watch Saturn's moons orbit in the same plane as its rings
- Observe the Moon pass through Earth's shadow during orbital alignment (lunar eclipse)
- Zoom in on Jupiter to see the Great Red Spot
- Explore the asteroid belt between Mars and Jupiter
- Discover the distant Kuiper belt beyond Neptune

## Technical Details

This project uses **ES6 modules** for clean code organization:

### Core Modules

- **js/config.js**: Complete solar system data including orbital parameters, physical properties, and visual features
- **js/main.js**: WebGL initialization, buffer creation, animation loop, particle systems (CMEs), and camera transitions
- **js/camera.js**: Camera state management, user input handling, and smooth focus transitions
- **js/renderer.js**: Specialized rendering functions for spheres, rings, orbits, and particles
- **js/geometry.js**: Procedural geometry generation (spheres with 32×32 tessellation, rings, orbital paths)

### Utilities

- **js/utils/math.js**: 4×4 matrix operations for 3D transformations
- **js/utils/shaders.js**: GLSL vertex and fragment shaders with:
  - Procedural noise for sun spots
  - Multi-texture support (base, clouds, specular, normal, night)
  - Shadow ray tracing for lunar eclipses
  - Particle billboard rendering
- **js/utils/textures.js**: Texture loading with power-of-2 detection and mipmap generation

### Advanced Rendering Features

#### Shader Techniques

- **Multi-texture blending**: Up to 5 texture units per object (Earth uses all)
- **Procedural noise**: Hash-based 2D noise for sun spot generation
- **Normal mapping**: Simplified tangent-space perturbation for terrain detail
- **Phong lighting**: Specular highlights with configurable shininess
- **Shadow ray tracing**: Umbra/penumbra calculation for lunar eclipses
- **Additive blending**: Particle rendering for bright CME plasma effects

#### Texture System

- **Earth textures**:
  - Base: 2k surface map
  - Clouds: Semi-transparent animated layer
  - Specular: Ocean/ice reflectivity map
  - Normal: Terrain detail heightmap
  - Night: City lights for dark side
- **Texture wrapping**: Seamless spot rendering across UV boundaries
- **Dynamic loading**: Placeholder pixels while textures load asynchronously

#### Particle Systems

- **CME particles**: Position, velocity, life, size, and alpha per particle
- **Dynamic buffers**: Recreated each frame for particle updates
- **Billboard rendering**: gl.POINTS with size attenuation based on distance
- **Spawning**: Burst emission from random sun surface points

### Performance Optimizations

- **Geometry reuse**: Single sphere buffer for all spherical objects
- **Efficient updates**: Only active particles consume resources
- **Viewport synchronization**: Automatic resize handling without stretching
- **Shader conditionals**: Features only active when needed (Earth-specific effects)

Built with **pure JavaScript and WebGL** - no frameworks, no dependencies, just modern web standards.

## Credits

### Textures

Planetary textures provided by [Solar System Scope](https://www.solarsystemscope.com/textures/) and are licensed under [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

**Attribution**: Solar System Scope (https://www.solarsystemscope.com/textures/)

### Code

Application code by Steve Haigh, licensed under the MIT License.

## License

This project contains:

- **Application code**: MIT License (see [LICENSE](LICENSE) file)
- **Texture files**: CC BY 4.0 License (see credits above)
