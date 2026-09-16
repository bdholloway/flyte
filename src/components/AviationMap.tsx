import { View } from "react-native";
import Svg, {
  Line,
  Path,
  Circle,
  Rect,
  Polygon,
  G,
  Defs,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import type { FlightData } from "@/data/flights";

// Quadratic bezier helpers
function qBezierPoint(
  t: number,
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number
) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x,
    y: mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y,
  };
}

function qBezierAngle(
  t: number,
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number
) {
  const mt = 1 - t;
  const dx = 2 * mt * (p1x - p0x) + 2 * t * (p2x - p1x);
  const dy = 2 * mt * (p1y - p0y) + 2 * t * (p2y - p1y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// Approximate arc length of the quadratic bezier by sampling.
function qBezierLength(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  steps = 64
) {
  let len = 0;
  let prev = qBezierPoint(0, p0x, p0y, p1x, p1y, p2x, p2y);
  for (let i = 1; i <= steps; i++) {
    const pt = qBezierPoint(i / steps, p0x, p0y, p1x, p1y, p2x, p2y);
    len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return len;
}

export function AviationMap({
  flight,
  progress,
}: {
  flight: FlightData;
  progress: number;
}) {
  // SVG coordinate system: 360 × 160
  const p0 = { x: 50, y: 128 };
  const ctrl = { x: 180, y: 22 };
  const p2 = { x: 310, y: 128 };

  const t = Math.max(0.01, Math.min(0.99, progress / 100));
  const plane = qBezierPoint(t, p0.x, p0.y, ctrl.x, ctrl.y, p2.x, p2.y);
  const angle = qBezierAngle(t, p0.x, p0.y, ctrl.x, ctrl.y, p2.x, p2.y);

  const isInFlight = progress > 0 && progress < 100;
  const pathD = `M ${p0.x} ${p0.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`;
  const pathLen = qBezierLength(p0.x, p0.y, ctrl.x, ctrl.y, p2.x, p2.y);
  const traveled = (Math.max(0, Math.min(100, progress)) / 100) * pathLen;

  return (
    <View className="rounded-2xl overflow-hidden border border-border bg-[#060c1a]">
      <Svg width="100%" height="100%" viewBox="0 0 360 160" style={{ aspectRatio: 360 / 160 }}>
        {/* Grid */}
        {[32, 64, 96, 128].map((y) => (
          <Line key={`h${y}`} x1={0} y1={y} x2={360} y2={y} stroke="white" strokeOpacity={0.04} strokeWidth={1} />
        ))}
        {[60, 120, 180, 240, 300].map((x) => (
          <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={160} stroke="white" strokeOpacity={0.04} strokeWidth={1} />
        ))}

        <Defs>
          <RadialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#f5a623" stopOpacity={0.04} />
            <Stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={360} height={160} fill="url(#mapGlow)" />

        {/* Full dashed path */}
        <Path
          d={pathD}
          stroke="white"
          strokeOpacity={0.1}
          strokeWidth={1.5}
          strokeDasharray={[5, 4]}
          fill="none"
        />

        {/* Traveled portion */}
        {progress > 0 && (
          <Path
            d={pathD}
            stroke="#f5a623"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            fill="none"
            strokeDasharray={[traveled, pathLen]}
          />
        )}

        {/* Departure dot */}
        <Circle cx={p0.x} cy={p0.y} r={4} fill="#f5a623" />
        <Circle cx={p0.x} cy={p0.y} r={8} fill="#f5a623" fillOpacity={0.15} />

        {/* Arrival dot */}
        <Circle
          cx={p2.x}
          cy={p2.y}
          r={4}
          fill={progress === 100 ? "#f5a623" : "white"}
          fillOpacity={progress === 100 ? 1 : 0.25}
        />
        {progress === 100 && (
          <Circle cx={p2.x} cy={p2.y} r={8} fill="#f5a623" fillOpacity={0.15} />
        )}

        {/* Airport labels */}
        <SvgText
          x={p0.x}
          y={p0.y + 18}
          textAnchor="middle"
          fill="white"
          fillOpacity={0.7}
          fontSize={9.5}
          fontFamily="monospace"
          fontWeight="500"
        >
          {flight.departure.code}
        </SvgText>
        <SvgText
          x={p2.x}
          y={p2.y + 18}
          textAnchor="middle"
          fill="white"
          fillOpacity={0.5}
          fontSize={9.5}
          fontFamily="monospace"
          fontWeight="500"
        >
          {flight.arrival.code}
        </SvgText>

        {/* Plane icon */}
        {isInFlight && (
          <G transform={`translate(${plane.x} ${plane.y}) rotate(${angle + 90})`}>
            <Circle cx={0} cy={0} r={10} fill="#f5a623" fillOpacity={0.15} />
            <Polygon points="0,-7 5,5 0,2 -5,5" fill="#f5a623" />
          </G>
        )}

        {/* Landed marker */}
        {progress === 100 && (
          <G transform={`translate(${p2.x} ${p2.y})`}>
            <Circle cx={0} cy={0} r={10} fill="#f5a623" fillOpacity={0.15} />
            <Polygon points="0,-7 5,5 0,2 -5,5" fill="#f5a623" transform="rotate(90)" />
          </G>
        )}
      </Svg>
    </View>
  );
}
