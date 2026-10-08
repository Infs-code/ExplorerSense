import test from "node:test";
import assert from "node:assert/strict";
import { pointingGuidance } from "../src/pointing/guidance.js";
import { raDecToVector } from "../src/astronomy/vectors.js";
test("guidance computes a local eastward sky-plane correction", () => {
    const result = pointingGuidance(raDecToVector(120, 20), raDecToVector(121, 20), [1, 0, 0, 0]);
    assert.ok(result.eastErrorDeg > 0.9 && result.eastErrorDeg < 1.1);
    assert.ok(Math.abs(result.northErrorDeg) < 0.005);
    assert.ok(result.residualDeg > 0.9 && !result.centered);
    assert.ok(Math.abs(Math.hypot(result.eastErrorDeg, result.northErrorDeg) - result.residualDeg) < 1e-10);
});
test("antipodal pointing reports an ambiguous direction instead of inventing one", () => {
    const result = pointingGuidance(raDecToVector(0, 0), raDecToVector(180, 0), [1, 0, 0, 0]);
    assert.equal(result.directionAmbiguous, true);
    assert.ok(Math.abs(result.residualDeg - 180) < 1e-10);
});
