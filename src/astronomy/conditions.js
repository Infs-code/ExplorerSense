import * as Astronomy from "astronomy-engine";
import { angularSeparationDeg, raDecToVector } from "./vectors.js";
import { bodyPosition, horizontalFromJ2000, precessJ2000ToDate } from "./coordinates.js";
function eventDate(search) {
    try {
        return search()?.date ?? null;
    }
    catch {
        return null;
    }
}
export function observingConditions(target, observer, date = new Date()) {
    const site = new Astronomy.Observer(observer.latitudeDeg, observer.longitudeDeg, observer.elevationMeters);
    const targetBody = target.body ?? Astronomy.Body.Star1;
    if (!target.body) {
        if (target.raDeg === null || target.decDeg === null)
            throw new RangeError("A fixed target needs catalog coordinates or a Solar System body identifier.");
        Astronomy.DefineStar(targetBody, target.raDeg / 15, target.decDeg, 1000);
    }
    let targetHorizontal;
    if (target.body) {
        targetHorizontal = bodyPosition(target.body, observer, date).horizontal;
    }
    else if (target.raDeg !== null && target.decDeg !== null) {
        targetHorizontal = horizontalFromJ2000({ raDeg: target.raDeg, decDeg: target.decDeg }, observer, date);
    }
    else {
        throw new RangeError("A fixed target needs catalog coordinates or a Solar System body identifier.");
    }
    const sunAltitudeDeg = bodyPosition(Astronomy.Body.Sun, observer, date).horizontal.altitudeDeg;
    const moon = bodyPosition(Astronomy.Body.Moon, observer, date);
    const sunRise = eventDate(() => Astronomy.SearchRiseSet(Astronomy.Body.Sun, site, +1, date, 2));
    const sunSet = eventDate(() => Astronomy.SearchRiseSet(Astronomy.Body.Sun, site, -1, date, 2));
    const civilDawn = eventDate(() => Astronomy.SearchAltitude(Astronomy.Body.Sun, site, +1, date, 2, -6));
    const civilDusk = eventDate(() => Astronomy.SearchAltitude(Astronomy.Body.Sun, site, -1, date, 2, -6));
    const nauticalDawn = eventDate(() => Astronomy.SearchAltitude(Astronomy.Body.Sun, site, +1, date, 2, -12));
    const nauticalDusk = eventDate(() => Astronomy.SearchAltitude(Astronomy.Body.Sun, site, -1, date, 2, -12));
    const astronomicalDawn = eventDate(() => Astronomy.SearchAltitude(Astronomy.Body.Sun, site, +1, date, 2, -18));
    const astronomicalDusk = eventDate(() => Astronomy.SearchAltitude(Astronomy.Body.Sun, site, -1, date, 2, -18));
    const moonRise = eventDate(() => Astronomy.SearchRiseSet(Astronomy.Body.Moon, site, +1, date, 2));
    const moonSet = eventDate(() => Astronomy.SearchRiseSet(Astronomy.Body.Moon, site, -1, date, 2));
    const targetRise = eventDate(() => Astronomy.SearchRiseSet(targetBody, site, +1, date, 2));
    const targetSet = eventDate(() => Astronomy.SearchRiseSet(targetBody, site, -1, date, 2));
    const targetTransit = eventDate(() => Astronomy.SearchHourAngle(targetBody, site, 0, date, +1).time);
    const moonPhaseAngleDeg = Astronomy.MoonPhase(date);
    const moonIlluminationPercent = Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction * 100;
    const targetEquatorial = target.body
        ? bodyPosition(target.body, observer, date).equatorial
        : precessJ2000ToDate({ raDeg: target.raDeg, decDeg: target.decDeg }, date);
    const moonSeparationDeg = angularSeparationDeg(raDecToVector(targetEquatorial.raDeg, targetEquatorial.decDeg), raDecToVector(moon.equatorial.raDeg, moon.equatorial.decDeg));
    const status = targetHorizontal.altitudeDeg < 0
        ? "Below horizon"
        : targetHorizontal.altitudeDeg < 20
            ? "Low altitude"
            : sunAltitudeDeg > -18
                ? "Astronomical twilight"
                : "Astronomical night";
    return {
        targetAltitudeDeg: targetHorizontal.altitudeDeg,
        targetAzimuthDeg: targetHorizontal.azimuthDeg,
        targetRise,
        targetSet,
        targetTransit,
        sunAltitudeDeg,
        sunRise,
        sunSet,
        civilDawn,
        civilDusk,
        nauticalDawn,
        nauticalDusk,
        astronomicalDawn,
        astronomicalDusk,
        moonAltitudeDeg: moon.horizontal.altitudeDeg,
        moonAzimuthDeg: moon.horizontal.azimuthDeg,
        moonRise,
        moonSet,
        moonPhaseAngleDeg,
        moonIlluminationPercent,
        moonSeparationDeg,
        status,
    };
}
