-- Simplified optimization without transactions
-- Core performance indexes

-- 1. Execution history indexes
CREATE INDEX IF NOT EXISTS idx_execution_workflow_time 
  ON execution_history(workflow_id, created_at DESC)
  WHERE status != 'deleted';

CREATE INDEX IF NOT EXISTS idx_execution_active 
  ON execution_history(status, created_at DESC)
  WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_execution_user_time 
  ON execution_history(executed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_task_active 
  ON execution_history(task_id)
  WHERE status IN ('pending', 'running', 'completed');

-- 2. JSONB indexes
CREATE INDEX IF NOT EXISTS idx_workflow_nodes 
  ON workflows USING GIN (nodes);

CREATE INDEX IF NOT EXISTS idx_workflow_edges 
  ON workflows USING GIN (edges);

CREATE INDEX IF NOT EXISTS idx_execution_results 
  ON execution_history USING GIN (node_results);

-- 3. Relationship indexes
CREATE INDEX IF NOT EXISTS idx_workflow_project_time 
  ON workflows(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_templates 
  ON workflows(is_template, is_published, execution_count DESC)
  WHERE is_template = true AND is_published = true;

CREATE INDEX IF NOT EXISTS idx_project_member_user 
  ON project_members(user_id, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_node_log_execution_time 
  ON node_execution_logs(execution_id, started_at ASC);

-- 4. Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_user_time 
  ON audit_logs(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_resource 
  ON audit_logs(resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_action_time 
  ON audit_logs(action, created_at DESC);

-- 5. File indexes
CREATE INDEX IF NOT EXISTS idx_file_project_time 
  ON files(project_id, uploaded_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_file_workflow_time 
  ON files(workflow_id, uploaded_at DESC)
  WHERE workflow_id IS NOT NULL;

-- Update statistics
ANALYZE;

-- Success message
\echo 'Optimization complete! 16 indexes created.'
