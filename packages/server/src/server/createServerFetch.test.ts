import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { recordRobotTaskResponse } from "@herbert/server/robotTasks/robotTaskStore";
import { createServerFetch } from "@herbert/server/server/createServerFetch";
import { robotTaskActionBatchPollResponseSchema } from "@herbert/shared";
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
        caption: undefined,
      },
      {
        chatId: "202",
        filename: "herbert.jpg",
        caption: undefined,
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

  test("polls and completes queued robot action batches", async () => {
    const store = createMemoryDocumentStore();
    await recordRobotTaskResponse({
      chatId: "101",
      store,
      response: {
        telegramMessage: null,
        spokenMessage: null,
        taskState: "Need an initial look.",
        isFinished: false,
        actions: [{ type: "take_photo" }],
      },
    });

    const sentPhotos: string[] = [];
    const sentMessages: string[] = [];
    const fetch = createServerFetch({
      telegramBotToken: "token",
      store,
      async sendTelegramPhoto({ chatId }) {
        sentPhotos.push(chatId);
        return { messageId: 201 };
      },
      async sendTelegramMessage({ text }) {
        sentMessages.push(text);
        return { messageId: 202 };
      },
      async respondToTelegramMessage() {
        return {
          telegramMessage: "I have the photo now.",
          spokenMessage: null,
          taskState: "Initial photo captured.",
          isFinished: true,
          actions: [],
        };
      },
    });

    const pollResponse = await fetch(
      new Request("http://localhost/robot/action-batches/next"),
    );
    const pollPayload = robotTaskActionBatchPollResponseSchema.parse(
      await pollResponse.json(),
    );

    expect(pollResponse.status).toBe(200);
    expect(pollPayload.batch?.actions).toEqual([{ type: "take_photo" }]);

    const body = new FormData();
    const batch = expectDefined(pollPayload.batch);
    body.set("batchId", batch.id);
    body.set("taskId", batch.taskId);
    body.append(
      "image",
      new File(["image-bytes"], "observation.jpg"),
      "observation.jpg",
    );

    const completeResponse = await fetch(
      new Request("http://localhost/robot/action-batches/complete", {
        method: "POST",
        body,
      }),
    );

    expect(completeResponse.status).toBe(200);
    await expectJson(completeResponse, {
      ok: true,
      accepted: true,
    });
    expect(sentPhotos).toEqual(["101"]);
    expect(sentMessages).toEqual(["I have the photo now."]);
  });
});

async function expectJson(
  response: Response,
  expected: unknown,
): Promise<void> {
  expect(await response.json()).toEqual(expected);
}

function createMemoryDocumentStore(): DocumentStore {
  const documents = new Map<string, unknown>();

  return {
    async read({ collection, key, schema }) {
      const value = documents.get(`${collection}:${key}`);
      return value === undefined ? undefined : schema.parse(value);
    },
    async write({ collection, key, schema, value }) {
      documents.set(`${collection}:${key}`, schema.parse(value));
    },
  } satisfies DocumentStore;
}

function expectDefined<T>(value: T | null | undefined): T {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
  return value as T;
}
