import * as Linking from "expo-linking";
import { invokeFunction } from "../../lib/functions";
import { supabase } from "../../lib/supabase";
import type { ForgotPasswordInput, SignInInput, SignUpInput } from "./schemas";

export async function signUp({ email, password }: SignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Send people back into the app (web origin or the directwork:// scheme)
    // after confirming, rather than to the Supabase Site URL default.
    options: { emailRedirectTo: Linking.createURL("/sign-in") },
  });
  if (error) throw error;
  return data;
}

/** Re-sends the sign-up confirmation email (rate-limited by Supabase). */
export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: Linking.createURL("/sign-in") },
  });
  if (error) throw error;
}

export async function signIn({ email, password }: SignInInput) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset({ email }: ForgotPasswordInput) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: Linking.createURL("/update-password"),
  });
  if (error) throw error;
}

/**
 * Permanently deletes the account and everything it owns. Re-checks the
 * password first: the server only accepts deletion right after a fresh
 * sign-in (see supabase/functions/delete-account).
 */
export async function deleteAccount(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      error.code === "invalid_credentials" ? "That password isn't right." : error.message,
    );
  }
  await invokeFunction("delete-account", {});
  // The user no longer exists server-side; clear the local session too.
  await supabase.auth.signOut({ scope: "local" });
}
