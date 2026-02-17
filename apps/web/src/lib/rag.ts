import { getDB, getVectorize, getAI } from "./db";

const CHUNK_SIZE = 500; // characters per chunk
const CHUNK_OVERLAP = 100; // overlap between chunks

export interface Document {
  id: string;
  agentId: string;
  title: string;
  content: string;
  contentType?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  title: string;
  score: number;
}

/**
 * Split text into overlapping chunks
 */
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to end at a sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const boundary = Math.max(lastPeriod, lastNewline);

      if (boundary > start + chunkSize / 2) {
        end = boundary + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Create embeddings using Workers AI
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const ai = await getAI();

  // Use Qwen3 embedding model (1024 dimensions, matches Vectorize index)
  const results = await ai.run("@cf/qwen/qwen3-embedding-0.6b", {
    text: texts,
  });

  const embeddings = results as unknown as { data: number[][] };
  return embeddings.data;
}

/**
 * Store a document with its chunks and embeddings
 */
export async function storeDocument(doc: Document): Promise<{ documentId: string; chunkCount: number }> {
  const db = await getDB();
  const vectorize = await getVectorize();

  // Generate document ID
  const documentId = doc.id || crypto.randomUUID();

  // Chunk the content
  const chunks = chunkText(doc.content);

  // Create embeddings for all chunks
  const embeddings = await createEmbeddings(chunks);

  // Store document in D1
  await db
    .prepare(
      `INSERT INTO documents (id, agent_id, title, content, content_type, source_url, metadata, chunk_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      documentId,
      doc.agentId,
      doc.title,
      doc.content,
      doc.contentType || "text/plain",
      doc.sourceUrl || null,
      doc.metadata ? JSON.stringify(doc.metadata) : null,
      chunks.length
    )
    .run();

  // Store chunks in D1 and vectors in Vectorize
  const vectors: { id: string; values: number[]; metadata: Record<string, string> }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = `${documentId}-${i}`;

    // Store chunk in D1
    await db
      .prepare(
        `INSERT INTO document_chunks (id, document_id, chunk_index, content, token_count)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(chunkId, documentId, i, chunks[i], Math.ceil(chunks[i].length / 4))
      .run();

    // Prepare vector for Vectorize
    vectors.push({
      id: chunkId,
      values: embeddings[i],
      metadata: {
        documentId,
        agentId: doc.agentId,
        title: doc.title,
        chunkIndex: i.toString(),
      },
    });
  }

  // Batch insert vectors into Vectorize
  if (vectors.length > 0) {
    await vectorize.insert(vectors);
  }

  return { documentId, chunkCount: chunks.length };
}

/**
 * Search for similar documents
 */
export async function searchDocuments(
  agentId: string,
  query: string,
  limit = 5
): Promise<SearchResult[]> {
  const db = await getDB();
  const vectorize = await getVectorize();

  // Create embedding for query
  const [queryEmbedding] = await createEmbeddings([query]);

  // Search in Vectorize - fetch more results since we'll filter by agentId in D1
  // Note: Vectorize metadata filtering requires indexes declared at creation time.
  // Since our index doesn't have metadata indexes, we filter in the D1 query instead.
  const searchResults = await vectorize.query(queryEmbedding, {
    topK: limit * 3, // Fetch more to account for filtering
    returnMetadata: "all",
  });

  if (!searchResults.matches || searchResults.matches.length === 0) {
    return [];
  }

  // Filter matches by agentId using metadata
  const filteredMatches = searchResults.matches.filter(
    (match) => match.metadata?.agentId === agentId
  );

  if (filteredMatches.length === 0) {
    return [];
  }

  // Fetch chunk contents from D1
  const results: SearchResult[] = [];

  for (const match of filteredMatches.slice(0, limit)) {
    const chunk = await db
      .prepare(
        `SELECT dc.content, d.title, d.id as document_id
         FROM document_chunks dc
         JOIN documents d ON dc.document_id = d.id
         WHERE dc.id = ? AND d.agent_id = ?`
      )
      .bind(match.id, agentId)
      .first<{ content: string; title: string; document_id: string }>();

    if (chunk) {
      results.push({
        chunkId: match.id,
        documentId: chunk.document_id,
        content: chunk.content,
        title: chunk.title,
        score: match.score,
      });
    }
  }

  return results;
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const db = await getDB();
  const vectorize = await getVectorize();

  // Get chunk IDs
  const chunks = await db
    .prepare("SELECT id FROM document_chunks WHERE document_id = ?")
    .bind(documentId)
    .all<{ id: string }>();

  // Delete from Vectorize
  if (chunks.results.length > 0) {
    const chunkIds = chunks.results.map((c) => c.id);
    await vectorize.deleteByIds(chunkIds);
  }

  // Delete from D1
  await db.prepare("DELETE FROM document_chunks WHERE document_id = ?").bind(documentId).run();
  await db.prepare("DELETE FROM documents WHERE id = ?").bind(documentId).run();
}

/**
 * Get all documents for an agent
 */
export async function getAgentDocuments(agentId: string): Promise<
  {
    id: string;
    title: string;
    contentType: string;
    chunkCount: number;
    createdAt: string;
  }[]
> {
  const db = await getDB();

  const result = await db
    .prepare(
      `SELECT id, title, content_type, chunk_count, created_at
       FROM documents WHERE agent_id = ? ORDER BY created_at DESC`
    )
    .bind(agentId)
    .all<{
      id: string;
      title: string;
      content_type: string;
      chunk_count: number;
      created_at: string;
    }>();

  return result.results.map((doc) => ({
    id: doc.id,
    title: doc.title,
    contentType: doc.content_type,
    chunkCount: doc.chunk_count,
    createdAt: doc.created_at,
  }));
}
