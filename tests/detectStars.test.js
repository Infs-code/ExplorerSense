import test from "node:test";
import assert from "node:assert/strict";
import { detectStars } from "../src/camera/detectStars.js";
function frame(width, height) {
    const image = { width, height, data: new Uint8ClampedArray(width * height * 4) };
    for (let i = 0; i < image.data.length; i += 4) {
        image.data[i] = 12;
        image.data[i + 1] = 12;
        image.data[i + 2] = 12;
        image.data[i + 3] = 255;
    }
    for (let y = 30; y <= 32; y += 1)
        for (let x = 27; x <= 29; x += 1) {
            const i = (y * width + x) * 4;
            image.data[i] = 120;
            image.data[i + 1] = 120;
            image.data[i + 2] = 120;
        }
    return image;
}
test("real-frame star detector detects a compact source and returns its centroid", () => {
    const result = detectStars(frame(80, 64));
    assert.equal(result.stars.length, 1);
    assert.ok(Math.abs(result.stars[0].x - 28) < 1e-5);
    assert.ok(Math.abs(result.stars[0].y - 31) < 1e-5);
});
