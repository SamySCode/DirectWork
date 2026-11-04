import { Alert, Platform } from "react-native";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
};

/**
 * Cross-platform confirm dialog. React Native Web's Alert is a no-op, so
 * web falls back to the browser's native confirm().
 */
export function confirm({
  title,
  message,
  confirmLabel,
  destructive,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}
