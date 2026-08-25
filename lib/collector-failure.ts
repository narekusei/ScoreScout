export type CollectorRequestFailure = {
  source: "RSS" | "Greenhouse" | "Lever";
  target: string;
  message: string;
};

export function collectorRequestFailure(
  source: CollectorRequestFailure["source"],
  target: string,
  error: unknown,
  fallbackMessage: string,
): CollectorRequestFailure {
  return {
    source,
    target,
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}
