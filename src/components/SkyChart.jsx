import { useMemo } from "react";
import { horizontalFromJ2000 } from "../astronomy/coordinates.js";
import { brightStars, constellationLines } from "../astronomy/brightStars.js";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const signedAngle = (value) => ((value + 540) % 360) - 180;

export function SkyChart({ location, date, headingDeg, tiltDeg, zoom = 1 }) {
  const plotted = useMemo(() => brightStars.map((star) => {
    if (!location) {
      const x = 180 + signedAngle(star.raDeg) * 0.42;
      const y = 380 - star.decDeg * 3.7;
      return { ...star, x, y, altitudeDeg: null, visible: true };
    }
    const horizontal = horizontalFromJ2000(star, location, date);
    const azimuthOffset = signedAngle(horizontal.azimuthDeg - (headingDeg ?? 0));
    const horizontalSpan = 45 / zoom;
    const x = 180 + (azimuthOffset / horizontalSpan) * 180;
    const centerAltitude = tiltDeg === null || tiltDeg === undefined ? 45 : clamp(Math.abs(tiltDeg), 5, 85);
    const y = 380 - (horizontal.altitudeDeg - centerAltitude) * 7.1;
    return { ...star, x, y, altitudeDeg: horizontal.altitudeDeg, visible: horizontal.altitudeDeg > -2 && Math.abs(azimuthOffset) < horizontalSpan };
  }), [location, date, headingDeg, tiltDeg, zoom]);
  const positions = useMemo(() => new Map(plotted.map((star) => [star.id, star])), [plotted]);

  return <svg className="sky-chart" viewBox="0 0 360 760" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Bright-star map aligned to device compass when available">
    <defs><radialGradient id="night-fade"><stop offset="0" stopColor="#090909"/><stop offset="1" stopColor="#000"/></radialGradient></defs>
    <rect width="360" height="760" fill="url(#night-fade)"/>
    <g className="sky-grid">
      <path d="M0 190h360M0 380h360M0 570h360"/>
      <path d="M90 0v760M180 0v760M270 0v760"/>
      <circle cx="180" cy="380" r="146"/><circle cx="180" cy="380" r="70"/>
    </g>
    <g className="constellation-lines">{constellationLines.map(([a, b]) => {
      const first = positions.get(a); const second = positions.get(b);
      return first?.visible && second?.visible ? <line key={`${a}-${b}`} x1={first.x} y1={first.y} x2={second.x} y2={second.y}/> : null;
    })}</g>
    <g className="stars">{plotted.filter((star) => star.visible && star.x >= 0 && star.x <= 360 && star.y >= 0 && star.y <= 760).map((star) => <g key={star.id}>
      <circle cx={star.x} cy={star.y} r={clamp(4.6 - star.magnitude * 0.75, 1.7, 5.2)}/>
      {star.magnitude < 1.8 && <text x={star.x + 7} y={star.y - 7}>{star.name}</text>}
    </g>)}</g>
    {[["Auriga", ["capella", "menkalinan", "elnath"]], ["Orion", ["betelgeuse", "bellatrix", "rigel"]], ["Gemini", ["castor", "pollux"]]].map(([name, ids]) => {
      const members = ids.map((id) => positions.get(id)).filter((star) => star?.visible);
      if (members.length < 2) return null;
      const x = members.reduce((sum, star) => sum + star.x, 0) / members.length;
      const y = members.reduce((sum, star) => sum + star.y, 0) / members.length;
      return <text key={name} className="constellation-name" x={x} y={y}>{name}</text>;
    })}
    <g className="cardinal-ticks"><text x="180" y="25">N</text><text x="338" y="384">E</text><text x="180" y="748">S</text><text x="18" y="384">W</text></g>
  </svg>;
}
