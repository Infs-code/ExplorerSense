import { fitAttitude } from "../calibration/attitude.js";
const DB_NAME = "explorer-sense";
const DB_VERSION = 1;
const STORE_NAME = "settings";
const CALIBRATION_KEY = "calibration.v1";
const CONFIG_KEY = "telescope.v1";
const LEGACY_CALIBRATION_KEY = "explorer-sense.calibration.v1";
const LEGACY_CONFIG_KEY = "explorer-sense.telescope.v1";
let database = null;
function openDatabase() {
    if (!("indexedDB" in globalThis))
        return Promise.reject(new Error("IndexedDB is unavailable."));
    if (database)
        return database;
    const opening = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME))
                request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open local database."));
        request.onblocked = () => reject(new Error("Local database upgrade is blocked by another tab."));
    }).catch((error) => {
        database = null;
        throw error;
    });
    database = opening;
    return opening;
}
async function read(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error ?? new Error("Could not read local data."));
    });
}
async function write(key, value) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Could not save local data."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Local data save was aborted."));
    });
}
async function remove(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove local data."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Local data removal was aborted."));
    });
}
function legacyRead(key) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    }
    catch {
        return null;
    }
}
function legacyWrite(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
        // Persistent browser storage can be disabled or full; IndexedDB remains preferred.
    }
}
function legacyRemove(key) {
    try {
        localStorage.removeItem(key);
    }
    catch {
        // Ignore unavailable fallback storage.
    }
}
async function load(key, legacyKey) {
    try {
        const value = await read(key);
        if (value !== null)
            return value;
    }
    catch {
        return legacyRead(legacyKey);
    }
    const legacy = legacyRead(legacyKey);
    if (legacy !== null)
        void write(key, legacy).catch(() => undefined);
    return legacy;
}
export async function loadCalibration() {
    const saved = await load(CALIBRATION_KEY, LEGACY_CALIBRATION_KEY);
    if (!saved || !Array.isArray(saved.points) || saved.points.length < 3)
        return null;
    try {
        const fit = fitAttitude(saved.points);
        return { points: saved.points, quaternion: fit.quaternion, meanDeg: fit.meanDeg, rmsDeg: fit.rmsDeg, worstDeg: fit.worstDeg, retainedIndexes: fit.retained, savedAt: saved.savedAt };
    }
    catch {
        return null;
    }
}
export async function saveCalibration(value) {
    try {
        await write(CALIBRATION_KEY, value);
        legacyRemove(LEGACY_CALIBRATION_KEY);
    }
    catch {
        legacyWrite(LEGACY_CALIBRATION_KEY, value);
    }
}
export async function deleteCalibration() {
    try {
        await remove(CALIBRATION_KEY);
    }
    catch {
        // The fallback is removed below whether or not IndexedDB is available.
    }
    legacyRemove(LEGACY_CALIBRATION_KEY);
}
export async function loadTelescopeConfig() {
    const saved = await load(CONFIG_KEY, LEGACY_CONFIG_KEY);
    const validPositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
    const apparentField = validPositive(saved?.eyepieceApparentFieldDeg);
    return {
        apertureMm: validPositive(saved?.apertureMm),
        focalLengthMm: validPositive(saved?.focalLengthMm),
        eyepieceMm: validPositive(saved?.eyepieceMm),
        eyepieceApparentFieldDeg: apparentField && apparentField <= 180 ? apparentField : null,
    };
}
export async function saveTelescopeConfig(value) {
    try {
        await write(CONFIG_KEY, value);
        legacyRemove(LEGACY_CONFIG_KEY);
    }
    catch {
        legacyWrite(LEGACY_CONFIG_KEY, value);
    }
}
