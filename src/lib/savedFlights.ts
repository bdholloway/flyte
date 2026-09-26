import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeFlightNumber } from "@/lib/api/flights";
import type { FlightData } from "@/types/flight";

/**
 * What Favorites/Recent remember about a flight: enough to render its row
 * without an API call. Deliberately no status — it would be stale; tapping
 * the row runs a fresh search.
 */
export interface SavedFlight {
  key: string; // normalized flight number, e.g. "AA2847"
  flightNumber: string; // display form from the backend, e.g. "AA 2847"
  airline: string;
  from: string;
  to: string;
}

const FAVORITES_KEY = "flyte-favorites-v2"; // v1 held mock-data keys only
const RECENTS_KEY = "flyte-recents";
const MAX_RECENTS = 5;

export function toSavedFlight(flight: FlightData): SavedFlight {
  return {
    key: normalizeFlightNumber(flight.flightNumber),
    flightNumber: flight.flightNumber,
    airline: flight.airline,
    from: flight.departure.code,
    to: flight.arrival.code,
  };
}

async function load(storageKey: string): Promise<SavedFlight[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupt value — start fresh
  }
}

function save(storageKey: string, flights: SavedFlight[]) {
  AsyncStorage.setItem(storageKey, JSON.stringify(flights)).catch(() => {});
}

export const loadFavorites = () => load(FAVORITES_KEY);
export const loadRecents = () => load(RECENTS_KEY);
export const saveFavorites = (flights: SavedFlight[]) => save(FAVORITES_KEY, flights);
export const saveRecents = (flights: SavedFlight[]) => save(RECENTS_KEY, flights);

/** Most-recent-first, deduped, capped. */
export function pushRecent(recents: SavedFlight[], flight: SavedFlight): SavedFlight[] {
  return [flight, ...recents.filter((r) => r.key !== flight.key)].slice(0, MAX_RECENTS);
}

// Clean up the mock-era favorites key; its entries can't be rendered anymore.
AsyncStorage.removeItem("flyte-favorites").catch(() => {});
