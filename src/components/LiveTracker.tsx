import { ScrollView, View, Text, Pressable } from "react-native";
import {
  ChevronLeft,
  Plane,
  Gauge,
  Wind,
  Navigation,
  Radio,
  WifiOff,
  type LucideIcon,
} from "lucide-react-native";
import type { FlightData, LiveUpdate } from "@/types/flight";
import { colors } from "@/theme";
import { StatusBadge } from "./StatusBadge";
import { AviationMap } from "./AviationMap";
import { PulseDot } from "./PulseDot";

const rotate90 = { transform: [{ rotate: "90deg" }] } as const;

function groupThousands(n: number) {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return (
    sign +
    String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}

function TelemetryCell({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 bg-card border border-border rounded-2xl p-3 items-center">
      <View className="mb-1">
        <Icon size={13} color={colors.primary} />
      </View>
      <Text className="font-mono text-sm font-semibold text-foreground">
        {value}
      </Text>
      <Text className="text-xs text-muted-foreground mt-0.5 tracking-wide">
        {label}
      </Text>
    </View>
  );
}

function formatUtcTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

export function LiveTracker({
  flight,
  live,
  liveFailed,
  onBack,
}: {
  flight: FlightData;
  /** Latest poll of /live; undefined until the first one returns. */
  live: LiveUpdate | undefined;
  /** The most recent poll failed — showing the last known data. */
  liveFailed: boolean;
  onBack: () => void;
}) {
  // Live poll wins once it arrives; until then fall back to the search result.
  const status = live?.status ?? flight.status;
  const progress = live?.progress ?? flight.progress;
  const telemetry = live ? live.telemetry : flight.telemetry;

  const formatEta = (mins: number) => {
    if (mins <= 0) return "Arrived";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const landed = status === "landed";
  const boarding = status === "boarding" || status === "scheduled";
  const inFlight = !landed && !boarding && status !== "cancelled";
  const hasPosition = inFlight && telemetry !== null;
  const lastPosition = telemetry ? formatUtcTime(telemetry.lastUpdated) : null;

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-7 pt-6 pb-10"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Pressable
        onPress={onBack}
        className="flex-row items-center gap-1.5 mb-5 active:opacity-60"
      >
        <ChevronLeft size={16} color={colors.mutedForeground} />
        <Text className="text-sm text-muted-foreground">Back</Text>
      </Pressable>

      <View className="flex-row items-center justify-between mb-3">
        <View>
          <Text className="font-mono text-2xl font-semibold text-foreground">
            {flight.flightNumber}
          </Text>
          <Text className="text-sm text-muted-foreground mt-0.5">
            {flight.airline}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {hasPosition ? (
            <View className="flex-row items-center gap-1.5">
              <PulseDot size={8} color={colors.emerald400} />
              <Text className="text-xs font-mono text-emerald-400">LIVE</Text>
            </View>
          ) : null}
          <StatusBadge status={status} />
        </View>
      </View>

      <View className="gap-3">
        {/* Map */}
        <AviationMap flight={flight} progress={progress} />

        {/* Route labels */}
        <View className="flex-row items-center justify-between px-1">
          <View className="items-center">
            <Text className="font-mono text-2xl font-semibold text-foreground">
              {flight.departure.code}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {flight.departure.city}
            </Text>
          </View>
          <View className="items-center gap-0.5">
            <View className="flex-row items-center gap-1">
              <View className="h-px w-8 bg-border" />
              <Plane size={12} color={colors.primary} style={rotate90} />
              <View className="h-px w-8 bg-border" />
            </View>
            <Text className="text-xs text-muted-foreground font-mono">
              {flight.duration}
            </Text>
          </View>
          <View className="items-center">
            <Text className="font-mono text-2xl font-semibold text-foreground">
              {flight.arrival.code}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {flight.arrival.city}
            </Text>
          </View>
        </View>

        {/* Telemetry — only shown if in flight */}
        {hasPosition ? (
          <View className="gap-1.5">
            <View className="flex-row gap-2">
              <TelemetryCell Icon={Gauge} label="Altitude" value={`${groupThousands(telemetry.altitude)} ft`} />
              <TelemetryCell Icon={Wind} label="Speed" value={`${Math.round(telemetry.speed)} mph`} />
              <TelemetryCell Icon={Navigation} label="Heading" value={`${Math.round(telemetry.heading)}°`} />
            </View>
            {lastPosition ? (
              <Text className="text-xs text-muted-foreground/60 font-mono text-center">
                {liveFailed ? "Connection lost · " : ""}Position as of {lastPosition}
              </Text>
            ) : null}
          </View>
        ) : inFlight ? (
          // In the air but OpenSky has no position: outside ADS-B receiver
          // coverage (oceans, remote regions). Expected — not an error.
          <View className="flex-row items-center gap-3 bg-card border border-border rounded-2xl p-4">
            <WifiOff size={15} color={colors.mutedForeground} />
            <Text className="text-sm text-muted-foreground flex-1">
              {liveFailed
                ? "Can't reach the Flyte server. Retrying…"
                : "No live position right now. The aircraft is outside ADS-B coverage."}
            </Text>
          </View>
        ) : null}

        {/* ETA card */}
        <View className="bg-card border border-border rounded-2xl p-4">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-xs text-muted-foreground tracking-wider uppercase">
                {landed
                  ? "Arrived"
                  : boarding
                  ? "Estimated Departure"
                  : "Estimated Arrival"}
              </Text>
              <Text className="font-mono text-2xl font-semibold text-foreground mt-0.5">
                {landed
                  ? flight.arrival.time
                  : boarding
                  ? flight.departure.time
                  : telemetry
                  ? formatEta(telemetry.etaMinutes)
                  : flight.arrival.time}
              </Text>
            </View>
            <View className="items-end">
              {boarding ? (
                <>
                  <Text className="text-xs text-muted-foreground">
                    Gate {flight.departure.gate ?? "—"}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Terminal {flight.departure.terminal ?? "—"}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-xs text-muted-foreground">
                    Gate {flight.arrival.gate ?? "—"}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Terminal {flight.arrival.terminal ?? "—"}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Progress bar */}
          <View className="h-1 bg-secondary rounded-full overflow-hidden">
            <View
              className="absolute inset-y-0 left-0 bg-primary rounded-full"
              style={{ width: `${progress}%` }}
            />
          </View>
          <View className="flex-row justify-between mt-1.5">
            <Text className="text-xs text-muted-foreground">
              {flight.departure.code}
            </Text>
            <Text className="text-xs text-muted-foreground font-mono">
              {inFlight && progress === 0 ? "—" : `${progress}%`}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {flight.arrival.code}
            </Text>
          </View>
        </View>

        {/* Event log — the backend doesn't produce events yet, so hide when empty */}
        {flight.events.length > 0 ? (
          <View className="bg-card border border-border rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-4">
              <Radio size={13} color={colors.primary} />
              <Text className="text-xs text-muted-foreground tracking-wider uppercase">
                Flight Log
              </Text>
            </View>
            <View className="gap-3">
              {flight.events.map((evt, i) => (
                <View key={`${evt.time}-${i}`} className="flex-row gap-3">
                  <View style={{ width: 6 }} className="items-center">
                    <View
                      className={`w-1.5 h-1.5 rounded-full ${
                        i === 0 ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    />
                    {i < flight.events.length - 1 ? (
                      <View
                        className="bg-border"
                        style={{ width: 1, flex: 1, marginTop: 4, minHeight: 16 }}
                      />
                    ) : null}
                  </View>
                  <View className="flex-1 pb-1">
                    <Text
                      className={`text-sm ${
                        i === 0 ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {evt.label}
                    </Text>
                    <Text className="font-mono text-xs text-muted-foreground/60 mt-0.5">
                      {evt.time}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
