import { ReactNode, useEffect, useRef } from "react";
import { Animated } from "react-native";
import { nativeDriverEnabled } from "../lib/animation";

type FadeInProps = {
  children: ReactNode;
  duration?: number;
};

export function FadeIn({ children, duration = 250 }: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: nativeDriverEnabled,
    }).start();
  }, [opacity, duration]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
