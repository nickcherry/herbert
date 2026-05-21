export function parseJsonResponse({
  rawBody,
  context,
}: {
  readonly rawBody: string;
  readonly context: string;
}): unknown {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error(`${context} returned a non-JSON response.`);
  }
}
