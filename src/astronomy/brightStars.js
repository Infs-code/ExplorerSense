// Curated bright-star coordinates (J2000) for the orientation display.
export const brightStars = [
  { id: "capella", name: "Capella", raDeg: 79.172, decDeg: 45.998, magnitude: 0.08 },
  { id: "menkalinan", name: "Menkalinan", raDeg: 89.882, decDeg: 44.947, magnitude: 1.90 },
  { id: "elnath", name: "Elnath", raDeg: 81.573, decDeg: 28.608, magnitude: 1.65 },
  { id: "aldebaran", name: "Aldebaran", raDeg: 68.980, decDeg: 16.509, magnitude: 0.85 },
  { id: "betelgeuse", name: "Betelgeuse", raDeg: 88.793, decDeg: 7.407, magnitude: 0.50 },
  { id: "bellatrix", name: "Bellatrix", raDeg: 81.283, decDeg: 6.350, magnitude: 1.64 },
  { id: "rigel", name: "Rigel", raDeg: 78.634, decDeg: -8.202, magnitude: 0.13 },
  { id: "sirius", name: "Sirius", raDeg: 101.287, decDeg: -16.716, magnitude: -1.46 },
  { id: "procyon", name: "Procyon", raDeg: 114.825, decDeg: 5.225, magnitude: 0.34 },
  { id: "castor", name: "Castor", raDeg: 113.650, decDeg: 31.888, magnitude: 1.58 },
  { id: "pollux", name: "Pollux", raDeg: 116.329, decDeg: 28.026, magnitude: 1.14 },
  { id: "polaris", name: "Polaris", raDeg: 37.955, decDeg: 89.264, magnitude: 1.98 },
  { id: "dubhe", name: "Dubhe", raDeg: 165.932, decDeg: 61.751, magnitude: 1.79 },
  { id: "merak", name: "Merak", raDeg: 165.460, decDeg: 56.382, magnitude: 2.37 },
  { id: "alioth", name: "Alioth", raDeg: 193.507, decDeg: 55.960, magnitude: 1.77 },
  { id: "vega", name: "Vega", raDeg: 279.235, decDeg: 38.784, magnitude: 0.03 },
  { id: "deneb", name: "Deneb", raDeg: 310.358, decDeg: 45.280, magnitude: 1.25 },
  { id: "altair", name: "Altair", raDeg: 297.696, decDeg: 8.868, magnitude: 0.77 },
  { id: "schedar", name: "Schedar", raDeg: 10.127, decDeg: 56.537, magnitude: 2.24 },
  { id: "caph", name: "Caph", raDeg: 2.295, decDeg: 59.150, magnitude: 2.28 },
  { id: "gamma-cas", name: "Gamma Cas", raDeg: 14.177, decDeg: 60.717, magnitude: 2.47 },
];

export const constellationLines = [
  ["capella", "menkalinan"], ["menkalinan", "elnath"], ["capella", "aldebaran"],
  ["betelgeuse", "bellatrix"], ["betelgeuse", "rigel"], ["bellatrix", "elnath"],
  ["betelgeuse", "procyon"], ["castor", "pollux"], ["pollux", "procyon"],
  ["dubhe", "merak"], ["dubhe", "alioth"], ["vega", "deneb"], ["vega", "altair"],
  ["deneb", "altair"], ["schedar", "caph"], ["schedar", "gamma-cas"],
];
