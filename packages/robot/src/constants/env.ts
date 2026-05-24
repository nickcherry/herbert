export const env = {
  get basicAuthPassword(): string | undefined {
    return optionalEnv("HERBERT_BASIC_AUTH_PASSWORD");
  },
  get basicAuthUsername(): string | undefined {
    return optionalEnv("HERBERT_BASIC_AUTH_USERNAME");
  },
  get herbertPythonPath(): string {
    return optionalEnv("HERBERT_PYTHON") ?? "python3";
  },
};

export const herbertPythonPath = env.herbertPythonPath;

function optionalEnv(name: string): string | undefined {
  const raw = process.env[name];

  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
