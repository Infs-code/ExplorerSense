function median(values) {
    if (!values.length)
        return 0;
    values.sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}
export function detectStars(image, maxStars = 250) {
    const { data, width, height } = image;
    if (width < 9 || height < 9)
        return { stars: [], background: 0, noise: 0, threshold: 0, width, height };
    const luminance = new Float32Array(width * height);
    const sample = [];
    for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
        const value = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        luminance[pixel] = value;
        if (pixel % 31 === 0)
            sample.push(value);
    }
    const background = median(sample);
    const deviations = sample.map((value) => Math.abs(value - background));
    const noise = Math.max(1, 1.4826 * median(deviations));
    const threshold = background + Math.max(7, 4.5 * noise);
    const candidates = [];
    const index = (x, y) => y * width + x;
    for (let y = 4; y < height - 4; y += 1) {
        for (let x = 4; x < width - 4; x += 1) {
            const centerIndex = index(x, y);
            const peak = luminance[centerIndex];
            if (peak < threshold || peak > 250)
                continue;
            let isMaximum = true;
            for (let dy = -2; dy <= 2 && isMaximum; dy += 1) {
                for (let dx = -2; dx <= 2; dx += 1) {
                    if ((dx !== 0 || dy !== 0) && luminance[index(x + dx, y + dy)] > peak) {
                        isMaximum = false;
                        break;
                    }
                }
            }
            if (!isMaximum)
                continue;
            let weightedX = 0;
            let weightedY = 0;
            let flux = 0;
            let radiusMoment = 0;
            let saturated = false;
            for (let dy = -3; dy <= 3; dy += 1) {
                for (let dx = -3; dx <= 3; dx += 1) {
                    const value = luminance[index(x + dx, y + dy)];
                    if (value >= 254)
                        saturated = true;
                    const weight = Math.max(0, value - background);
                    flux += weight;
                    weightedX += (x + dx) * weight;
                    weightedY += (y + dy) * weight;
                    radiusMoment += (dx * dx + dy * dy) * weight;
                }
            }
            const radiusPx = Math.sqrt(radiusMoment / Math.max(flux, 1));
            if (saturated || flux < noise * 16 || radiusPx < 0.5 || radiusPx > 2.5)
                continue;
            const star = {
                x: weightedX / flux,
                y: weightedY / flux,
                flux,
                peak,
                radiusPx,
                signalToNoise: (peak - background) / noise,
            };
            candidates.push(star);
        }
    }
    candidates.sort((a, b) => b.signalToNoise - a.signalToNoise);
    const stars = candidates.filter((star, index) => candidates.slice(0, index).every((prior) => Math.hypot(prior.x - star.x, prior.y - star.y) > 5)).slice(0, maxStars);
    return { stars, background, noise, threshold, width, height };
}
