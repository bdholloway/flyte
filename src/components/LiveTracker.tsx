import { useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import {
  ChevronLeft,
  Plane,
  Gauge,
  Wind,
  Navigation,
  Radio,
  type LucideIcon,
} from "lucide-react-native";
import type { FlightData } from "@/data/flights";
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

export function LiveTracker({
  flight,
  onBack,
}: {
  flight: FlightData;
  onBack: () => void;
}) {
  const base = flight.telemetry;
  const [alt, setAlt] = useState(base.altitude);
  const [spd, setSpd] = useState(base.speed);
  const [eta, setEta] = useState(base.etaMinutes);

  useEffect(() => {
    if (flight.status === "landed" || flight.status === "boarding") return;
    const id = setInterval(() => {
      setAlt((a) => a + Math.round((Math.random() - 0.5) * 150));
      setSpd((s) => s + Math.round((Math.random() - 0.5) * 18));
      setEta((e) => Math.max(0, e - 1));
    }, 3000);
    return () => clearInterval(id);
  }, [flight.status]);

  const formatEta = (mins: number) => {
    if (mins <= 0) return "Arrived";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const inFlight =
    flight.status !== "landed" &&
    flight.status !== "boarding" &&
    flight.status !== "cancelled";
  const boarding = flight.status === "boarding";
  const landed = flight.status === "landed";

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
          {inFlight ? (
            <View className="flex-row items-center gap-1.5">
              <PulseDot size={8} color={colors.emerald400} />
              <Text className="text-xs font-mono text-emerald-400">LIVE</Text>
            </View>
          ) : null}
          <StatusBadge status={flight.status} />
        </View>
      </View>

      <View className="gap-3">
        {/* Map */}
        <AviationMap flight={flight} progress={flight.progress} />

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
        {inFlight ? (
          <View className="flex-row gap-2">
            <TelemetryCell Icon={Gauge} label="Altitude" value={`${groupThousands(alt)} ft`} />
            <TelemetryCell Icon={Wind} label="Speed" value={`${spd} mph`} />
            <TelemetryCell Icon={Navigation} label="Heading" value={`${base.heading}°`} />
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
                  : formatEta(eta)}
              </Text>
            </View>
            <View className="items-end">
              {boarding ? (
                <>
                  <Text className="text-xs text-muted-foreground">
                    Gate {flight.departure.gate}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Terminal {flight.departure.terminal}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-xs text-muted-foreground">
                    Gate {flight.arrival.gate}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Terminal {flight.arrival.terminal}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Progress bar */}
          <View className="h-1 bg-secondary rounded-full overflow-hidden">
            <View
              className="absolute inset-y-0 left-0 bg-primary rounded-full"
              style={{ width: `${flight.progress}%` }}
            />
          </View>
          <View className="flex-row justify-between mt-1.5">
            <Text className="text-xs text-muted-foreground">
              {flight.departure.code}
            </Text>
            <Text className="text-xs text-muted-foreground font-mono">
              {flight.progress}%
            </Text>
            <Text className="text-xs text-muted-foreground">
              {flight.arrival.code}
            </Text>
          </View>
        </View>

        {/* Event log */}
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
      </View>
    </ScrollView>
  );
}
