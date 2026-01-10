class Camera {
    constructor() {
        this.position = [0, 0, 5]; // Initial camera position
        this.angle = [0, 0]; // Initial camera angle (yaw, pitch)
    }

    updatePosition(x, y, z) {
        this.position = [x, y, z];
    }

    setAngle(yaw, pitch) {
        this.angle = [yaw, pitch];
    }

    getViewMatrix() {
        const [x, y, z] = this.position;
        const [yaw, pitch] = this.angle;

        // Simple view matrix calculation (not complete)
        const viewMatrix = mat4.create();
        mat4.rotateY(viewMatrix, viewMatrix, yaw);
        mat4.rotateX(viewMatrix, viewMatrix, pitch);
        mat4.translate(viewMatrix, viewMatrix, [-x, -y, -z]);

        return viewMatrix;
    }
}

export default Camera;