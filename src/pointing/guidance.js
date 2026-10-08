import { dot, normalize, vectorToRaDec } from "../astronomy/vectors.js";
import { rotateVector } from "../calibration/attitude.js";
export function pointingGuidance(cameraDirection, targetDirection, cameraToTelescope, centerToleranceDeg = 0.25) {
    const telescopeDirection = rotateVector(cameraToTelescope, normalize(cameraDirection));
    const target = normalize(targetDirection);
    const telescope = vectorToRaDec(telescopeDirection);
    const ra = (telescope.raDeg * Math.PI) / 180;
    const dec = (telescope.decDeg * Math.PI) / 180;
    const east = [-Math.sin(ra), Math.cos(ra), 0];
    const north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
    const cosine = Math.max(-1, Math.min(1, dot(telescopeDirection, target)));
    const eastComponent = east[0] * target[0] + east[1] * target[1] + east[2] * target[2];
    const northComponent = north[0] * target[0] + north[1] * target[1] + north[2] * target[2];
    const sine = Math.hypot(eastComponent, northComponent);
    const residualRadians = Math.atan2(sine, cosine);
    const residualDeg = (residualRadians * 180) / Math.PI;
    const directionAmbiguous = cosine < 0 && sine <= 1e-12;
    const eastErrorDeg = sine > 1e-12 ? ((residualRadians * eastComponent) / sine * 180) / Math.PI : 0;
    const northErrorDeg = sine > 1e-12 ? ((residualRadians * northComponent) / sine * 180) / Math.PI : 0;
    return { telescopeDirection, targetDirection: target, residualDeg, eastErrorDeg, northErrorDeg, directionAmbiguous, centered: residualDeg <= centerToleranceDeg };
}
