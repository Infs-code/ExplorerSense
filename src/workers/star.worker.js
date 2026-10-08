import { detectStars } from "../camera/detectStars.js";
self.onmessage = (event) => {
    const { data, width, height } = event.data;
    const result = detectStars(new ImageData(new Uint8ClampedArray(data), width, height));
    self.postMessage(result);
};
