import { detectStars } from "./detectStars.js";
export function detectStarsOffThread(image) {
    if (typeof Worker === "undefined")
        return Promise.resolve(detectStars(image));
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("../workers/star.worker.js", import.meta.url), { type: "module" });
        worker.onmessage = (event) => {
            worker.terminate();
            resolve(event.data);
        };
        worker.onerror = (event) => {
            worker.terminate();
            reject(new Error(event.message || "Star detection worker failed."));
        };
        const pixels = new Uint8ClampedArray(image.data);
        worker.postMessage({ data: pixels, width: image.width, height: image.height }, [pixels.buffer]);
    });
}
