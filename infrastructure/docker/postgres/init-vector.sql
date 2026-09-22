-- ==============================================================================
-- POSTGRESQL INITIALIZATION SCRIPT: PGVECTOR EXTENSION & CORE SCHEMAS
-- ==============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Schema for Agent Core
CREATE SCHEMA IF NOT EXISTS agent_core;

-- 3. Semantic Long-Term Memory (Embeddings)
CREATE TABLE IF NOT EXISTS agent_core.semantic_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL DEFAULT 'default_user',
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    -- 1536 dims for text-embedding-3-small (OpenAI) / 768 for Gemini
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HNSW Index for rapid approximate nearest neighbors search
CREATE INDEX IF NOT EXISTS idx_semantic_memories_embedding 
ON agent_core.semantic_memories 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_semantic_memories_agent_user 
ON agent_core.semantic_memories(agent_id, user_id);

-- 4. Audit Trail & Human-In-The-Loop Approval Logs
CREATE TABLE IF NOT EXISTS agent_core.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id VARCHAR(128) NOT NULL,
    step_index INTEGER NOT NULL,
    node_name VARCHAR(64) NOT NULL,
    action_type VARCHAR(64) NOT NULL,
    action_payload JSONB NOT NULL,
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_status VARCHAR(32) DEFAULT 'not_required', -- pending, approved, rejected
    reviewer_notes TEXT,
    execution_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_thread 
ON agent_core.audit_logs(thread_id);

-- 5. Demonstration Recordings for Workflow Synthesis
CREATE TABLE IF NOT EXISTS agent_core.demonstration_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    raw_events JSONB NOT NULL, -- Array of mouse clicks, keys, DOM snapshots
    synthesized_script TEXT, -- Generated Playwright script
    status VARCHAR(32) DEFAULT 'pending', -- pending, synthesizing, ready, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
