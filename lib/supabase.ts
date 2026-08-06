import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

export const supabase = createClient(
  getEnv("EXPO_PUBLIC_SUPABASE_URL"),
  getEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
