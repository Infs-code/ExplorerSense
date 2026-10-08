const normalizeHeading = (value) => (value % 360 + 360) % 360;

function readOrientation(event) {
  const compass = Number.isFinite(event.webkitCompassHeading)
    ? normalizeHeading(event.webkitCompassHeading)
    : event.absolute && Number.isFinite(event.alpha)
      ? normalizeHeading(360 - event.alpha)
      : null;
  return {
    headingDeg: compass,
    headingSource: Number.isFinite(event.webkitCompassHeading) ? "device compass" : compass === null ? "relative only" : "absolute orientation",
    tiltDeg: Number.isFinite(event.beta) ? event.beta : null,
    rollDeg: Number.isFinite(event.gamma) ? event.gamma : null,
    orientationAbsolute: Boolean(event.absolute),
  };
}

export async function requestDeviceSensors(onUpdate) {
  const state = { headingDeg: null, headingSource: "waiting for sensor", tiltDeg: null, rollDeg: null, acceleration: null, rotationRate: null, magneticField: null, pressureRaw: null, motionAvailable: false, orientationAvailable: false, magneticAvailable: false, barometerAvailable: false };
  let alive = true;
  const publish = (update) => {
    if (!alive) return;
    Object.assign(state, update);
    onUpdate({ ...state });
  };
  const listeners = [];
  const addListener = (name, handler) => {
    window.addEventListener(name, handler, { passive: true });
    listeners.push(() => window.removeEventListener(name, handler));
  };

  const permissionRequests = [];
  for (const SensorEvent of [window.DeviceOrientationEvent, window.DeviceMotionEvent]) {
    if (typeof SensorEvent?.requestPermission === "function") {
      try { permissionRequests.push(Promise.resolve(SensorEvent.requestPermission()).catch((error) => error?.name === "NotAllowedError" ? "denied" : "unavailable")); }
      catch (error) { permissionRequests.push(Promise.resolve(error?.name === "NotAllowedError" ? "denied" : "unavailable")); }
    }
  }
  const permissionResults = await Promise.all(permissionRequests);
  const denied = permissionResults.includes("denied");

  if (!denied && "DeviceOrientationEvent" in window) {
    const orientationHandler = (event) => publish({ ...readOrientation(event), orientationAvailable: true });
    addListener("deviceorientationabsolute", orientationHandler);
    addListener("deviceorientation", orientationHandler);
  }
  if (!denied && "DeviceMotionEvent" in window) {
    addListener("devicemotion", (event) => publish({
      motionAvailable: true,
      acceleration: event.accelerationIncludingGravity ? { x: event.accelerationIncludingGravity.x, y: event.accelerationIncludingGravity.y, z: event.accelerationIncludingGravity.z } : null,
      rotationRate: event.rotationRate ? { alpha: event.rotationRate.alpha, beta: event.rotationRate.beta, gamma: event.rotationRate.gamma } : null,
    }));
  }

  let magnetometer;
  if (!denied && typeof window.Magnetometer === "function") {
    try {
      magnetometer = new window.Magnetometer({ frequency: 10 });
      magnetometer.addEventListener("reading", () => publish({ magneticAvailable: true, magneticField: { x: magnetometer.x, y: magnetometer.y, z: magnetometer.z } }));
      magnetometer.addEventListener("error", () => publish({ magneticAvailable: false, magneticField: null }));
      magnetometer.start();
    } catch { publish({ magneticAvailable: false }); }
  }

  let barometer;
  if (!denied && typeof window.Barometer === "function") {
    try {
      barometer = new window.Barometer({ frequency: 1 });
      barometer.addEventListener("reading", () => publish({ barometerAvailable: true, pressureRaw: Number.isFinite(barometer.pressure) ? barometer.pressure : null }));
      barometer.addEventListener("error", () => publish({ barometerAvailable: false, pressureRaw: null }));
      barometer.start();
    } catch { publish({ barometerAvailable: false }); }
  }

  if (permissionResults.length > 0 && denied) publish({ headingSource: "permission denied" });
  else if (typeof window.DeviceOrientationEvent === "undefined") publish({ headingSource: "not exposed by this browser" });

  return {
    initial: { ...state },
    permissionDenied: denied,
    stop() {
      alive = false;
      listeners.forEach((remove) => remove());
      magnetometer?.stop();
      barometer?.stop();
    },
  };
}
