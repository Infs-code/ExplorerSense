import test from "node:test";
import assert from "node:assert/strict";
import { pixelToSky, skyToPixel } from "../src/plateSolver/wcs.js";
import { angularSeparationDeg, raDecToVector } from "../src/astronomy/vectors.js";
const solution = {
    raDeg: 359.8,
    decDeg: 22.4,
    pixelScaleArcsec: 30,
    orientationDeg: 37,
    parity: -1,
    imageWidth: 1280,
    imageHeight: 720,
    jobId: 1,
    solvedAt: "2026-10-07T00:00:00.000Z",
};
test("TAN WCS maps the reference pixel to the solved center", () => {
    const center = pixelToSky(solution, (solution.imageWidth - 1) / 2, (solution.imageHeight - 1) / 2);
    assert.ok(angularSeparationDeg(center, raDecToVector(solution.raDeg, solution.decDeg)) < 1e-6);
});
test("TAN WCS pixel and sky transforms invert within floating-point tolerance", () => {
    const original = { x: 841.2, y: 245.7 };
    const recovered = skyToPixel(solution, pixelToSky(solution, original.x, original.y));
    assert.ok(Math.abs(recovered.x - original.x) < 1e-6);
    assert.ok(Math.abs(recovered.y - original.y) < 1e-6);
});
