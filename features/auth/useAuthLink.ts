import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { supabase } from "../../lib/supabase";

/**
 * What an auth email link (sign-up confirmation, password reset) carried.
 * PKCE links bring a one-time `?code=`; failed ones bring `error_code` /
 * `error_description`, in the query or the #fragment.
 */
export type AuthLinkParams = { code: string | null; errorCode: string | null };

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/**
 * Hand-rolled rather than URLSearchParams: React Native's polyfill doesn't
 * implement `get`, and the fragment needs reading too.
 */
export function parseAuthLink(url: string | null): AuthLinkParams {
  const params: Record<string, string> = {};
  if (url) {
    const [beforeHash, hash = ""] = url.split("#", 2) as [string, string?];
    const query = beforeHash.includes("?") ? beforeHash.slice(beforeHash.indexOf("?") + 1) : "";
    for (const part of [query, hash]) {
      for (const pair of part.split("&")) {
        if (!pair) continue;
        const [key, value = ""] = pair.split("=", 2) as [string, string?];
        params[decode(key)] = decode(value);
      }
    }
  }
  return {
    code: params.code || null,
    errorCode: params.error_code || params.error || null,
  };
}

export type AuthLinkState =
  /** No auth link, or nothing to say about it. */
  | { status: "idle" }
  /** A code is being exchanged for a session. */
  | { status: "exchanging" }
  /** The code worked: the session listener takes it from here. */
  | { status: "signed_in" }
  /** The link was valid but this device can't finish it (other device/browser, reused). */
  | { status: "exchange_failed" }
  /** The link itself was refused: expired, already used, malformed. */
  | { status: "link_error"; expired: boolean };

function initialState(url: string | null): AuthLinkState {
  const { code, errorCode } = parseAuthLink(url);
  if (errorCode) return { status: "link_error", expired: errorCode === "otp_expired" };
  return code ? { status: "exchanging" } : { status: "idle" };
}

/**
 * Finishes an auth email link opened in the app. Native exchanges the code
 * itself; web lets supabase-js do it (detectSessionInUrl) and just waits for
 * that to settle. Tokens are never accepted from a URL: a code only works on
 * the device that asked for it, so a crafted link can't swap in another account.
 */
export function useAuthLink(): AuthLinkState {
  const url = Linking.useLinkingURL();
  const [state, setState] = useState<AuthLinkState>(() => initialState(url));

  useEffect(() => {
    const next = initialState(url);
    setState(next);
    if (next.status !== "exchanging") return;
    const { code } = parseAuthLink(url);
    let cancelled = false;
    const finish = (ok: boolean) => {
      if (!cancelled) setState({ status: ok ? "signed_in" : "exchange_failed" });
    };
    const attempt =
      Platform.OS === "web"
        ? supabase.auth.getSession().then(({ data }) => !!data.session)
        : supabase.auth.exchangeCodeForSession(code!).then(({ error }) => !error);
    attempt.then(finish, () => finish(false));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
