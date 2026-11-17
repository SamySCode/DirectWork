import { ReactNode, useEffect, useRef } from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";
import { useReducedMotion } from "../lib/accessibility";
import { nativeDriverEnabled } from "../lib/animation";

/**
 * An opacity that runs from 0 to 1 once, when the component mounts. Put it
 * on an `Animated.View`. With Reduce Motion on it is 1 from the start.
 */
export function useFadeIn(duration = 250): Animated.Value {
  const reduceMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: nativeDriverEnabled,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity, duration, reduceMotion]);

  return opacity;
}

type FadeInProps = {
  children: ReactNode;
  duration?: number;
  /** Layout for the wrapper, e.g. the `gap` its children had before being wrapped. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Fades its children in when it mounts. Use it where content replaces a
 * loading placeholder, so the swap is a short dissolve and not a hard cut.
 * To fade a different thing in later, give it a new `key`.
 */
export function FadeIn({ children, duration = 250, style }: FadeInProps) {
  const opacity = useFadeIn(duration);
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
