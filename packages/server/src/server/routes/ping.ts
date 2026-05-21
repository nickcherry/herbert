import { jsonResponse } from "@herbert/server/server/jsonResponse";

export const pingRoutePath = "/ping";

export function handlePingRoute() {
  return jsonResponse({
    ok: true,
    service: "herbert-server",
  });
}
