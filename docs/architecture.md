# Architecture

## Runtime flow

```text
Browser camera
    ├── live preview
    └── manual still capture → downscale → luminance/source detection in Web Worker
                                  └── explicit same-origin proxy request → Astrometry.net job
                                                                          └── center/scale/orientation/parity
                                                                     ├── TAN pixel ↔ sky projection
                                                                     ├── target projection
                                                                     └── camera direction for calibration

Fixed catalog targets + Solar System ephemerides
    └── current equatorial direction → local horizon / Sun / Moon context

Camera-center ↔ eyepiece-centered direction samples
    └── robust Wahba quaternion fit → independent target validation
                                          └── measured residual and tangent-plane guidance
```

## Modules

- `src/App.jsx`: screen-level state and user workflows. Permission requests, capture/solve/calibrate actions are initiated by the user. Mobile styling presents this as a full-screen observing view with bottom navigation.
- `src/camera/detectStars.js`: real pixel-based source extraction and quality filters.
- `src/camera/detectStarsWorker.js`, `src/workers/star.worker.js`: off-main-thread image analysis where Worker is available.
- `src/plateSolver/astrometryNet.js`: private single-frame request to the same-origin solver proxy, progress polling and result validation.
- `server/astrometry.mjs`: optional server-side API-key login, private single-frame upload, job polling and calibration return. The key is read from the server environment and is not sent to the browser.
- `src/plateSolver/wcs.js`: TAN projection from returned solution parameters. It does not invent distortion coefficients.
- `src/astronomy/vectors.js`: normalized 3D directions and spherical separation.
- `src/astronomy/coordinates.js`: precession, horizontal coordinates and topocentric Solar System positions using Astronomy Engine.
- `src/astronomy/conditions.js`: calculated altitude/azimuth, target/Sun/Moon rise/set, target transit, twilight, lunar phase/illumination and Moon separation. Weather and light pollution remain unavailable.
- `src/calibration/attitude.js`: quaternion attitude fit and robust residual-based outlier rejection.
- `src/pointing/guidance.js`: calibrated camera-to-telescope mapping and sky tangent-plane pointing error.
- `src/catalog/targets.js`, `src/catalog/openNgc.js`, `src/catalog/load.js`: curated fixed targets, lazy OpenNGC CSV parsing/search, metadata extraction and dynamic Solar System targets. `src/workers/catalog.worker.js` keeps the full-catalog parse off the UI thread.
- `src/storage/local.js`: IndexedDB-backed telescope and calibration state, with localStorage fallback and migration.
- `public/catalog/OpenNGC.csv`: pinned OpenNGC source snapshot under CC BY-SA 4.0; see the colocated attribution and license notice.
- `public/service-worker.js`: path-scoped app-shell/runtime asset cache for GitHub Pages; the object catalog is cached after its first download, while online solving is not cached or represented as offline-capable.

## Measurement contract

Plate-center and image-derived astrometric coordinates come from the online plate solver. Fixed-object coordinates and aliases come from OpenNGC; Solar System coordinates come from Astronomy Engine. Star counts come from the captured frame. Visibility values require actual location permission and an astronomical calculation. Target-centered status requires a current solve, at least five retained calibration samples and a successful independent validation. Weather and light-pollution values are not estimated.

## Important limitation

The plate solver's JSON calibration endpoint returns a center, pixel scale, orientation and parity, but not the full SIP distortion model or a formal fit residual. The app uses the documented solution values for a center-referenced TAN projection and labels its edge limitations. Do not use projected field-edge locations as precision measurements until full WCS output and lens distortion correction are integrated.
