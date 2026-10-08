import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseOpenNgcCsv } from "../src/catalog/openNgc.js";
import { searchTargets } from "../src/catalog/targets.js";
test("OpenNGC parser converts sexagesimal positions and keeps catalog metadata", () => {
    const csv = [
        "Name;Type;RA;Dec;Const;MajAx;MinAx;SurfBr;V-Mag;M;NGC;IC;Identifiers;Common names",
        "NGC0001;G;00:08:27.05;+27:43:03.6;Peg;0.4;0.3;12.5;13.65;;;;PGC 000001;Test Galaxy",
        "IC0002;PN;00:11:00.88;-12:49:22.3;Cet;0.8;0.6;9.2;12.4;;;;;;;;",
        "NGC0224;G;00:42:44.35;+41:16:08.6;And;177.8;69.6;23.6;3.44;031;;;;Andromeda Galaxy",
    ].join("\n");
    const result = parseOpenNgcCsv(csv);
    const ngcOne = result.find((target) => target.id === "NGC 1");
    const icTwo = result.find((target) => target.id === "IC 2");
    const m31 = result.filter((target) => target.id === "M31");
    assert.ok(ngcOne);
    assert.ok(icTwo);
    assert.ok(Math.abs(ngcOne.raDeg - 2.1127) < 0.0001);
    assert.ok(Math.abs(icTwo.decDeg + 12.8229) < 0.0001);
    assert.equal(ngcOne.objectType, "Galaxy");
    assert.equal(ngcOne.magnitude, 13.65);
    assert.equal(ngcOne.aliases?.includes("Test Galaxy"), true);
    assert.equal(m31.length, 1);
    assert.equal(m31[0].magnitude, 3.44);
});
test("catalog search matches NGC IDs, Messier aliases and common names", () => {
    const catalog = parseOpenNgcCsv([
        "Name;Type;RA;Dec;Const;M;Common names",
        "NGC0598;G;01:33:50.90;+30:39:36.8;Tri;033;Triangulum Galaxy",
    ].join("\n"));
    assert.equal(searchTargets("NGC 598", catalog).some((target) => target.id === "NGC 598"), true);
    assert.equal(searchTargets("M33", catalog).some((target) => target.id === "NGC 598"), true);
    assert.equal(searchTargets("triangulum galaxy", catalog).some((target) => target.id === "NGC 598"), true);
});
test("the licensed OpenNGC snapshot parses as a broad offline search catalog", () => {
    const source = readFileSync(new URL("../public/catalog/OpenNGC.csv", import.meta.url), "utf8");
    const catalog = parseOpenNgcCsv(source);
    assert.ok(catalog.length > 13_000);
    assert.equal(catalog.filter((target) => target.id === "M31").length, 1);
    assert.equal(searchTargets("NGC 224", catalog).some((target) => target.id === "M31"), true);
    assert.equal(catalog.find((target) => target.id === "M31")?.magnitude, 3.44);
});
