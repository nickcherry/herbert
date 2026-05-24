export const serverConfig = {
  host: "0.0.0.0",
  port: 8787,
  idleTimeoutSeconds: 255,
} satisfies {
  readonly host: string;
  readonly port: number;
  readonly idleTimeoutSeconds: number;
};
