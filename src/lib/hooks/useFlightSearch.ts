import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeFlightNumber, searchFlight } from "@/lib/api/flights";
import type { FlightData } from "@/types/flight";

// Matches the backend's schedule cache TTL — re-searching the same flight
// within this window is answered locally without a request.
const SEARCH_STALE_MS = 45_000;

/**
 * One-shot flight search. Imperative (`search()` returns the result) because
 * the UI navigates on success, but it goes through the query cache so results
 * are shared with any useQuery reading the same ["flight", key].
 */
export function useFlightSearch() {
  const queryClient = useQueryClient();
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(
    async (raw: string): Promise<FlightData> => {
      const key = normalizeFlightNumber(raw);
      setIsSearching(true);
      try {
        return await queryClient.fetchQuery({
          queryKey: ["flight", key],
          queryFn: () => searchFlight(key),
          staleTime: SEARCH_STALE_MS,
        });
      } finally {
        setIsSearching(false);
      }
    },
    [queryClient]
  );

  return { search, isSearching };
}
