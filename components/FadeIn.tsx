import { ReactNode, useEffect, useRef } from "react";
import { Animated } from "react-native";
import { useReducedMotion } from "../lib/accessibility";
import { nativeDriverEnabled } from "../lib/animation";

type FadeInProps = {
  children: ReactNode;
  duration?: number;
};

export function FadeIn({ children, duration = 250 }: FadeInProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: nativeDriverEnabled,
    }).start();
  }, [opacity, duration, reduceMotion]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
