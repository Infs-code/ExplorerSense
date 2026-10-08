import test from "node:test";
import assert from "node:assert/strict";
import { fitAttitude, rotateVector } from "../src/calibration/attitude.js";
import { angularSeparationDeg, raDecToVector } from "../src/astronomy/vectors.js";
test("attitude fit recovers a 90 degree rotation from multiple directions", () => {
    const q = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
    const camera = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 2, 3]].map((v) => {
        const length = Math.hypot(...v);
        return v.map((value) => value / length);
    });
    const rotate = (vector) => rotateVector(q, vector);
    const points = camera.map((direction, index) => ({ camera: direction, telescope: rotate(direction), label: `${index}`, createdAt: "now" }));
    const fit = fitAttitude(points);
    points.forEach((point) => assert.ok(angularSeparationDeg(rotateVector(fit.quaternion, point.camera), point.telescope) < 1e-5));
});
test("attitude fit rejects a bad direction as an outlier", () => {
    const camera = [[0, 0], [90, 0], [180, 0], [270, 0], [0, 55], [180, -50]].map(([ra, dec]) => raDecToVector(ra, dec));
    const points = camera.map((direction, index) => ({ camera: direction, telescope: direction, label: `${index}`, createdAt: `${index}` }));
    points.push({ camera: raDecToVector(130, 25), telescope: raDecToVector(260, -20), label: "bad", createdAt: "bad" });
    const fit = fitAttitude(points, 0.1);
    assert.ok(fit.retained.length < points.length);
    assert.ok(fit.rmsDeg < 0.2);
});
