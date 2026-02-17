import type { Citation } from '@straits/core';
import { generateId, RAG_CONFIG } from '@straits/core';

export interface RAGConfig {
  topK?: number;
  minSimilarity?: number;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  chunk: Chunk;
  document: Document;
  score: number;
}

/**
 * RAGPipeline handles document ingestion, chunking, and retrieval.
 * Note: Actual vector operations happen in Cloudflare Vectorize.
 */
export class RAGPipeline {
  private config: Required<RAGConfig>;

  constructor(config: RAGConfig = {}) {
    this.config = {
      topK: config.topK ?? RAG_CONFIG.TOP_K,
      minSimilarity: config.minSimilarity ?? RAG_CONFIG.MIN_SIMILARITY,
      chunkSize: config.chunkSize ?? RAG_CONFIG.CHUNK_SIZE,
      chunkOverlap: config.chunkOverlap ?? RAG_CONFIG.CHUNK_OVERLAP,
    };
  }

  /**
   * Chunk a document into smaller pieces for embedding.
   */
  chunkDocument(document: Document): Chunk[] {
    const chunks: Chunk[] = [];
    const content = document.content;
    const { chunkSize, chunkOverlap } = this.config;

    // Split by paragraphs first
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // If adding this paragraph exceeds chunk size, save current and start new
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `${document.id}_chunk_${chunkIndex}`,
          documentId: document.id,
          content: currentChunk.trim(),
          metadata: {
            ...document.metadata,
            chunkIndex,
          },
        });
        chunkIndex++;

        // Keep overlap from previous chunk
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(chunkOverlap / 5));
        currentChunk = overlapWords.join(' ') + ' ' + paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: `${document.id}_chunk_${chunkIndex}`,
        documentId: document.id,
        content: currentChunk.trim(),
        metadata: {
          ...document.metadata,
          chunkIndex,
        },
      });
    }

    return chunks;
  }

  /**
   * Search for relevant chunks (placeholder - actual search uses Vectorize).
   */
  async search(query: string, documents: Document[]): Promise<SearchResult[]> {
    // This is a placeholder for local/testing use
    // In production, this calls Cloudflare Vectorize
    const results: SearchResult[] = [];

    for (const doc of documents) {
      const chunks = this.chunkDocument(doc);
      for (const chunk of chunks) {
        // Simple keyword matching as placeholder
        const score = this.calculateSimpleScore(query, chunk.content);
        if (score >= this.config.minSimilarity) {
          results.push({
            chunk,
            document: doc,
            score,
          });
        }
      }
    }

    // Sort by score and take top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.topK);
  }

  /**
   * Simple keyword-based scoring (placeholder for embeddings).
   */
  private calculateSimpleScore(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    let matches = 0;
    for (const word of queryWords) {
      if (word.length > 2 && contentLower.includes(word)) {
        matches++;
      }
    }

    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  /**
   * Convert search results to citations.
   */
  resultsToCitations(results: SearchResult[]): Citation[] {
    return results.map((result) => ({
      id: generateId(),
      documentId: result.document.id,
      title: result.document.title,
      excerpt: this.truncateExcerpt(result.chunk.content, 200),
      location: result.chunk.metadata?.chunkIndex !== undefined
        ? `Section ${(result.chunk.metadata.chunkIndex as number) + 1}`
        : undefined,
      score: result.score,
    }));
  }

  /**
   * Truncate text for excerpt display.
   */
  private truncateExcerpt(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3).trim() + '...';
  }

  /**
   * Build context string from search results.
   */
  buildContext(results: SearchResult[]): string {
    if (results.length === 0) return '';

    const contextParts = results.map((r, i) => {
      return `[Source ${i + 1}: ${r.document.title}]\n${r.chunk.content}`;
    });

    return `Relevant information from knowledge base:\n\n${contextParts.join('\n\n---\n\n')}`;
  }
}
