import { startHerbertServer } from "@herbert/server/server/startHerbertServer";
import { describe, expect, test } from "bun:test";

describe("startHerbertServer", () => {
  test("starts a pingable Bun server", async () => {
    const handle = await startHerbertServer({
      host: "127.0.0.1",
      port: 0,
      basicAuthCredentials: testBasicAuthCredentials,
    });

    try {
      const unauthenticatedResponse = await fetch(`${handle.url}/ping`);
      expect(unauthenticatedResponse.status).toBe(401);

      const response = await fetch(`${handle.url}/ping`, {
        headers: {
          authorization: basicAuthHeaderValue(testBasicAuthCredentials),
        },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        service: "herbert-server",
      });
    } finally {
      await handle.stop();
    }
  });
});

function basicAuthHeaderValue({
  username,
  password,
}: {
  readonly username: string;
  readonly password: string;
}): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

const testBasicAuthCredentials = {
  username: "driver",
  password: "open-sesame",
};
