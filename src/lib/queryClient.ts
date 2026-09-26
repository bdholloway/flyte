import { AppState, Platform } from "react-native";
import { QueryClient, focusManager } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 404 won't fix itself on retry; a dropped connection might.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.kind === "not-found") && failureCount < 1,
    },
  },
});

// React Native has no window focus events, so tell TanStack Query when the app
// is foregrounded/backgrounded. Polling (the live tracker) pauses in the
// background instead of burning OpenSky quota nobody is looking at.
focusManager.setEventListener((setFocused) => {
  if (Platform.OS === "web") return;
  const sub = AppState.addEventListener("change", (state) =>
    setFocused(state === "active")
  );
  return () => sub.remove();
});
