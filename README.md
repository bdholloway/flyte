# Flyte

A mobile flight tracker. Search a flight number, see its route, times, gates and
status, then follow it live: altitude, speed, heading and ETA while it's in the air.

- **App:** React Native (Expo SDK 53), Android-first
- **Backend:** a small C++17 proxy in Docker that holds the API keys, merges two
  data sources into one response, and caches aggressively to stay inside free tiers
- **Data:** [AeroDataBox](https://aerodatabox.com/) for schedules,
  [OpenSky Network](https://opensky-network.org/) for live ADS-B positions

Everything the app shows comes from those two APIs. There is no mock data.

**Status:** MVP. The full path from search to live tracking works end to end on the
Android emulator. The backend isn't hosted anywhere; you start it by hand
(see [Run the backend](#1-run-the-backend)).

---

## Contents

1. [How it works](#how-it-works)
2. [Repository layout](#repository-layout)
3. [Backend API](#backend-api)
4. [Getting started](#getting-started)
5. [Development loop](#development-loop)
6. [Troubleshooting](#troubleshooting)
7. [Known limitations](#known-limitations)
8. [Design decisions](#design-decisions)

---

## How it works

```
React Native app (TanStack Query + Zod)
        │  GET /flights/:flightNumber        one-shot search
        │  GET /flights/:flightNumber/live   polled every 10s on the tracker screen
        ▼
C++ proxy: cpp-httplib, Docker (holds API keys, merges, caches)
        │
        ├──► AeroDataBox  schedule, route, times, gates, status   (cached 45s)
        └──► OpenSky      altitude, speed, heading                 (cached 5s)
```

No single free API gives both schedule data and live position, so the backend
joins two of them:

1. **Schedule (AeroDataBox).** Look up the flight number. A flight number often
   returns several legs (yesterday's landed flight, today's, and sometimes a stale
   duplicate), so the backend picks the most recently updated leg that's in the
   air, or otherwise the first match.
2. **Is it airborne?** OpenSky is only called when AeroDataBox's raw status is
   `Departed`, `EnRoute` or `Approaching`. Flights on the ground never spend
   OpenSky quota.
3. **Telemetry (OpenSky).** Look up the aircraft by its ICAO24 transponder code
   (AeroDataBox's `aircraft.modeS`). If OpenSky has no position (out of receiver
   range, over an ocean), the response has `telemetry: null`. That's a normal
   state, not an error.
4. **Merge.** `merge_service` combines both halves into one `FlightData`. OpenSky
   has no ETA, so `etaMinutes` is computed from AeroDataBox's live arrival
   prediction. Progress is computed from the actual takeoff time and that same
   arrival estimate; if neither is available it's reported as 0, which the app
   shows as "Progress unavailable".

**Caching.** Both upstream calls sit behind an in-memory TTL cache
(`server/src/cache/ttl_cache.h`): schedules for 45 seconds (keyed by normalized
flight number, so `sq21` and `SQ 21` share an entry) and telemetry for 5 seconds.
While the tracker polls, AeroDataBox is hit about once a minute and OpenSky at
most every 5 seconds. "Not found" results are deliberately not cached, because an
AeroDataBox rate-limit response looks the same and shouldn't stick.

**On the app side,** every response is validated against Zod schemas
(`src/types/flight.ts`) before it reaches the UI. The C++ serializer and the
TypeScript types have no compile-time link, so this runtime check is what catches
drift between them. Live polling runs only while the tracker screen is open,
stops once the flight lands, and pauses when the app is in the background.

---

## Repository layout

```
Flyte/
├── index.js, app.json           app entry + Expo config
├── babel.config.js, metro.config.js
├── tailwind.config.js, global.css   NativeWind (Tailwind classes in RN)
├── package.json                 see the "load-bearing" note in Getting started
├── src/
│   ├── App.tsx                  screen state machine: Home → Result → Live tracker
│   ├── theme.ts                 raw colours for icons / SVG
│   ├── types/flight.ts          Zod schemas: the API contract, app side
│   ├── lib/
│   │   ├── api/client.ts        fetch + timeout + Zod validation; picks the backend URL
│   │   ├── api/flights.ts       searchFlight(), getLiveTelemetry()
│   │   ├── hooks/useFlightSearch.ts
│   │   ├── hooks/useLiveTelemetry.ts
│   │   ├── queryClient.ts       TanStack Query setup + app-foreground tracking
│   │   └── savedFlights.ts      Favorites / Recent, persisted in AsyncStorage
│   └── components/
│       ├── FlightDetail.tsx     result screen body
│       ├── LiveTracker.tsx      live telemetry screen
│       ├── AviationMap.tsx      schematic route arc (react-native-svg)
│       ├── FlightRow.tsx, StatusBadge.tsx, PulseDot.tsx
└── server/
    ├── Dockerfile               multi-stage: build (Conan + CMake + gcc) → slim runtime
    ├── docker-compose.yml       local dev: bind-mounted src/, cached build volume
    ├── conanfile.py, CMakeLists.txt
    ├── .env.example
    └── src/
        ├── main.cpp                         routes + CORS
        ├── config/env_config.*              reads PORT and the API credentials
        ├── models/flight_data.h             C++ structs: the API contract, server side
        ├── models/flight_data_json.h        JSON serializers (must mirror src/types/flight.ts)
        ├── services/aerodatabox_client.*    schedule lookup + status/time mapping
        ├── services/opensky_client.*        OAuth2 token cache + position lookup
        ├── services/merge_service.*         combines both, computes ETA, owns the caches
        └── cache/ttl_cache.h                generic thread-safe TTL cache
```

`android/` and `ios/` are generated by `expo prebuild` and are git-ignored.

---

## Backend API

The base URL is `http://localhost:8080` from your PC, or `http://10.0.2.2:8080`
from the Android emulator.

### `GET /flights/:flightNumber`

One-shot search. The flight number is case- and space-insensitive (`aa2847`,
`AA 2847`).

- **200** returns a `FlightData` object:

  ```jsonc
  {
    "flightNumber": "SQ 21",
    "callsign": "SIA21",
    "icao24": "76CCE6",               // optional; OpenSky lookup key
    "airline": "Singapore Airlines",
    "status": "en-route",             // scheduled | on-time | delayed | boarding
                                      // | en-route | landed | cancelled
    "departure": { "code": "EWR", "city": "Newark", "time": "12:01", "terminal": "B" },
    "arrival":   { "code": "SIN", "city": "Singapore", "time": "18:34" },
                                      // terminal / gate are optional
    "duration": "16h 29m",
    "aircraft": "Airbus A350",
    "progress": 38,                   // 0–100; 0 when unknown
    "delay": "29m",                   // optional, bare duration
    "date": "Thu, 24 Sep",
    "telemetry": {                    // null when on the ground or out of coverage
      "altitude": 37000,              // feet
      "speed": 577,                   // mph (ground speed)
      "heading": 107,                 // degrees
      "etaMinutes": 738,
      "lastUpdated": "2026-09-24T22:37:36Z"
    },
    "events": []                      // not populated yet
  }
  ```

- **404** returns `{ "error": "Flight not found" }`.

### `GET /flights/:flightNumber/live`

The lightweight response the live tracker polls.

- **200** returns `{ "status": "...", "progress": 54, "telemetry": { ... } | null }`.
  `status` is included so the app can tell "landed" (stop polling) apart from
  "in the air but no coverage" (keep polling). `telemetry` is `null` in both cases.
- **404** is returned for an unknown flight.

The contract is defined twice and must stay in sync:
`server/src/models/flight_data.h` + `flight_data_json.h` (C++), and
`src/types/flight.ts` (Zod).

---

## Getting started

### Prerequisites

| Tool | Notes |
|---|---|
| **Docker Desktop** | Runs the backend. |
| **Node.js 20 or 22** + npm | For the app. |
| **Android Studio** | Emulator and SDK Manager. Install `platform-tools`, a recent platform + build-tools, and the NDK (`27.1.12297006`) from the SDK Manager. |
| **JDK 17 or 21** | **Not JDK 25.** Gradle 8.13 can't run on it (`Unsupported class file major version 69`), and Android Studio's bundled JBR may be 25. Install a separate Temurin 21. |
| **An emulator** | Android Studio → Device Manager (e.g. a Pixel with a recent API level). |
| **API credentials** | A [RapidAPI](https://rapidapi.com/aedbx-aedbx/api/aerodatabox) key for AeroDataBox (free BASIC plan), and an [OpenSky](https://opensky-network.org/) account with an API client (Account → API clients) for the OAuth2 client ID and secret. |

### 1. Run the backend

```bash
cd server
cp .env.example .env          # Windows cmd: copy .env.example .env
```

Fill in `server/.env` (it's git-ignored; never commit it):

```properties
PORT=8080
AERODATABOX_KEY=your_rapidapi_key
OPENSKY_CLIENT_ID=your_opensky_client_id
OPENSKY_CLIENT_SECRET=your_opensky_client_secret
```

All three credentials are required; the server exits at startup if one is missing.

```bash
docker compose up --build
```

The first build takes several minutes (Conan builds libcurl and friends). Check it:

```bash
curl http://localhost:8080/flights/BA178
curl http://localhost:8080/flights/BA178/live
```

Stop it with `Ctrl+C`, or `docker compose down`.

> **Stale build volume.** `docker-compose.yml` keeps build output in a named
> volume that is filled from the image only once. After changing `conanfile.py`,
> `CMakeLists.txt` or the `Dockerfile`, run `docker compose down -v` and then
> `docker compose up --build`, or your change will be silently ignored. Edits to
> files under `server/src/` don't need this: `src/` is bind-mounted and
> `docker compose restart` recompiles.

> **Local isn't identical to production.** Compose runs the full `build` stage.
> The image that would actually ship is the slim `runtime` stage. Test that one
> directly with
> `docker build -t flyte-server . && docker run --rm -p 8080:8080 --env-file .env flyte-server`.
> (The runtime stage once lacked `ca-certificates`, which broke HTTPS only there.)

### 2. Set up the Android toolchain (one-time)

Set `JAVA_HOME` and `ANDROID_HOME`, then reopen terminals and Android Studio:

```cmd
:: Windows cmd
setx JAVA_HOME "C:\path\to\jdk-21"
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"
```

```bash
# macOS / Linux
export JAVA_HOME="/path/to/jdk-21"
export ANDROID_HOME="$HOME/Library/Android/sdk"   # ~/Android/Sdk on Linux
```

Make command-line Gradle always use JDK 21 by adding this to
`~/.gradle/gradle.properties`:

```properties
org.gradle.java.home=/path/to/jdk-21
```

For builds started from Android Studio, also set **Settings → Build, Execution,
Deployment → Build Tools → Gradle → Gradle JDK → 21**.

### 3. Install and generate the native project

```bash
npm install
npx expo prebuild            # generates android/ (use --clean to regenerate from scratch)
```

Then create `android/local.properties` pointing at your SDK. It's required, and
you need to recreate it after every `prebuild`:

```properties
sdk.dir=C:\\Users\\you\\AppData\\Local\\Android\\Sdk
```

> **Don't "tidy up" these `package.json` entries; they're load-bearing:**
> - `"nativewind": "4.1.23"` is pinned with **no caret**. 4.2.x assumes Reanimated 4
>   and breaks Metro with `Cannot find module 'react-native-worklets/plugin'`.
> - `expo-asset`, `expo-constants`, `expo-font`, `expo-file-system` and
>   `expo-keep-awake` are listed as direct dependencies on purpose. Otherwise npm
>   nests them under `node_modules/expo/`, Expo's autolinking misses them, and the
>   app crashes with `Cannot find native module 'ExpoAsset'`.

### 4. Run the app

Make sure the backend is running (step 1).

**From Android Studio:**

1. Open the **`android/`** folder (not the repo root) and let Gradle sync.
2. In a terminal at the repo root, run `npx expo start` and leave it running.
3. Boot the emulator from Device Manager and wait for its home screen.
4. Select the emulator and click **▶ Run**.

**From the command line** (with the emulator already booted):

```bash
npx expo run:android
```

The first native build takes about 7 minutes. The first JS bundle takes about a
minute. You should see the Flyte home screen with a search box and the suggestion
chips `SQ21 / BA178 / DL1 / QF7`.

**Pointing the app at the backend.** The app defaults to `http://10.0.2.2:8080`
on Android, which is the emulator's alias for your PC's `localhost`. For a
physical phone on the same Wi-Fi, set your PC's LAN address before starting
Metro:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:8080 npx expo start    # Windows cmd: set EXPO_PUBLIC_API_URL=... first
```

Debug builds allow plain `http://`. A release build would need HTTPS or a
cleartext exception.

---

## Development loop

- **App code (`src/`):** keep `npx expo start` running and press `r` in its
  terminal to reload. A Gradle rebuild is only needed after adding or removing a
  native dependency or changing `app.json`. In that case run `npx expo prebuild`,
  recreate `local.properties`, and rebuild.
- **Backend code (`server/src/`):** `docker compose restart` recompiles. See the
  stale-volume note above for build-config changes.
- **Changing the API contract:** update `flight_data.h`, `flight_data_json.h` and
  `src/types/flight.ts` together, then run `npx tsc --noEmit`.
- **Finding a flight to test live tracking:** it has to be in the air *now* and
  within ADS-B coverage. Transatlantic and US domestic flights during their local
  daytime are reliable. An anonymous OpenSky query lists what's airborne over the
  US right now, without touching your quota:

  ```bash
  curl "https://opensky-network.org/api/states/all?lamin=30&lomin=-110&lamax=45&lomax=-75"
  ```

  Callsigns map to flight numbers by swapping the airline prefix: `UAL1950` →
  `UA1950`, `DAL2699` → `DL2699`, `AAL574` → `AA574`.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| App says **"Can't reach the Flyte server."** | The backend isn't running, or the app has the wrong URL. Run `docker compose up` in `server/`. On a physical phone, set `EXPO_PUBLIC_API_URL` (see step 4). |
| A real flight returns **"No flight found"** | Either the number is wrong, or AeroDataBox rate-limited the request (free tier is limited per second and per month); a rate limit currently also shows as 404. Wait a moment and retry. The backend log shows `httpCode=429` in that case. |
| Live tracker says **"No live position right now"** | Expected over oceans and remote areas, where OpenSky has no receivers. |
| `SDK location not found … local.properties` | Create `android/local.properties` (step 3). |
| `Unsupported class file major version 69` | Gradle is running on JDK 25. Point it at JDK 21 (step 2). |
| `expo run:android`: **JAVA_HOME is not set** | Set `JAVA_HOME` for that shell (step 2). |
| Metro: `Cannot find module 'react-native-worklets/plugin'` | NativeWind drifted to 4.2.x. Pin `"nativewind": "4.1.23"`, run `npm install`, restart with `npx expo start -c`. |
| Redbox: `Cannot find native module 'ExpoAsset'` (or `ExpoFont`, …) | Run `npx expo install expo-asset expo-constants expo-font expo-file-system expo-keep-awake`, delete `android/app/build/generated`, and rebuild. Check with `npx expo-modules-autolinking search -p android`. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | The installed copy was signed with a different debug key. Run `adb uninstall com.flyte.app`. This happens once after each `prebuild --clean`. |
| Pressing `r` gives **"No apps connected"** | The app launched before Metro. With Metro running, run `adb reverse tcp:8081 tcp:8081` and relaunch the app. |
| Metro: `Port 8081 is being used` | A stale Metro is still running. Find it with `netstat -ano \| findstr :8081` and kill that PID. |
| Emulator is "running" but frozen or has no window | Kill `qemu-system-x86_64.exe`, then Device Manager → the AVD → **Cold Boot Now**. If it's still stuck, use **Wipe Data**. |
| Backend change has no effect | You changed build config. Run `docker compose down -v`, then `docker compose up --build`. |
| Taps or Back seem ignored on the emulator | Android's floating keyboard toolbar can swallow input. Dismiss the keyboard first. |

Useful commands:

```bash
adb devices
adb logcat -d | grep -Ei "ReactNativeJS|FATAL"      # Windows: findstr /I "ReactNativeJS FATAL"
adb shell am force-stop com.flyte.app
cd android && ./gradlew :app:assembleDebug          # native build only
# Debug APK: android/app/build/outputs/apk/debug/app-debug.apk
```

On Windows with Git Bash, prefix `adb shell` commands that use device paths
(`/sdcard/...`) with `MSYS_NO_PATHCONV=1`, or Git Bash rewrites the path.

---

## Known limitations

- **No hosting.** The backend runs only on the machine you start it on. The
  emulator reaches it at `10.0.2.2`, and a phone on the same Wi-Fi via
  `EXPO_PUBLIC_API_URL`.
- **ADS-B coverage gaps.** OpenSky only knows positions within range of its
  receivers. Long oceanic and remote segments show "No live position".
- **Free-tier limits.** AeroDataBox's BASIC plan is capped per month and per
  second. OpenSky authenticated accounts get roughly 4,000 credits a day.
  Caching keeps normal use well inside both, but heavy testing can hit them.
- **Rate limits look like "not found".** An AeroDataBox 429 surfaces as a 404.
- **The route map is schematic.** It draws the same arc for every flight. The
  plane's position along it is real progress; the shape isn't geography.
- **No flight events.** `events` is always empty, so the tracker's flight log is
  hidden.
- **Android only in practice.** `app.json` has an iOS config, but iOS has never
  been built or tested.
- **Not built:** fallback data providers (AviationStack for schedules, ADS-B
  Exchange for telemetry) and release packaging / physical-device testing.

---

## Design decisions

- **Why a backend at all?** Both APIs need credentials (a RapidAPI key and OpenSky
  OAuth2 client credentials) that can't ship inside a mobile app. The backend is
  also the one place that joins the two sources and caches for rate limits.
- **Why C++?** Project preference. cpp-httplib is header-only and right-sized for
  two endpoints (vs. Drogon or Boost.Beast). Conan manages dependencies. libcurl
  handles outbound HTTPS, including OpenSky's form-encoded OAuth2 token request.
- **Docker everywhere.** The backend always builds in a Linux container, so
  there's one Conan profile and no Windows/MSVC vs. Linux/gcc split.
- **Thread safety.** cpp-httplib serves requests from a thread pool. The OpenSky
  token cache and both TTL caches are mutex-guarded; the token is refreshed 60
  seconds before it expires.
- **Why React Native?** The app was first a React web export (Vite + Tailwind +
  shadcn) meant for Capacitor. It was rewritten in React Native / Expo for a
  course that requires React Native or Flutter. NativeWind kept the Tailwind
  styling nearly one-to-one.
- **Favorites and Recent store snapshots.** They keep the flight number, airline
  and route, but not status, which would be stale. Tapping one runs a fresh search.
