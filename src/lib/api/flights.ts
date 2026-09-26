import {
  FlightDataSchema,
  LiveUpdateSchema,
  type FlightData,
  type LiveUpdate,
} from "@/types/flight";
import { getJson } from "./client";

/** "aa 2847" → "AA2847" — same normalization the backend uses for its cache key. */
export function normalizeFlightNumber(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function searchFlight(flightNumber: string): Promise<FlightData> {
  return getJson(
    `/flights/${encodeURIComponent(normalizeFlightNumber(flightNumber))}`,
    FlightDataSchema
  );
}

export function getLiveTelemetry(flightNumber: string): Promise<LiveUpdate> {
  return getJson(
    `/flights/${encodeURIComponent(normalizeFlightNumber(flightNumber))}/live`,
    LiveUpdateSchema
  );
}
