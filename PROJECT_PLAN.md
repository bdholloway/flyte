# Flyte — Project Plan

## 1. Goal

Turn the current Figma Make export (a static, mock-data React UI) into a real
mobile flight-tracking app: search a flight number, see route/gate/status,
and watch live position telemetry — backed by real APIs, packaged as an
installable iOS/Android app.

## 2. What the current code already gives us

- `src/app/App.tsx` — full UI (search, result, live tracker screens), currently
  reading from a hardcoded `FLIGHTS` object and simulating async work with
  `setTimeout`/`setInterval`.
- Shape of a "flight" the UI already expects: `FlightData`, `AirportInfo`,
  `telemetry { altitude, speed, heading, etaMinutes }`, `events[]`.
- Tailwind + Radix/shadcn components, dark aviation-style theme.

The plan below keeps this UI and shape intact — we're replacing the data
source underneath it, not redesigning the screens.

## 3. Why two APIs

No single free/cheap API gives both schedule data (gate, terminal, delay,
"boarding" status) **and** live position telemetry (altitude, speed, heading).

| Need | API | Gives us | Doesn't give us |
|---|---|---|---|
| Search by flight number → route/gate/terminal/status | **AeroDataBox** (RapidAPI) | Schedule lookup by flight number (`AA2847`), airline, airports, terminal/gate, scheduled/estimated times, status | Live in-air position/telemetry |
| Live position while en route | **OpenSky Network** | Real-time ADS-B state vectors by `icao24`/callsign: lat/lon, altitude, ground speed, heading, on-ground flag | Any schedule/gate/airline metadata, and no lookup by flight number |

**Fallback options:** AviationStack (has both schedule and rough live position
in one call) as a documented alternative in case AeroDataBox's free tier
proves too limited, and ADS-B Exchange as a documented alternative to
OpenSky if its daily credit cap proves too tight. Neither is built first —
the backend selects primary vs. fallback per data type via an env var
(`SCHEDULE_PROVIDER`, `TELEMETRY_PROVIDER`), so switching under rate-limit
pressure is a redeploy, not a code change.

**Key integration detail:** AeroDataBox returns each flight's ICAO24/callsign
(or we derive the ICAO callsign from IATA flight number + airline ICAO
prefix, e.g. `AA2847` → `AAL2847`). That callsign is what we then query
OpenSky with to get the live telemetry. This join happens in the backend,
not the client.

## 4. Tech stack

**Mobile shell** — React + TypeScript + Vite + Tailwind/Radix (unchanged),
wrapped with **Capacitor** for iOS/Android app store packaging.

**Frontend data layer**
- **TanStack Query** — replaces the fake `setTimeout`/`setInterval` in
  `App.tsx`; handles the one-shot search query and the polling live-telemetry
  query (e.g. refetch every 5–10s while `screen === "tracker"`, paused
  otherwise).
- **Zod** — validates/parses every API response at the boundary; TS types are
  inferred from the schema so a bad response fails loudly instead of
  corrupting UI state.

**Backend proxy** — small **C++** service (cpp-httplib + Conan). Required
because:
- AeroDataBox and OpenSky both need credentials that can't live in a shipped
  mobile bundle (OpenSky's free tier uses OAuth2 client-credentials; AeroDataBox
  uses a RapidAPI key).
- It's the one place that joins schedule data + telemetry into the single
  `FlightData` object the UI expects.
- It caches responses briefly to stay under both APIs' rate limits.

**Why C++ instead of the more typical Node/Express choice for a small proxy:**
project preference. **cpp-httplib** was chosen over heavier frameworks
(Drogon, Boost.Beast) because it's header-only and right-sized for two
endpoints; **Conan** manages dependencies (nlohmann/json, libcurl, OpenSSL).

**Workflow: "Docker everywhere."** The backend always runs in a Linux
container — both for local dev (Docker Desktop/WSL2 on Windows) and for
deploy — so there's only one Conan profile to maintain (no Windows/MSVC vs.
Linux/gcc split) and no drift between "works on my machine" and what
actually deploys.

**Deploy target: TBD** (not yet chosen). The original plan called for
**deploying early** — as soon as the skeleton endpoint returns mock data, before any
real API integration — rather than at the end. This mattered specifically
because the client was a **Capacitor mobile app**: an Android emulator
can't reach `localhost` on the dev machine, and a physical phone can't
reach `localhost` or `10.0.2.2` either. Deploying the trivial skeleton
first would turn "can my phone reach my backend" into a solved problem on
day one, so every later phase (real schedule data, real telemetry,
caching, fallbacks) gets verified against infrastructure that's already
known-good. This reasoning no longer applies as-is now that the frontend
is React Native/Expo rather than Capacitor — revisit once a deploy target
is picked again.

**Shared types** — `server/src/models/flight_data.h` (+ `flight_data_json.h`
for JSON (de)serialization) on the backend, `src/types/flight.ts` (Zod
schemas) on the frontend. These aren't literally shared code across the
language boundary the way a Node backend could share a `.ts` file — the C++
serializer is hand-written and has no compiler-enforced link back to the TS
types. Zod-parsing every response at the frontend boundary (§7) is the
safety net that catches drift between the two.

```
Capacitor-wrapped React app (TanStack Query + Zod)
        │
        ▼
  C++ proxy — cpp-httplib, Docker (holds API keys, merges data, caches)
        │
        ├──► AeroDataBox   — schedule / gate / terminal / status
        └──► OpenSky       — live position / altitude / speed / heading
```

## 5. Data models

Formalizes what `App.tsx` already assumes, split into "what the API gives us"
vs. "what the UI consumes" (kept identical on purpose so no mapping layer is
needed beyond the backend merge step):

```ts
// types/flight.ts

export type FlightStatus =
  | "scheduled" | "on-time" | "delayed" | "boarding"
  | "en-route" | "landed" | "cancelled";

export interface AirportInfo {
  code: string;       // IATA, e.g. "JFK"
  city: string;
  time: string;        // scheduled/estimated local time, HH:mm
  terminal?: string;
  gate?: string;
}

export interface Telemetry {
  altitude: number;    // feet
  speed: number;        // mph
  heading: number;      // degrees
  etaMinutes: number;
  lastUpdated: string;  // ISO timestamp, from OpenSky
}

export interface FlightEvent {
  time: string;
  label: string;
}

export interface FlightData {
  flightNumber: string;   // IATA, e.g. "AA 2847"
  callsign: string;         // ICAO, e.g. "AAL2847" — join key for OpenSky
  icao24?: string;          // resolved once the aircraft is airborne
  airline: string;
  status: FlightStatus;
  departure: AirportInfo;
  arrival: AirportInfo;
  duration: string;
  aircraft: string;
  progress: number;        // 0-100, derived server-side from telemetry + schedule
  delay?: string;
  date: string;
  telemetry: Telemetry | null;  // null until airborne / if OpenSky has no match
  events: FlightEvent[];
}
```

`icao24`/`callsign` are new fields not in the current mock data — they're the
join key between the two APIs and should stay invisible to the UI (not
rendered), just carried through.

## 6. Backend service design (C++)

```
server/
  CMakeLists.txt
  conanfile.py                             # cpp-httplib, nlohmann_json, libcurl, openssl
  conan/profiles/linux-gcc-release          # the only profile needed — Docker-only builds
  src/
    main.cpp                                # server setup, route registration, CORS
    routes/
      flights_route.cpp/.h                  # GET /flights/:flightNumber, GET .../live
    services/
      aerodatabox_client.cpp/.h             # schedule adapter
      opensky_client.cpp/.h                 # OAuth2 token mgmt + telemetry adapter
      aviationstack_client.cpp/.h           # fallback schedule adapter (stub first)
      adsbexchange_client.cpp/.h            # fallback telemetry adapter (stub first)
      merge_service.cpp/.h                  # schedule + telemetry -> FlightData
    cache/
      ttl_cache.h                           # generic templated TTL cache, mutex-guarded
    models/
      flight_data.h                         # FlightData/AirportInfo/Telemetry/FlightEvent structs
      flight_data_json.h                    # nlohmann adl_serializer, must mirror the TS contract exactly
    config/
      env_config.cpp/.h                     # AERODATABOX_KEY, OPENSKY_CLIENT_ID/SECRET, PORT,
                                             # ALLOWED_ORIGINS, SCHEDULE_PROVIDER, TELEMETRY_PROVIDER
  Dockerfile                                # multi-stage: build (conan+cmake+gcc) -> slim runtime
  docker-compose.yml                        # local dev: bind-mounted src/, named volume for build/ cache
  .env.example
  .dockerignore
```

`server/` sits alongside `src/`, not inside it, so the CMake/Conan build
tree never collides with Vite's file watcher or `tsconfig`.

**Endpoints:**
- `GET /flights/:flightNumber` — one-shot search. Cache check → AeroDataBox
  for schedule → (if airborne) OpenSky for telemetry → merge → cache →
  200. No match → 404 with a JSON error body (feeds the UI's existing
  `searchError` state). Cached ~45s per flight number.
- `GET /flights/:flightNumber/live` — lightweight, telemetry-only endpoint the
  live-tracker screen polls every 5–10s. No ADS-B coverage → 200 with
  `telemetry: null` (the UI's existing null-telemetry path — never treat
  this as an error). Cached ~5s to avoid hammering OpenSky.

**Provider abstraction:** each external API is one adapter class
implementing a small `ScheduleProvider`/`TelemetryProvider` interface, so
`merge_service` doesn't care which concrete provider answered and adding a
future API is a new file, not a rewrite. `SCHEDULE_PROVIDER`/
`TELEMETRY_PROVIDER` env vars pick primary vs. fallback.

**OpenSky OAuth2:** `opensky_client` fetches a token via a libcurl
form-encoded POST, caches it in-memory with a 60s refresh-skew buffer
ahead of the real 30-minute expiry, guarded by `std::mutex` — required, not
optional, since cpp-httplib serves concurrent requests off a thread pool
and two simultaneous `/live` calls can otherwise race on token refresh.

**Caching matters here more than usual:** OpenSky's free tier is rate-limited
per day, and AeroDataBox's free tier is rate-limited per month — a naive
"call the API on every UI poll" design will exhaust both quickly with even a
handful of users. `ttl_cache.h` is a generic templated
`std::unordered_map` + `std::mutex` cache with lazy expiry-on-read; no
sweep thread or Redis needed at this scale.

**Outbound HTTP:** libcurl (not `httplib::Client`) for all calls to
AeroDataBox/OpenSky — more battle-tested TLS handling, and already needed
for OpenSky's form-encoded OAuth2 POST.

**CORS:** a cpp-httplib `set_pre_routing_handler` hook reflecting an
allow-list from `ALLOWED_ORIGINS` (the Vite dev origin, plus whatever
origin the Capacitor WebView presents — confirm the exact value once
`capacitor.config.ts` exists, it depends on `androidScheme`/`server.url`).

## 7. Frontend integration

```
src/
  lib/
    api/
      client.ts          # base fetch wrapper pointed at the backend proxy
      flights.ts          # searchFlight(), getLiveTelemetry() — typed, Zod-parsed
    hooks/
      useFlightSearch.ts   # useQuery — one-shot search
      useLiveTelemetry.ts  # useQuery with refetchInterval, enabled only on tracker screen
  types/
    flight.ts               # Zod schemas — validated at runtime against every
                             # response from the C++ backend (see §4, no compile-time
                             # sharing across the language boundary)
```

`App.tsx` changes from owning mock data + fake timers to calling these hooks;
screen transition logic and all visual components stay as-is.

## 8. Environment & secrets

- `.env` (backend only, gitignored, used for local Docker dev):
  `AERODATABOX_KEY`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`,
  `ALLOWED_ORIGINS`, `SCHEDULE_PROVIDER`, `TELEMETRY_PROVIDER`.
- Same variables set in whatever deployment host's secret store, once one
  is chosen — never committed. `.env.example` documents the keys with
  placeholder values.
- Frontend only ever knows the backend's base URL — no third-party keys ship
  in the mobile bundle.

## 9. Phased implementation plan

Sequenced to deploy early rather than at the end — see §4 for why that
matters specifically for a Capacitor mobile client.

0. **Initialize git** — `git init` + `.gitignore` covering `server/build/`,
   Conan cache dirs, and `.env`, before any code lands.
1. **Data model** — `server/src/models/flight_data.h` +
   `flight_data_json.h` and `src/types/flight.ts` (Zod), no behavior change
   yet.
2. **Backend skeleton** — cpp-httplib app, `/flights/:flightNumber`
   returning a hardcoded `FlightData` JSON literal (proves the contract
   before touching real APIs). Verify locally via `docker compose up` +
   `curl`.
3. **Deploy the skeleton somewhere reachable immediately** (deploy target
   TBD — see §4) — get it working end-to-end (build, env vars, CORS,
   health check) before any AeroDataBox/OpenSky code exists.
4. **AeroDataBox integration** — real schedule lookup, sign up for RapidAPI
   key, replace mock schedule half. Verify with curl against the *live*
   deployed URL, then redeploy.
5. **OpenSky integration** — OAuth2 client-credentials flow, callsign
   lookup, replace mock telemetry half; implement the merge step. Same
   curl-then-redeploy verification.
6. **Caching layer** — add TTL cache in front of both upstream calls.
7. **Fallback providers** — AviationStack / ADS-B Exchange adapters, wired
   behind the `SCHEDULE_PROVIDER`/`TELEMETRY_PROVIDER` env vars.
8. **Frontend wiring** — TanStack Query + Zod, hooks, replace `setTimeout`/
   `setInterval` in `App.tsx` with real calls against the deployed URL;
   handle loading/error/no-match/null-telemetry states already stubbed in
   the UI.
9. **Capacitor packaging** — wrap as iOS/Android app, verify against the
   Android emulator first (should just work, since the app was never
   pointed at `localhost`), then a physical device — polling/live tracker
   behavior across backgrounding and network transitions (WiFi→cellular).

## 10. Open risks / things to watch

- **Coverage gaps:** OpenSky only sees aircraft with an active ADS-B
  transponder in range of a receiver — regional/ground/some international
  flights may show no live telemetry. UI already has a path for this
  (`telemetry: null` → hide the live stats grid, as it already does for
  "boarding"/"landed").
- **Rate limits:** both APIs are free-tier-limited; caching is not optional,
  it's load-bearing for the app to keep working under any real usage.
- **Callsign matching:** IATA→ICAO callsign derivation isn't always a clean
  string transform (codeshares, regional carriers); AeroDataBox's response
  should be checked for whether it already includes the ICAO callsign
  directly before we derive one ourselves.
- **AeroDataBox free tier ceiling:** if it proves too restrictive during
  testing, AviationStack is the documented fallback (see §3).
- **First Docker build may take real debugging time:** Conan 2.x's
  toolchain-file path handling inside a from-scratch multi-stage
  Dockerfile is a common first-time friction point — don't assume it's a
  one-shot.
- **cpp-httplib's threading model:** synchronous-per-connection over a
  thread pool, not async I/O. Fine at course-project scale, but a slow/
  rate-limited upstream call holds a worker thread for the full round
  trip — `svr.new_task_queue` is the tuning knob if it's ever needed.
- **No compile-time link between the C++ JSON serializer and the frontend
  types** — Zod-parsing at the frontend boundary (§4, §7) is the ongoing
  safety net for this, not a one-time check.
- **Capacitor's CORS origin is platform/config-dependent** — confirm the
  exact value once `capacitor.config.ts` exists rather than guessing it now.
- **No deploy target currently chosen** — whatever host is picked, re-verify
  its free-tier/always-on terms at actual deploy time.
