export const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  border: "#E2E5EA",
  textPrimary: "#111827",
  textSecondary: "#4B5563",
  textMuted: "#9CA3AF",
  accent: "#1D4ED8",
  accentMuted: "#DBEAFE",
  onAccent: "#FFFFFF",
  success: "#15803D",
  danger: "#B91C1C",
  warning: "#B45309",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

export const typography = {
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;
