/**
 * Canonical environment dependency access for the server package. All env-var
 * reads should go through this object. Environment variables are for secrets
 * and deployment-local identities, not normal runtime tuning config.
 */
export const env = {
  get basicAuthPassword(): string | undefined {
    return optionalEnv("HERBERT_BASIC_AUTH_PASSWORD");
  },
  get basicAuthUsername(): string | undefined {
    return optionalEnv("HERBERT_BASIC_AUTH_USERNAME");
  },
  get openaiApiKey(): string | undefined {
    return optionalEnv("OPENAI_API_KEY");
  },
  get telegramBotToken(): string | undefined {
    return optionalEnv("TELEGRAM_BOT_TOKEN");
  },
  get telegramAdminChatIds(): readonly string[] {
    return commaListEnv("TELEGRAM_ADMIN_CHAT_IDS");
  },
  get tlsCertPath(): string | undefined {
    return optionalEnv("HERBERT_TLS_CERT_PATH");
  },
  get tlsKeyPath(): string | undefined {
    return optionalEnv("HERBERT_TLS_KEY_PATH");
  },
};

function optionalEnv(name: string): string | undefined {
  const raw = process.env[name];

  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function commaListEnv(name: string): readonly string[] {
  const raw = optionalEnv(name);

  if (raw === undefined) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
