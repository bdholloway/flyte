# Flyte

Mobile flight-tracking app. **React Native (Expo SDK 53)** front end + a C++ backend
proxy (`server/`, unchanged).

The UI currently runs on mock data (`src/data/flights.ts`); wiring it to the
backend is a later phase — see `PROJECT_PLAN.md`.

## Front end stack

- Expo SDK 53 / React Native 0.79 / React 19
- NativeWind v4 (Tailwind classes in RN)
- `react-native-svg` (route map), `lucide-react-native` (icons)
- `@react-native-async-storage/async-storage` (favorites)

## Running it

```bash
npm install
npx expo prebuild --clean          # generates the native android/ project
npx expo run:android               # build + install on a running emulator/device
```

Or open the generated `android/` folder in Android Studio and Run.

`android/` and `ios/` are git-ignored — regenerate them with `expo prebuild`.

### Note on the JDK

Gradle needs a **JDK 17 or 21**. If the only JDK on the machine is Android
Studio's bundled JBR (JDK 25), Gradle will fail with
`Unsupported class file major version`. Fix: in Android Studio → Settings →
Build, Execution, Deployment → Build Tools → Gradle → **Gradle JDK** →
*Download JDK* → version 21, then re-sync. (Or install Temurin 21 and set
`org.gradle.java.home` in `android/gradle.properties`.)

## Layout

```
src/
  App.tsx                 # screen state machine + Home / Result panels
  data/flights.ts         # mock data + UI types
  theme.ts                # raw colour values for icons / SVG
  components/
    StatusBadge.tsx
    AviationMap.tsx        # react-native-svg route map
    FlightRow.tsx          # favorites / recent list row
    FlightDetail.tsx       # result-screen body
    LiveTracker.tsx        # live telemetry screen
    PulseDot.tsx           # animated "ping" dot
  types/flight.ts          # Zod schemas for the future backend contract
```
