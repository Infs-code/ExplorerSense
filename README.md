# Explorer Sense

Explorer Sense is a JavaScript/JSX mobile web app for exploring the night sky from a phone. Its portrait view is a full-screen star chart with a compass heading, time and touch controls, plus a small live camera preview. It is designed for mobile browsers and can be added to the phone's home screen.

## Current implementation

The app currently provides:

- Front-camera video starts as the default after a user tap; a front/rear switch is available. The rear camera is required to scan or plate-solve the sky.
- A full-screen portrait chart plots a curated set of bright stars and constellation lines. With location and an absolute device heading, stars are projected into the local horizon view; without those readings, the chart is labeled as a preview.
- User-initiated device-orientation and motion access. The UI reports heading/tilt, accelerometer and gyroscope readings, and raw magnetometer values when the browser exposes them.
- Location, local device time and explicit capability reporting. Location remains in memory for the session.
- Installed PWA presentation with standalone display, iPhone safe-area support and a compact full-screen observing view.
- Real image processing for compact bright-source detection: grayscale luminance, robust background/noise estimate, local maxima, centroid, flux, size, saturation rejection and signal-to-noise ranking. Detection runs in a Web Worker where supported.
- An optional, user-initiated Astrometry.net API workflow. The user checks an upload disclosure and presses the solve button. A same-origin Node proxy keeps the Astrometry.net key server-side, and sends the still image privately (`publicly_visible: n`) to the service; the API returns a real field center, scale, orientation and parity.
- A TAN-plane pixel-to-sky transform using the returned center, pixel scale, orientation and parity. The calibration API does not provide the full distortion model, so wide-angle edge coordinates remain approximate.
- Spherical vector operations, J2000-to-date precession, horizontal coordinates, Solar System ephemerides, target/Sun/Moon rise and set, target transit, civil/nautical/astronomical twilight, lunar phase and illumination, altitude/azimuth and Moon separation.
- A lazy-loaded OpenNGC NGC/IC catalog with Messier cross-references, common-name search, object types and available V magnitude/surface-brightness/size data. Search results are parsed in a Worker and capped at 50 visible rows.
- Current Solar System targets, telescope/eyepiece configuration, magnification, approximate true field, exit pupil, IndexedDB-backed calibration/settings and offline shell/catalog caching after first download.
- 3D camera-to-scope alignment fitting with quaternion/Wahba least squares, robust outlier rejection, residual reporting and an independent validation step.
- Push-to guidance only after a real plate solution, at least five retained calibration points and an independent validation residual of 0.5° or less. “TARGET CENTERED” reports the measured residual against a 0.25° tolerance.

## Known limits

- There is no offline blind plate solver or bundled full-sky star index. The app shell, astronomy calculations and OpenNGC object catalog can work offline after they have been downloaded once.
- Online solving requires an Astrometry.net API key, the optional Node proxy and internet. A static PWA deployment needs a same-origin `/api/solve` reverse-proxy route to the Node service. The app reports configuration and service errors instead of claiming a solve.
- A phone's live video exposure may be too short to show enough stars, especially in city skies. Safari does not consistently expose camera shutter/ISO controls to web apps.
- Calibration input uses fixed targets with catalog coordinates. Each point must be solved, centered in the eyepiece and tapped in the corresponding image. Use at least five widely separated targets, then validate on an unused target.
- Device heading and motion are not a plate solution and do not prove target centering. The app currently shows a sensor-aligned 2D sky map, not camera-registered AR or AstroHopper-style calibrated telescope tracking.
- Browser geolocation does not reveal whether the location came from GNSS, Wi-Fi or cellular networks, and it does not provide satellite data. Raw magnetometer and barometer readings are only shown if the browser exposes their sensor APIs.
- Compass calibration is controlled by the operating system. Keep magnetic cases and accessories away; a figure-eight movement may help the phone recalibrate. The app cannot force recalibration.
- Browser camera APIs do not expose optical image stabilization status or controls here. Actual stabilization is managed by the phone camera system.
- Rescanning is user initiated after each telescope movement. The app does not yet schedule automatic movement-triggered solves.
- The calibration response does not include a formal fit confidence or full WCS distortion terms. Field center and scale are the service's result; edge projection is approximate. A numeric solver confidence is therefore not shown.
- No local weather, seeing or light-pollution data source is configured. Those fields remain `UNAVAILABLE`.
- The UI has not been exercised on a physical phone during this implementation. Camera, installation and sensor behavior still need target-hardware validation.
- The offline catalog covers OpenNGC's NGC/IC objects and related Messier cross-references. It is not a complete Gaia/HIP/HD/WDS or minor-planet catalog. Fixed-object positions are J2000 catalog positions; planet and Moon ephemerides are calculated for the current time and observer.
- Numeric sky-quality scores, filter support, object distances, and target-specific eyepiece recommendations are not implemented. OpenNGC provides V magnitude, B-band surface brightness, and angular size for some catalog entries; missing values are not inferred. The app reports actual geometry and events but does not rank targets using unavailable weather or light-pollution data.

## Run it

Requirements: Node.js 20 or later and npm.

```sh
npm install
npm run dev
```

Vite prints a local URL. Camera permission works on `localhost`; remote phone use requires serving the built app over HTTPS.

To enable online solving in local development, set `ASTROMETRY_API_KEY` in the environment and run both the Vite app and private API proxy:

```powershell
$env:ASTROMETRY_API_KEY = "your Astrometry.net key"
npm run dev:full
```

The proxy binds to `127.0.0.1:8787`; the Vite server forwards `/api/solve` to it. For deployment, keep the key in the server environment and route `/api/solve` and `/api/solve/status` to this backend over HTTPS. Do not expose the proxy to the public internet without access controls and rate limits.

```sh
npm test
npm run build
npm run preview
```

The app and tests are JavaScript/JSX. Vite handles JSX during the production build.

## Publish to GitHub Pages

The included GitHub Actions workflow builds and deploys the static app whenever code is pushed to `main`:

1. Create a public GitHub repository and push this project to its `main` branch.
2. In the repository, open **Settings → Pages** and set the build source to **GitHub Actions**.
3. Wait for the **Build and deploy to GitHub Pages** workflow to finish. The Actions run shows the public site URL.
4. On your iPhone, open that HTTPS URL in Safari, tap **Share → Add to Home Screen**, enable **Open as Web App** if it appears, then tap **Add**.

The workflow handles the repository subpath so the PWA files and offline catalog load correctly from `username.github.io/repository/`. GitHub Pages is static hosting: camera, catalog and astronomy features work there, while online plate solving still needs a separately hosted Node proxy. Keep the Astrometry.net key in that server's environment; never commit it to GitHub.

## Install as a PWA

The app's `standalone` manifest opens it without Safari's browser chrome after you add it to the Home Screen. The service worker caches the app shell and same-origin assets after the first online visit; the OpenNGC CSV is cached after the catalog is first opened. The plate solver remains internet-dependent and requires its separate backend.

## Field setup with a Sky-Watcher 150P

1. In Optics setup, confirm your exact telescope variant. The preset applies 150 mm / 750 mm only for the manufacturer's BK P15075 150/750 variant; Quattro 150P is a different 150/600 model. Enter the eyepiece focal length and apparent field if known.
2. Secure the iPhone to the telescope tube so it cannot slip or rotate. The camera must remain rigidly fixed during a session.
3. In Live guide, enable the rear camera and allow location if you want horizon and visibility calculations.
4. For a plate solution, open Optional online plate solve, enter your Astrometry.net API key, check the disclosure, and press Upload still & solve. A solve sends one still image only when you explicitly request it.
5. For each calibration point, choose a fixed catalog target, solve a frame, center that same object in the eyepiece, tap it in the still image, and add the pair. Use five or more points distributed across the sky.
6. Validate on a target that was not used in the fit. If the residual exceeds 0.5°, the app locks guidance and asks for recalibration.
7. Select a target, solve again after each manual telescope movement, and read the measured residual and sky-plane direction. The app never infers mount motion from phone orientation alone.

## Privacy and data sources

Camera images are processed locally for star detection. They are not uploaded unless the user explicitly opens online solving, checks the disclosure and presses the solve button. The Astrometry.net key is held by the optional backend process, never sent to the browser or written to application logs. Geolocation is requested after a button press and remains in page memory. Telescope values and calibration are saved in IndexedDB on the device, with localStorage fallback and migration for older app data.

Solar System calculations use [Astronomy Engine](https://github.com/cosinekitty/astronomy), which supports browser use and ephemeris/horizon calculations. Online plate solving uses the [Astrometry.net API](https://astrometry.net/doc/net/api.html). The 150/750 preset is tied to the manufacturer listing for [Sky-Watcher BK P15075](https://www.skywatcher.com/product/bk-p15075-eq3-wsteel-tripod/). The included [OpenNGC catalog snapshot](https://github.com/mattiaverga/OpenNGC) is pinned to commit `75ca7ff090e1d0081a5b08be70eb3bc45ccd9e06` and redistributed under CC BY-SA 4.0; its attribution and license are included in `public/catalog/`. The app includes no third-party astronomical images.

Explorer Sense application source is MIT licensed; the catalog remains under its separate CC BY-SA 4.0 license. See `LICENSE` and `public/catalog/README.md`.

## Development

See [docs/architecture.md](docs/architecture.md) for module boundaries and measurement flow.
