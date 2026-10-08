import * as Astronomy from "astronomy-engine";
import { raDecToVector, vectorToRaDec } from "./vectors.js";
export function precessJ2000ToDate(coord, date) {
    const t = (date.getTime() / 86_400_000 + 2_440_587.5 - 2_451_545) / 36_525;
    const arcsec = Math.PI / (180 * 3600);
    const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * arcsec;
    const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * arcsec;
    const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * arcsec;
    const ra = (coord.raDeg * Math.PI) / 180;
    const dec = (coord.decDeg * Math.PI) / 180;
    const a = Math.cos(dec) * Math.sin(ra + zeta);
    const b = Math.cos(theta) * Math.cos(dec) * Math.cos(ra + zeta) - Math.sin(theta) * Math.sin(dec);
    const c = Math.sin(theta) * Math.cos(dec) * Math.cos(ra + zeta) + Math.cos(theta) * Math.sin(dec);
    return {
        raDeg: ((Math.atan2(a, b) + z) * 180 / Math.PI + 360) % 360,
        decDeg: (Math.asin(Math.max(-1, Math.min(1, c))) * 180) / Math.PI,
    };
}
export function toDateEquatorialVector(coordJ2000, date) {
    const time = new Astronomy.AstroTime(date);
    const vector = raDecToVector(coordJ2000.raDeg, coordJ2000.decDeg);
    const matrix = Astronomy.Rotation_EQJ_EQD(time);
    const rotated = Astronomy.RotateVector(matrix, new Astronomy.Vector(vector[0], vector[1], vector[2], time));
    return [rotated.x, rotated.y, rotated.z];
}
export function horizontalFromJ2000(coord, observer, date = new Date()) {
    const time = new Astronomy.AstroTime(date);
    const ofDate = vectorToRaDec(toDateEquatorialVector(coord, date));
    const horizon = Astronomy.Horizon(time, new Astronomy.Observer(observer.latitudeDeg, observer.longitudeDeg, observer.elevationMeters), ofDate.raDeg / 15, ofDate.decDeg, "normal");
    return { azimuthDeg: horizon.azimuth, altitudeDeg: horizon.altitude };
}
export function bodyPosition(body, observer, date = new Date()) {
    const time = new Astronomy.AstroTime(date);
    const site = new Astronomy.Observer(observer.latitudeDeg, observer.longitudeDeg, observer.elevationMeters);
    const equ = Astronomy.Equator(body, time, site, true, true);
    const j2000 = Astronomy.Equator(body, time, site, false, true);
    const horizontal = Astronomy.Horizon(time, site, equ.ra, equ.dec, "normal");
    return {
        equatorial: { raDeg: equ.ra * 15, decDeg: equ.dec },
        j2000: { raDeg: j2000.ra * 15, decDeg: j2000.dec },
        horizontal: { azimuthDeg: horizontal.azimuth, altitudeDeg: horizontal.altitude },
    };
}
export function sunAltitude(observer, date = new Date()) {
    return bodyPosition(Astronomy.Body.Sun, observer, date).horizontal.altitudeDeg;
}
export function moonPosition(observer, date = new Date()) {
    return bodyPosition(Astronomy.Body.Moon, observer, date);
}
