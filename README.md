# Solar System WebGL

This project is a simple WebGL application that simulates the solar system. It features animated planets orbiting around the sun, with the ability to change camera angles and zoom in and out on various objects.

## Project Structure

```
solar-system-webgl
├── src
│   ├── index.html          # Main HTML document
│   ├── styles
│   │   └── main.css       # Styles for the project
│   ├── js
│   │   ├── main.js        # Entry point for JavaScript
│   │   ├── renderer.js    # Handles rendering of the solar system
│   │   ├── camera.js      # Manages camera position and angle
│   │   ├── objects
│   │   │   ├── planet.js  # Represents a planet
│   │   │   └── sun.js     # Represents the sun
│   │   └── utils
│   │       ├── shaders.js  # Functions to load and compile shaders
│   │       └── math.js     # Utility functions for math operations
│   └── shaders
│       ├── vertex.glsl    # Vertex shader code
│       └── fragment.glsl   # Fragment shader code
├── config
│   └── solar-system.json   # Configuration file for the solar system
└── README.md               # Project documentation
```

## Setup Instructions

1. Clone the repository to your local machine.
2. Open the `index.html` file in a web browser to view the solar system simulation.
3. Modify the `solar-system.json` configuration file to adjust parameters such as planet scale, camera position, and animation settings.

## Usage

- Use the mouse to change the camera angle and zoom in/out on the planets.
- The planets will animate in their orbits around the sun based on the parameters defined in the configuration file.

## Details

This project is built using plain HTML, CSS, and JavaScript with WebGL for rendering. It does not rely on any frameworks like React or D3.js, making it lightweight and easy to understand. The configuration is managed through a JSON file, allowing for easy adjustments to the simulation parameters.