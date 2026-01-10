class Sun {
    constructor(gl) {
        this.gl = gl;
        this.radius = 1; // Scale radius for the sun
        this.color = [1.0, 1.0, 0.0]; // Yellow color
        this.position = [0, 0, 0]; // Position at the center of the solar system
        this.vertexBuffer = this.initBuffers();
    }

    initBuffers() {
        const vertices = this.createSphereVertices(this.radius);
        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        return vertexBuffer;
    }

    createSphereVertices(radius) {
        const latitudeBands = 30;
        const longitudeBands = 30;
        const vertices = [];

        for (let latNumber = 0; latNumber <= latitudeBands; latNumber++) {
            const theta = latNumber * Math.PI / latitudeBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let longNumber = 0; longNumber <= longitudeBands; longNumber++) {
                const phi = longNumber * 2 * Math.PI / longitudeBands;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;

                vertices.push(radius * x);
                vertices.push(radius * y);
                vertices.push(radius * z);
            }
        }
        return vertices;
    }

    render(shaderProgram) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        const position = this.gl.getAttribLocation(shaderProgram, 'aPosition');
        this.gl.vertexAttribPointer(position, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(position);

        this.gl.uniform3fv(this.gl.getUniformLocation(shaderProgram, 'uColor'), this.color);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.vertexBuffer.numItems);
    }
}

export default Sun;