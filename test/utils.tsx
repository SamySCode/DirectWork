import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, RenderOptions } from "@testing-library/react-native";
import { ReactElement, ReactNode } from "react";

/** Renders inside a fresh QueryClient (no retries, no cache shared between tests). */
export function renderWithClient(ui: ReactElement, options?: RenderOptions) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...render(ui, { wrapper: Wrapper, ...options }) };
}
