export function registerServiceWorker() {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
    const base = import.meta.env.BASE_URL;
    void navigator.serviceWorker.register(`${base}service-worker.js`, { scope: base }).catch(() => undefined);
    }
}
