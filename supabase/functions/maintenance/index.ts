// Entry point only; the logic (and its tests) live in handler.ts.
import { createMaintenanceHandler } from "./handler.ts";

Deno.serve(createMaintenanceHandler());
