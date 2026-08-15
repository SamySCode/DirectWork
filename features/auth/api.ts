import { supabase } from "../../lib/supabase";
import type { ForgotPasswordInput, SignInInput, SignUpInput } from "./schemas";

export async function signUp({ email, password }: SignUpInput) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
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
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
