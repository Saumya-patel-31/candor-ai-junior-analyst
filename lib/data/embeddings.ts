import { config } from "@/lib/config";
import { getServiceClient } from "@/lib/db/supabase";

export interface FilingChunk {
  form: string;
  item: string;
  text: string;
  filedAt: string;
  score: number;
}

interface EmbedProvider {
  baseURL: string;
  apiKey: string;
  sendDimensions: boolean;
}

/** Resolve the (free) embedding provider from config. */
function embedProvider(): EmbedProvider {
  switch (config.embedding.provider) {
    case "gemini":
      return {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: process.env.GEMINI_API_KEY ?? "",
        sendDimensions: true, // gemini-embedding-001 supports output dimensionality
      };
    case "ollama":
      return {
        baseURL: (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1").replace(/\/$/, ""),
        apiKey: "",
        sendDimensions: false,
      };
    case "voyage":
      return { baseURL: "https://api.voyageai.com/v1", apiKey: process.env.VOYAGE_API_KEY ?? "", sendDimensions: false };
    default:
      // Any OpenAI-compatible embeddings endpoint.
      return {
        baseURL: (process.env.CANDOR_EMBED_BASE_URL ?? "").replace(/\/$/, ""),
        apiKey: process.env.CANDOR_EMBED_API_KEY ?? "",
        sendDimensions: false,
      };
  }
}

/** Embed a query/document string via the configured free provider. */
export async function embed(text: string): Promise<number[]> {
  const p = embedProvider();
  if (!p.baseURL) throw new Error(`Embedding provider "${config.embedding.provider}" not configured`);
  const res = await fetch(`${p.baseURL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.embedding.model,
      input: text,
      ...(p.sendDimensions ? { dimensions: config.embedding.dim } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Embeddings ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

/**
 * Hybrid retrieval over filing_chunks via the `match_filing_chunks` RPC
 * (pgvector cosine + ticker filter). Throws if unconfigured — caller degrades.
 */
export async function retrieveFilingChunks(ticker: string, query: string, k = 6): Promise<FilingChunk[]> {
  if (!config.supabase.enabled) throw new Error("Supabase not configured");
  const supabase = getServiceClient();
  const queryEmbedding = await embed(query);
  const { data, error } = await supabase.rpc("match_filing_chunks", {
    query_embedding: queryEmbedding,
    match_ticker: ticker.toUpperCase(),
    match_count: k,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FilingChunk[];
}
