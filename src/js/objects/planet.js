class Planet {
    constructor(name, radius, distanceFromSun, color) {
        this.name = name;
        this.radius = radius;
        this.distanceFromSun = distanceFromSun;
        this.color = color;
        this.angle = 0;
        this.orbitSpeed = 0.01; // Adjust this value for different speeds
    }

    updatePosition() {
        this.angle += this.orbitSpeed;
        this.x = this.distanceFromSun * Math.cos(this.angle);
        this.z = this.distanceFromSun * Math.sin(this.angle);
    }

    render(gl) {
        // Implement rendering logic using WebGL
        // Set color and draw the planet based on its radius and position
    }
}