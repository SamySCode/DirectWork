import { useFonts } from "expo-font";

export function useAppFonts() {
  const [loaded, error] = useFonts({
    "GeneralSans-Bold": require("../assets/fonts/GeneralSans-Bold.ttf"),
  });
  return { loaded, error };
}
