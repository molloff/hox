-- RPC function for pgvector semantic search
CREATE OR REPLACE FUNCTION vault_semantic_search(
    query_embedding vector(1536),
    match_user_id UUID,
    match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    vault_file_id UUID,
    chunk_text TEXT,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        ve.vault_file_id,
        ve.chunk_text,
        1 - (ve.embedding <=> query_embedding) AS similarity
    FROM public.vault_embeddings ve
    WHERE ve.user_id = match_user_id
    ORDER BY ve.embedding <=> query_embedding
    LIMIT match_count;
$$;
