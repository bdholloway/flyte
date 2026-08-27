import { useState, useEffect, useRef } from "react";
import {
  Plane, ArrowRight, Clock, MapPin, ChevronLeft,
  Search, AlertCircle, CheckCircle, Loader2, X,
  Gauge, Navigation, Wind, Radio, Star,
} from "lucide-react";

type FlightStatus = "on-time" | "delayed" | "boarding" | "landed" | "cancelled";
type Screen = "home" | "result" | "tracker";

interface AirportInfo {
  code: string;
  city: string;
  time: string;
  terminal: string;
  gate: string;
}

interface FlightData {
  flightNumber: string;
  airline: string;
  status: FlightStatus;
  departure: AirportInfo;
  arrival: AirportInfo;
  duration: string;
  aircraft: string;
  progress: number;
  delay?: string;
  date: string;
  telemetry: {
    altitude: number;
    speed: number;
    heading: number;
    etaMinutes: number;
  };
  events: { time: string; label: string }[];
}

const FLIGHTS: Record<string, FlightData> = {
  AA2847: {
    flightNumber: "AA 2847",
    airline: "American Airlines",
    status: "on-time",
    departure: { code: "JFK", city: "New York", time: "14:30", terminal: "4", gate: "B22" },
    arrival: { code: "LAX", city: "Los Angeles", time: "17:45", terminal: "3", gate: "A8" },
    duration: "5h 15m",
    aircraft: "Boeing 737-800",
    progress: 62,
    date: "Wed, 20 Aug",
    telemetry: { altitude: 38000, speed: 547, heading: 265, etaMinutes: 114 },
    events: [
      { time: "16:42", label: "Cruising at FL380" },
      { time: "15:20", label: "Reached cruising altitude" },
      { time: "14:35", label: "Departed JFK" },
      { time: "14:20", label: "Pushback complete" },
      { time: "14:05", label: "Boarding complete" },
    ],
  },
  UA421: {
    flightNumber: "UA 421",
    airline: "United Airlines",
    status: "delayed",
    departure: { code: "ORD", city: "Chicago", time: "09:15", terminal: "1", gate: "C18" },
    arrival: { code: "SFO", city: "San Francisco", time: "12:10", terminal: "3", gate: "F6" },
    duration: "4h 55m",
    aircraft: "Airbus A320",
    progress: 28,
    delay: "+38 min",
    date: "Wed, 20 Aug",
    telemetry: { altitude: 35000, speed: 512, heading: 280, etaMinutes: 212 },
    events: [
      { time: "10:05", label: "Climbing to FL350" },
      { time: "09:53", label: "Departed ORD (delayed)" },
      { time: "09:30", label: "Gate push delayed — ATC hold" },
      { time: "09:05", label: "Boarding complete" },
    ],
  },
  DL1089: {
    flightNumber: "DL 1089",
    airline: "Delta Air Lines",
    status: "boarding",
    departure: { code: "ATL", city: "Atlanta", time: "16:00", terminal: "N", gate: "N12" },
    arrival: { code: "BOS", city: "Boston", time: "19:45", terminal: "A", gate: "A22" },
    duration: "3h 45m",
    aircraft: "Boeing 757-200",
    progress: 0,
    date: "Wed, 20 Aug",
    telemetry: { altitude: 0, speed: 0, heading: 45, etaMinutes: 225 },
    events: [
      { time: "15:45", label: "Boarding in progress" },
      { time: "15:30", label: "Gate opened" },
      { time: "15:10", label: "Aircraft arrived at gate" },
      { time: "14:50", label: "Inbound aircraft on approach" },
    ],
  },
  BA178: {
    flightNumber: "BA 178",
    airline: "British Airways",
    status: "landed",
    departure: { code: "LHR", city: "London", time: "11:25", terminal: "5", gate: "C44" },
    arrival: { code: "JFK", city: "New York", time: "14:10", terminal: "7", gate: "D2" },
    duration: "7h 45m",
    aircraft: "Boeing 777-300ER",
    progress: 100,
    date: "Wed, 20 Aug",
    telemetry: { altitude: 0, speed: 0, heading: 0, etaMinutes: 0 },
    events: [
      { time: "14:08", label: "Landed at JFK" },
      { time: "13:55", label: "Final approach — ILS active" },
      { time: "13:20", label: "Begun descent" },
      { time: "13:00", label: "Cruising at FL390" },
      { time: "11:40", label: "Departed LHR" },
    ],
  },
};

const RECENT_SEARCHES = ["AA2847", "DL1089", "UA421"];

const STATUS_CONFIG: Record<FlightStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  "on-time": { label: "On Time", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: <CheckCircle size={13} /> },
  delayed: { label: "Delayed", color: "text-amber-400", bg: "bg-amber-400/10", icon: <AlertCircle size={13} /> },
  boarding: { label: "Boarding", color: "text-sky-400", bg: "bg-sky-400/10", icon: <Loader2 size={13} className="animate-spin" /> },
  landed: { label: "Landed", color: "text-slate-400", bg: "bg-slate-400/10", icon: <CheckCircle size={13} /> },
  cancelled: { label: "Cancelled", color: "text-red-400", bg: "bg-red-400/10", icon: <X size={13} /> },
};

function StatusBadge({ status }: { status: FlightStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-wide ${cfg.color} ${cfg.bg}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// Quadratic bezier helpers
function qBezierPoint(t: number, p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x,
    y: mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y,
  };
}

function qBezierAngle(t: number, p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number) {
  const mt = 1 - t;
  const dx = 2 * mt * (p1x - p0x) + 2 * t * (p2x - p1x);
  const dy = 2 * mt * (p1y - p0y) + 2 * t * (p2y - p1y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function AviationMap({ flight, progress }: { flight: FlightData; progress: number }) {
  // SVG coordinate system: 360 × 180
  const p0 = { x: 50, y: 128 };
  const ctrl = { x: 180, y: 22 };
  const p2 = { x: 310, y: 128 };

  const t = Math.max(0.01, Math.min(0.99, progress / 100));
  const plane = qBezierPoint(t, p0.x, p0.y, ctrl.x, ctrl.y, p2.x, p2.y);
  const angle = qBezierAngle(t, p0.x, p0.y, ctrl.x, ctrl.y, p2.x, p2.y);

  const isInFlight = progress > 0 && progress < 100;

  return (
    <div className="relative bg-[#060c1a] rounded-2xl overflow-hidden border border-border">
      <svg viewBox="0 0 360 160" className="w-full" style={{ display: "block" }}>
        {/* Grid */}
        {[32, 64, 96, 128].map((y) => (
          <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="white" strokeOpacity="0.04" strokeWidth="1" />
        ))}
        {[60, 120, 180, 240, 300].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="160" stroke="white" strokeOpacity="0.04" strokeWidth="1" />
        ))}

        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f5a623" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#f5a623" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="360" height="160" fill="url(#mapGlow)" />

        {/* Full dashed path */}
        <path
          d={`M ${p0.x} ${p0.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`}
          stroke="white"
          strokeOpacity="0.1"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          fill="none"
        />

        {/* Traveled portion */}
        {progress > 0 && (
          <path
            d={`M ${p0.x} ${p0.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`}
            stroke="#f5a623"
            strokeOpacity="0.55"
            strokeWidth="1.5"
            fill="none"
            pathLength="100"
            strokeDasharray={`${progress} 100`}
          />
        )}

        {/* Departure dot */}
        <circle cx={p0.x} cy={p0.y} r="4" fill="#f5a623" />
        <circle cx={p0.x} cy={p0.y} r="8" fill="#f5a623" fillOpacity="0.15" />

        {/* Arrival dot */}
        <circle cx={p2.x} cy={p2.y} r="4" fill={progress === 100 ? "#f5a623" : "white"} fillOpacity={progress === 100 ? 1 : 0.25} />
        {progress === 100 && <circle cx={p2.x} cy={p2.y} r="8" fill="#f5a623" fillOpacity="0.15" />}

        {/* Airport labels */}
        <text x={p0.x} y={p0.y + 18} textAnchor="middle" fill="white" fillOpacity="0.7" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="500">
          {flight.departure.code}
        </text>
        <text x={p2.x} y={p2.y + 18} textAnchor="middle" fill="white" fillOpacity="0.5" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="500">
          {flight.arrival.code}
        </text>

        {/* Plane icon */}
        {isInFlight && (
          <g transform={`translate(${plane.x} ${plane.y}) rotate(${angle + 90})`}>
            {/* Halo */}
            <circle cx="0" cy="0" r="10" fill="#f5a623" fillOpacity="0.15" />
            {/* Body */}
            <polygon points="0,-7 5,5 0,2 -5,5" fill="#f5a623" />
          </g>
        )}

        {/* Landed marker */}
        {progress === 100 && (
          <g transform={`translate(${p2.x} ${p2.y})`}>
            <circle cx="0" cy="0" r="10" fill="#f5a623" fillOpacity="0.15" />
            <polygon points="0,-7 5,5 0,2 -5,5" fill="#f5a623" transform="rotate(90)" />
          </g>
        )}
      </svg>
    </div>
  );
}

function LiveTracker({ flight, onBack }: { flight: FlightData; onBack: () => void }) {
  const base = flight.telemetry;
  const [alt, setAlt] = useState(base.altitude);
  const [spd, setSpd] = useState(base.speed);
  const [eta, setEta] = useState(base.etaMinutes);

  useEffect(() => {
    if (flight.status === "landed" || flight.status === "boarding") return;
    const id = setInterval(() => {
      setAlt((a) => a + Math.round((Math.random() - 0.5) * 150));
      setSpd((s) => s + Math.round((Math.random() - 0.5) * 18));
      setEta((e) => Math.max(0, e - 1));
    }, 3000);
    return () => clearInterval(id);
  }, [flight.status]);

  const formatEta = (mins: number) => {
    if (mins <= 0) return "Arrived";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const inFlight = flight.status !== "landed" && flight.status !== "boarding" && flight.status !== "cancelled";

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-7 pt-6 pb-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ChevronLeft size={16} />
          <span className="text-sm">Back</span>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-2xl font-semibold text-foreground">{flight.flightNumber}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{flight.airline}</p>
          </div>
          <div className="flex items-center gap-2">
            {inFlight && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                LIVE
              </span>
            )}
            <StatusBadge status={flight.status} />
          </div>
        </div>
      </div>

      <div className="px-7 pb-10 space-y-3">
        {/* Map */}
        <AviationMap flight={flight} progress={flight.progress} />

        {/* Route labels */}
        <div className="flex items-center justify-between px-1">
          <div className="text-center">
            <p className="font-mono text-2xl font-semibold text-foreground">{flight.departure.code}</p>
            <p className="text-xs text-muted-foreground">{flight.departure.city}</p>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <div className="h-px w-8 bg-border" />
              <Plane size={12} className="rotate-90 text-primary" />
              <div className="h-px w-8 bg-border" />
            </div>
            <p className="text-xs text-muted-foreground font-mono">{flight.duration}</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-2xl font-semibold text-foreground">{flight.arrival.code}</p>
            <p className="text-xs text-muted-foreground">{flight.arrival.city}</p>
          </div>
        </div>

        {/* Telemetry — only shown if in flight */}
        {inFlight && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <Gauge size={13} className="text-primary" />, label: "Altitude", value: `${alt.toLocaleString()} ft` },
              { icon: <Wind size={13} className="text-primary" />, label: "Speed", value: `${spd} mph` },
              { icon: <Navigation size={13} className="text-primary" />, label: "Heading", value: `${base.heading}°` },
            ].map(({ icon, label, value }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-3 text-center">
                <div className="flex justify-center mb-1">{icon}</div>
                <p className="font-mono text-sm font-semibold text-foreground leading-tight">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ETA card */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground tracking-wider uppercase">
                {flight.status === "landed" ? "Arrived" : flight.status === "boarding" ? "Estimated Departure" : "Estimated Arrival"}
              </p>
              <p className="font-mono text-2xl font-semibold text-foreground mt-0.5">
                {flight.status === "landed" ? flight.arrival.time : flight.status === "boarding" ? flight.departure.time : formatEta(eta)}
              </p>
            </div>
            <div className="text-right">
              {flight.status === "boarding" ? (
                <>
                  <p className="text-xs text-muted-foreground">Gate {flight.departure.gate}</p>
                  <p className="text-xs text-muted-foreground">Terminal {flight.departure.terminal}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Gate {flight.arrival.gate}</p>
                  <p className="text-xs text-muted-foreground">Terminal {flight.arrival.terminal}</p>
                </>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="relative h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-700"
              style={{ width: `${flight.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>{flight.departure.code}</span>
            <span className="font-mono">{flight.progress}%</span>
            <span>{flight.arrival.code}</span>
          </div>
        </div>

        {/* Event log */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Radio size={13} className="text-primary" />
            <p className="text-xs text-muted-foreground tracking-wider uppercase">Flight Log</p>
          </div>
          <div className="space-y-3">
            {flight.events.map((evt, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center shrink-0 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  {i < flight.events.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />}
                </div>
                <div className="flex-1 pb-1">
                  <p className={`text-sm ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>{evt.label}</p>
                  <p className="font-mono text-xs text-muted-foreground/60 mt-0.5">{evt.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlightDetail({ flight, onTrack }: { flight: FlightData; onTrack: () => void }) {
  return (
    <div className="space-y-3">
      {/* Route header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-center">
          <p className="font-mono text-4xl font-semibold text-foreground tracking-tight">{flight.departure.code}</p>
          <p className="text-muted-foreground text-xs mt-1">{flight.departure.city}</p>
        </div>
        <div className="flex-1 px-3 flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1 text-muted-foreground">
            <div className="h-px w-6 bg-border" />
            <Plane size={14} className="rotate-90 text-primary" />
            <div className="h-px w-6 bg-border" />
          </div>
          <p className="text-xs text-muted-foreground font-mono">{flight.duration}</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-4xl font-semibold text-foreground tracking-tight">{flight.arrival.code}</p>
          <p className="text-muted-foreground text-xs mt-1">{flight.arrival.city}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
          <span>{flight.departure.time}</span>
          <span>{flight.arrival.time}</span>
        </div>
        <div className="relative py-4">
          <div className="h-px bg-white/10 w-full" />
          <div className="absolute top-4 left-0 h-px bg-primary transition-all duration-700" style={{ width: `${flight.progress}%` }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700"
            style={{ left: `${Math.max(4, Math.min(96, flight.progress))}%` }}
          >
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <Plane size={12} className="text-background rotate-90 fill-background" />
            </div>
          </div>
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-2 rounded-full bg-white/20" />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{flight.progress === 0 ? "At gate" : flight.progress === 100 ? "Landed" : "En route"}</span>
          <span>{flight.progress === 100 ? "Arrived" : flight.progress === 0 ? "Awaiting departure" : `${flight.progress}% complete`}</span>
        </div>
      </div>

      {/* Departure / Arrival */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Departure", info: flight.departure },
          { label: "Arrival", info: flight.arrival },
        ].map(({ label, info }) => (
          <div key={label} className="bg-card rounded-2xl p-4 border border-border">
            <p className="text-xs text-muted-foreground tracking-wider uppercase mb-2">{label}</p>
            <p className="font-mono text-xl font-semibold text-foreground">{info.time}</p>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin size={10} className="text-primary" />
                <span>Terminal {info.terminal}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowRight size={10} className="text-primary" />
                <span>Gate {info.gate}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Flight info */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Airline", value: flight.airline },
            { label: "Aircraft", value: flight.aircraft },
            { label: "Date", value: flight.date },
            { label: "Flight", value: flight.flightNumber },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground tracking-wider uppercase mb-0.5">{label}</p>
              <p className="text-sm font-medium text-foreground font-mono">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {flight.delay && (
        <div className="flex items-center gap-2 bg-amber-400/8 border border-amber-400/20 rounded-2xl p-4">
          <AlertCircle size={15} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-200">
            {flight.progress > 0
              ? <>Departed <span className="font-mono font-semibold text-amber-400">{flight.delay}</span> late.</>
              : <>Delayed by <span className="font-mono font-semibold text-amber-400">{flight.delay}</span>. Check departure board for updates.</>
            }
          </p>
        </div>
      )}

      {/* Track Live button */}
      {(() => {
        const landed = flight.status === "landed";
        const delayedOnGround = flight.status === "delayed" && flight.progress === 0;
        const canTrack = flight.progress > 0 && !landed;
        const label = landed
          ? `Arrived ${flight.arrival.time}`
          : delayedOnGround
          ? `Delayed · Est. ${flight.departure.time}`
          : canTrack
          ? "Track Live"
          : "Not yet departed";
        const muted = landed || delayedOnGround || !canTrack;
        return (
          <button
            onClick={canTrack ? onTrack : undefined}
            disabled={muted}
            className={`w-full flex items-center justify-center gap-2 font-semibold text-sm rounded-2xl py-4 transition-all ${
              canTrack
                ? "bg-primary text-background active:scale-[0.98]"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            }`}
          >
            {canTrack && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-background opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-background" />
              </span>
            )}
            {label}
          </button>
        );
      })()}
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [flight, setFlight] = useState<FlightData | null>(null);
  const [flightKey, setFlightKey] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("flyte-favorites") ?? "[]"); }
    catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const normalize = (s: string) => s.replace(/\s+/g, "").toUpperCase();

  const toggleFavorite = (key: string) => {
    setFavorites((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem("flyte-favorites", JSON.stringify(next));
      return next;
    });
  };

  const handleSearch = (raw: string) => {
    const key = normalize(raw);
    if (!key) return;
    setSearching(true);
    setSearchError(null);
    setTimeout(() => {
      const found = FLIGHTS[key] ?? null;
      if (found) {
        setFlight(found);
        setFlightKey(key);
        setScreen("result");
      } else {
        setSearchError(`No flight found for "${raw.toUpperCase()}"`);
      }
      setSearching(false);
    }, 700);
  };

  const handleBack = (to: Screen = "home") => {
    setScreen(to);
    if (to === "home") {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  useEffect(() => {
    if (screen === "home") inputRef.current?.focus();
  }, [screen]);

  const slideFrom = (s: Screen): string => {
    if (s === "home") return screen === "home" ? "translateX(0)" : "translateX(-100%)";
    if (s === "result") {
      if (screen === "result") return "translateX(0)";
      return screen === "tracker" ? "translateX(-100%)" : "translateX(100%)";
    }
    if (s === "tracker") return screen === "tracker" ? "translateX(0)" : "translateX(100%)";
    return "translateX(100%)";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-[390px] min-h-[780px] bg-background rounded-[44px] overflow-hidden shadow-2xl flex flex-col"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.7)" }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between px-8 pt-5 pb-1 shrink-0">
          <span className="font-mono text-xs text-muted-foreground">9:41</span>
          <div className="w-4 h-2 border border-muted-foreground/50 rounded-sm relative">
            <div className="absolute inset-0.5 left-0.5 bg-foreground/70 rounded-xs" style={{ right: "20%" }} />
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {/* HOME */}
          <div
            className="absolute inset-0 flex flex-col transition-all duration-500 ease-in-out"
            style={{ opacity: screen === "home" ? 1 : 0, transform: slideFrom("home"), pointerEvents: screen === "home" ? "auto" : "none" }}
          >
            <div className="px-7 pt-6 pb-8">
              <div className="flex items-center gap-2 mb-1">
                <Plane size={16} className="text-primary rotate-90" />
                <span className="font-mono text-xs tracking-[0.2em] text-primary uppercase">Flyte</span>
              </div>
              <h1 className="text-3xl font-semibold text-foreground leading-tight mt-3">
                Track your<br />flight.
              </h1>
              <p className="text-sm text-muted-foreground mt-2">Enter a flight number to get live status.</p>
            </div>

            <div className="px-7">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value.toUpperCase()); setSearchError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
                  placeholder="e.g. AA2847"
                  className={`w-full bg-secondary border rounded-2xl px-5 py-4 pr-14 font-mono text-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-all ${
                    searchError
                      ? "border-red-400/50 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20"
                      : "border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  }`}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  onClick={() => handleSearch(query)}
                  disabled={searching || !query.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-primary rounded-xl flex items-center justify-center disabled:opacity-30 transition-all active:scale-95"
                >
                  {searching ? <Loader2 size={16} className="text-background animate-spin" /> : <Search size={16} className="text-background" />}
                </button>
              </div>
              {searchError && (
                <div className="mt-2 flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {["AA2847", "DL1089", "UA421", "BA178"].map((code) => (
                  <button
                    key={code}
                    onClick={() => { setQuery(code); handleSearch(code); }}
                    className="font-mono text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:border-primary/40 hover:text-primary transition-all active:scale-95"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-7 mt-8 space-y-6">
              {favorites.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Star size={11} className="text-primary fill-primary" />
                    <p className="text-xs text-muted-foreground tracking-wider uppercase">Favorites</p>
                  </div>
                  <div className="space-y-2">
                    {favorites.map((key) => {
                      const f = FLIGHTS[key];
                      if (!f) return null;
                      return (
                        <button
                          key={key}
                          onClick={() => { setQuery(key); handleSearch(key); }}
                          className="w-full flex items-center gap-4 bg-card border border-primary/20 rounded-2xl px-5 py-4 hover:border-primary/40 transition-all active:scale-[0.98] text-left"
                        >
                          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Plane size={13} className="text-primary rotate-90" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-foreground">{f.flightNumber}</span>
                              <StatusBadge status={f.status} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {f.departure.code} → {f.arrival.code} · {f.airline}
                            </p>
                          </div>
                          <Star size={12} className="text-primary fill-primary shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
              <p className="text-xs text-muted-foreground tracking-wider uppercase mb-3">Recent</p>
              <div className="space-y-2">
                {RECENT_SEARCHES.filter((k) => !favorites.includes(k)).map((key) => {
                  const f = FLIGHTS[key];
                  if (!f) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => { setQuery(key); handleSearch(key); }}
                      className="w-full flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 hover:border-primary/30 transition-all active:scale-[0.98] text-left"
                    >
                      <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                        <Plane size={13} className="text-primary rotate-90" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-foreground">{f.flightNumber}</span>
                          <StatusBadge status={f.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {f.departure.code} → {f.arrival.code} · {f.airline}
                        </p>
                      </div>
                      <Clock size={12} className="text-muted-foreground/50 shrink-0" />
                    </button>
                  );
                })}
              </div>
              </div>
            </div>
          </div>

          {/* RESULT */}
          <div
            className="absolute inset-0 flex flex-col transition-all duration-500 ease-in-out overflow-y-auto"
            style={{
              opacity: screen === "result" ? 1 : 0,
              transform: slideFrom("result"),
              pointerEvents: screen === "result" ? "auto" : "none",
            }}
          >
            <div className="px-7 pt-6 pb-4 shrink-0">
              <button onClick={() => handleBack("home")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-5">
                <ChevronLeft size={16} />
                <span className="text-sm">Back</span>
              </button>
              {flight && flightKey && (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-2xl font-semibold text-foreground">{flight.flightNumber}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{flight.airline}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFavorite(flightKey)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-90"
                    >
                      <Star
                        size={18}
                        className={favorites.includes(flightKey) ? "text-primary fill-primary" : "text-muted-foreground"}
                      />
                    </button>
                    <StatusBadge status={flight.status} />
                  </div>
                </div>
              )}
            </div>

            <div className="px-7 pb-10 space-y-3">
              {flight && <FlightDetail flight={flight} onTrack={() => setScreen("tracker")} />}
            </div>
          </div>

          {/* LIVE TRACKER */}
          <div
            className="absolute inset-0 flex flex-col transition-all duration-500 ease-in-out"
            style={{
              opacity: screen === "tracker" ? 1 : 0,
              transform: slideFrom("tracker"),
              pointerEvents: screen === "tracker" ? "auto" : "none",
            }}
          >
            {flight && screen === "tracker" && (
              <LiveTracker flight={flight} onBack={() => handleBack("result")} />
            )}
          </div>
        </div>

        {/* Home indicator */}
        <div className="flex justify-center pb-4 shrink-0">
          <div className="w-24 h-1 bg-white/20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
