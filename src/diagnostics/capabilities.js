export function browserCapabilities() {
    const secure = window.isSecureContext;
    const media = Boolean(navigator.mediaDevices?.getUserMedia);
    const geo = "geolocation" in navigator;
    const orientationPermission = typeof DeviceOrientationEvent !== "undefined" && "requestPermission" in DeviceOrientationEvent;
    const orientation = typeof DeviceOrientationEvent !== "undefined";
    const motion = typeof DeviceMotionEvent !== "undefined";
    const magnetometer = typeof window.Magnetometer === "function";
    const barometer = typeof window.Barometer === "function";
    const webXr = Boolean(navigator.xr);
    const worker = typeof Worker !== "undefined";
    const wasm = typeof WebAssembly !== "undefined";
    const indexedDb = "indexedDB" in globalThis;
    const webGpu = "gpu" in navigator;
    let webGl = false;
    try {
        const canvas = document.createElement("canvas");
        webGl = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    }
    catch {
        webGl = false;
    }
    const userAgent = navigator.userAgent;
    const safari = /safari/i.test(userAgent) && !/(chrome|crios|chromium|fxios|edgios|android)/i.test(userAgent);
    return [
        { name: "Browser", state: safari ? "available" : "limited", detail: safari ? "Safari user agent detected." : "Safari user agent not detected; camera and storage are still feature-tested." },
        { name: "Secure context", state: secure ? "available" : "unavailable", detail: secure ? "Camera access is allowed on this origin." : "Use HTTPS or localhost for camera access." },
        { name: "Front / rear camera", state: media ? "available" : "unavailable", detail: media ? "Camera selection is requested in the app; hardware and permission are checked when started." : "This browser does not expose getUserMedia." },
        { name: "Location estimate", state: geo ? "available" : "unavailable", detail: geo ? "Browser location may use GNSS, Wi-Fi or cellular sources; it does not expose raw satellite data." : "Geolocation is unavailable in this browser." },
        { name: "Device orientation / compass", state: orientationPermission ? "limited" : orientation ? "available" : "unavailable", detail: orientationPermission ? "User permission is required. Heading quality and magnetic calibration depend on device and browser." : "Orientation data is optional and is not used as a plate solution." },
        { name: "Accelerometer + gyroscope", state: motion ? "available" : "unavailable", detail: motion ? "Device motion events may provide acceleration and rotation rate after permission." : "Device motion events are unavailable." },
        { name: "Raw magnetometer", state: magnetometer ? "available" : "unavailable", detail: magnetometer ? "Generic Sensor Magnetometer is exposed; permission and sensor hardware are still required." : "Raw magnetic-field values are not exposed by this browser." },
        { name: "Barometer", state: barometer ? "limited" : "unavailable", detail: barometer ? "A browser-specific Barometer constructor is present; this API is not standardized here, so its pressure units cannot be confirmed." : "No Barometer API is exposed by this browser." },
        { name: "Device clock", state: "available", detail: "Sky positions use the phone's local clock and time zone." },
        { name: "AR / camera registration", state: webXr ? "limited" : "unavailable", detail: webXr ? "WebXR is present, but this app currently draws a sensor-aligned 2D sky map, not a camera-registered AR scene." : "WebXR is not exposed here; the sky overlay is a 2D map, not camera-registered AR." },
        { name: "Optical image stabilization", state: "unavailable", detail: "The browser does not expose an OIS status or control for this camera." },
        { name: "Web Workers", state: worker ? "available" : "unavailable", detail: worker ? "Star detection can run off the main UI thread." : "Star detection must use the main UI thread." },
        { name: "WebAssembly", state: wasm ? "available" : "unavailable", detail: wasm ? "Supported by this browser; no WASM plate solver is bundled." : "WebAssembly is unavailable." },
        { name: "IndexedDB", state: indexedDb ? "available" : "unavailable", detail: indexedDb ? "Calibration and telescope settings use local browser storage." : "Persistent settings fall back to localStorage when available." },
        { name: "WebGL", state: webGl ? "available" : "unavailable", detail: webGl ? "Available but not required for current image processing." : "WebGL is unavailable; current image processing remains CPU based." },
        { name: "WebGPU", state: webGpu ? "available" : "unavailable", detail: webGpu ? "Available but not required by this build." : "WebGPU is unavailable and is not required." },
        { name: "Service worker / PWA", state: "serviceWorker" in navigator ? "available" : "unavailable", detail: "The service worker caches the app shell after the first online visit." },
        { name: "Network", state: navigator.onLine ? "available" : "limited", detail: navigator.onLine ? "Browser reports online; online plate solving still requires the configured backend." : "Browser reports offline; online plate solving is unavailable." },
        { name: "Offline shell", state: "limited", detail: "Static app assets are cached after the first online visit. Camera and online plate solving keep their own requirements." },
        { name: "Local blind plate solver", state: "unavailable", detail: "No offline star-pattern catalog/index is bundled. Plate solving uses an explicitly requested Astrometry.net online submission." },
    ];
}
