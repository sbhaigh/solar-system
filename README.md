# Solar System WebGL

A realistic WebGL simulation of the solar system featuring all 8 planets with accurate orbital mechanics, axial tilts, moons, rings, asteroid belt, Kuiper belt, and planetary features like Jupiter's Great Red Spot.

## Features

- **8 Planets**: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
- **13 Moons**: Including Earth's Moon (with orbital tilt), Mars' Phobos & Deimos, Jupiter's 4 Galilean moons, and Saturn's 7 major moons
- **Orbital Mechanics**: Elliptical orbits with eccentricity, orbital inclinations, and varying orbital speeds
- **Planetary Features**:
  - Axial tilts (e.g., Uranus' extreme 97.77° tilt)
  - Rotation speeds and directions
  - Jupiter's Great Red Spot (surface-mapped)
  - Saturn's ring system (C, B, and A rings)
- **Particle Systems**: Asteroid belt and Kuiper belt with orbital motion
- **Interactive Camera**: Mouse controls for rotation, pan, and zoom
- **Focus Tracking**: Lock camera onto any planet
- **Time Controls**: Adjustable time scale for orbital animation

## Project Structure

```
solar-system-webgl/
├── src/
│   ├── index.html          # Main HTML document with UI controls
│   ├── config.js           # Solar system configuration (planets, moons, belts)
│   ├── main.js             # Application entry point and render loop
│   ├── camera.js           # Camera class with controls
│   ├── renderer.js         # Rendering functions (spheres, rings, orbits)
│   ├── geometry.js         # WebGL geometry creation (spheres, rings, paths)
│   └── utils/
│       ├── math.js         # Matrix mathematics (mat4 library)
│       └── shaders.js      # WebGL shader programs
└── README.md
```

## Setup Instructions

1. Clone the repository to your local machine.
2. Navigate to `solar-system-webgl/src/`
3. Open `index.html` in a modern web browser that supports WebGL
4. No build process or dependencies required - just open and run!

## Usage

### Camera Controls

- **Left-click + drag**: Rotate camera around focus point
- **Right-click + drag**: Pan camera position
- **Mouse wheel**: Zoom in/out
- **Sliders**: Fine-tune camera angle, height, and zoom

### View Controls

- **Focus Select**: Choose a planet to focus the camera on
- **Show Orbits**: Toggle orbital path visibility
- **Time Scale**: Adjust simulation speed (0.01 to 10 seconds per Earth day)

### Navigation Tips

- Focus on outer planets (Jupiter, Saturn) to see their moon systems
- Zoom in on Jupiter to see the Great Red Spot
- Observe Saturn's rings with proper axial tilt
- Watch the asteroid belt between Mars and Jupiter
- Explore the distant Kuiper belt beyond Neptune

## Technical Details

This project uses **ES6 modules** for clean code organization:

- **config.js**: Complete solar system data including orbital parameters, physical properties, and visual features
- **main.js**: WebGL initialization, buffer creation, animation loop, and planetary feature rendering (Great Red Spot)
- **camera.js**: Camera state management and user input handling
- **renderer.js**: Specialized rendering functions for different object types
- **geometry.js**: Procedural geometry generation (spheres with 32×32 tessellation, rings, orbital paths)
- **utils/math.js**: 4×4 matrix operations for 3D transformations
- **utils/shaders.js**: GLSL vertex and fragment shaders with lighting and shadow support

### Rendering Features

- **Phong-style lighting**: Directional lighting from the sun
- **Moon shadows**: Earth casts shadow from its moon
- **Surface mapping**: Great Red Spot properly oriented on Jupiter's surface using tangent vectors
- **Ring rendering**: Saturn's rings with proper tilt and transparency
- **Particle systems**: Dynamic asteroid and Kuiper belt objects

Built with **pure JavaScript and WebGL** - no frameworks, no dependencies, just modern web standards.
