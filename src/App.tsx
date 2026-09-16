import "../global.css";

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { Plane, Search, AlertCircle, ChevronLeft, Star } from "lucide-react-native";

import {
  FLIGHTS,
  RECENT_SEARCHES,
  SUGGESTED_CODES,
  type FlightData,
  type Screen,
} from "@/data/flights";
import { colors } from "@/theme";
import { StatusBadge } from "@/components/StatusBadge";
import { FlightRow } from "@/components/FlightRow";
import { FlightDetail } from "@/components/FlightDetail";
import { LiveTracker } from "@/components/LiveTracker";

const rotate90 = { transform: [{ rotate: "90deg" }] } as const;
const SCREENS: Screen[] = ["home", "result", "tracker"];

function App() {
  const { width: W } = useWindowDimensions();

  const [query, setQuery] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [flight, setFlight] = useState<FlightData | null>(null);
  const [flightKey, setFlightKey] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  const inputRef = useRef<TextInput>(null);
  const slide = useRef(new Animated.Value(0)).current;

  // Load persisted favorites
  useEffect(() => {
    AsyncStorage.getItem("flyte-favorites").then((v) => {
      if (!v) return;
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) setFavorites(parsed);
      } catch {
        // ignore corrupt value
      }
    });
  }, []);

  const normalize = (s: string) => s.replace(/\s+/g, "").toUpperCase();

  const goTo = (s: Screen) => {
    setScreen(s);
    Animated.timing(slide, {
      toValue: SCREENS.indexOf(s),
      duration: 350,
      useNativeDriver: true,
    }).start();
  };

  const toggleFavorite = (key: string) => {
    setFavorites((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      AsyncStorage.setItem("flyte-favorites", JSON.stringify(next)).catch(
        () => {}
      );
      return next;
    });
  };

  const handleSearch = (raw: string) => {
    const key = normalize(raw);
    if (!key) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchError(null);
    setTimeout(() => {
      const found = FLIGHTS[key] ?? null;
      if (found) {
        setFlight(found);
        setFlightKey(key);
        goTo("result");
      } else {
        setSearchError(`No flight found for "${raw.toUpperCase()}"`);
      }
      setSearching(false);
    }, 700);
  };

  const handleBack = () => {
    if (screen === "tracker") {
      goTo("result");
    } else if (screen === "result") {
      goTo("home");
      setQuery("");
    }
  };

  // Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen !== "home") {
        handleBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen]);

  // Focus the search field when Home is shown
  useEffect(() => {
    if (screen === "home") {
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [screen]);

  const translateX = slide.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -W, -2 * W],
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <Animated.View
          style={{
            flex: 1,
            flexDirection: "row",
            width: W * 3,
            transform: [{ translateX }],
          }}
        >
          {/* ---------- HOME ---------- */}
          <View style={{ width: W }}>
            <ScrollView
              contentContainerClassName="px-7 pt-6 pb-10"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="pb-8">
                <View className="flex-row items-center gap-2 mb-1">
                  <Plane size={16} color={colors.primary} style={rotate90} />
                  <Text
                    className="font-mono text-xs text-primary uppercase"
                    style={{ letterSpacing: 2 }}
                  >
                    Flyte
                  </Text>
                </View>
                <Text className="text-3xl font-semibold text-foreground mt-3">
                  {"Track your\nflight."}
                </Text>
                <Text className="text-sm text-muted-foreground mt-2">
                  Enter a flight number to get live status.
                </Text>
              </View>

              {/* Search field */}
              <View className="relative">
                <TextInput
                  ref={inputRef}
                  value={query}
                  onChangeText={(t) => {
                    setQuery(t.toUpperCase());
                    setSearchError(null);
                  }}
                  onSubmitEditing={() => handleSearch(query)}
                  placeholder="e.g. AA2847"
                  placeholderTextColor="rgba(122,139,170,0.4)"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType="search"
                  className={`w-full bg-secondary border rounded-2xl px-5 py-4 pr-14 font-mono text-lg text-foreground ${
                    searchError ? "border-red-400/50" : "border-border"
                  }`}
                />
                <Pressable
                  onPress={() => handleSearch(query)}
                  disabled={searching || !query.trim()}
                  className={`absolute right-3 top-1/2 w-9 h-9 bg-primary rounded-xl items-center justify-center active:scale-95 ${
                    searching || !query.trim() ? "opacity-30" : ""
                  }`}
                  style={{ transform: [{ translateY: -18 }] }}
                >
                  {searching ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Search size={16} color={colors.background} />
                  )}
                </Pressable>
              </View>

              {searchError ? (
                <View className="mt-2 flex-row items-center gap-2">
                  <AlertCircle size={13} color={colors.red400} />
                  <Text className="text-red-400 text-sm flex-1">{searchError}</Text>
                </View>
              ) : null}

              {/* Suggested codes */}
              <View className="mt-3 flex-row flex-wrap gap-2">
                {SUGGESTED_CODES.map((code) => (
                  <Pressable
                    key={code}
                    onPress={() => {
                      setQuery(code);
                      handleSearch(code);
                    }}
                    className="border border-border rounded-lg px-3 py-1.5 active:scale-95"
                  >
                    <Text className="font-mono text-xs text-muted-foreground">
                      {code}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Favorites */}
              {favorites.length > 0 ? (
                <View className="mt-8">
                  <View className="flex-row items-center gap-1.5 mb-3">
                    <Star size={11} color={colors.primary} fill={colors.primary} />
                    <Text className="text-xs text-muted-foreground tracking-wider uppercase">
                      Favorites
                    </Text>
                  </View>
                  <View className="gap-2">
                    {favorites.map((key) => {
                      const f = FLIGHTS[key];
                      if (!f) return null;
                      return (
                        <FlightRow
                          key={key}
                          flight={f}
                          variant="favorite"
                          onPress={() => {
                            setQuery(key);
                            handleSearch(key);
                          }}
                        />
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Recent */}
              <View className="mt-8">
                <Text className="text-xs text-muted-foreground tracking-wider uppercase mb-3">
                  Recent
                </Text>
                <View className="gap-2">
                  {RECENT_SEARCHES.filter((k) => !favorites.includes(k)).map(
                    (key) => {
                      const f = FLIGHTS[key];
                      if (!f) return null;
                      return (
                        <FlightRow
                          key={key}
                          flight={f}
                          variant="recent"
                          onPress={() => {
                            setQuery(key);
                            handleSearch(key);
                          }}
                        />
                      );
                    }
                  )}
                </View>
              </View>
            </ScrollView>
          </View>

          {/* ---------- RESULT ---------- */}
          <View style={{ width: W }}>
            <ScrollView
              contentContainerClassName="px-7 pt-6 pb-10"
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                onPress={handleBack}
                className="flex-row items-center gap-1.5 mb-5 active:opacity-60"
              >
                <ChevronLeft size={16} color={colors.mutedForeground} />
                <Text className="text-sm text-muted-foreground">Back</Text>
              </Pressable>

              {flight && flightKey ? (
                <>
                  <View className="flex-row items-start justify-between mb-3">
                    <View>
                      <Text className="font-mono text-2xl font-semibold text-foreground">
                        {flight.flightNumber}
                      </Text>
                      <Text className="text-sm text-muted-foreground mt-0.5">
                        {flight.airline}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Pressable
                        onPress={() => toggleFavorite(flightKey)}
                        className="w-8 h-8 items-center justify-center active:scale-90"
                      >
                        <Star
                          size={18}
                          color={
                            favorites.includes(flightKey)
                              ? colors.primary
                              : colors.mutedForeground
                          }
                          fill={
                            favorites.includes(flightKey)
                              ? colors.primary
                              : "transparent"
                          }
                        />
                      </Pressable>
                      <StatusBadge status={flight.status} />
                    </View>
                  </View>

                  <FlightDetail flight={flight} onTrack={() => goTo("tracker")} />
                </>
              ) : null}
            </ScrollView>
          </View>

          {/* ---------- LIVE TRACKER ---------- */}
          <View style={{ width: W }}>
            {flight ? (
              <LiveTracker flight={flight} onBack={handleBack} />
            ) : null}
          </View>
        </Animated.View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;
