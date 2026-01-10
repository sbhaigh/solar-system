const canvas = document.getElementById('solar-system-canvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    console.error('WebGL not supported, falling back on experimental-webgl');
    gl = canvas.getContext('experimental-webgl');
}

const renderer = new Renderer(gl);
const camera = new Camera();

function animate() {
    requestAnimationFrame(animate);
    camera.updatePosition();
    renderer.render(camera);
}

function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.init();
    animate();
}

window.onload = init;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.resize();
});