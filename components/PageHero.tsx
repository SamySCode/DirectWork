import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout, radius, spacing, TabTheme, typography } from "../lib/theme";
import { Text } from "./Text";

type PageHeroProps = {
  theme: TabTheme;
  title: string;
  subtitle?: string;
  /** Above the title - e.g. the ConnectMark or an avatar. */
  top?: ReactNode;
  /** Below the subtitle - stats, actions, a search field. */
  children?: ReactNode;
};

/** The gradient header band used at the top of every tab. */
export function PageHero({ theme, title, subtitle, top, children }: PageHeroProps) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={theme.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}
    >
      <View style={styles.inner}>
        {top}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </LinearGradient>
  );
}

type HeroStatProps = { value: number | string; label: string };

export function HeroStat({ value, label }: HeroStatProps) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function HeroStats({ children }: { children: ReactNode }) {
  return <View style={styles.stats}>{children}</View>;
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  inner: {
    width: "100%",
    maxWidth: layout.maxContentWidth - spacing.lg * 2,
    alignSelf: "center",
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xxl,
    color: colors.onInk,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: "rgba(255,255,255,0.78)",
    marginTop: -spacing.sm,
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.xl,
    rowGap: spacing.sm,
  },
  stat: {
    gap: 2,
  },
  statValue: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xl,
    color: colors.onInk,
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: "rgba(255,255,255,0.75)",
  },
});
