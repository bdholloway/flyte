import { View, Text, Pressable } from "react-native";
import { Plane, MapPin, ArrowRight, AlertCircle } from "lucide-react-native";
import type { AirportInfo, FlightData } from "@/data/flights";
import { colors } from "@/theme";
import { PulseDot } from "./PulseDot";

const rotate90 = { transform: [{ rotate: "90deg" }] } as const;

function EndpointCard({ label, info }: { label: string; info: AirportInfo }) {
  return (
    <View className="flex-1 bg-card rounded-2xl p-4 border border-border">
      <Text className="text-xs text-muted-foreground tracking-wider uppercase mb-2">
        {label}
      </Text>
      <Text className="font-mono text-xl font-semibold text-foreground">
        {info.time}
      </Text>
      <View className="mt-2 gap-1">
        <View className="flex-row items-center gap-1.5">
          <MapPin size={10} color={colors.primary} />
          <Text className="text-xs text-muted-foreground">Terminal {info.terminal}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <ArrowRight size={10} color={colors.primary} />
          <Text className="text-xs text-muted-foreground">Gate {info.gate}</Text>
        </View>
      </View>
    </View>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="text-xs text-muted-foreground tracking-wider uppercase mb-0.5">
        {label}
      </Text>
      <Text className="text-sm font-medium text-foreground font-mono">{value}</Text>
    </View>
  );
}

export function FlightDetail({
  flight,
  onTrack,
}: {
  flight: FlightData;
  onTrack: () => void;
}) {
  const landed = flight.status === "landed";
  const delayedOnGround = flight.status === "delayed" && flight.progress === 0;
  const canTrack = flight.progress > 0 && !landed;
  const label = landed
    ? `Arrived ${flight.arrival.time}`
    : delayedOnGround
    ? `Delayed · Est. ${flight.departure.time}`
    : canTrack
    ? "Track Live"
    : "Not yet departed";

  const markerLeft = `${Math.max(4, Math.min(96, flight.progress))}%` as const;

  return (
    <View className="gap-3">
      {/* Route header */}
      <View className="flex-row items-center justify-between px-1 mb-2">
        <View className="items-center">
          <Text className="font-mono text-4xl font-semibold text-foreground tracking-tight">
            {flight.departure.code}
          </Text>
          <Text className="text-muted-foreground text-xs mt-1">
            {flight.departure.city}
          </Text>
        </View>
        <View className="flex-1 px-3 items-center gap-0.5">
          <View className="flex-row items-center gap-1">
            <View className="h-px w-6 bg-border" />
            <Plane size={14} color={colors.primary} style={rotate90} />
            <View className="h-px w-6 bg-border" />
          </View>
          <Text className="text-xs text-muted-foreground font-mono">
            {flight.duration}
          </Text>
        </View>
        <View className="items-center">
          <Text className="font-mono text-4xl font-semibold text-foreground tracking-tight">
            {flight.arrival.code}
          </Text>
          <Text className="text-muted-foreground text-xs mt-1">
            {flight.arrival.city}
          </Text>
        </View>
      </View>

      {/* Progress */}
      <View className="bg-card rounded-2xl p-4 border border-border">
        <View className="flex-row justify-between mb-1">
          <Text className="text-xs font-mono text-muted-foreground">
            {flight.departure.time}
          </Text>
          <Text className="text-xs font-mono text-muted-foreground">
            {flight.arrival.time}
          </Text>
        </View>

        <View className="my-2" style={{ height: 24 }}>
          <View className="absolute left-0 right-0 h-px bg-white/10" style={{ top: 11 }} />
          <View
            className="absolute left-0 h-px bg-primary"
            style={{ top: 11, width: `${flight.progress}%` }}
          />
          <View
            className="absolute w-2 h-2 rounded-full bg-primary"
            style={{ left: 0, top: 8 }}
          />
          <View
            className="absolute w-2 h-2 rounded-full bg-white/20"
            style={{ right: 0, top: 8 }}
          />
          <View
            className="absolute w-6 h-6 rounded-full bg-primary items-center justify-center"
            style={{ left: markerLeft, top: 0, transform: [{ translateX: -12 }], elevation: 4 }}
          >
            <Plane
              size={12}
              color={colors.background}
              fill={colors.background}
              style={rotate90}
            />
          </View>
        </View>

        <View className="flex-row justify-between mt-1">
          <Text className="text-xs text-muted-foreground">
            {flight.progress === 0
              ? "At gate"
              : flight.progress === 100
              ? "Landed"
              : "En route"}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {flight.progress === 100
              ? "Arrived"
              : flight.progress === 0
              ? "Awaiting departure"
              : `${flight.progress}% complete`}
          </Text>
        </View>
      </View>

      {/* Departure / Arrival */}
      <View className="flex-row gap-3">
        <EndpointCard label="Departure" info={flight.departure} />
        <EndpointCard label="Arrival" info={flight.arrival} />
      </View>

      {/* Flight info */}
      <View className="bg-card rounded-2xl p-4 border border-border gap-3">
        <View className="flex-row gap-3">
          <InfoCell label="Airline" value={flight.airline} />
          <InfoCell label="Aircraft" value={flight.aircraft} />
        </View>
        <View className="flex-row gap-3">
          <InfoCell label="Date" value={flight.date} />
          <InfoCell label="Flight" value={flight.flightNumber} />
        </View>
      </View>

      {flight.delay ? (
        <View className="flex-row items-start gap-2 bg-amber-400/10 border border-amber-400/20 rounded-2xl p-4">
          <AlertCircle size={15} color={colors.amber400} style={{ marginTop: 1 }} />
          <Text className="text-sm text-amber-200 flex-1">
            {flight.progress > 0 ? (
              <>
                Departed{" "}
                <Text className="font-mono font-semibold text-amber-400">
                  {flight.delay}
                </Text>{" "}
                late.
              </>
            ) : (
              <>
                Delayed by{" "}
                <Text className="font-mono font-semibold text-amber-400">
                  {flight.delay}
                </Text>
                . Check departure board for updates.
              </>
            )}
          </Text>
        </View>
      ) : null}

      {/* Track Live button */}
      <Pressable
        disabled={!canTrack}
        onPress={canTrack ? onTrack : undefined}
        className={`w-full flex-row items-center justify-center gap-2 rounded-2xl py-4 ${
          canTrack ? "bg-primary active:scale-[0.98]" : "bg-secondary"
        }`}
      >
        {canTrack ? (
          <PulseDot size={8} color={colors.background} haloOpacity={0.6} />
        ) : null}
        <Text
          className={`font-semibold text-sm ${
            canTrack ? "text-background" : "text-muted-foreground"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
