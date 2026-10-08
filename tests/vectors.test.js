import test from "node:test";
import assert from "node:assert/strict";
import { angularSeparationDeg, raDecToVector, vectorToRaDec } from "../src/astronomy/vectors.js";
test("spherical vector math round trips coordinates through a unit vector", () => {
    const result = vectorToRaDec(raDecToVector(359.8, -32.25));
    assert.ok(Math.abs(result.raDeg - 359.8) < 1e-8);
    assert.ok(Math.abs(result.decDeg + 32.25) < 1e-8);
});
test("spherical vector math handles right ascension wraparound", () => {
    assert.ok(Math.abs(angularSeparationDeg(raDecToVector(359.9, 0), raDecToVector(0.1, 0)) - 0.2) < 1e-5);
});
test("spherical vector math measures a right angle", () => {
    assert.ok(Math.abs(angularSeparationDeg(raDecToVector(0, 0), raDecToVector(90, 0)) - 90) < 1e-8);
});
test("spherical separation preserves very small measured offsets", () => {
    const separation = angularSeparationDeg(raDecToVector(120, 20), raDecToVector(120.000001, 20));
    assert.ok(separation > 0.0000009 && separation < 0.000001);
});
