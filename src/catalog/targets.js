import * as Astronomy from "astronomy-engine";
export const targets = [
    { id: "M31", name: "Andromeda Galaxy", kind: "deep-sky", raDeg: 10.684708, decDeg: 41.269167, summary: "M31 · Galaxy" },
    { id: "M42", name: "Orion Nebula", kind: "deep-sky", raDeg: 83.822083, decDeg: -5.391111, summary: "M42 · Emission nebula" },
    { id: "M45", name: "Pleiades", kind: "deep-sky", raDeg: 56.75, decDeg: 24.1167, summary: "M45 · Open cluster" },
    { id: "M13", name: "Hercules Cluster", kind: "deep-sky", raDeg: 250.423, decDeg: 36.461, summary: "M13 · Globular cluster" },
    { id: "M57", name: "Ring Nebula", kind: "deep-sky", raDeg: 283.396, decDeg: 33.029, summary: "M57 · Planetary nebula" },
    { id: "M51", name: "Whirlpool Galaxy", kind: "deep-sky", raDeg: 202.469, decDeg: 47.195, summary: "M51 · Galaxy" },
    { id: "M81", name: "Bode's Galaxy", kind: "deep-sky", raDeg: 148.888, decDeg: 69.065, summary: "M81 · Galaxy" },
    { id: "M82", name: "Cigar Galaxy", kind: "deep-sky", raDeg: 148.968, decDeg: 69.679, summary: "M82 · Galaxy" },
    { id: "M8", name: "Lagoon Nebula", kind: "deep-sky", raDeg: 270.925, decDeg: -24.38, summary: "M8 · Emission nebula" },
    { id: "M27", name: "Dumbbell Nebula", kind: "deep-sky", raDeg: 299.901, decDeg: 22.721, summary: "M27 · Planetary nebula" },
    { id: "M101", name: "Pinwheel Galaxy", kind: "deep-sky", raDeg: 210.803, decDeg: 54.349, summary: "M101 · Galaxy" },
    { id: "M104", name: "Sombrero Galaxy", kind: "deep-sky", raDeg: 189.998, decDeg: -11.623, summary: "M104 · Galaxy" },
    { id: "M3", name: "Globular Cluster M3", kind: "deep-sky", raDeg: 205.548, decDeg: 28.377, summary: "M3 · Globular cluster" },
    { id: "M5", name: "Globular Cluster M5", kind: "deep-sky", raDeg: 229.638, decDeg: 2.082, summary: "M5 · Globular cluster" },
    { id: "Mercury", name: "Mercury", kind: "planet", raDeg: null, decDeg: null, summary: "Current ephemeris position", body: Astronomy.Body.Mercury },
    { id: "Venus", name: "Venus", kind: "planet", raDeg: null, decDeg: null, summary: "Current ephemeris position", body: Astronomy.Body.Venus },
    { id: "Mars", name: "Mars", kind: "planet", raDeg: null, decDeg: null, summary: "Current ephemeris position", body: Astronomy.Body.Mars },
    { id: "Jupiter", name: "Jupiter", kind: "planet", raDeg: null, decDeg: null, summary: "Current ephemeris position", body: Astronomy.Body.Jupiter },
    { id: "Saturn", name: "Saturn", kind: "planet", raDeg: null, decDeg: null, summary: "Current ephemeris position", body: Astronomy.Body.Saturn },
    { id: "Uranus", name: "Uranus", kind: "planet", raDeg: null, decDeg: null, summary: "Current ephemeris position", body: Astronomy.Body.Uranus },
    { id: "Neptune", name: "Neptune", kind: "planet", raDeg: null, decDeg: null, summary: "Current ephemeris position", body: Astronomy.Body.Neptune },
    { id: "Moon", name: "Moon", kind: "moon", raDeg: null, decDeg: null, summary: "Current topocentric ephemeris position", body: Astronomy.Body.Moon },
];
export function searchTargets(query, catalog = []) {
    const normalized = query.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
    const available = [...targets, ...catalog];
    if (!normalized)
        return available;
    return available.filter((target) => `${target.id} ${target.name} ${target.summary} ${target.aliases?.join(" ") ?? ""}`.toLocaleLowerCase().replace(/[^a-z0-9]/g, "").includes(normalized));
}
