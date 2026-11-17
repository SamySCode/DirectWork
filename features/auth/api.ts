import * as Linking from "expo-linking";
import { invokeFunction } from "../../lib/functions";
import { supabase } from "../../lib/supabase";
import { PRIVACY_VERSION, TERMS_VERSION } from "../legal/versions";
import type { ForgotPasswordInput, SignInInput, SignUpInput } from "./schemas";
import { beginSigningOut, endSigningOut } from "./signingOut";

export async function signUp({ email, password }: SignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Send people back into the app (web origin or the directwork:// scheme)
    // after confirming, rather than to the Supabase Site URL default.
    options: {
      emailRedirectTo: Linking.createURL("/sign-in"),
      // Read by the auth.users AFTER INSERT trigger, which records the
      // acceptance in public.legal_acceptances (the form requires the box).
      data: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, age_confirmed: true },
    },
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

/**
 * Signs out, with the "Signing out" cover up from the first moment (see
 * signingOut.ts). On success the cover is taken down by the route guard once
 * it has moved to the welcome screen, not here, so the signed-in screen
 * never shows through in between.
 *
 * If the server can't be reached the session on this device is still
 * cleared (supabase-js does that), which is what the person asked for, so
 * that counts as signed out. It only throws when they are still signed in.
 */
export async function signOut() {
  // Cover first: even reading the stored session can wait on the network
  // (an expired token is refreshed), and the press must show at once.
  beginSigningOut();
  try {
    const current = await supabase.auth.getSession();
    if (!current.data.session) {
      // Nothing to sign out of, so no redirect is coming to lift the cover.
      endSigningOut();
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (!error) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    throw error;
  } catch (error) {
    endSigningOut();
    throw error;
  }
}

export async function requestPasswordReset({ email }: ForgotPasswordInput) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: Linking.createURL("/update-password"),
  });
  if (error) throw error;
}

/**
 * Permanently deletes the account and everything it owns. Re-checks the
 * password first: the server only accepts deletion within minutes of a
 * password sign-in (the JWT `amr` claim - see supabase/functions/delete-account),
 * so the function is called straight after, with the new session's token
 * (supabase-js reads the current session for every request). Server
 * refusals (DELETION_UNAVAILABLE under a legal hold, REAUTH_REQUIRED) come
 * back as FunctionErrors carrying the server's message.
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
