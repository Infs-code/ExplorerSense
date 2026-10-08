import test from "node:test";
import assert from "node:assert/strict";
import * as Astronomy from "astronomy-engine";
import { bodyPosition, horizontalFromJ2000, precessJ2000ToDate } from "../src/astronomy/coordinates.js";
import { observingConditions } from "../src/astronomy/conditions.js";
import { approximateTrueFieldDeg, exitPupilMm, magnification } from "../src/astronomy/optics.js";
import { targets } from "../src/catalog/targets.js";
const observer = { latitudeDeg: 35.2, longitudeDeg: -111.7, elevationMeters: 2000 };
const epoch2000 = new Date("2000-01-01T12:00:00.000Z");
const testDate = new Date("2026-10-07T03:00:00.000Z");
test("precession is the identity at J2000", () => {
    const result = precessJ2000ToDate({ raDeg: 123.4, decDeg: -12.3 }, epoch2000);
    assert.ok(Math.abs(result.raDeg - 123.4) < 1e-8);
    assert.ok(Math.abs(result.decDeg + 12.3) < 1e-8);
});
test("fixed-target horizontal coordinates are finite", () => {
    const result = horizontalFromJ2000({ raDeg: 10.684708, decDeg: 41.269167 }, observer, testDate);
    assert.ok(Number.isFinite(result.azimuthDeg));
    assert.ok(result.azimuthDeg >= 0 && result.azimuthDeg < 360);
    assert.ok(result.altitudeDeg >= -90 && result.altitudeDeg <= 90);
});
test("Solar System positions use current ephemerides", () => {
    for (const body of [Astronomy.Body.Sun, Astronomy.Body.Moon, Astronomy.Body.Jupiter]) {
        const position = bodyPosition(body, observer, testDate);
        assert.ok(Number.isFinite(position.equatorial.raDeg));
        assert.ok(Number.isFinite(position.equatorial.decDeg));
        assert.ok(Number.isFinite(position.j2000.raDeg));
        assert.ok(Number.isFinite(position.j2000.decDeg));
        assert.ok(Number.isFinite(position.horizontal.altitudeDeg));
    }
});
test("target visibility combines target, Sun and Moon positions", () => {
    const result = observingConditions(targets.find((target) => target.id === "M31"), observer, testDate);
    assert.ok(Number.isFinite(result.targetAltitudeDeg));
    assert.ok(Number.isFinite(result.sunAltitudeDeg));
    assert.ok(Number.isFinite(result.moonSeparationDeg));
    assert.ok(result.moonSeparationDeg >= 0 && result.moonSeparationDeg <= 180);
    assert.ok(result.moonIlluminationPercent >= 0 && result.moonIlluminationPercent <= 100);
    assert.ok(result.moonPhaseAngleDeg >= 0 && result.moonPhaseAngleDeg < 360);
    assert.ok(result.targetRise === null || Number.isFinite(result.targetRise.getTime()));
    assert.ok(result.targetSet === null || Number.isFinite(result.targetSet.getTime()));
    assert.ok(result.targetTransit === null || Number.isFinite(result.targetTransit.getTime()));
    assert.ok(result.civilDawn === null || Number.isFinite(result.civilDawn.getTime()));
    assert.ok(["Below horizon", "Low altitude", "Astronomical twilight", "Astronomical night"].includes(result.status));
});
test("magnification is derived only from valid entered optics", () => {
    assert.equal(magnification(750, 25), 30);
    assert.equal(magnification(null, 25), null);
    assert.equal(magnification(750, 0), null);
    assert.equal(approximateTrueFieldDeg(60, 30), 2);
    assert.equal(approximateTrueFieldDeg(null, 30), null);
    assert.equal(exitPupilMm(150, 30), 5);
    assert.equal(exitPupilMm(150, null), null);
});
