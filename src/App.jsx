import { useEffect, useMemo, useRef, useState } from "react";
import { browserCapabilities } from "./diagnostics/capabilities.js";
import { detectStarsOffThread } from "./camera/detectStarsWorker.js";
import { fitAttitude, rotateVector } from "./calibration/attitude.js";
import { observingConditions } from "./astronomy/conditions.js";
import { bodyPosition } from "./astronomy/coordinates.js";
import { approximateTrueFieldDeg, exitPupilMm, magnification } from "./astronomy/optics.js";
import { raDecToVector, angularSeparationDeg } from "./astronomy/vectors.js";
import { loadOpenNgcCatalog } from "./catalog/load.js";
import { searchTargets } from "./catalog/targets.js";
import { solveThroughAstrometryProxy } from "./plateSolver/astrometryNet.js";
import { pixelToSky, skyToPixel } from "./plateSolver/wcs.js";
import { pointingGuidance } from "./pointing/guidance.js";
import { deleteCalibration, loadCalibration, loadTelescopeConfig, saveCalibration, saveTelescopeConfig } from "./storage/local.js";
import { requestDeviceSensors } from "./sensors/deviceSensors.js";
import { SkyChart } from "./components/SkyChart.jsx";
const capabilityList = browserCapabilities();
const deg = (value) => `${value >= 0 ? "+" : "âˆ’"}${Math.abs(value).toFixed(2)}Â°`;
const moonPhaseName = (angleDeg) => ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Third quarter", "Waning crescent"][Math.floor(((angleDeg + 22.5) % 360) / 45)] ?? "N/A";
const localEventTime = (date) => date ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "No event in 48 h";
function App() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const sensorCleanupRef = useRef(null);
    const abortRef = useRef(null);
    const [cameraState, setCameraState] = useState("idle");
    const [cameraFacing, setCameraFacing] = useState("user");
    const [cameraMessage, setCameraMessage] = useState("Camera has not been requested.");
    const [sensorData, setSensorData] = useState({ headingDeg: null, headingSource: "not enabled", tiltDeg: null, rollDeg: null, acceleration: null, rotationRate: null, magneticField: null, pressureRaw: null, motionAvailable: false, orientationAvailable: false, magneticAvailable: false, barometerAvailable: false });
    const [sensorMessage, setSensorMessage] = useState("Tap Enable Device Orientation to request sensor access.");
    const [orientationPromptOpen, setOrientationPromptOpen] = useState(true);
    const [skyZoom, setSkyZoom] = useState(1);
    const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
    const [location, setLocation] = useState(null);
    const [locationMessage, setLocationMessage] = useState("Location not requested.");
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState("");
    const [targetCategory, setTargetCategory] = useState("all");
    const [solution, setSolution] = useState(null);
    const [solveMessage, setSolveMessage] = useState("No plate solution yet.");
    const [solveBusy, setSolveBusy] = useState(false);
    const [uploadConsent, setUploadConsent] = useState(false);
    const [detection, setDetection] = useState(null);
    const [frameUrl, setFrameUrl] = useState(null);
    const [calibrationPixel, setCalibrationPixel] = useState(null);
    const [calibrationMarker, setCalibrationMarker] = useState(null);
    const [validation, setValidation] = useState(null);
    const [calibrationPoints, setCalibrationPoints] = useState([]);
    const [fit, setFit] = useState(null);
    const [telescope, setTelescope] = useState({ apertureMm: null, focalLengthMm: null, eyepieceMm: null, eyepieceApparentFieldDeg: null });
    const [storageReady, setStorageReady] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const [tab, setTab] = useState("guide");
    const [catalogObjects, setCatalogObjects] = useState([]);
    const [catalogState, setCatalogState] = useState("idle");
    const [catalogError, setCatalogError] = useState("");
    const [now, setNow] = useState(new Date());
    const matchingTargets = useMemo(() => searchTargets(search, catalogObjects), [search, catalogObjects]);
    const categoryTargets = useMemo(() => targetCategory === "all" ? matchingTargets : matchingTargets.filter((target) => target.kind === targetCategory), [matchingTargets, targetCategory]);
    const visibleTargets = categoryTargets.slice(0, 50);
    const conditions = useMemo(() => location && selected ? observingConditions(selected, location, now) : null, [location, selected, now]);
    const targetEquatorial = useMemo(() => {
        if (!selected)
            return null;
        if (selected.body) {
            if (!location)
                return null;
            const position = bodyPosition(selected.body, location, now).j2000;
            return { ra: position.raDeg / 15, dec: position.decDeg };
        }
        return selected.raDeg !== null && selected.decDeg !== null ? { ra: selected.raDeg / 15, dec: selected.decDeg } : null;
    }, [location, now, selected]);
    const guide = useMemo(() => {
        if (!solution || !fit || fit.retainedIndexes.length < 5 || !validation || validation.residualDeg > 0.5 || !targetEquatorial)
            return null;
        const target = raDecToVector(targetEquatorial.ra * 15, targetEquatorial.dec);
        return pointingGuidance(raDecToVector(solution.raDeg, solution.decDeg), target, fit.quaternion);
    }, [solution, fit, targetEquatorial, calibrationPoints.length, validation]);
    useEffect(() => {
        let active = true;
        void Promise.all([loadCalibration(), loadTelescopeConfig()]).then(([saved, config]) => {
            if (!active)
                return;
            if (saved) {
                setFit(saved);
                setCalibrationPoints(saved.points);
            }
            setTelescope(config);
            setStorageReady(true);
        });
        const timer = window.setInterval(() => setNow(new Date()), 30_000);
        const updateOnline = () => setOnline(navigator.onLine);
        window.addEventListener("online", updateOnline);
        window.addEventListener("offline", updateOnline);
        return () => {
            active = false;
            window.clearInterval(timer);
            window.removeEventListener("online", updateOnline);
            window.removeEventListener("offline", updateOnline);
            streamRef.current?.getTracks().forEach((track) => track.stop());
            sensorCleanupRef.current?.stop();
            abortRef.current?.abort();
        };
    }, []);
    useEffect(() => {
        if (tab !== "targets" || catalogState !== "idle")
            return;
        setCatalogState("loading");
        void loadOpenNgcCatalog().then((catalog) => {
            setCatalogObjects(catalog);
            setCatalogState("ready");
        }).catch((error) => {
            setCatalogError(error instanceof Error ? error.message : "The offline object catalog could not be loaded.");
            setCatalogState("error");
        });
    }, [catalogState, tab]);
    useEffect(() => {
        if (storageReady)
            void saveTelescopeConfig(telescope);
    }, [storageReady, telescope]);
    async function startCamera(facing = cameraFacing) {
        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraState("error");
            setCameraMessage("Camera is unavailable. Open this app over HTTPS in a supported browser.");
            return;
        }
        setCameraState("starting");
        setCameraMessage("Waiting for camera permissionâ€¦");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 15, max: 30 } },
            });
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setCameraState("ready");
            const track = stream.getVideoTracks()[0];
            const actualFacing = track?.getSettings().facingMode ?? facing;
            setCameraMessage(`${actualFacing === "user" ? "Front" : "Rear"}-camera stream active${track?.getSettings().width ? ` Â· ${track.getSettings().width}Ã—${track.getSettings().height}` : ""}.`);
        }
        catch (error) {
            const name = error instanceof DOMException ? error.name : "Error";
            setCameraState("error");
            setCameraMessage(name === "NotAllowedError" ? "Camera permission was denied. Enable camera access for this site in Safari settings." : name === "NotFoundError" ? "No camera was found on this device." : `Camera could not start (${name}). Close other camera apps and try again.`);
        }
    }
    function stopCamera() {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current)
            videoRef.current.srcObject = null;
        setCameraState("idle");
        setCameraMessage("Camera stopped.");
    }
    function requestLocation() {
        if (!navigator.geolocation) {
            setLocationMessage("This browser does not provide geolocation.");
            return;
        }
        setLocationMessage("Waiting for location permissionâ€¦");
        navigator.geolocation.getCurrentPosition((position) => {
            const value = { latitudeDeg: position.coords.latitude, longitudeDeg: position.coords.longitude, elevationMeters: position.coords.altitude ?? 0, accuracyMeters: position.coords.accuracy };
            setLocation(value);
            setLocationMessage(`Location available Â· Â±${Math.round(position.coords.accuracy)} m accuracy. Used in this session only.`);
        }, (error) => setLocationMessage(error.code === error.PERMISSION_DENIED ? "Location permission denied. Visibility calculations are unavailable." : "Location unavailable. Check device location settings and retry."), { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
    }
    async function enableDeviceOrientation() {
        requestLocation();
        sensorCleanupRef.current?.stop();
        setSensorMessage("Requesting orientation and motion access. Keep the phone away from magnetic cases while it starts.");
        try {
            const session = await requestDeviceSensors(setSensorData);
            sensorCleanupRef.current = session;
            setSensorMessage(session.permissionDenied ? "Sensor permission was denied. Enable Motion & Orientation Access in browser settings, then retry." : "Move the phone in a figure eight if the compass heading looks wrong. Phone sensors are guidance only; verify targets visually.");
            setOrientationPromptOpen(false);
        }
        catch (error) {
            setSensorMessage(error instanceof Error ? error.message : "Device sensors could not be started in this browser.");
            setOrientationPromptOpen(false);
        }
    }
    function switchCamera() {
        const nextFacing = cameraFacing === "user" ? "environment" : "user";
        setCameraFacing(nextFacing);
        setFrameUrl(null);
        setDetection(null);
        setSolution(null);
        if (cameraState === "ready") {
            stopCamera();
            void startCamera(nextFacing);
        }
    }
    async function captureFrame() {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight)
            return null;
        const scale = Math.min(1, 1280 / video.videoWidth, 960 / video.videoHeight);
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context)
            return null;
        context.drawImage(video, 0, 0, width, height);
        const image = context.getImageData(0, 0, width, height);
        const url = canvas.toDataURL("image/jpeg", 0.92);
        setSolution(null);
        setFrameUrl(url);
        const stars = await detectStarsOffThread(image);
        setDetection(stars);
        setCalibrationPixel(null);
        setCalibrationMarker(null);
        return { imageBase64: url, width, height, detection: stars };
    }
    async function scanFrame() {
        if (cameraFacing !== "environment") {
            setSolveMessage("Switch to the rear camera to scan the sky. The front camera is active for your requested selfie preview.");
            return;
        }
        const captured = await captureFrame();
        if (!captured) {
            setSolveMessage("Camera frame is not ready. Wait for live video, then scan again.");
            return;
        }
        setSolveMessage(`${captured.detection.stars.length} star-like sources detected in this frame. No plate solution has been attempted.`);
    }
    async function solveFrame() {
        if (cameraFacing !== "environment") {
            setSolveMessage("Switch to the rear camera before solving a sky image. The front camera points toward you.");
            return;
        }
        if (!uploadConsent) {
            setSolveMessage("Confirm the upload disclosure before sending a still frame.");
            return;
        }
        const captured = await captureFrame();
        if (!captured) {
            setSolveMessage("Camera frame is not ready. Wait for live video, then try again.");
            return;
        }
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setSolveBusy(true);
        try {
            setSolveMessage("Submitting one still image through the configured solve backend. The service may retain submitted data under its terms.");
            const result = await solveThroughAstrometryProxy(captured.imageBase64, captured.width, captured.height, setSolveMessage, controller.signal);
            setSolution(result);
            setSolveMessage("Solved by Astrometry.net. Center/scale/orientation are the service result; camera distortion is not modeled in this WCS.");
        }
        catch (error) {
            setSolveMessage(error instanceof Error ? error.message : "Plate solve failed.");
        }
        finally {
            setSolveBusy(false);
        }
    }
    function addCalibrationPoint() {
        if (!selected) {
            setSolveMessage("Choose a fixed catalog target before adding a calibration point.");
            return;
        }
        if (!solution || !calibrationPixel) {
            setSolveMessage("First solve a frame, then tap the known object in that still frame so its identity can be checked against the plate solution.");
            return;
        }
        if (selected.body || selected.raDeg === null || selected.decDeg === null)
            return;
        if (calibrationPoints.some((point) => point.label.startsWith(`${selected.id} `))) {
            setSolveMessage("Use a different fixed target for each calibration point so the sample spans the sky.");
            return;
        }
        const cameraCenter = raDecToVector(solution.raDeg, solution.decDeg);
        const nearestPointDeg = calibrationPoints.reduce((minimum, point) => Math.min(minimum, angularSeparationDeg(point.camera, cameraCenter)), 180);
        if (calibrationPoints.length > 0 && nearestPointDeg < 15) {
            setSolveMessage(`This point is only ${nearestPointDeg.toFixed(1)}Â° from an existing sample. Choose a target farther across the sky to improve the 3D fit.`);
            return;
        }
        const clickedSky = pixelToSky(solution, calibrationPixel.x, calibrationPixel.y);
        const catalogDirection = raDecToVector(selected.raDeg, selected.decDeg);
        const matchError = angularSeparationDeg(clickedSky, catalogDirection);
        if (matchError > Math.max(2, solution.pixelScaleArcsec * Math.hypot(solution.imageWidth, solution.imageHeight) / 7200)) {
            setSolveMessage(`The clicked source is ${matchError.toFixed(2)}Â° from the entered catalog position. Check the target identity or plate solution before saving this point.`);
            return;
        }
        const point = {
            camera: cameraCenter,
            telescope: catalogDirection,
            label: `${selected.id} Â· eyepiece center`,
            createdAt: new Date().toISOString(),
        };
        const updated = [...calibrationPoints, point];
        setCalibrationPoints(updated);
        setValidation(null);
        if (updated.length >= 3) {
            try {
                const attitude = fitAttitude(updated);
                const saved = { points: updated, quaternion: attitude.quaternion, meanDeg: attitude.meanDeg, rmsDeg: attitude.rmsDeg, worstDeg: attitude.worstDeg, retainedIndexes: attitude.retained, savedAt: new Date().toISOString() };
                setFit(saved);
                void saveCalibration(saved);
            }
            catch (error) {
                setSolveMessage(error instanceof Error ? error.message : "Calibration fit failed.");
            }
        }
    }
    function validateCalibration() {
        if (!selected || !fit || !solution || !calibrationPixel || selected.body || selected.raDeg === null || selected.decDeg === null) {
            setSolveMessage("Solve a frame of a fixed, previously unused target and tap that target in the image before validating.");
            return;
        }
        if (calibrationPoints.some((point) => point.label.startsWith(`${selected.id} `))) {
            setSolveMessage("Choose a fixed target that was not used in the calibration fit.");
            return;
        }
        const expected = raDecToVector(selected.raDeg, selected.decDeg);
        const clicked = pixelToSky(solution, calibrationPixel.x, calibrationPixel.y);
        const identityError = angularSeparationDeg(clicked, expected);
        const maxIdentityError = Math.max(2, solution.pixelScaleArcsec * Math.hypot(solution.imageWidth, solution.imageHeight) / 7200);
        if (identityError > maxIdentityError) {
            setSolveMessage(`The tapped target does not agree with this frame's WCS (${identityError.toFixed(2)}Â°). Check the plate solution and selected object.`);
            return;
        }
        const measuredScope = rotateVector(fit.quaternion, raDecToVector(solution.raDeg, solution.decDeg));
        const residualDeg = angularSeparationDeg(measuredScope, expected);
        setValidation({ targetId: selected.id, residualDeg });
        setSolveMessage(residualDeg <= 0.5 ? `Independent validation residual: ${residualDeg.toFixed(2)}Â°.` : `Validation error ${residualDeg.toFixed(2)}Â°. Phone mount may have moved; recalibration is required before guidance.`);
    }
    function selectCalibrationTarget(event) {
        if (!solution)
            return;
        const rect = event.currentTarget.getBoundingClientRect();
        const scale = Math.max(rect.width / solution.imageWidth, rect.height / solution.imageHeight);
        const drawnWidth = solution.imageWidth * scale;
        const drawnHeight = solution.imageHeight * scale;
        const offsetX = (rect.width - drawnWidth) / 2;
        const offsetY = (rect.height - drawnHeight) / 2;
        const x = (event.clientX - rect.left - offsetX) / scale;
        const y = (event.clientY - rect.top - offsetY) / scale;
        if (x < 0 || y < 0 || x >= solution.imageWidth || y >= solution.imageHeight)
            return;
        setCalibrationPixel({ x, y });
        const viewRect = event.currentTarget.parentElement?.getBoundingClientRect();
        if (viewRect)
            setCalibrationMarker({ x: event.clientX - viewRect.left, y: event.clientY - viewRect.top });
    }
    function removeCalibrationPoint(index) {
        const updated = calibrationPoints.filter((_, itemIndex) => itemIndex !== index);
        setCalibrationPoints(updated);
        setValidation(null);
        if (updated.length >= 3) {
            try {
                const attitude = fitAttitude(updated);
                const saved = { points: updated, quaternion: attitude.quaternion, meanDeg: attitude.meanDeg, rmsDeg: attitude.rmsDeg, worstDeg: attitude.worstDeg, retainedIndexes: attitude.retained, savedAt: new Date().toISOString() };
                setFit(saved);
                void saveCalibration(saved);
            }
            catch {
                setFit(null);
            }
        }
        else {
            setFit(null);
            void deleteCalibration();
        }
    }
    function clearCalibration() {
        setCalibrationPoints([]);
        setFit(null);
        setValidation(null);
        void deleteCalibration();
        setSolveMessage("Calibration cleared. Recalibrate after the phone mount has moved.");
    }
    const targetPixel = solution && targetEquatorial ? skyToPixel(solution, raDecToVector(targetEquatorial.ra * 15, targetEquatorial.dec)) : null;
    const fieldDegrees = solution ? solution.pixelScaleArcsec * Math.max(solution.imageWidth, solution.imageHeight) / 3600 : null;
    const calculatedMagnification = magnification(telescope.focalLengthMm, telescope.eyepieceMm);
    const trueFieldDegrees = approximateTrueFieldDeg(telescope.eyepieceApparentFieldDeg, calculatedMagnification);
    const calculatedExitPupil = exitPupilMm(telescope.apertureMm, calculatedMagnification);
    return (<div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Explorer Sense home"><span className="brand-mark">âœ³</span><span>EXPLORER <b>SENSE</b></span></a>
        <div className="top-status"><span className={`status-dot ${cameraState === "ready" ? "live" : ""}`}/>{cameraState === "ready" ? "CAMERA LIVE" : "FIELD SETUP"}<span className="divider"/>{online ? "ONLINE" : "OFFLINE"}</div>
      </header>

      <main id="top" className={`layout view-${tab} ${mobileToolsOpen ? "mobile-tools-open" : ""}`}>
        <section className="intro">
          <div>
            <p className="eyebrow">PUSH-TO TELESCOPE COMPANION</p>
            <h1>Find your way<br /><em>through the sky.</em></h1>
            <p className="lede">A camera-assisted observing workspace for a manually operated telescope. Measurements appear only when the hardware and data support them.</p>
          </div>
          <div className="session-chip"><span className="chip-icon">â—·</span><span>{now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}<br /><b>{now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</b></span><small>LOCAL DEVICE TIME</small></div>
        </section>

        <nav className="tabs" aria-label="App sections">
          <button className={tab === "guide" ? "active" : ""} onClick={() => setTab("guide")}>AR</button>
          <button className={tab === "targets" ? "active" : ""} onClick={() => setTab("targets")}>Targets</button>
          <button className={tab === "tonight" ? "active" : ""} onClick={() => setTab("tonight")}>Tonight</button>
          <button className={tab === "setup" ? "active" : ""} onClick={() => setTab("setup")}>Settings</button>
        </nav>

        {tab === "guide" && <>
          <div className="main-grid">
            <section className="panel camera-panel">
              <div className="panel-heading"><div><p className="eyebrow">01 / SKY SCAN</p><h2>Camera view</h2></div><span className={`pill ${cameraState === "ready" ? "pill-live" : ""}`}>{cameraState === "ready" ? "LIVE" : "IDLE"}</span></div>
              <div className="camera-view">
                <SkyChart location={location} date={now} headingDeg={sensorData.headingDeg} tiltDeg={sensorData.tiltDeg} zoom={skyZoom}/>
                <div className="sky-controls">
                  <button onClick={() => void enableDeviceOrientation()}>Align</button>
                  <button onClick={() => setTab("targets")}>Search</button>
                  <button aria-label="Open settings" onClick={() => { setMobileToolsOpen(false); setTab("setup"); }}>âš™</button>
                </div>
                <div className="sky-zoom-controls"><button aria-label="Zoom out" onClick={() => setSkyZoom((value) => Math.max(0.7, value - 0.2))}>âˆ’</button><span>{Math.round(60 / skyZoom)}Â°</span><button aria-label="Zoom in" onClick={() => setSkyZoom((value) => Math.min(2.5, value + 0.2))}>+</button></div>
                <div className="sky-target-label">{selected?.name ?? "Sky map"}<small>{location ? sensorData.headingDeg === null ? "LIVE SKY Â· ALIGN COMPASS" : "LIVE LOCAL SKY Â· COMPASS ALIGNED" : "SKY MAP PREVIEW Â· ALLOW LOCATION"}</small></div>
                <div className="sky-readout"><span>AZ {sensorData.headingDeg === null ? "--" : `${sensorData.headingDeg.toFixed(1)}Â°`}</span><span>TILT {sensorData.tiltDeg === null ? "--" : `${sensorData.tiltDeg.toFixed(0)}Â°`}</span><span>{now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span></div>
                <div className="sky-camera-controls"><button onClick={() => cameraState === "ready" ? stopCamera() : void startCamera()} disabled={cameraState === "starting"}>{cameraState === "ready" ? "Camera off" : cameraState === "starting" ? "Startingâ€¦" : `${cameraFacing === "user" ? "Front" : "Rear"} camera`}</button><button onClick={switchCamera} disabled={cameraState === "starting"}>{cameraFacing === "user" ? "Use rear" : "Use front"}</button><button onClick={() => void scanFrame()} disabled={cameraState !== "ready" || cameraFacing !== "environment"}>Scan</button></div>
                <video className={`camera-pip ${cameraState === "ready" ? "active" : ""}`} ref={videoRef} playsInline muted aria-label={`${cameraFacing === "user" ? "Front" : "Rear"} camera preview`}/>
                {orientationPromptOpen && <div className="orientation-prompt"><div><b>Enable Device Orientation</b><p>{sensorMessage}</p><button onClick={() => void enableDeviceOrientation()}>Enable Device Orientation</button></div></div>}
                {frameUrl && <img className="last-frame" src={frameUrl} alt="Most recent solve frame; after a plate solution, tap a known object here for calibration" onClick={selectCalibrationTarget}/>}
                {calibrationMarker && <span className="picked-point" style={{ left: calibrationMarker.x, top: calibrationMarker.y }} aria-label="Selected calibration object"/>}
                <div className="reticle"><span /></div>
                <div className="camera-overlay"><span>{detection ? `${detection.stars.length} CANDIDATES` : "NO FRAME ANALYZED"}</span><span>{solution ? "ASTROMETRIC SOLUTION" : "NO PLATE SOLUTION"}</span></div>
              </div>
              <p className="muted status-line" role="status">{cameraMessage}</p>
              <div className="button-row">
                {cameraState === "ready" ? <button className="button secondary" onClick={stopCamera}>Stop camera</button> : <button className="button primary" onClick={() => void startCamera()} disabled={cameraState === "starting"}>{cameraState === "starting" ? "Requestingâ€¦" : `Enable ${cameraFacing === "user" ? "front" : "rear"} camera`}</button>}
                <button className="button secondary" onClick={switchCamera}>Use {cameraFacing === "user" ? "rear" : "front"} camera</button>
                <button className="button secondary" onClick={() => void scanFrame()} disabled={cameraState !== "ready" || cameraFacing !== "environment"}>Scan frame</button>
              </div>
              {detection && <div className="detection-line"><span>REAL FRAME ANALYSIS</span><b>{detection.stars.length} star-like sources</b><small>Background {detection.background.toFixed(1)} Â· threshold {detection.threshold.toFixed(1)} DN</small></div>}

              <div className="online-solve">
                <details>
                  <summary>Optional online plate solve</summary>
                  <p>Astrometry.net receives one still image only when you press Solve. An optional same-origin backend performs the API request so your API key stays server-side. For local use, start with <code>npm run dev:full</code> after setting <code>ASTROMETRY_API_KEY</code>. The app works without the backend, but online plate solving then remains unavailable.</p>
                  <label className="check-label"><input type="checkbox" checked={uploadConsent} onChange={(event) => setUploadConsent(event.target.checked)}/> I understand this still frame will be uploaded to Astrometry.net for solving.</label>
                  <button className="button primary" onClick={() => void solveFrame()} disabled={cameraState !== "ready" || cameraFacing !== "environment" || solveBusy}>{solveBusy ? "Solvingâ€¦" : "Upload still & solve"}</button>
                </details>
                <p className="muted status-line" role="status">{solveMessage}</p>
              </div>
              <canvas ref={canvasRef} className="hidden-canvas" aria-hidden="true"/>
            </section>

            <section className="panel target-panel">
              <div className="panel-heading"><div><p className="eyebrow">02 / DESTINATION</p><h2>Selected target</h2></div>{selected && <span className="target-kind">{(selected.objectType ?? selected.kind.replace("-", " ")).toUpperCase()}</span>}</div>
              {selected ? <>
              <div className="target-title"><div className="target-orb">âœ¦</div><div><h3>{selected.name}</h3><p>{selected.summary}</p></div></div>
              <div className="target-coords"><div><span>RIGHT ASCENSION</span><b>{targetEquatorial ? `${(targetEquatorial.ra * 15).toFixed(3)}Â°` : "N/A"}</b></div><div><span>DECLINATION</span><b>{targetEquatorial ? deg(targetEquatorial.dec) : "N/A"}</b></div></div>
              {selected.aliases && selected.aliases.length > 0 && <p className="muted">Also cataloged as: {selected.aliases.filter((alias) => alias.toLocaleLowerCase() !== selected.id.toLocaleLowerCase() && alias !== selected.name).slice(0, 4).join(", ")}{selected.aliases.length > 5 ? " â€¦" : ""}</p>}
              {selected.kind === "deep-sky" && (selected.magnitude !== undefined || selected.surfaceBrightness !== undefined || selected.sizeMajorArcmin !== undefined || selected.constellation) && <div className="metrics-grid"><Metric label="V MAG" value={selected.magnitude == null ? "N/A" : selected.magnitude.toFixed(2)}/><Metric label="B SURF. BRIGHTNESS" value={selected.surfaceBrightness == null ? "N/A" : `${selected.surfaceBrightness.toFixed(2)} mag/arcsecÂ²`}/><Metric label="MAJOR SIZE" value={selected.sizeMajorArcmin == null ? "N/A" : `${selected.sizeMajorArcmin.toFixed(1)}â€²`}/><Metric label="CONSTELLATION" value={selected.constellation ?? "N/A"}/></div>}
              <button className="text-button" onClick={() => setTab("targets")}>Change target <span>â†—</span></button>

              <div className="rule"/>
              <div className="panel-heading compact"><div><p className="eyebrow">03 / VISIBILITY</p><h2>Right now</h2></div><span className={`pill ${conditions ? "pill-live" : ""}`}>{conditions ? "CALCULATED" : "NO LOCATION"}</span></div>
              {conditions ? <>
                <div className="visibility-state"><span className="visibility-icon">â—‰</span><div><b>{conditions.status}</b><small>{conditions.status === "Below horizon" ? "Target is below the geometric horizon." : conditions.status === "Low altitude" ? "Near the horizon; atmospheric effects may be strong." : conditions.status === "Astronomical twilight" ? "Sun is above âˆ’18Â°; astronomical darkness has not begun." : "Target is above 20Â° and Sun is below âˆ’18Â°. This does not account for Moon, weather or light pollution."}</small></div></div>
                <div className="metrics-grid"><Metric label="TARGET ALT." value={deg(conditions.targetAltitudeDeg)}/><Metric label="TARGET AZ." value={`${conditions.targetAzimuthDeg.toFixed(1)}Â°`}/><Metric label="MOON PHASE" value={moonPhaseName(conditions.moonPhaseAngleDeg)}/><Metric label="MOON ILLUM." value={`${conditions.moonIlluminationPercent.toFixed(0)}%`}/><Metric label="MOON ALT." value={deg(conditions.moonAltitudeDeg)}/><Metric label="MOON SEP." value={`${conditions.moonSeparationDeg.toFixed(1)}Â°`}/></div>
                <details className="event-details"><summary>Rise, set, transit & twilight times Â· local</summary><div className="metrics-grid"><Metric label="TARGET RISE" value={localEventTime(conditions.targetRise)}/><Metric label="TARGET SET" value={localEventTime(conditions.targetSet)}/><Metric label="TARGET TRANSIT" value={localEventTime(conditions.targetTransit)}/><Metric label="MOON RISE / SET" value={`${localEventTime(conditions.moonRise)} / ${localEventTime(conditions.moonSet)}`}/><Metric label="SUN ALTITUDE" value={deg(conditions.sunAltitudeDeg)}/><Metric label="SUNRISE / SUNSET" value={`${localEventTime(conditions.sunRise)} / ${localEventTime(conditions.sunSet)}`}/><Metric label="CIVIL DAWN / DUSK" value={`${localEventTime(conditions.civilDawn)} / ${localEventTime(conditions.civilDusk)}`}/><Metric label="NAUTICAL DAWN / DUSK" value={`${localEventTime(conditions.nauticalDawn)} / ${localEventTime(conditions.nauticalDusk)}`}/><Metric label="ASTRO DAWN / DUSK" value={`${localEventTime(conditions.astronomicalDawn)} / ${localEventTime(conditions.astronomicalDusk)}`}/></div></details>
                <div className="unknown-grid"><span>WEATHER <b>UNAVAILABLE</b></span><span>LIGHT POLLUTION <b>UNAVAILABLE</b></span></div>
              </> : <div className="empty-state"><p>{!location ? "Location is needed for altitude, azimuth and visibility calculations." : "Choose a target to calculate its visibility."}</p>{!location && <button className="button secondary" onClick={requestLocation}>Allow location</button>}<small role="status">{locationMessage}</small></div>}
              </> : <div className="empty-state"><p>No target selected. Choose one when you are ready to explore.</p><button className="button secondary" onClick={() => setTab("targets")}>Choose a target</button></div>}
            </section>
          </div>

          <section className="panel solution-panel">
            <div className="panel-heading"><div><p className="eyebrow">04 / ASTROMETRIC STATUS</p><h2>{solution ? "Plate solution" : "Awaiting a real plate solution"}</h2></div><span className={`pill ${solution ? "pill-live" : ""}`}>{solution ? "SOLVED" : "NO SOLUTION"}</span></div>
            {solution ? <div className="solution-content">
              <div className="solution-coordinate"><span>RA</span><b>{(solution.raDeg / 15).toFixed(5)} h</b></div><div className="solution-coordinate"><span>DEC</span><b>{deg(solution.decDeg)}</b></div>
              <div className="solution-coordinate"><span>FIELD WIDTH</span><b>â‰ˆ {fieldDegrees?.toFixed(2)}Â°</b></div><div className="solution-coordinate"><span>PIXEL SCALE</span><b>{solution.pixelScaleArcsec.toFixed(2)}â€³/px</b></div>
              <div className="solution-note">Astrometry.net job {solution.jobId} Â· parity {solution.parity > 0 ? "+" : "âˆ’"} Â· orientation {solution.orientationDeg.toFixed(2)}Â°</div>
              {targetPixel && Number.isFinite(targetPixel.x) && <div className="solution-note">Selected target projects to pixel {targetPixel.x.toFixed(0)}, {targetPixel.y.toFixed(0)} in this frame {targetPixel.x >= 0 && targetPixel.x <= solution.imageWidth && targetPixel.y >= 0 && targetPixel.y <= solution.imageHeight ? "(inside field)" : "(outside field)"}.</div>}
            </div> : <div className="no-solution"><span className="crosshair">âŒ–</span><div><b>Coordinates are unavailable until an actual solve succeeds.</b><small>Local blind solving is not bundled. Online solve is optional and requires your Astrometry.net API key, internet access and an explicit image upload.</small></div></div>}
            <div className="guide-result">
              {!solution ? <><span className="guide-arrow">â†—</span><div><b>Push-to guidance is locked</b><small>A valid plate solution and telescope-axis calibration are required. Phone compass orientation alone is not used.</small></div></> : !fit || fit.retainedIndexes.length < 5 ? <><span className="guide-arrow">â—Ž</span><div><b>Calibration required</b><small>Add five or more solved calibration pairs across the sky; excluded outliers do not count. {Math.max(0, 5 - (fit?.retainedIndexes.length ?? 0))} more retained point{fit?.retainedIndexes.length === 4 ? "" : "s"} needed.</small></div></> : !validation ? <><span className="guide-arrow">â—Ž</span><div><b>Independent validation required</b><small>Validate this fit against a fixed target that was not used during calibration.</small></div></> : validation.residualDeg > 0.5 ? <><span className="guide-arrow">!</span><div><b>Validation failed Â· recalibration required</b><small>Error {validation.residualDeg.toFixed(2)}Â°. The phone mount may have shifted. Repeat the calibration before relying on guidance.</small></div></> : !targetEquatorial ? <><span className="guide-arrow">â—Ž</span><div><b>Target position unavailable</b><small>Allow location for the current topocentric position of this Solar System target.</small></div></> : guide?.directionAmbiguous ? <><span className="guide-arrow">!</span><div><b>Move direction is ambiguous</b><small>The target is almost exactly opposite the measured direction. Use a finder to move toward a closer sky region, then scan again.</small></div></> : guide ? <><span className="guide-arrow" style={!guide.centered ? { transform: `rotate(${Math.atan2(guide.eastErrorDeg, guide.northErrorDeg) * 180 / Math.PI}deg)` } : undefined}>{guide.centered ? "âœ“" : "â†‘"}</span><div><b>{guide.centered ? "TARGET CENTERED" : `Residual ${guide.residualDeg.toFixed(2)}Â°`}</b><small>{guide.centered ? `Measured residual ${guide.residualDeg.toFixed(2)}Â° is inside the 0.25Â° tolerance.` : `Measured from the calibrated scope direction. Move approximately ${Math.abs(guide.eastErrorDeg).toFixed(2)}Â° ${guide.eastErrorDeg >= 0 ? "east" : "west"} and ${Math.abs(guide.northErrorDeg).toFixed(2)}Â° ${guide.northErrorDeg >= 0 ? "north" : "south"} in the sky tangent plane, then scan again.`}</small></div></> : null}
            </div>
          </section>

          <section className="panel calibration-panel">
            <div className="panel-heading"><div><p className="eyebrow">05 / OPTICAL ALIGNMENT</p><h2>Precision calibration</h2></div><span className="pill">{calibrationPoints.length} POINT{calibrationPoints.length === 1 ? "" : "S"}</span></div>
            <p className="panel-copy">The camera center and telescope optical axis are not assumed to align. Select a fixed catalog object, solve a frame, center that object in the eyepiece, and tap it in the solved image. The tap checks object identity against the WCS; the fit maps the camera center direction to the telescope-centered object direction.</p>
            <div className="calibration-form"><div className="catalog-coordinate"><span>SELECTED TARGET</span><b>{!selected ? "Choose a fixed catalog target" : selected.body || selected.raDeg === null || selected.decDeg === null ? `${selected.id} Â· fixed target required` : `${selected.id} Â· RA ${(selected.raDeg / 15).toFixed(5)} h Â· Dec ${deg(selected.decDeg)}`}</b></div><button className="button primary" onClick={addCalibrationPoint} disabled={!selected || !solution || !calibrationPixel || Boolean(selected?.body)}>Add solved point</button></div>
            <p className="muted">After a successful solve, tap the selected fixed target in the camera still. The marker confirms the point used to check object identity against the WCS.</p>
            {selected?.body && <p className="inline-warning">For calibration, select a fixed deep-sky target with known coordinates. Planetary positions move and are not accepted as fixed catalog directions.</p>}
            {fit && <div className="calibration-quality"><div><span>MEAN / RMS</span><b>{fit.meanDeg.toFixed(3)}Â° / {fit.rmsDeg.toFixed(3)}Â°</b></div><div><span>WORST FIT RESIDUAL</span><b>{fit.worstDeg.toFixed(3)}Â°</b></div><div><span>POINTS FIT / TOTAL</span><b>{fit.retainedIndexes.length} / {fit.points.length}</b></div><div><span>FIT CHECK</span><b>{fit.retainedIndexes.length >= 5 && fit.rmsDeg < 0.25 ? "GOOD" : "PRELIMINARY"}</b></div></div>}
            {fit && fit.retainedIndexes.length >= 5 && <div className="validation-row"><div><b>Independent validation</b><small>{validation ? `${validation.targetId} Â· ${validation.residualDeg.toFixed(2)}Â° residual` : "Choose an unused fixed target, solve a frame, and tap it in the image."}</small></div><button className="button secondary" onClick={validateCalibration} disabled={!selected || !solution || !calibrationPixel || Boolean(selected?.body) || calibrationPoints.some((point) => point.label.startsWith(`${selected?.id} `))}>Validate target</button></div>}
            {calibrationPoints.length > 0 && <ul className="point-list">{calibrationPoints.map((point, index) => { const retained = !fit || fit.retainedIndexes.includes(index); const residual = fit ? angularSeparationDeg(rotateVector(fit.quaternion, point.camera), point.telescope) : null; return <li key={point.createdAt}><span>{index + 1}. {point.label}{!retained && <b className="point-warning">BAD CALIBRATION POINT Â· {residual?.toFixed(2)}Â° Â· REPEAT</b>}</span><button aria-label={`Remove point ${index + 1}`} onClick={() => removeCalibrationPoint(index)}>Remove</button></li>; })}</ul>}
            {calibrationPoints.length > 0 && <button className="text-button clear-calibration" onClick={clearCalibration}>Clear calibration</button>}
            <small className="muted">Calibration is saved on this device. Validate on an independent target. The app cannot directly detect a phone-to-telescope shift; clear and repeat calibration after any mount movement.</small>
          </section>

          <section className="panel equipment-panel">
            <div className="panel-heading"><div><p className="eyebrow">06 / TELESCOPE</p><h2>Optics setup</h2></div></div>
            <p className="muted">For the Sky-Watcher BK P15075 150/750 variant, the manufacturer lists 150 mm aperture and 750 mm focal length. Check the model label before applying it; other 150P variants differ. <a href="https://www.skywatcher.com/product/bk-p15075-eq3-wsteel-tripod/" target="_blank" rel="noreferrer">Manufacturer specifications</a></p>
            <button className="button secondary" onClick={() => setTelescope((old) => ({ ...old, apertureMm: 150, focalLengthMm: 750 }))}>Use 150/750 preset</button>
            <div className="equipment-fields"><NumberField label="Aperture" unit="mm" value={telescope.apertureMm} onChange={(value) => setTelescope((old) => ({ ...old, apertureMm: value }))}/><NumberField label="Focal length" unit="mm" value={telescope.focalLengthMm} onChange={(value) => setTelescope((old) => ({ ...old, focalLengthMm: value }))}/><NumberField label="Eyepiece" unit="mm" value={telescope.eyepieceMm} onChange={(value) => setTelescope((old) => ({ ...old, eyepieceMm: value }))}/><NumberField label="Eyepiece apparent field" unit="Â°" value={telescope.eyepieceApparentFieldDeg} onChange={(value) => setTelescope((old) => ({ ...old, eyepieceApparentFieldDeg: value }))}/></div>
            <div className="magnification"><span>MAGNIFICATION</span><b>{calculatedMagnification ? `${calculatedMagnification.toFixed(1)}Ã—` : "N/A"}</b><span>TRUE FIELD â‰ˆ</span><b>{trueFieldDegrees ? `${trueFieldDegrees.toFixed(2)}Â°` : "N/A"}</b><span>EXIT PUPIL</span><b>{calculatedExitPupil ? `${calculatedExitPupil.toFixed(2)} mm` : "N/A"}</b><small>Magnification = telescope focal length Ã· eyepiece focal length. True field uses apparent field Ã· magnification as an approximation.</small></div>
          </section>
        </>}

        {tab === "targets" && <section className="panel library-panel">
          <div className="panel-heading"><div><p className="eyebrow">OBJECT CATALOG</p><h2>Choose a destination</h2></div><span className="pill">{catalogState === "ready" ? `OPENNGC Â· ${catalogObjects.length.toLocaleString()} OBJECTS` : catalogState === "loading" ? "LOADING CATALOG" : catalogState === "error" ? "CATALOG ERROR" : "MESSIER STARTER SET"}</span></div>
          <label className="search-field"><span>âŒ•</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search M31, Orion, Jupiterâ€¦"/></label>
          <div className="target-filters" role="group" aria-label="Filter targets">
            {[{ id: "all", label: "All targets" }, { id: "deep-sky", label: "Deep sky" }, { id: "planet", label: "Planets" }, { id: "moon", label: "Moon" }].map((category) => <button key={category.id} className={targetCategory === category.id ? "active" : ""} onClick={() => setTargetCategory(category.id)}>{category.label}</button>)}
          </div>
          {catalogState === "loading" && <p className="muted" role="status">Loading the licensed offline NGC/IC catalog in a worker. The list will update when parsing finishes.</p>}
          {catalogState === "error" && <div className="empty-state"><p>{catalogError}</p><button className="button secondary" onClick={() => { setCatalogError(""); setCatalogState("idle"); }}>Retry catalog load</button></div>}
          <div className="target-list">{visibleTargets.map((target) => <button key={target.id} className={`target-row ${selected?.id === target.id ? "selected" : ""}`} onClick={() => { setSelected(target); setTab("guide"); }}><span className={`catalog-symbol ${target.kind}`}>{target.kind === "planet" ? "â—" : target.kind === "moon" ? "â—" : "âœ¦"}</span><span><b>{target.name}</b><small>{target.summary}</small></span><span className="catalog-id">{target.id}<small>VIEW IN AR</small></span></button>)}{categoryTargets.length === 0 && <p className="muted">No matching target in this category.</p>}</div>
          {categoryTargets.length > visibleTargets.length && <p className="muted">Showing {visibleTargets.length} of {categoryTargets.length.toLocaleString()} matches. Refine the search to narrow the list.</p>}
          <p className="panel-copy">Fixed-object coordinates, aliases and available magnitudes/sizes come from the local OpenNGC catalog. Planet and Moon positions use current ephemerides. Coordinates do not imply visibility.</p>
          <p className="muted">OpenNGC by Mattia Verga and contributors Â· CC BY-SA 4.0 Â· <a href="/catalog/README.md" target="_blank" rel="noreferrer">Catalog attribution and license</a></p>
        </section>}

        {tab === "tonight" && <section className="panel tonight-panel">
          <div className="panel-heading"><div><p className="eyebrow">OBSERVING CONDITIONS</p><h2>Tonight</h2></div><span className="pill">{now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></div>
          <p className="panel-copy">Local sky times use your device clock and an approximate location fix. Weather and light pollution are not included.</p>
          {!location && <div className="empty-state"><p>Allow location to calculate altitude, azimuth, visibility and rise/set times for your observing site.</p><button className="button secondary" onClick={requestLocation}>Allow location</button><small role="status">{locationMessage}</small></div>}
          {location && !selected && <div className="empty-state"><p>Your observing location is ready. Select a target to see when it is best placed tonight.</p><button className="button secondary" onClick={() => setTab("targets")}>Choose a target</button></div>}
          {location && selected && conditions && <>
            <div className="tonight-target"><span className="target-orb">âœ¦</span><div><small>SELECTED TARGET</small><h3>{selected.name}</h3><p>{conditions.status}</p></div><button className="text-button" onClick={() => setTab("guide")}>View in AR</button></div>
            <div className="metrics-grid"><Metric label="ALTITUDE" value={deg(conditions.targetAltitudeDeg)}/><Metric label="AZIMUTH" value={`${conditions.targetAzimuthDeg.toFixed(1)}Â°`}/><Metric label="RISES" value={localEventTime(conditions.targetRise)}/><Metric label="SETS" value={localEventTime(conditions.targetSet)}/><Metric label="TRANSIT" value={localEventTime(conditions.targetTransit)}/><Metric label="MOON ILLUMINATION" value={`${conditions.moonIlluminationPercent.toFixed(0)}%`}/><Metric label="MOON ALTITUDE" value={deg(conditions.moonAltitudeDeg)}/><Metric label="MOON SEPARATION" value={`${conditions.moonSeparationDeg.toFixed(1)}Â°`}/></div>
            <details className="event-details"><summary>Twilight and solar times Â· local</summary><div className="metrics-grid"><Metric label="SUN ALTITUDE" value={deg(conditions.sunAltitudeDeg)}/><Metric label="SUNRISE" value={localEventTime(conditions.sunRise)}/><Metric label="SUNSET" value={localEventTime(conditions.sunSet)}/><Metric label="ASTRONOMICAL DAWN" value={localEventTime(conditions.astronomicalDawn)}/><Metric label="ASTRONOMICAL DUSK" value={localEventTime(conditions.astronomicalDusk)}/></div></details>
            <p className="muted">{location.accuracyMeters ? `Location accuracy Â±${Math.round(location.accuracyMeters)} m.` : "Location accuracy unavailable."} These calculations do not account for terrain, clouds or local obstructions.</p>
          </>}
        </section>}

        {tab === "setup" && <>
          <section className="panel setup-panel">
            <div className="panel-heading"><div><p className="eyebrow">FIELD SETUP</p><h2>Prepare the telescope</h2></div><span className="pill">MANUAL MOUNT</span></div>
            <ol className="setup-steps"><li><b>Mount the phone securely.</b><span>Fix the phone rigidly to the tube so it cannot rotate or slide. Recalibrate the optical offset if the clamp moves.</span></li><li><b>Allow camera access.</b><span>Use Safari over HTTPS. The front camera starts first; switch to the rear camera to scan or solve the sky.</span></li><li><b>Allow location.</b><span>Location is requested when you tap Align or Request location. It stays in memory for this session.</span></li><li><b>Calibrate the compass.</b><span>Keep the phone away from magnets and move it in a figure eight if heading drifts. Browser compass calibration is controlled by the device.</span></li><li><b>Calibrate the optical offset.</b><span>Use several well-separated fixed targets. Center each target in the eyepiece while its rear-camera sky frame is solved.</span></li></ol>
          </section>
          <section className="panel diagnostics-panel sensor-readings-panel">
            <div className="panel-heading"><div><p className="eyebrow">LIVE PHONE SENSORS</p><h2>Device readings</h2></div><div className="button-row"><button className="button secondary" onClick={() => void enableDeviceOrientation()}>Refresh permission</button><button className="button secondary" onClick={() => { setMobileToolsOpen(true); setTab("guide"); }}>Optical calibration</button></div></div>
            <p className="panel-copy" role="status">{sensorMessage}</p>
            <div className="sensor-grid">
              <Metric label="COMPASS HEADING" value={sensorData.headingDeg === null ? sensorData.headingSource : `${sensorData.headingDeg.toFixed(1)}Â° Â· ${sensorData.headingSource}`}/>
              <Metric label="PHONE TILT / ROLL" value={`${sensorData.tiltDeg === null ? "N/A" : `${sensorData.tiltDeg.toFixed(1)}Â°`} / ${sensorData.rollDeg === null ? "N/A" : `${sensorData.rollDeg.toFixed(1)}Â°`}`}/>
              <Metric label="ACCELERATION + GRAVITY" value={sensorData.acceleration ? `${sensorData.acceleration.x?.toFixed(2) ?? "--"}, ${sensorData.acceleration.y?.toFixed(2) ?? "--"}, ${sensorData.acceleration.z?.toFixed(2) ?? "--"} m/sÂ²` : "Not exposed yet"}/>
              <Metric label="GYROSCOPE RATE" value={sensorData.rotationRate ? `${sensorData.rotationRate.alpha?.toFixed(1) ?? "--"}, ${sensorData.rotationRate.beta?.toFixed(1) ?? "--"}, ${sensorData.rotationRate.gamma?.toFixed(1) ?? "--"} Â°/s` : "Not exposed yet"}/>
              <Metric label="MAGNETIC FIELD" value={sensorData.magneticField ? `${sensorData.magneticField.x?.toFixed(1)}, ${sensorData.magneticField.y?.toFixed(1)}, ${sensorData.magneticField.z?.toFixed(1)} ÂµT` : "Raw values unavailable"}/>
              <Metric label="BAROMETER" value={sensorData.pressureRaw === null ? "Not exposed by browser" : `${sensorData.pressureRaw.toFixed(1)} raw units`}/>
              <Metric label="GPS / GNSS" value={location ? `Location Â±${Math.round(location.accuracyMeters)} m` : "Location not requested"}/>
              <Metric label="PHONE TIME" value={now.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}/>
            </div>
            <div className="limitations"><b>Sensor and camera limits</b><p>Compass alignment depends on the phone's own calibration; this page cannot force recalibration. The browser provides a location estimate but no raw GNSS satellite list. This app draws a 2D sky overlay, not camera-registered AR. OIS status and controls are not exposed here. The star-map overlay is not an astrometric camera solve.</p></div>
          </section>
          <section className="panel diagnostics-panel">
            <div className="panel-heading"><div><p className="eyebrow">COMPATIBILITY & LIMITATIONS</p><h2>Device diagnostics</h2></div></div>
            <div className="diagnostics-list">{capabilityList.map((capability) => <div key={capability.name} className="diagnostic-row"><span className={`diagnostic-icon ${capability.state}`}>{capability.state === "available" ? "âœ“" : capability.state === "limited" ? "!" : "Ã—"}</span><div><b>{capability.name}</b><small>{capability.detail}</small></div><span className="diagnostic-state">{capability.state.toUpperCase()}</span></div>)}</div>
            <div className="limitations"><b>Unavailable data</b><p>Weather, seeing and light-pollution estimates are shown as unavailable. The app does not request those services or invent values. Safari camera exposure controls vary by device; a live video frame may not show enough stars for a solve.</p></div>
          </section>
          <section className="panel location-panel"><div className="panel-heading"><div><p className="eyebrow">LOCATION</p><h2>Observer position</h2></div></div><p className="panel-copy">Precise location is only requested after your action and is not saved.</p>{location && <div className="location-value"><span>AVAILABLE Â· Â±{Math.round(location.accuracyMeters)} m accuracy</span><button className="text-button" onClick={() => { setLocation(null); setLocationMessage("Location cleared from this session."); }}>Clear</button></div>}<p className="muted status-line" role="status">{locationMessage}</p><button className="button secondary" onClick={requestLocation}>Request location</button></section>
        </>}

        <footer className="footer"><span>EXPLORER SENSE <b>0.1.0</b></span><span>ASTRONOMY WITHOUT GUESSWORK</span><span>LOCAL TIME {now.toLocaleTimeString()}</span></footer>
      </main>
    </div>);
}
function Metric({ label, value }) {
    return <div className="metric"><span>{label}</span><b>{value}</b></div>;
}
function NumberField({ label, unit, value, onChange }) {
    return <label>{label}<div className="unit-input"><input type="number" min="0" step="any" value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}/><span>{unit}</span></div></label>;
}
export { App };

