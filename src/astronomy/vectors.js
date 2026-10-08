export function normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]);
    if (!Number.isFinite(length) || length === 0)
        throw new RangeError("Cannot normalize a zero or invalid vector.");
    return [v[0] / length, v[1] / length, v[2] / length];
}
export function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function raDecToVector(raDeg, decDeg) {
    const ra = (raDeg * Math.PI) / 180;
    const dec = (decDeg * Math.PI) / 180;
    return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}
export function vectorToRaDec(vector) {
    const [x, y, z] = normalize(vector);
    return {
        raDeg: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
        decDeg: (Math.asin(Math.max(-1, Math.min(1, z))) * 180) / Math.PI,
    };
}
export function angularSeparationDeg(a, b) {
    const first = normalize(a);
    const second = normalize(b);
    const cosine = Math.max(-1, Math.min(1, dot(first, second)));
    const sine = Math.hypot(...cross(first, second));
    return (Math.atan2(sine, cosine) * 180) / Math.PI;
}
export function applyRotation(matrix, vector) {
    return [
        matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
        matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
        matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
    ];
}
