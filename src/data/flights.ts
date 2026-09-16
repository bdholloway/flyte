/**
 * Mock flight data + UI types.
 *
 * This mirrors the shape the screens consume. The real backend contract lives
 * in src/types/flight.ts (Zod); wiring the two together is a later phase.
 */

export type FlightStatus =
  | "on-time"
  | "delayed"
  | "boarding"
  | "landed"
  | "cancelled";

export type Screen = "home" | "result" | "tracker";

export interface AirportInfo {
  code: string;
  city: string;
  time: string;
  terminal: string;
  gate: string;
}

export interface FlightData {
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

export const FLIGHTS: Record<string, FlightData> = {
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

export const RECENT_SEARCHES = ["AA2847", "DL1089", "UA421"];

export const SUGGESTED_CODES = ["AA2847", "DL1089", "UA421", "BA178"];
