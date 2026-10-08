const sleep = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
export async function solveThroughAstrometryProxy(imageBase64, width, height, onProgress, signal) {
    onProgress("Sending one still frame to the configured private solve proxy…");
    const apiBase = `${import.meta.env.BASE_URL}api/`;
    const responsePromise = fetch(`${apiBase}solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, width, height }),
        signal,
    });
    let finished = false;
    const progressPoll = (async () => {
        while (!finished) {
            await sleep(2000);
            if (finished || signal?.aborted)
                return;
            try {
                const response = await fetch(`${apiBase}solve/status`, { cache: "no-store", signal });
                if (!response.ok)
                    continue;
                const status = await response.json();
                if (status.busy && status.progress)
                    onProgress(status.progress);
            }
            catch {
                // The main request carries the authoritative result/error.
            }
        }
    })();
    try {
        const response = await responsePromise;
        const payload = await response.json();
        if (!response.ok)
            throw new Error(payload.error ?? `Solve proxy returned HTTP ${response.status}.`);
        if (![payload.raDeg, payload.decDeg, payload.pixelScaleArcsec, payload.orientationDeg, payload.parity].every(Number.isFinite)) {
            throw new Error("Solve proxy returned incomplete astrometric data.");
        }
        onProgress("Plate solution received.");
        return { ...payload, imageWidth: width, imageHeight: height };
    }
    catch (error) {
        if (error instanceof TypeError)
            throw new Error("The plate-solve proxy is unavailable. Start the app with its optional solve backend, or deploy a same-origin /api/solve endpoint.");
        throw error;
    }
    finally {
        finished = true;
        await progressPoll;
    }
}
