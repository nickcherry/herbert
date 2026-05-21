import { startHerbertServer } from "@herbert/server/server/startHerbertServer";
import { describe, expect, test } from "bun:test";

describe("startHerbertServer", () => {
  test("starts a pingable Bun server", async () => {
    const handle = await startHerbertServer({
      host: "127.0.0.1",
      port: 0,
      telegramPolling: false,
    });

    try {
      const response = await fetch(`${handle.url}/ping`);

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
