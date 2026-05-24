import { env } from "@herbert/server/constants/env";
import { serverConfig } from "@herbert/server/constants/server";
import {
  assertValidBasicAuthCredentials,
  type BasicAuthCredentials,
} from "@herbert/server/server/basicAuth";
import { createServerFetch } from "@herbert/server/server/createServerFetch";

export interface StartHerbertServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly basicAuthCredentials?: BasicAuthCredentials;
}

export interface HerbertServerHandle {
  readonly server: Bun.Server<undefined>;
  readonly url: string;
  readonly stop: () => Promise<void>;
}

export async function startHerbertServer({
  host = serverConfig.host,
  port = serverConfig.port,
  basicAuthCredentials = requireBasicAuthCredentials(),
}: StartHerbertServerOptions = {}): Promise<HerbertServerHandle> {
  const tls = await loadTlsConfigFromEnv();
  const server = Bun.serve({
    hostname: host,
    port,
    idleTimeout: serverConfig.idleTimeoutSeconds,
    fetch: createServerFetch({
      telegramBotToken: env.telegramBotToken,
      telegramAdminChatIds: env.telegramAdminChatIds,
      basicAuthCredentials,
    }),
    ...(tls === undefined ? {} : { tls }),
  });

  return {
    server,
    url: localUrlForServer({ server, tlsEnabled: tls !== undefined }),
    async stop() {
      await server.stop(true);
    },
  };
}

function localUrlForServer({
  server,
  tlsEnabled,
}: {
  readonly server: Bun.Server<undefined>;
  readonly tlsEnabled: boolean;
}): string {
  const port = server.port;

  if (port === undefined) {
    return server.url.href;
  }

  return `${tlsEnabled ? "https" : "http"}://127.0.0.1:${port}`;
}

function requireBasicAuthCredentials(): BasicAuthCredentials {
  const username = env.basicAuthUsername;
  const password = env.basicAuthPassword;

  if (username === undefined || password === undefined) {
    throw new Error(
      "HERBERT_BASIC_AUTH_USERNAME and HERBERT_BASIC_AUTH_PASSWORD must be set.",
    );
  }

  const credentials = { username, password };
  assertValidBasicAuthCredentials(credentials);
  return credentials;
}

async function loadTlsConfigFromEnv(): Promise<
  | {
      readonly cert: string;
      readonly key: string;
    }
  | undefined
> {
  const certPath = env.tlsCertPath;
  const keyPath = env.tlsKeyPath;

  if (certPath === undefined && keyPath === undefined) {
    return undefined;
  }

  if (certPath === undefined || keyPath === undefined) {
    throw new Error(
      "HERBERT_TLS_CERT_PATH and HERBERT_TLS_KEY_PATH must be set together.",
    );
  }

  const certFile = Bun.file(certPath);
  const keyFile = Bun.file(keyPath);

  if (!(await certFile.exists())) {
    throw new Error(`HERBERT_TLS_CERT_PATH does not exist: ${certPath}`);
  }

  if (!(await keyFile.exists())) {
    throw new Error(`HERBERT_TLS_KEY_PATH does not exist: ${keyPath}`);
  }

  return {
    cert: await certFile.text(),
    key: await keyFile.text(),
  };
}
