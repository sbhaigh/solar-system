class Renderer {
    constructor(gl) {
        this.gl = gl;
        this.objects = [];
    }

    addObject(object) {
        this.objects.push(object);
    }

    render(camera) {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.enable(this.gl.DEPTH_TEST);

        this.objects.forEach(object => {
            object.draw(this.gl, camera);
        });
    }

    update() {
        this.objects.forEach(object => {
            object.updatePosition();
        });
    }
}