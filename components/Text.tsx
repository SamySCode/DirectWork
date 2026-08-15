import { Text as RNText, TextProps } from "react-native";
import { typography } from "../lib/theme";

export function Text({ style, ...props }: TextProps) {
  return <RNText style={[{ fontFamily: typography.fontFamily }, style]} {...props} />;
}
