export type SqlValue = string | number | boolean | null | Date | Uint8Array;

export type SqlRow = Record<string, unknown>;

export interface SqlClient {
  (
    strings: TemplateStringsArray,
    ...values: readonly SqlValue[]
  ): PromiseLike<readonly SqlRow[]>;
  readonly end?: () => Promise<void> | void;
}
