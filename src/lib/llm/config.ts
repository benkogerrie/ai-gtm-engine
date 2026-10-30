import { LlmMissingApiKeyError } from "./errors";

export const DEFAULT_LLM_MODEL = "deepseek-chat";
export const DEFAULT_LLM_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_LLM_TIMEOUT_MS = 30_000;
export const DEFAULT_LLM_MAX_ATTEMPTS = 3;

export type LlmEnvConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxAttempts: number;
};

export type LlmEnvSnapshot = {
  apiKey?: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxAttempts: number;
};

export type LlmHealthStatus = {
  configured: boolean;
  model: string;
};

function readOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function getLlmModel(env: NodeJS.ProcessEnv = process.env): string {
  return readOptional(env.LLM_MODEL) ?? DEFAULT_LLM_MODEL;
}

export function getLlmBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return readOptional(env.LLM_BASE_URL) ?? DEFAULT_LLM_BASE_URL;
}

export function isLlmConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(readOptional(env.DEEPSEEK_API_KEY));
}

export function getLlmHealth(env: NodeJS.ProcessEnv = process.env): LlmHealthStatus {
  return {
    configured: isLlmConfigured(env),
    model: getLlmModel(env),
  };
}

export function readLlmEnv(env: NodeJS.ProcessEnv = process.env): LlmEnvSnapshot {
  return {
    apiKey: readOptional(env.DEEPSEEK_API_KEY),
    model: getLlmModel(env),
    baseUrl: getLlmBaseUrl(env),
    timeoutMs: readPositiveInt(env.LLM_TIMEOUT_MS, DEFAULT_LLM_TIMEOUT_MS),
    maxAttempts: readPositiveInt(env.LLM_MAX_ATTEMPTS, DEFAULT_LLM_MAX_ATTEMPTS),
  };
}

export function getLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmEnvConfig {
  const snapshot = readLlmEnv(env);
  if (!snapshot.apiKey) {
    throw new LlmMissingApiKeyError();
  }

  return {
    apiKey: snapshot.apiKey,
    model: snapshot.model,
    baseUrl: snapshot.baseUrl,
    timeoutMs: snapshot.timeoutMs,
    maxAttempts: snapshot.maxAttempts,
  };
}
