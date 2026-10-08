export function magnification(telescopeFocalLengthMm, eyepieceFocalLengthMm) {
    if (!telescopeFocalLengthMm || !eyepieceFocalLengthMm || telescopeFocalLengthMm <= 0 || eyepieceFocalLengthMm <= 0)
        return null;
    if (!Number.isFinite(telescopeFocalLengthMm) || !Number.isFinite(eyepieceFocalLengthMm))
        return null;
    return telescopeFocalLengthMm / eyepieceFocalLengthMm;
}
export function approximateTrueFieldDeg(apparentFieldDeg, magnificationValue) {
    if (!apparentFieldDeg || !magnificationValue || apparentFieldDeg <= 0 || apparentFieldDeg > 180 || magnificationValue <= 0)
        return null;
    if (!Number.isFinite(apparentFieldDeg) || !Number.isFinite(magnificationValue))
        return null;
    return apparentFieldDeg / magnificationValue;
}
export function exitPupilMm(apertureMm, magnificationValue) {
    if (!apertureMm || !magnificationValue || apertureMm <= 0 || magnificationValue <= 0)
        return null;
    if (!Number.isFinite(apertureMm) || !Number.isFinite(magnificationValue))
        return null;
    return apertureMm / magnificationValue;
}
