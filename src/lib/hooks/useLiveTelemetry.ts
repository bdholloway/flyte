import { useQuery } from "@tanstack/react-query";
import { getLiveTelemetry, normalizeFlightNumber } from "@/lib/api/flights";

// Backend telemetry cache is 5s; polling at 10s keeps each poll fresh while
// halving OpenSky usage compared to matching it exactly.
const POLL_MS = 10_000;

/**
 * Polls GET /flights/:flightNumber/live while `enabled` (i.e. the tracker
 * screen is showing). Stops polling once the flight is landed or cancelled —
 * nothing will change after that.
 */
export function useLiveTelemetry(flightNumber: string | null, enabled: boolean) {
  const key = flightNumber ? normalizeFlightNumber(flightNumber) : "";
  return useQuery({
    queryKey: ["live", key],
    queryFn: () => getLiveTelemetry(key),
    enabled: enabled && key !== "",
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "landed" || status === "cancelled" ? false : POLL_MS;
    },
  });
}
