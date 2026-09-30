# Frontend (React Native app)

The app lives in `src/`. It is a single-activity React Native app built with
Expo: three screens (Home → Result → Live tracker), a small data layer that
talks to the backend, and persisted Favorites/Recent lists.

← [Server](server.md) · [Architecture index](README.md)

---

## Contents

1. [Tech stack](#tech-stack)
2. [File layout](#file-layout)
3. [Layers](#layers)
4. [Screens and navigation](#screens-and-navigation)
5. [State in App.tsx](#state-in-apptsx)
6. [Data layer](#data-layer)
7. [Search flow](#search-flow)
8. [Live tracking flow](#live-tracking-flow)
9. [Favorites and Recent](#favorites-and-recent)
10. [Components](#components)
11. [Styling](#styling)
12. [Build pipeline](#build-pipeline)

---

## Tech stack

| Piece | Choice | Role |
|---|---|---|
| Framework | React Native 0.79 + React 19 | UI |
| Tooling | Expo SDK 53 | Native project generation, Metro bundler, modules |
| Server state | TanStack Query v5 | Fetching, caching, polling |
| Validation | Zod | Runtime checks on every API response; TS types inferred from schemas |
| Styling | NativeWind 4 (Tailwind for RN) | `className="..."` on native views |
| Graphics | react-native-svg | Route map |
| Icons | lucide-react-native | All icons |
| Storage | AsyncStorage | Favorites and Recent |
| Animation | RN `Animated` | Screen slides, pulsing dots |

## File layout

```
index.js                        registerRootComponent(App)
src/
├── App.tsx                     root: providers, screen state machine, Home + Result UI
├── theme.ts                    raw colours for icon/SVG props (mirror of tailwind.config.js)
├── types/
│   └── flight.ts               Zod schemas = the API contract (see README.md)
├── lib/
│   ├── api/
│   │   ├── client.ts           getJson(): fetch + timeout + status → ApiError + Zod parse
│   │   └── flights.ts          searchFlight(), getLiveTelemetry(), normalizeFlightNumber()
│   ├── hooks/
│   │   ├── useFlightSearch.ts  imperative search through the query cache
│   │   └── useLiveTelemetry.ts polling query for /live
│   ├── queryClient.ts          QueryClient + retry policy + AppState focus wiring
│   └── savedFlights.ts         Favorites / Recent persistence
└── components/
    ├── FlightDetail.tsx        Result screen body
    ├── LiveTracker.tsx         Live tracker screen
    ├── AviationMap.tsx         SVG route arc with plane marker
    ├── FlightRow.tsx           row in Favorites / Recent
    ├── StatusBadge.tsx         coloured status pill
    └── PulseDot.tsx            animated "live" dot
```

## Layers

Each layer only talks to the one below it. Components never call `fetch`, and
the API layer knows nothing about screens.

```mermaid
flowchart TD
    subgraph UI["UI"]
        App["App.tsx<br/>screens + navigation"]
        Comp["components/*<br/>FlightDetail, LiveTracker, ..."]
    end
    subgraph Hooks["Hooks"]
        UFS["useFlightSearch"]
        ULT["useLiveTelemetry"]
    end
    subgraph Query["TanStack Query"]
        QC["queryClient<br/>cache, retries, polling, focus"]
    end
    subgraph API["API layer"]
        FL["flights.ts<br/>searchFlight / getLiveTelemetry"]
        CL["client.ts<br/>getJson + ApiError"]
        Z["types/flight.ts<br/>Zod schemas"]
    end
    Store["savedFlights.ts<br/>AsyncStorage"]
    Server[("flyte-server<br/>:8080")]

    App --> Comp
    App --> UFS
    App --> ULT
    App --> Store
    UFS --> QC
    ULT --> QC
    QC --> FL
    FL --> CL
    CL --> Z
    CL -- HTTP --> Server
```

## Screens and navigation

There's no navigation library. The three screens sit side by side in one
horizontal row, three screen-widths wide, and `goTo()` slides that row with an
`Animated.timing` translate (350 ms).

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Home
    Home --> Result: search succeeds
    Home --> Home: search fails<br/>(error under the search box)
    Result --> Tracker: tap "Track Live"<br/>(only if in the air)
    Tracker --> Result: Back / hardware back
    Result --> Home: Back / hardware back<br/>(clears the query)
    Home --> [*]: hardware back exits app
```

```
 ┌──────────────┬──────────────┬──────────────┐
 │     HOME     │    RESULT    │   TRACKER    │   ← one Animated.View, width = 3 × screen
 └──────────────┴──────────────┴──────────────┘
   translateX:  0          −W            −2W
```

Because all three screens stay mounted, the tracker's content exists (off
screen) as soon as a search succeeds. Its **polling**, however, only runs while
`screen === "tracker"`.

The Android hardware back button is handled with `BackHandler`: it goes back one
screen, and on Home it falls through so the app exits normally.

## State in App.tsx

All UI state lives in the root component. Server data lives in TanStack Query.

| State | Type | Purpose |
|---|---|---|
| `query` | `string` | Search box text (uppercased as you type) |
| `screen` | `"home" \| "result" \| "tracker"` | Which screen is showing |
| `flight` | `FlightData \| null` | The last successful search result |
| `flightKey` | `string \| null` | Normalized flight number (`"UA1950"`), used for `/live` |
| `searchError` | `string \| null` | Message shown under the search box |
| `favorites` | `SavedFlight[]` | Starred flights (persisted) |
| `recents` | `SavedFlight[]` | Last 5 searches (persisted) |
| `searching` | from `useFlightSearch` | Spinner on the search button |
| `live` | from `useLiveTelemetry` | `{ data, isError, ... }` from polling |

## Data layer

### `lib/api/client.ts`: one function, four outcomes

```mermaid
flowchart TD
    A["getJson(path, schema)"] --> B["fetch(API_URL + path)<br/>15 s timeout (AbortController)"]
    B -- throws --> N["ApiError 'network'<br/>Can't reach the Flyte server."]
    B --> C{status}
    C -- 404 --> NF["ApiError 'not-found'"]
    C -- other non-2xx --> S["ApiError 'server'<br/>Server error (code)"]
    C -- 2xx --> D["schema.safeParse(json)"]
    D -- fails --> I["ApiError 'invalid-response'<br/>+ console.warn with Zod issues"]
    D -- ok --> OK["typed data ✔"]
```

**Which backend?** `API_URL` is `EXPO_PUBLIC_API_URL` if set (Expo bakes it in
at bundle time); otherwise `http://10.0.2.2:8080` on Android, which is the
emulator's alias for the host PC's `localhost`, and `http://localhost:8080`
elsewhere.

### `lib/queryClient.ts`

- **Retry policy.** Never retry a `not-found` (it won't change); retry other
  failures once.
- **Focus.** React Native has no browser "window focus", so `AppState` is wired
  into TanStack Query's `focusManager`. When the app goes to the background the
  query client treats it as unfocused, which pauses the live polling.

### Hooks

| Hook | Style | Query key | Behaviour |
|---|---|---|---|
| `useFlightSearch()` | Imperative: returns `search(raw)` + `isSearching` | `["flight", KEY]` | `queryClient.fetchQuery` with `staleTime` 45 s (matches the server cache), so re-searching the same flight within 45 s needs no request |
| `useLiveTelemetry(key, enabled)` | Declarative `useQuery` | `["live", KEY]` | `enabled` only on the tracker screen; `refetchInterval` 10 s, switching to `false` once status is `landed`/`cancelled` |

Search is imperative because the UI has to act on the result: navigate on
success, or show an error. It still goes through the query cache, so results are
shared and deduplicated.

## Search flow

```mermaid
sequenceDiagram
    actor User
    participant Home as App.tsx (Home)
    participant Hook as useFlightSearch
    participant QC as queryClient
    participant API as getJson
    participant Srv as flyte-server

    User->>Home: types "ua 1950", taps search
    Home->>Home: normalize → "UA1950", dismiss keyboard
    Home->>Hook: search("UA1950")
    Hook->>QC: fetchQuery(["flight","UA1950"])
    alt cached and under 45 s old
        QC-->>Hook: cached FlightData
    else
        QC->>API: searchFlight("UA1950")
        API->>Srv: GET /flights/UA1950
        Srv-->>API: 200 JSON
        API->>API: FlightDataSchema.safeParse
        API-->>QC: FlightData
        QC-->>Hook: FlightData
    end
    Hook-->>Home: FlightData
    Home->>Home: setFlight, setFlightKey,<br/>push to Recent, goTo("result")
    Note over Home: on ApiError: not-found → "No flight found for …"<br/>otherwise → the error's message
```

## Live tracking flow

The tracker combines the last search result with the latest `/live` poll.
Whichever is fresher wins:

```ts
const status    = live?.status   ?? flight.status;
const progress  = live?.progress ?? flight.progress;
const telemetry = live ? live.telemetry : flight.telemetry;
```

```mermaid
flowchart TD
    S{status} -->|landed| L["'Arrived' + arrival time<br/>polling stopped"]
    S -->|scheduled / boarding| B["'Estimated Departure'<br/>+ gate and terminal"]
    S -->|cancelled| C["no telemetry section"]
    S -->|in the air| T{telemetry?}
    T -->|present| P["LIVE dot · altitude / speed / heading<br/>ETA countdown<br/>'Position as of HH:MM UTC'"]
    T -->|null| N["'No live position right now'<br/>(outside ADS-B coverage)<br/>ETA falls back to arrival time"]
    P -. poll fails .-> PF["keeps last values<br/>'Connection lost · Position as of …'"]
    N -. poll fails .-> NF["'Can't reach the Flyte server. Retrying…'"]
```

**When is "Track Live" enabled?** In `FlightDetail`, for a flight that is
neither landed nor cancelled **and** has progress > 0, status `en-route`, or
telemetry. The extra conditions cover AeroDataBox's `Departed` status, which
arrives as `on-time`/`delayed`.

**Progress of 0 for a flight in the air** means the backend couldn't compute
it. The Result screen shows "Progress unavailable" and the tracker shows "—",
rather than a made-up number.

## Favorites and Recent

Both lists persist in AsyncStorage as small **snapshots**, not full flight
data:

```ts
interface SavedFlight {
  key: string;          // "AA2847"  (normalized, used to re-search)
  flightNumber: string; // "AA 2847" (display)
  airline: string;
  from: string;         // "JFK"
  to: string;           // "LAX"
}
```

| List | Storage key | Rules |
|---|---|---|
| Favorites | `flyte-favorites-v2` | Toggled with the ☆ on the Result screen |
| Recent | `flyte-recents` | Every successful search; newest first, deduplicated, max 5; hidden if already a favourite |

Snapshots deliberately leave out **status**, which would be stale by the time
you look at the list. Tapping a row runs a fresh search. `v2` in the key
exists because v1 stored keys into the old mock data; `savedFlights.ts` deletes
that old key on startup.

## Components

```mermaid
flowchart TD
    Root["Root<br/>QueryClientProvider"] --> App
    App --> Home["Home panel (in App.tsx)"]
    App --> Result["Result panel (in App.tsx)"]
    App --> LT["LiveTracker"]
    Home --> FR["FlightRow × n<br/>(Favorites, Recent)"]
    Result --> SB1["StatusBadge"]
    Result --> FD["FlightDetail"]
    FD --> PD1["PulseDot<br/>(Track Live button)"]
    LT --> SB2["StatusBadge"]
    LT --> AM["AviationMap"]
    LT --> PD2["PulseDot (LIVE)"]
```

| Component | Props | Notes |
|---|---|---|
| `FlightDetail` | `flight`, `onTrack` | Route header, progress bar, departure/arrival cards, info grid, delay banner, Track Live button. Missing terminal/gate show "—". |
| `LiveTracker` | `flight`, `live`, `liveFailed`, `onBack` | Map, telemetry cells, ETA card, progress bar; flight log hidden while `events` is empty |
| `AviationMap` | `flight`, `progress` | A schematic SVG arc in a 360×160 viewBox; plane placed along a quadratic Bézier by progress. **Not geographic.** Sized by the wrapper's `aspectRatio`; a percentage `height` on the `Svg` inside a ScrollView blows up to full screen. |
| `StatusBadge` | `status` | One colour + icon per `FlightStatus` (`en-route` = green plane, `delayed` = amber, …) |
| `FlightRow` | `flight: SavedFlight`, `variant` | No status badge, since saved status would be stale |
| `PulseDot` | `size`, `color`, `haloOpacity` | Looping `Animated` scale + fade halo |

## Styling

- **NativeWind** compiles Tailwind classes (`className="bg-card rounded-2xl p-4"`)
  into React Native styles at build time. The colour tokens (`background`,
  `card`, `primary`, `secondary`, `muted-foreground`, `border`) live in
  `tailwind.config.js`.
- **`theme.ts`** repeats the few colours that must be passed as raw values, such
  as icon `color` props and SVG fills, because those can't take a `className`.
  Keep the two in sync.
- Dark theme only; the fonts are system defaults with `monospace` for flight
  numbers and times.

## Build pipeline

```mermaid
flowchart LR
    subgraph JS["JavaScript (Metro)"]
        src["src/**/*.tsx"] --> babel["Babel<br/>babel-preset-expo<br/>+ nativewind/babel<br/>+ reanimated plugin"]
        css["global.css<br/>+ tailwind.config.js"] --> nw["NativeWind<br/>(metro.config.js)"]
        babel --> bundle["JS bundle"]
        nw --> bundle
    end
    subgraph Native["Native (Gradle)"]
        appjson["app.json"] --> prebuild["expo prebuild"]
        prebuild --> android["android/"]
        android --> apk["app-debug.apk"]
    end
    bundle -- "served by Metro :8081<br/>(debug builds)" --> device["Emulator / device"]
    apk -- install --> device
```

- **Two halves.** Gradle builds the native shell, which changes rarely. Metro
  serves the JavaScript, which is what you edit, and pressing `r` reloads it
  without a native rebuild.
- **`android/` is generated.** It's never edited by hand or committed. Rebuild
  it with `expo prebuild` after changing `app.json` or adding a native
  dependency, and recreate `android/local.properties` each time.
- **Debug builds allow plain `http://`,** which is how the app reaches the local
  backend. A release build would need HTTPS or a cleartext exception.
- **Load-bearing dependency pins** (don't "tidy" them): `nativewind` exactly
  `4.1.23`, and the explicit `expo-*` modules in `package.json`. The project
  README explains why.
