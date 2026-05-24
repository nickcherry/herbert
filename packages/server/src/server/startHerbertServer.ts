import { env } from "@herbert/server/constants/env";
import { serverConfig } from "@herbert/server/constants/server";
import { createServerFetch } from "@herbert/server/server/createServerFetch";

export interface StartHerbertServerOptions {
  readonly host?: string;
  readonly port?: number;
}

export interface HerbertServerHandle {
  readonly server: Bun.Server<undefined>;
  readonly url: string;
  readonly stop: () => Promise<void>;
}

export async function startHerbertServer({
  host = serverConfig.host,
  port = serverConfig.port,
}: StartHerbertServerOptions = {}): Promise<HerbertServerHandle> {
  const server = Bun.serve({
    hostname: host,
    port,
    fetch: createServerFetch({
      telegramBotToken: env.telegramBotToken,
      telegramAdminChatIds: env.telegramAdminChatIds,
    }),
  });

  return {
    server,
    url: localUrlForServer({ server }),
    async stop() {
      await server.stop(true);
    },
  };
}

function localUrlForServer({
  server,
}: {
  readonly server: Bun.Server<undefined>;
}): string {
  const port = server.port;

  if (port === undefined) {
    return server.url.href;
  }

  return `http://127.0.0.1:${port}`;
}
