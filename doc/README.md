# Flyte architecture

How the codebase is organised and how the app works end to end. For setup and
run instructions, see the [project README](../README.md).

| Document | Covers |
|---|---|
| [server.md](server.md) | The C++ backend: request flow, the two API clients, merging, caching, the Docker build |
| [frontend.md](frontend.md) | The React Native app: screens, the data layer, polling, persistence, components |

This page covers the parts that span both: the system as a whole and the API
contract between them.

---

## The system at a glance

```mermaid
flowchart LR
    App["📱 Flyte app<br/>React Native + Expo<br/>(emulator or phone)"]
    Server["🖥️ flyte-server<br/>C++17 / cpp-httplib<br/>Docker on your PC, :8080"]
    Cache[("In-memory<br/>TTL caches")]
    ADB["AeroDataBox<br/>(via RapidAPI)<br/>schedules"]
    OSN["OpenSky Network<br/>live ADS-B positions"]
    OAuth["OpenSky auth<br/>OAuth2 token"]

    App -- "HTTP JSON<br/>10.0.2.2:8080" --> Server
    Server --- Cache
    Server -- "HTTPS + API key" --> ADB
    Server -- "HTTPS + bearer token" --> OSN
    Server -- "client credentials" --> OAuth
```

Three things to take from this:

1. **The app never talks to a third-party API directly.** API keys can't safely
   ship inside a mobile app, so every request goes through the backend.
2. **The backend combines two sources.** No free API gives both schedule data
   (route, gates, status) and live position (altitude, speed, heading).
   AeroDataBox provides the first and OpenSky the second. The backend joins them
   into one response.
3. **Caching is essential here.** Both APIs are free-tier limited. The server
   caches schedules for 45 s and positions for 5 s, so a phone polling every
   10 s barely touches the upstream quotas.

## One search, end to end

What happens when you type `UA1950` and tap search, then open the live tracker:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Flyte app
    participant Srv as flyte-server
    participant ADB as AeroDataBox
    participant OSN as OpenSky

    User->>App: search "UA1950"
    App->>Srv: GET /flights/UA1950
    Srv->>ADB: GET /flights/number/UA1950
    ADB-->>Srv: legs [ ... ] (status EnRoute)
    Note over Srv: pick freshest airborne leg<br/>map status, times, gates
    Srv->>OSN: GET /states/all?icao24=aa9300
    OSN-->>Srv: state vector (alt, speed, track)
    Note over Srv: convert units, compute ETA<br/>and progress, cache both halves
    Srv-->>App: 200 FlightData JSON
    Note over App: Zod-validate, show Result screen,<br/>save to Recent

    User->>App: tap "Track Live"
    loop every 10 s while tracker is open
        App->>Srv: GET /flights/UA1950/live
        Note over Srv: schedule: cache hit (45 s)<br/>telemetry: refetch if > 5 s old
        Srv-->>App: { status, progress, telemetry }
    end
    Note over App: polling stops when status = landed
```

## The API contract

The one interface both halves depend on. It is defined **twice**, once per
language, and the two must match field for field:

| Side | File |
|---|---|
| Server (C++) | `server/src/models/flight_data.h` (structs) + `flight_data_json.h` (JSON) |
| App (TypeScript) | `src/types/flight.ts` (Zod schemas; TS types are inferred from them) |

There is no compile-time link between them. The safety net is at runtime: the
app validates every response against the Zod schema, so a mismatch shows up as
a clear "Unexpected response from the server" error instead of broken UI.

```mermaid
classDiagram
    class FlightData {
        string flightNumber
        string callsign
        string icao24 [optional]
        string airline
        FlightStatus status
        AirportInfo departure
        AirportInfo arrival
        string duration
        string aircraft
        int progress  0-100
        string delay [optional]
        string date
        Telemetry telemetry [nullable]
        FlightEvent[] events
    }
    class AirportInfo {
        string code
        string city
        string time  HH:mm
        string terminal [optional]
        string gate [optional]
    }
    class Telemetry {
        double altitude  ft
        double speed  mph
        double heading  deg
        int etaMinutes
        string lastUpdated  ISO-8601
    }
    class LiveUpdate {
        FlightStatus status
        int progress
        Telemetry telemetry [nullable]
    }
    class FlightStatus {
        <<enumeration>>
        scheduled
        on-time
        delayed
        boarding
        en-route
        landed
        cancelled
    }
    FlightData --> AirportInfo : departure, arrival
    FlightData --> Telemetry
    FlightData --> FlightStatus
    LiveUpdate --> Telemetry
    LiveUpdate --> FlightStatus
```

| Endpoint | Returns | Used by |
|---|---|---|
| `GET /flights/:flightNumber` | `FlightData`, or `404 { "error": "Flight not found" }` | Search |
| `GET /flights/:flightNumber/live` | `LiveUpdate`, or `404` | Live tracker polling |

`telemetry: null` is a normal value, not an error. It means the flight is on the
ground or OpenSky currently has no position for it (for example over an ocean).

**Changing the contract?** Update `flight_data.h`, `flight_data_json.h` and
`src/types/flight.ts` together, then run `npx tsc --noEmit`.

## Repository map

```
Flyte/
├── README.md          setup & run instructions
├── doc/               ← you are here
├── src/               the React Native app         → frontend.md
├── server/            the C++ backend              → server.md
├── index.js           app entry point
├── app.json           Expo config (name, package id, plugins)
├── package.json       JS dependencies
├── babel.config.js, metro.config.js, tailwind.config.js, global.css
│                      build tooling for NativeWind / Tailwind styling
└── android/           generated by `expo prebuild` (git-ignored)
```
