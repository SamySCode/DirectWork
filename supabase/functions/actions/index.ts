// The single gate for every sensitive state transition (CLAUDE.md,
// docs/ACCESS_CONTROL.md). Authenticates the caller from their JWT, validates
// the payload shape, and hands off to a private.* SQL function that does the
// authorization and the transition atomically. One function rather than one
// per action keeps cold starts and deploy surface down.

import { fromDbError, handle, HttpError, serviceClient } from "../_shared/http.ts";
import { actionSchema, toRpc } from "./schema.ts";

// 60 actions a minute per user is far above human pace; it only bites scripts.
handle("actions", { rateLimit: { max: 60, windowSeconds: 60 } }, async ({ user, body }) => {
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const [fn, args] = toRpc(user.id, parsed.data);
  const { error } = await serviceClient().rpc(fn, args);
  if (error) throw fromDbError(error);
  return { ok: true };
});
