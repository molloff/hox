import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Store text embeddings for a vault file.
 * Chunks the OCR text and stores vector embeddings for semantic search.
 *
 * In production, use OpenAI ada-002 or a local model for embeddings.
 * For now, this accepts pre-computed embeddings.
 */
export async function storeEmbeddings(
  userId: string,
  fileId: string,
  chunks: { text: string; embedding: number[] }[]
): Promise<void> {
  const rows = chunks.map((chunk, index) => ({
    vault_file_id: fileId,
    user_id: userId,
    chunk_text: chunk.text,
    embedding: JSON.stringify(chunk.embedding),
    chunk_index: index,
  }));

  const { error } = await supabaseAdmin
    .from('vault_embeddings')
    .insert(rows);

  if (error) {
    logger.error({ userId, fileId, error: error.message }, 'Failed to store embeddings');
    throw new Error(`Embedding storage failed: ${error.message}`);
  }

  logger.info({ userId, fileId, chunks: chunks.length }, 'Embeddings stored');
}

/**
 * Semantic search across a user's vault using pgvector.
 * "Намери договора от 2022" → 3 seconds
 */
export async function semanticSearch(
  userId: string,
  queryEmbedding: number[],
  limit = 10
): Promise<{ fileId: string; chunkText: string; similarity: number }[]> {
  // pgvector cosine similarity search
  const { data, error } = await supabaseAdmin.rpc('vault_semantic_search', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_user_id: userId,
    match_count: limit,
  });

  if (error) {
    logger.error({ userId, error: error.message }, 'Semantic search failed');
    throw new Error(`Search failed: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    fileId: row.vault_file_id,
    chunkText: row.chunk_text,
    similarity: row.similarity,
  }));
}

/**
 * Full-text search across vault files using PostgreSQL tsvector.
 * Faster than semantic search for exact keyword matches.
 */
export async function fullTextSearch(
  userId: string,
  query: string,
  limit = 20
): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('vault_files')
    .select('id, category, title, original_name, ocr_text, created_at')
    .eq('user_id', userId)
    .textSearch('ocr_text', query, { type: 'websearch' })
    .limit(limit);

  if (error) {
    logger.error({ userId, error: error.message }, 'Full-text search failed');
    throw new Error(`Search failed: ${error.message}`);
  }

  return data || [];
}
