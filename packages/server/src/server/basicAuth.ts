import { timingSafeEqual } from "node:crypto";

import { jsonResponse } from "@herbert/server/server/jsonResponse";
import { apiErrorResponseSchema } from "@herbert/shared";

export interface BasicAuthCredentials {
  readonly username: string;
  readonly password: string;
}

export function assertValidBasicAuthCredentials({
  username,
  password,
}: BasicAuthCredentials): void {
  if (username.length === 0) {
    throw new Error("Basic auth username must not be empty.");
  }

  if (username.includes(":")) {
    throw new Error("Basic auth username must not contain `:`.");
  }

  if (password.length === 0) {
    throw new Error("Basic auth password must not be empty.");
  }
}

export function isBasicAuthAuthorized({
  request,
  credentials,
}: {
  readonly request: Request;
  readonly credentials: BasicAuthCredentials;
}): boolean {
  const parsed = parseBasicAuthHeader({
    authorization: request.headers.get("authorization"),
  });

  if (parsed === undefined) {
    return false;
  }

  return (
    timingSafeStringEqual(parsed.username, credentials.username) &&
    timingSafeStringEqual(parsed.password, credentials.password)
  );
}

export function basicAuthChallengeResponse(): Response {
  return jsonResponse(
    apiErrorResponseSchema.parse({
      ok: false,
      error: "unauthorized",
      message: "Basic authentication is required.",
    }),
    {
      status: 401,
      headers: {
        "cache-control": "no-store",
        "www-authenticate": `${basicAuthScheme} realm="${basicAuthRealm}", charset="UTF-8"`,
      },
    },
  );
}

function parseBasicAuthHeader({
  authorization,
}: {
  readonly authorization: string | null;
}): BasicAuthCredentials | undefined {
  if (authorization === null) {
    return undefined;
  }

  const [scheme, encoded] = authorization.split(" ");
  if (scheme !== basicAuthScheme || encoded === undefined) {
    return undefined;
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) {
    return undefined;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.byteLength !== bBuffer.byteLength) {
    const length = Math.max(aBuffer.byteLength, bBuffer.byteLength);
    const paddedA = Buffer.alloc(length);
    const paddedB = Buffer.alloc(length);
    aBuffer.copy(paddedA);
    bBuffer.copy(paddedB);
    timingSafeEqual(paddedA, paddedB);
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

const basicAuthScheme = "Basic";
const basicAuthRealm = "Herbert Cam";
