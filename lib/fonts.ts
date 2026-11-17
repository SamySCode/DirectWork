import { useFonts } from "expo-font";

export function useAppFonts() {
  const [loaded, error] = useFonts({
    "GeneralSans-Bold": require("../assets/fonts/GeneralSans-Bold.ttf"),
  });
  // A font that fails to load must not hold the app on its loading screen:
  // text falls back to the system face.
  return { loaded: loaded || !!error, error };
}
