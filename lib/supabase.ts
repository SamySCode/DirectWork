import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { getEnv } from "./env";
import { LargeSecureStore } from "./secureStorage";

export const supabase = createClient(
  getEnv("EXPO_PUBLIC_SUPABASE_URL"),
  getEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  {
    auth: {
      // Native: encrypted, key in the Keychain/Keystore (lib/secureStorage.ts).
      // Web: browser storage - there's no secure enclave to use there.
      storage: Platform.OS === "web" ? AsyncStorage : new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      // PKCE: email links carry a one-time `?code=`, not live tokens. A code
      // can only be exchanged by the device that requested it (it holds the
      // matching verifier), so a crafted link can't sign this device into
      // someone else's account, and an app intercepting the custom scheme
      // gets nothing usable.
      flowType: "pkce",
      // On web supabase-js exchanges `?code=` itself; native does it in
      // app/update-password.tsx.
      detectSessionInUrl: Platform.OS === "web",
    },
  },
);
