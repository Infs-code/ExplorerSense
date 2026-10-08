import { raDecToVector, vectorToRaDec } from "../astronomy/vectors.js";
export function pixelToSky(solution, x, y) {
    const scale = solution.pixelScaleArcsec / 3600;
    const angle = (solution.orientationDeg * Math.PI) / 180;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dx = x - (solution.imageWidth - 1) / 2;
    const dy = y - (solution.imageHeight - 1) / 2;
    let xiDeg;
    let etaDeg;
    if (solution.parity < 0) {
        xiDeg = scale * (-c * dx + s * dy);
        etaDeg = scale * (s * dx + c * dy);
    }
    else {
        xiDeg = scale * (c * dx + s * dy);
        etaDeg = scale * (-s * dx + c * dy);
    }
    const xi = (xiDeg * Math.PI) / 180;
    const eta = (etaDeg * Math.PI) / 180;
    const centerRa = (solution.raDeg * Math.PI) / 180;
    const centerDec = (solution.decDeg * Math.PI) / 180;
    const denominator = Math.cos(centerDec) - eta * Math.sin(centerDec);
    const ra = centerRa + Math.atan2(xi, denominator);
    const dec = Math.atan2(Math.sin(centerDec) + eta * Math.cos(centerDec), Math.hypot(denominator, xi));
    return raDecToVector((ra * 180) / Math.PI, (dec * 180) / Math.PI);
}
export function skyToPixel(solution, direction) {
    const { raDeg, decDeg } = vectorToRaDec(direction);
    const ra = (raDeg * Math.PI) / 180;
    const dec = (decDeg * Math.PI) / 180;
    const ra0 = (solution.raDeg * Math.PI) / 180;
    const dec0 = (solution.decDeg * Math.PI) / 180;
    const deltaRa = Math.atan2(Math.sin(ra - ra0), Math.cos(ra - ra0));
    const denominator = Math.sin(dec) * Math.sin(dec0) + Math.cos(dec) * Math.cos(dec0) * Math.cos(deltaRa);
    if (denominator <= 0)
        return { x: Number.NaN, y: Number.NaN };
    const xi = (Math.cos(dec) * Math.sin(deltaRa) / denominator) * 180 / Math.PI;
    const eta = ((Math.sin(dec) * Math.cos(dec0) - Math.cos(dec) * Math.sin(dec0) * Math.cos(deltaRa)) / denominator) * 180 / Math.PI;
    const scale = solution.pixelScaleArcsec / 3600;
    const angle = (solution.orientationDeg * Math.PI) / 180;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let dx;
    let dy;
    if (solution.parity < 0) {
        dx = (-c * xi + s * eta) / scale;
        dy = (s * xi + c * eta) / scale;
    }
    else {
        dx = (c * xi - s * eta) / scale;
        dy = (s * xi + c * eta) / scale;
    }
    return { x: dx + (solution.imageWidth - 1) / 2, y: dy + (solution.imageHeight - 1) / 2 };
}
