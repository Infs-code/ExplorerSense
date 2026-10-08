import { parseOpenNgcCsv } from "./openNgc.js";
export async function loadOpenNgcCatalog() {
    const response = await fetch(`${import.meta.env.BASE_URL}catalog/OpenNGC.csv`);
    if (!response.ok)
        throw new Error(`OpenNGC catalog request failed (HTTP ${response.status}).`);
    const source = await response.text();
    if (typeof Worker === "undefined")
        return parseOpenNgcCsv(source);
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("../workers/catalog.worker.js", import.meta.url), { type: "module" });
        worker.onmessage = (event) => {
            worker.terminate();
            if (event.data.error)
                reject(new Error(event.data.error));
            else
                resolve(event.data.targets ?? []);
        };
        worker.onerror = () => {
            worker.terminate();
            try {
                resolve(parseOpenNgcCsv(source));
            }
            catch (error) {
                reject(error);
            }
        };
        worker.postMessage(source);
    });
}
