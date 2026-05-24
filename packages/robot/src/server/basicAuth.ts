import { env } from "@herbert/robot/constants/env";

export interface RobotServerBasicAuthCredentials {
  readonly username: string;
  readonly password: string;
}

export function robotServerBasicAuthHeaders(): Record<string, string> {
  const credentials = robotServerBasicAuthCredentialsFromEnv();

  if (credentials === undefined) {
    return {};
  }

  return {
    authorization: basicAuthHeaderValue(credentials),
  };
}

export function basicAuthHeaderValue({
  username,
  password,
}: RobotServerBasicAuthCredentials): string {
  if (username.length === 0) {
    throw new Error("HERBERT_BASIC_AUTH_USERNAME must not be empty.");
  }

  if (username.includes(":")) {
    throw new Error("HERBERT_BASIC_AUTH_USERNAME must not contain `:`.");
  }

  if (password.length === 0) {
    throw new Error("HERBERT_BASIC_AUTH_PASSWORD must not be empty.");
  }

  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function robotServerBasicAuthCredentialsFromEnv():
  | RobotServerBasicAuthCredentials
  | undefined {
  const username = env.basicAuthUsername;
  const password = env.basicAuthPassword;

  if (username === undefined && password === undefined) {
    return undefined;
  }

  if (username === undefined || password === undefined) {
    throw new Error(
      "HERBERT_BASIC_AUTH_USERNAME and HERBERT_BASIC_AUTH_PASSWORD must be set together.",
    );
  }

  return {
    username,
    password,
  };
}
