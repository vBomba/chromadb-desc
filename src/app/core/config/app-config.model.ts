/**
 * Application configuration for ChromaDB API.
 * apiKey is optional (no auth for local/dev; set in config or env for production).
 */
export interface AppConfig {
  apiBaseUrl: string;
  tenant: string;
  database: string;
  /** Optional. When set, sent as x-chroma-token header. */
  apiKey: string | null;
}
