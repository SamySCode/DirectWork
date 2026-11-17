import { ReactNode, useEffect, useRef } from "react";
import { Animated, DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { a11yState, useReducedMotion } from "../lib/accessibility";
import { nativeDriverEnabled } from "../lib/animation";
import { colors, layout, motion, radius, spacing, surfaces } from "../lib/theme";

// A response that arrives this quickly never shows a placeholder at all:
// a flash of grey boxes is worse than a brief still page.
const SHOW_AFTER_MS = 150;
const PULSE_HALF_MS = 800;
// Shallow on purpose: the boxes are already quiet, and a deep fade makes
// them vanish against the page at the bottom of each pulse.
const PULSE_LOW = 0.6;

type SkeletonProps = {
  children: ReactNode;
  /**
   * Fill the screen with the standard page gutter and content column. For
   * screens that return the placeholder instead of their `Screen`.
   */
  page?: boolean;
  /** What a screen reader announces in place of the boxes. */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The frame for a loading placeholder: grey boxes in the shape of what is
 * about to appear. Build the shape from `Bone`, `SkeletonCard` and the
 * presets below, and keep it close to the real layout so nothing jumps when
 * the content arrives.
 *
 * One animated value drives the whole group (a slow opacity pulse on the
 * native driver), so a screen of placeholders costs one animation, not one
 * per box. With Reduce Motion on it is shown still.
 *
 * Use it where the shape of the content is known. Where it is not (checking
 * a reset link, a permission check), `LoadingState` is the honest choice.
 */
export function Skeleton({ children, page = false, label = "Loading", style }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const step = (toValue: number, duration: number) =>
      Animated.timing(opacity, { toValue, duration, useNativeDriver: nativeDriverEnabled });
    const pulse = Animated.loop(
      Animated.sequence([step(PULSE_LOW, PULSE_HALF_MS), step(1, PULSE_HALF_MS)]),
    );
    const appear = Animated.sequence([Animated.delay(SHOW_AFTER_MS), step(1, motion.base)]);
    appear.start(({ finished }) => {
      if (finished) pulse.start();
    });
    return () => {
      appear.stop();
      pulse.stop();
    };
  }, [opacity, reduceMotion]);

  return (
    <View
      style={page ? styles.page : undefined}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      {...a11yState({ busy: true })}
    >
      <Animated.View aria-hidden style={[page ? styles.column : styles.stack, style, { opacity }]}>
        {children}
      </Animated.View>
    </View>
  );
}

type BoneProps = {
  width?: DimensionValue;
  height?: number;
  /** Corner radius. Lines default to a soft 6; pass `radius.pill` for chips and avatars. */
  rounded?: number;
  style?: StyleProp<ViewStyle>;
};

/** One grey box. */
export function Bone({ width = "100%", height = 12, rounded = 6, style }: BoneProps) {
  return <View style={[styles.bone, { width, height, borderRadius: rounded }, style]} />;
}

type SkeletonLinesProps = {
  lines?: number;
  /** The line height of the text being stood in for, so the block is the same height. */
  lineHeight?: number;
};

/** A paragraph: full-width lines with a short last one. */
export function SkeletonLines({ lines = 3, lineHeight = 20 }: SkeletonLinesProps) {
  const height = Math.round(lineHeight * 0.55);
  const margin = (lineHeight - height) / 2;
  return (
    <View>
      {Array.from({ length: lines }, (_, index) => (
        <Bone
          key={index}
          height={height}
          width={index === lines - 1 && lines > 1 ? "60%" : "100%"}
          style={{ marginVertical: margin }}
        />
      ))}
    </View>
  );
}

/** A card outline. Flat on purpose: a placeholder shouldn't cast a shadow. */
export function SkeletonCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type SkeletonRowProps = {
  /** The shape in front of the text: a rounded icon tile or a round avatar. */
  leading?: "icon" | "avatar";
};

/** A list row card: optional leading shape, a title line and a detail line. */
export function SkeletonRow({ leading }: SkeletonRowProps) {
  return (
    <SkeletonCard style={styles.row}>
      {leading ? (
        <Bone width={40} height={40} rounded={leading === "avatar" ? radius.pill : radius.md} />
      ) : null}
      <View style={styles.rowText}>
        <Bone width="55%" height={14} />
        <Bone width="80%" />
      </View>
    </SkeletonCard>
  );
}

/** `count` list rows, spaced like a list of cards. */
export function SkeletonRows({ count = 3, leading }: SkeletonRowProps & { count?: number }) {
  return (
    <View style={styles.rows}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonRow key={index} leading={leading} />
      ))}
    </View>
  );
}

/** A detail page: eyebrow and title, a summary card, then a section of text. */
export function SkeletonDetail() {
  return (
    <Skeleton page>
      <View style={styles.heading}>
        <Bone width="40%" />
        <Bone width="75%" height={24} />
      </View>
      <SkeletonCard style={styles.detailCard}>
        <Bone width="35%" height={20} rounded={radius.pill} />
        <SkeletonLines lines={3} lineHeight={23} />
      </SkeletonCard>
      <View style={styles.section}>
        <Bone width="30%" height={10} />
        <SkeletonLines lines={4} lineHeight={23} />
      </View>
    </Skeleton>
  );
}

/** A form page: `fields` labelled inputs. */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <Skeleton page>
      {Array.from({ length: fields }, (_, index) => (
        <View key={index} style={styles.section}>
          <Bone width="30%" />
          <Bone height={48} rounded={radius.md} />
        </View>
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Same column as `Screen`, so the page doesn't shift when it takes over.
  column: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    padding: spacing.lg,
    gap: spacing.lg,
  },
  stack: {
    gap: spacing.md,
  },
  bone: {
    backgroundColor: colors.skeleton,
  },
  card: {
    ...surfaces.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.sm,
  },
  rows: {
    gap: spacing.md,
  },
  heading: {
    gap: spacing.sm,
  },
  detailCard: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
});
