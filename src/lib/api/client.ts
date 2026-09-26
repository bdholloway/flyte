import { Platform } from "react-native";
import type { z } from "zod";

/**
 * Base URL of the C++ backend. Override with EXPO_PUBLIC_API_URL (Expo inlines
 * EXPO_PUBLIC_* vars at bundle time), e.g. a LAN IP for a physical device.
 * Defaults target a backend running locally via `docker compose up`: the
 * Android emulator reaches the host machine at 10.0.2.2, not localhost.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:8080" : "http://localhost:8080");

const TIMEOUT_MS = 15_000;

export type ApiErrorKind = "not-found" | "network" | "server" | "invalid-response";

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * GET a backend path and validate the JSON body against a Zod schema — the
 * backend is C++, so this runtime check is the only thing guaranteeing the
 * response actually matches the TypeScript types.
 */
export async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { signal: controller.signal });
  } catch {
    throw new ApiError("network", "Can't reach the Flyte server.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) throw new ApiError("not-found", "Flight not found.");
  if (!res.ok) throw new ApiError("server", `Server error (${res.status}).`);

  const parsed = schema.safeParse(await res.json().catch(() => undefined));
  if (!parsed.success) {
    console.warn("[api] response failed validation", path, parsed.error.issues);
    throw new ApiError("invalid-response", "Unexpected response from the server.");
  }
  return parsed.data;
}
