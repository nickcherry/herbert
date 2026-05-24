import {
  basicAuthHeaderValue,
  robotServerBasicAuthHeaders,
} from "@herbert/robot/server/basicAuth";
import { describe, expect, test } from "bun:test";

describe("robot server basic auth", () => {
  test("encodes credentials as a Basic auth header", () => {
    expect(
      basicAuthHeaderValue({
        username: "driver",
        password: "open-sesame:please",
      }),
    ).toBe("Basic ZHJpdmVyOm9wZW4tc2VzYW1lOnBsZWFzZQ==");
  });

  test("returns auth headers from env when configured", () => {
    withBasicAuthEnv(
      {
        username: "driver",
        password: "open-sesame",
      },
      () => {
        expect(robotServerBasicAuthHeaders()).toEqual({
          authorization: "Basic ZHJpdmVyOm9wZW4tc2VzYW1l",
        });
      },
    );
  });

  test("omits auth headers when env is not configured", () => {
    withBasicAuthEnv({}, () => {
      expect(robotServerBasicAuthHeaders()).toEqual({});
    });
  });
});

function withBasicAuthEnv(
  credentials:
    | {
        readonly username: string;
        readonly password: string;
      }
    | Record<string, never>,
  run: () => void,
): void {
  const oldUsername = process.env.HERBERT_BASIC_AUTH_USERNAME;
  const oldPassword = process.env.HERBERT_BASIC_AUTH_PASSWORD;

  try {
    if ("username" in credentials) {
      process.env.HERBERT_BASIC_AUTH_USERNAME = credentials.username;
      process.env.HERBERT_BASIC_AUTH_PASSWORD = credentials.password;
    } else {
      delete process.env.HERBERT_BASIC_AUTH_USERNAME;
      delete process.env.HERBERT_BASIC_AUTH_PASSWORD;
    }

    run();
  } finally {
    restoreEnv("HERBERT_BASIC_AUTH_USERNAME", oldUsername);
    restoreEnv("HERBERT_BASIC_AUTH_PASSWORD", oldPassword);
  }
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
