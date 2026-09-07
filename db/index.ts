// The database client is intentionally introduced with the authenticated server
// API. Keeping this module side-effect free lets schema generation and tests run
// without production credentials.
export * from "./schema";
