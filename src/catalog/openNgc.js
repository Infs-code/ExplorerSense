import { targets } from "./targets.js";
const typeNames = {
    G: "Galaxy",
    GPair: "Galaxy pair",
    Gtrpl: "Galaxy triplet",
    GTrpl: "Galaxy triplet",
    GGroup: "Galaxy group",
    OCl: "Open cluster",
    GCl: "Globular cluster",
    "Cl+N": "Cluster with nebula",
    Neb: "Nebula",
    HII: "H II region",
    EmN: "Emission nebula",
    RfN: "Reflection nebula",
    DrkN: "Dark nebula",
    SNR: "Supernova remnant",
    PN: "Planetary nebula",
    Nova: "Nova",
    "**": "Double star",
    "*": "Star",
    "*Ass": "Stellar association",
};
function splitSemicolonCsv(line) {
    const fields = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
            if (quoted && line[index + 1] === '"') {
                value += '"';
                index += 1;
            }
            else {
                quoted = !quoted;
            }
        }
        else if (character === ";" && !quoted) {
            fields.push(value);
            value = "";
        }
        else {
            value += character;
        }
    }
    fields.push(value);
    return fields;
}
function sexagesimalToDegrees(value, rightAscension) {
    const match = /^([+-]?\d+):([+-]?\d+):([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(value.trim());
    if (!match)
        return null;
    const first = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (![first, minutes, seconds].every(Number.isFinite) || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60)
        return null;
    const sign = first < 0 || value.trim().startsWith("-") ? -1 : 1;
    const degrees = Math.abs(first) + minutes / 60 + seconds / 3600;
    return rightAscension ? degrees * 15 : sign * degrees;
}
function finiteNumber(value) {
    if (!value.trim())
        return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}
function formatDesignator(value) {
    const match = /^(NGC|IC)(\d+)$/i.exec(value.trim());
    return match ? `${match[1].toUpperCase()} ${Number(match[2])}` : value.trim();
}
export function parseOpenNgcCsv(source) {
    const lines = source.split(/\r?\n/);
    if (lines.length < 2)
        return [];
    const header = splitSemicolonCsv(lines[0]).map((value) => value.trim());
    const indexes = new Map(header.map((name, index) => [name, index]));
    const curatedMessierIndexes = new Map(targets.map((target, index) => [target.id.toUpperCase(), index]));
    const result = targets.map((target) => ({ ...target }));
    const readField = (row, name) => row[indexes.get(name) ?? -1]?.trim() ?? "";
    for (const line of lines.slice(1)) {
        if (!line.trim())
            continue;
        const row = splitSemicolonCsv(line);
        const rawName = readField(row, "Name");
        const typeCode = readField(row, "Type");
        if (typeCode === "Dup" || typeCode === "NonEx")
            continue;
        const raDeg = sexagesimalToDegrees(readField(row, "RA"), true);
        const decDeg = sexagesimalToDegrees(readField(row, "Dec"), false);
        if (!rawName || raDeg === null || decDeg === null || decDeg < -90 || decDeg > 90)
            continue;
        const messierNumber = readField(row, "M").replace(/^0+/, "");
        const messierId = messierNumber ? `M${messierNumber}` : "";
        const id = formatDesignator(rawName);
        const commonName = readField(row, "Common names").split(",")[0]?.trim() ?? "";
        const constellation = readField(row, "Const");
        const objectType = typeNames[typeCode] ?? (typeCode === "Dup" ? "Duplicate entry" : typeCode || "Unclassified object");
        const aliases = [rawName, id, messierId, readField(row, "NGC"), readField(row, "IC"), ...readField(row, "Identifiers").split(","), ...readField(row, "Common names").split(",")]
            .map((alias) => alias.trim())
            .filter(Boolean);
        const catalogData = {
            id,
            name: commonName || id,
            kind: "deep-sky",
            raDeg,
            decDeg,
            summary: `${messierId ? `${messierId} · ` : ""}${objectType}${constellation ? ` · ${constellation}` : ""}`,
            objectType,
            magnitude: finiteNumber(readField(row, "V-Mag")),
            surfaceBrightness: finiteNumber(readField(row, "SurfBr")),
            sizeMajorArcmin: finiteNumber(readField(row, "MajAx")),
            sizeMinorArcmin: finiteNumber(readField(row, "MinAx")),
            constellation: constellation || undefined,
            aliases,
        };
        const curatedIndex = curatedMessierIndexes.get(messierId.toUpperCase());
        if (curatedIndex !== undefined) {
            const curated = result[curatedIndex];
            result[curatedIndex] = {
                ...curated,
                objectType,
                magnitude: catalogData.magnitude,
                surfaceBrightness: catalogData.surfaceBrightness,
                sizeMajorArcmin: catalogData.sizeMajorArcmin,
                sizeMinorArcmin: catalogData.sizeMinorArcmin,
                constellation: catalogData.constellation,
                aliases,
            };
        }
        else {
            result.push(catalogData);
        }
    }
    return result;
}
