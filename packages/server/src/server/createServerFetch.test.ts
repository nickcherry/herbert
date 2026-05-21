import { createServerFetch } from "@herbert/server/server/createServerFetch";
import { describe, expect, test } from "bun:test";

describe("createServerFetch", () => {
  test("responds to /ping", async () => {
    const fetch = createServerFetch();
    const response = await fetch(new Request("http://localhost/ping"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expectJson(response, {
      ok: true,
      service: "herbert-server",
    });
  });

  test("rejects unsupported /ping methods", async () => {
    const fetch = createServerFetch();
    const response = await fetch(
      new Request("http://localhost/ping", { method: "POST" }),
    );

    expect(response.status).toBe(405);
    await expectJson(response, {
      ok: false,
      error: "method_not_allowed",
    });
  });

  test("returns JSON 404 for unknown routes", async () => {
    const fetch = createServerFetch();
    const response = await fetch(new Request("http://localhost/missing"));

    expect(response.status).toBe(404);
    await expectJson(response, {
      ok: false,
      error: "not_found",
    });
  });

  test("sends uploaded robot photos to telegram admins", async () => {
    const calls: Array<{
      readonly chatId: string;
      readonly filename: string;
      readonly caption?: string;
    }> = [];
    const fetch = createServerFetch({
      telegramBotToken: "token",
      telegramAdminChatIds: ["101", "202"],
      async sendTelegramPhoto({ chatId, filename, caption }) {
        calls.push({ chatId, filename, caption });
        return { messageId: Number(chatId) + 1 };
      },
    });
    const body = new FormData();
    body.append(
      "image",
      new File(["image-bytes"], "herbert.jpg"),
      "herbert.jpg",
    );
    body.set("sourcePath", "/tmp/herbert.jpg");

    const response = await fetch(
      new Request("http://localhost/robot/photos", {
        method: "POST",
        body,
      }),
    );

    expect(response.status).toBe(200);
    await expectJson(response, {
      ok: true,
      messageIds: [102, 203],
    });
    expect(calls).toEqual([
      {
        chatId: "101",
        filename: "herbert.jpg",
        caption: "Herbert photo\n/tmp/herbert.jpg",
      },
      {
        chatId: "202",
        filename: "herbert.jpg",
        caption: "Herbert photo\n/tmp/herbert.jpg",
      },
    ]);
  });

  test("rejects robot photo uploads without an image attachment", async () => {
    const fetch = createServerFetch({
      telegramBotToken: "token",
      telegramAdminChatIds: ["101"],
    });
    const response = await fetch(
      new Request("http://localhost/robot/photos", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(400);
    await expectJson(response, {
      ok: false,
      error: "missing_image",
      message: "Expected multipart field `image` containing a file.",
    });
  });
});

async function expectJson(
  response: Response,
  expected: unknown,
): Promise<void> {
  expect(await response.json()).toEqual(expected);
}
