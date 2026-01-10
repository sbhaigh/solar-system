export function normalize(vec) {
    const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
    return {
        x: vec.x / length,
        y: vec.y / length,
        z: vec.z / length
    };
}

export function add(vecA, vecB) {
    return {
        x: vecA.x + vecB.x,
        y: vecA.y + vecB.y,
        z: vecA.z + vecB.z
    };
}

export function subtract(vecA, vecB) {
    return {
        x: vecA.x - vecB.x,
        y: vecA.y - vecB.y,
        z: vecA.z - vecB.z
    };
}

export function scale(vec, scalar) {
    return {
        x: vec.x * scalar,
        y: vec.y * scalar,
        z: vec.z * scalar
    };
}

export function dot(vecA, vecB) {
    return vecA.x * vecB.x + vecA.y * vecB.y + vecA.z * vecB.z;
}

export function cross(vecA, vecB) {
    return {
        x: vecA.y * vecB.z - vecA.z * vecB.y,
        y: vecA.z * vecB.x - vecA.x * vecB.z,
        z: vecA.x * vecB.y - vecA.y * vecB.x
    };
}