import { jsonResponse } from "@herbert/server/server/jsonResponse";

export const pingRoutePath = "/ping";

export function handlePingRoute({ request }: { readonly request: Request }) {
  if (request.method !== "GET") {
    return jsonResponse(
      {
        ok: false,
        error: "method_not_allowed",
      },
      { status: 405 },
    );
  }

  return jsonResponse({
    ok: true,
    service: "herbert-server",
  });
}
