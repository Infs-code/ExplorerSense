import { parseOpenNgcCsv } from "../catalog/openNgc.js";
self.addEventListener("message", (event) => {
    try {
        self.postMessage({ targets: parseOpenNgcCsv(event.data) });
    }
    catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : "Catalog parsing failed." });
    }
});
