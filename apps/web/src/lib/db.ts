import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, KVNamespace, R2Bucket, VectorizeIndex, Ai, ExecutionContext } from "@cloudflare/workers-types";

// Augment the global CloudflareEnv interface
declare global {
  interface CloudflareEnv {
    DB: D1Database;
    KV: KVNamespace;
    R2: R2Bucket;
    VECTORIZE: VectorizeIndex;
    AI: Ai;
    OPENROUTER_API_KEY: string;
    EMBEDDED_WALLET_SECRET: string;
    RELAYER_PRIVATE_KEY: string;
    PAYMASTER_ADDRESS: string;
  }
}

export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export async function getKV(): Promise<KVNamespace> {
  const { env } = await getCloudflareContext({ async: true });
  return env.KV;
}

export async function getR2(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  return env.R2;
}

export async function getVectorize(): Promise<VectorizeIndex> {
  const { env } = await getCloudflareContext({ async: true });
  return env.VECTORIZE;
}

export async function getAI(): Promise<Ai> {
  const { env } = await getCloudflareContext({ async: true });
  return env.AI;
}

export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

export async function getCtx(): Promise<ExecutionContext> {
  const { ctx } = await getCloudflareContext({ async: true });
  return ctx;
}
