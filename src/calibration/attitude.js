import { angularSeparationDeg, normalize, raDecToVector } from "../astronomy/vectors.js";
function largestEigenvector(matrix) {
    const a = matrix.map((row) => [...row]);
    const v = Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, col) => row === col ? 1 : 0));
    for (let iteration = 0; iteration < 80; iteration += 1) {
        let p = 0;
        let q = 1;
        let maximum = Math.abs(a[p][q]);
        for (let row = 0; row < 4; row += 1) {
            for (let col = row + 1; col < 4; col += 1) {
                if (Math.abs(a[row][col]) > maximum) {
                    maximum = Math.abs(a[row][col]);
                    p = row;
                    q = col;
                }
            }
        }
        if (maximum < 1e-12)
            break;
        const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        for (let k = 0; k < 4; k += 1) {
            const apk = a[p][k];
            const aqk = a[q][k];
            a[p][k] = c * apk - s * aqk;
            a[q][k] = s * apk + c * aqk;
            const vkp = v[k][p];
            const vkq = v[k][q];
            v[k][p] = c * vkp - s * vkq;
            v[k][q] = s * vkp + c * vkq;
        }
        for (let k = 0; k < 4; k += 1) {
            const apk = a[k][p];
            const aqk = a[k][q];
            a[k][p] = c * apk - s * aqk;
            a[k][q] = s * apk + c * aqk;
        }
    }
    let index = 0;
    for (let i = 1; i < 4; i += 1)
        if (a[i][i] > a[index][index])
            index = i;
    const quaternion = [v[0][index], v[1][index], v[2][index], v[3][index]];
    const norm = Math.hypot(...quaternion);
    const result = quaternion.map((component) => component / norm);
    return result[0] < 0 ? [-result[0], -result[1], -result[2], -result[3]] : result;
}
export function rotateVector(q, vector) {
    const [w, x, y, z] = q;
    const qv = [x, y, z];
    const uv = [qv[1] * vector[2] - qv[2] * vector[1], qv[2] * vector[0] - qv[0] * vector[2], qv[0] * vector[1] - qv[1] * vector[0]];
    const uuv = [qv[1] * uv[2] - qv[2] * uv[1], qv[2] * uv[0] - qv[0] * uv[2], qv[0] * uv[1] - qv[1] * uv[0]];
    return normalize([vector[0] + 2 * (w * uv[0] + uuv[0]), vector[1] + 2 * (w * uv[1] + uuv[1]), vector[2] + 2 * (w * uv[2] + uuv[2])]);
}
function fitQuaternion(points) {
    const b = Array.from({ length: 3 }, () => [0, 0, 0]);
    for (const point of points) {
        const camera = normalize(point.camera);
        const telescope = normalize(point.telescope);
        for (let row = 0; row < 3; row += 1)
            for (let col = 0; col < 3; col += 1)
                b[row][col] = b[row][col] + camera[row] * telescope[col];
    }
    const sigma = b[0][0] + b[1][1] + b[2][2];
    const z = [b[1][2] - b[2][1], b[2][0] - b[0][2], b[0][1] - b[1][0]];
    const k = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    k[0][0] = sigma;
    for (let i = 0; i < 3; i += 1) {
        k[0][i + 1] = z[i];
        k[i + 1][0] = z[i];
        for (let j = 0; j < 3; j += 1)
            k[i + 1][j + 1] = b[i][j] + b[j][i] - (i === j ? sigma : 0);
    }
    return largestEigenvector(k);
}
function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}
export function fitAttitude(points, outlierFloorDeg = 0.15) {
    if (points.length < 3)
        throw new RangeError("At least three calibration points are required to estimate a 3D rotation.");
    let retained = points.map((_, index) => index);
    let quaternion = fitQuaternion(points);
    for (let pass = 0; pass < 3; pass += 1) {
        quaternion = fitQuaternion(retained.map((index) => points[index]));
        const residuals = points.map((point) => angularSeparationDeg(rotateVector(quaternion, point.camera), point.telescope));
        const center = median(retained.map((index) => residuals[index]));
        const mad = median(retained.map((index) => Math.abs(residuals[index] - center)));
        const cutoff = Math.max(outlierFloorDeg, center + 3.5 * 1.4826 * mad);
        const next = retained.filter((index) => residuals[index] <= cutoff);
        if (next.length < 3 || next.length === retained.length)
            break;
        retained = next;
    }
    quaternion = fitQuaternion(retained.map((index) => points[index]));
    const residualsDeg = points.map((point) => angularSeparationDeg(rotateVector(quaternion, point.camera), point.telescope));
    const inliers = retained.map((index) => residualsDeg[index]);
    const rmsDeg = Math.sqrt(inliers.reduce((sum, residual) => sum + residual * residual, 0) / inliers.length);
    return {
        quaternion,
        residualsDeg,
        retained,
        rmsDeg,
        meanDeg: inliers.reduce((sum, residual) => sum + residual, 0) / inliers.length,
        worstDeg: Math.max(...inliers),
    };
}
export function targetVectorFromDegrees(raDeg, decDeg) {
    return raDecToVector(raDeg, decDeg);
}
