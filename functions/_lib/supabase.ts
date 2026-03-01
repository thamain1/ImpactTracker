import { createClient } from "@supabase/supabase-js";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CENSUS_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

export function makeSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * Shallow-converts top-level keys of a database row from snake_case to camelCase.
 * JSONB column values (metricValues, geoContext, etc.) are left as-is.
 */
export function toCamel<T = Record<string, unknown>>(
  row: Record<string, unknown> | null | undefined
): T {
  if (!row) return {} as T;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    result[snakeToCamel(k)] = v;
  }
  return result as T;
}

/**
 * Shallow-converts top-level keys from camelCase to snake_case for Supabase inserts/updates.
 * JSONB values are left as-is.
 */
export function toSnake<T = Record<string, unknown>>(
  obj: Record<string, unknown>
): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[camelToSnake(k)] = v;
  }
  return result as T;
}
