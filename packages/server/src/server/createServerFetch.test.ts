import { createServerFetch } from "@herbert/server/server/createServerFetch";
import {
  apiErrorResponseSchema,
  robotControlNextResponseSchema,
  robotControlStatusResponseSchema,
  videoFrameUploadResponseSchema,
  videoStatusResponseSchema,
  webControlCommandResponseSchema,
} from "@herbert/shared";
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

  test("serves the live video app", async () => {
    const fetch = createServerFetch();
    const response = await fetch(new Request("http://localhost/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Herbert Cam");
    expect(html).toContain("/video.mjpeg");
    expect(html).toContain("/control");
    expect(html).toContain('data-control-action="forward"');
  });

  test("queues browser control commands for the robot", async () => {
    const fetch = createServerFetch();
    const queueResponse = await fetch(
      new Request("http://localhost/control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "drive",
          direction: "forward",
          speed: 45,
          durationMs: 300,
        }),
      }),
    );

    expect(queueResponse.status).toBe(200);
    const queuePayload = webControlCommandResponseSchema.parse(
      await queueResponse.json(),
    );
    expect(queuePayload).toMatchObject({
      ok: true,
      queueDepth: 1,
      command: {
        type: "drive",
        direction: "forward",
        speed: 45,
        durationMs: 300,
      },
    });

    const statusResponse = await fetch(
      new Request("http://localhost/robot/control/status"),
    );
    const statusPayload = robotControlStatusResponseSchema.parse(
      await statusResponse.json(),
    );
    expect(statusPayload).toEqual({
      ok: true,
      queueDepth: 1,
      nextCommandId: queuePayload.command.id,
      issuedCount: 1,
    });

    const nextResponse = await fetch(
      new Request("http://localhost/robot/control/next"),
    );
    const nextPayload = robotControlNextResponseSchema.parse(
      await nextResponse.json(),
    );
    expect(nextPayload.command).toEqual(queuePayload.command);

    const emptyResponse = await fetch(
      new Request("http://localhost/robot/control/next"),
    );
    expect(
      robotControlNextResponseSchema.parse(await emptyResponse.json()),
    ).toEqual({
      ok: true,
      command: null,
    });
  });

  test("rejects invalid browser control commands", async () => {
    const fetch = createServerFetch();
    const response = await fetch(
      new Request("http://localhost/control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "drive",
          direction: "forward",
          speed: 200,
          durationMs: 300,
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = apiErrorResponseSchema.parse(await response.json());
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("invalid_control_command");
  });

  test("stop control commands clear older queued movement", async () => {
    const fetch = createServerFetch();

    await fetch(
      new Request("http://localhost/control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "drive",
          direction: "forward",
          speed: 45,
          durationMs: 300,
        }),
      }),
    );
    await fetch(
      new Request("http://localhost/control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "camera",
          axis: "tilt",
          delta: 5,
        }),
      }),
    );
    const stopResponse = await fetch(
      new Request("http://localhost/control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "stop" }),
      }),
    );

    const stopPayload = webControlCommandResponseSchema.parse(
      await stopResponse.json(),
    );
    expect(stopPayload.queueDepth).toBe(1);
    expect(stopPayload.command.type).toBe("stop");

    const nextResponse = await fetch(
      new Request("http://localhost/robot/control/next"),
    );
    const nextPayload = robotControlNextResponseSchema.parse(
      await nextResponse.json(),
    );
    expect(nextPayload.command?.type).toBe("stop");
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

  test("accepts video frames and exposes latest frame plus status", async () => {
    const fetch = createServerFetch();
    const frameBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const uploadResponse = await fetch(
      new Request("http://localhost/robot/video/frames", {
        method: "POST",
        headers: {
          "content-type": "image/jpeg",
          "x-herbert-captured-at-ms": "123",
          "x-herbert-frame-width": "640",
          "x-herbert-frame-height": "480",
        },
        body: frameBytes,
      }),
    );

    expect(uploadResponse.status).toBe(200);
    const uploadPayload = videoFrameUploadResponseSchema.parse(
      await uploadResponse.json(),
    );
    expect(uploadPayload.frameId).toBe(1);
    expect(uploadPayload.subscriberCount).toBe(0);

    const statusResponse = await fetch(
      new Request("http://localhost/video/status"),
    );
    const statusPayload = videoStatusResponseSchema.parse(
      await statusResponse.json(),
    );
    expect(statusPayload).toMatchObject({
      ok: true,
      hasFrame: true,
      frameId: 1,
      capturedAtMs: 123,
      contentType: "image/jpeg",
      byteLength: 4,
      width: 640,
      height: 480,
      subscriberCount: 0,
    });

    const latestResponse = await fetch(
      new Request("http://localhost/video/latest.jpg"),
    );
    expect(latestResponse.status).toBe(200);
    expect(latestResponse.headers.get("content-type")).toBe("image/jpeg");
    expect(latestResponse.headers.get("x-herbert-frame-id")).toBe("1");
    expect(
      Array.from(new Uint8Array(await latestResponse.arrayBuffer())),
    ).toEqual(Array.from(frameBytes));
  });

  test("streams video frames over MJPEG", async () => {
    const fetch = createServerFetch();
    const streamResponse = await fetch(
      new Request("http://localhost/video.mjpeg"),
    );
    const reader = expectDefined(streamResponse.body).getReader();

    try {
      expect(streamResponse.status).toBe(200);
      expect(streamResponse.headers.get("content-type")).toContain(
        "multipart/x-mixed-replace",
      );

      const uploadResponse = await fetch(
        new Request("http://localhost/robot/video/frames", {
          method: "POST",
          headers: { "content-type": "image/jpeg" },
          body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
        }),
      );
      expect(uploadResponse.status).toBe(200);

      const chunk = await reader.read();
      expect(chunk.done).toBe(false);
      expect(new TextDecoder().decode(chunk.value)).toContain(
        "--herbert-video-frame",
      );
    } finally {
      await reader.cancel();
    }
  });

  test("rejects non-jpeg video frame uploads", async () => {
    const fetch = createServerFetch();
    const response = await fetch(
      new Request("http://localhost/robot/video/frames", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "not a jpeg",
      }),
    );

    expect(response.status).toBe(415);
    await expectJson(response, {
      ok: false,
      error: "unsupported_media_type",
      message: "Expected Content-Type: image/jpeg.",
    });
  });
});

async function expectJson(
  response: Response,
  expected: unknown,
): Promise<void> {
  expect(await response.json()).toEqual(expected);
}

function expectDefined<T>(value: T | null | undefined): T {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
  return value as T;
}
