import type { ErrorBoundaryProps } from "expo-router";
import { errorMessage } from "../lib/functions";
import { ErrorState } from "./ErrorState";

/**
 * Re-exported as `ErrorBoundary` from route files, so a screen that throws
 * while rendering is replaced by a retry prompt on its own - the tab bar,
 * header and every other screen keep working. (The root layout's boundary
 * is the last resort and takes over the whole app.)
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ErrorState
      title="Something broke on this screen"
      description={errorMessage(error)}
      onRetry={retry}
    />
  );
}
