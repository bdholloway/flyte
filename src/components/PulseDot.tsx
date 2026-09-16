import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

/**
 * Small pulsing dot — the RN stand-in for Tailwind's `animate-ping`
 * (a solid dot with an expanding, fading halo behind it).
 */
export function PulseDot({
  size = 8,
  color,
  haloOpacity = 0.7,
}: {
  size?: number;
  color: string;
  haloOpacity?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [haloOpacity, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
