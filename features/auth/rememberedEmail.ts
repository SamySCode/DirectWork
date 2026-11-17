import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The sign-in email, kept on this device only when the person ticks
// "Remember my email on this device". It is never sent anywhere.
//
// Legal basis (docs/legal/ropa.md, Cookies & Storage notice): storing it is
// not strictly necessary, so under PECR it needs consent. The tick box is
// the consent: unticked by default, optional, explained next to the box,
// and withdrawn by unticking, which deletes it at once. Keep it that way:
// never pre-tick the box, never store the email without the tick, and keep
// the notices in features/legal/documents in step with any change here.

const KEY = "directwork.remembered-email";

export async function getRememberedEmail(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return window.localStorage.getItem(KEY);
    return await SecureStore.getItemAsync(KEY);
  } catch {
    // Private browsing, blocked storage, a reset keystore: just don't prefill.
    return null;
  }
}

export async function rememberEmail(email: string): Promise<void> {
  try {
    if (Platform.OS === "web") window.localStorage.setItem(KEY, email);
    else await SecureStore.setItemAsync(KEY, email);
  } catch {
    // Not being remembered is harmless.
  }
}

export async function forgetEmail(): Promise<void> {
  try {
    if (Platform.OS === "web") window.localStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing stored, or storage unavailable: nothing to forget.
  }
}
