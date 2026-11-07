// Entry point only; the logic (and its tests) live in handler.ts.
import { createBillingWebhookHandler } from "./handler.ts";

Deno.serve(createBillingWebhookHandler());
