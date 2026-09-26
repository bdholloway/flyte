import { Pressable, View, Text } from "react-native";
import { Plane, Star, Clock } from "lucide-react-native";
import type { SavedFlight } from "@/lib/savedFlights";
import { colors } from "@/theme";

export function FlightRow({
  flight,
  variant,
  onPress,
}: {
  flight: SavedFlight;
  variant: "favorite" | "recent";
  onPress: () => void;
}) {
  const isFav = variant === "favorite";
  return (
    <Pressable
      onPress={onPress}
      className={`w-full flex-row items-center gap-4 bg-card border rounded-2xl px-5 py-4 active:scale-[0.98] ${
        isFav ? "border-primary/20" : "border-border"
      }`}
    >
      <View
        className={`w-8 h-8 rounded-xl items-center justify-center ${
          isFav ? "bg-primary/10" : "bg-secondary"
        }`}
      >
        <Plane
          size={13}
          color={colors.primary}
          style={{ transform: [{ rotate: "90deg" }] }}
        />
      </View>

      <View className="flex-1">
        {/* No status badge: a saved snapshot's status would be stale.
            Tapping the row runs a fresh search. */}
        <Text className="font-mono text-sm font-semibold text-foreground">
          {flight.flightNumber}
        </Text>
        <Text numberOfLines={1} className="text-xs text-muted-foreground mt-0.5">
          {flight.from} → {flight.to} · {flight.airline}
        </Text>
      </View>

      {isFav ? (
        <Star size={12} color={colors.primary} fill={colors.primary} />
      ) : (
        <Clock size={12} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}
