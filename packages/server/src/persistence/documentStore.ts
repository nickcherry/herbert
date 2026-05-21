import { z } from "zod";

export const documentCollectionSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9_]+$/);

export const documentKeySchema = z
  .string()
  .min(1)
  .max(191)
  .regex(/^[A-Za-z0-9_.:-]+$/);

export interface ReadDocumentOptions<Schema extends z.ZodType> {
  readonly collection: string;
  readonly key: string;
  readonly schema: Schema;
}

export interface WriteDocumentOptions<Schema extends z.ZodType> {
  readonly collection: string;
  readonly key: string;
  readonly schema: Schema;
  readonly value: z.input<Schema>;
}

export interface DocumentStore {
  readonly read: <Schema extends z.ZodType>(
    options: ReadDocumentOptions<Schema>,
  ) => Promise<z.infer<Schema> | undefined>;
  readonly write: <Schema extends z.ZodType>(
    options: WriteDocumentOptions<Schema>,
  ) => Promise<void>;
}

export function parseDocumentIdentity({
  collection,
  key,
}: {
  readonly collection: string;
  readonly key: string;
}): {
  readonly collection: string;
  readonly key: string;
} {
  return {
    collection: documentCollectionSchema.parse(collection),
    key: documentKeySchema.parse(key),
  };
}
