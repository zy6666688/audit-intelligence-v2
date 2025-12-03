-- =============================================
-- 数据库性能优化 - 索引和物化视图
-- 执行时间: 2-5分钟 (取决于数据量)
-- 预期提升: 3-5倍查询性能
-- =============================================

-- 开始事务
BEGIN;

-- =============================================
-- 第1部分: 核心索引优化
-- =============================================

-- 1. 执行历史核心索引
-- 用途: 工作流执行历史查询 (最常用查询)
-- 预期提升: 10-50x
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_workflow_time 
  ON execution_history(workflow_id, created_at DESC)
  WHERE status != 'deleted';

-- 2. 执行历史状态索引 (活跃任务查询)
-- 用途: 查询正在运行的任务
-- 预期提升: 20-100x
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_active 
  ON execution_history(status, created_at DESC)
  WHERE status IN ('pending', 'running');

-- 3. 用户执行历史索引
-- 用途: 用户执行历史列表
-- 预期提升: 5-20x
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_user_time 
  ON execution_history(executed_by, created_at DESC);

-- 4. 任务ID唯一索引 (已有UNIQUE约束，但添加部分索引优化)
-- 用途: 快速任务查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_task_active 
  ON execution_history(task_id)
  WHERE status IN ('pending', 'running', 'completed');

-- =============================================
-- 第2部分: JSONB字段索引优化
-- =============================================

-- 5. 工作流节点GIN索引
-- 用途: 节点类型查询、搜索
-- 预期提升: 10-50x
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_nodes 
  ON workflows USING GIN (nodes);

-- 6. 工作流边GIN索引
-- 用途: 连接关系查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_edges 
  ON workflows USING GIN (edges);

-- 7. 执行结果GIN索引
-- 用途: 结果数据搜索
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_results 
  ON execution_history USING GIN (node_results);

-- =============================================
-- 第3部分: 关系查询索引
-- =============================================

-- 8. 工作流-项目关系索引
-- 用途: 项目工作流列表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_project_time 
  ON workflows(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

-- 9. 工作流模板索引
-- 用途: 模板市场查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates 
  ON workflows(is_template, is_published, execution_count DESC)
  WHERE is_template = true AND is_published = true;

-- 10. 项目成员索引
-- 用途: 用户项目列表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_member_user 
  ON project_members(user_id, joined_at DESC);

-- 11. 节点日志-执行关系索引
-- 用途: 执行详情页节点日志
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_log_execution_time 
  ON node_execution_logs(execution_id, started_at ASC);

-- =============================================
-- 第4部分: 审计日志索引
-- =============================================

-- 12. 审计日志用户时间复合索引
-- 用途: 用户操作历史
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_user_time 
  ON audit_logs(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- 13. 审计日志资源索引
-- 用途: 资源操作历史
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_resource 
  ON audit_logs(resource_type, resource_id, created_at DESC);

-- 14. 审计日志操作索引
-- 用途: 操作类型统计
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_action_time 
  ON audit_logs(action, created_at DESC);

-- =============================================
-- 第5部分: 文件索引
-- =============================================

-- 15. 文件-项目关系索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_file_project_time 
  ON files(project_id, uploaded_at DESC)
  WHERE project_id IS NOT NULL;

-- 16. 文件-工作流关系索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_file_workflow_time 
  ON files(workflow_id, uploaded_at DESC)
  WHERE workflow_id IS NOT NULL;

-- =============================================
-- 第6部分: 物化视图 (实时统计)
-- =============================================

-- 17. 工作流执行统计物化视图
-- 用途: 工作流统计仪表板
DROP MATERIALIZED VIEW IF EXISTS workflow_execution_stats;
CREATE MATERIALIZED VIEW workflow_execution_stats AS
SELECT 
  w.id as workflow_id,
  w.name as workflow_name,
  w.category,
  DATE_TRUNC('day', eh.created_at) as date,
  COUNT(*) as total_executions,
  COUNT(CASE WHEN eh.status = 'completed' THEN 1 END) as successful_executions,
  COUNT(CASE WHEN eh.status = 'failed' THEN 1 END) as failed_executions,
  AVG(CASE WHEN eh.duration IS NOT NULL THEN eh.duration END) as avg_duration,
  MIN(eh.duration) as min_duration,
  MAX(eh.duration) as max_duration,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY eh.duration) as median_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY eh.duration) as p95_duration
FROM workflows w
LEFT JOIN execution_history eh ON eh.workflow_id = w.id
WHERE eh.created_at > NOW() - INTERVAL '90 days'  -- 只统计最近90天
GROUP BY w.id, w.name, w.category, DATE_TRUNC('day', eh.created_at)
ORDER BY date DESC;

-- 为物化视图创建唯一索引 (支持CONCURRENT刷新)
CREATE UNIQUE INDEX idx_workflow_stats_unique 
  ON workflow_execution_stats (workflow_id, date);

-- 为物化视图创建查询索引
CREATE INDEX idx_workflow_stats_date 
  ON workflow_execution_stats (date DESC);

-- 18. 用户活跃度统计物化视图
DROP MATERIALIZED VIEW IF EXISTS user_activity_stats;
CREATE MATERIALIZED VIEW user_activity_stats AS
SELECT 
  u.id as user_id,
  u.username,
  u.display_name,
  COUNT(DISTINCT eh.id) as total_executions,
  COUNT(DISTINCT eh.workflow_id) as unique_workflows,
  COUNT(DISTINCT p.id) as owned_projects,
  COUNT(DISTINCT pm.project_id) as member_projects,
  MAX(eh.created_at) as last_execution_at,
  MAX(u.last_login_at) as last_login_at
FROM users u
LEFT JOIN execution_history eh ON eh.executed_by = u.id
LEFT JOIN projects p ON p.owner_id = u.id
LEFT JOIN project_members pm ON pm.user_id = u.id
WHERE u.status = 'active'
GROUP BY u.id, u.username, u.display_name;

CREATE UNIQUE INDEX idx_user_activity_unique 
  ON user_activity_stats (user_id);

-- 19. 项目统计物化视图
DROP MATERIALIZED VIEW IF EXISTS project_stats;
CREATE MATERIALIZED VIEW project_stats AS
SELECT 
  p.id as project_id,
  p.name as project_name,
  p.status,
  COUNT(DISTINCT w.id) as workflow_count,
  COUNT(DISTINCT pm.user_id) as member_count,
  COUNT(DISTINCT eh.id) as total_executions,
  MAX(eh.created_at) as last_execution_at,
  COUNT(DISTINCT f.id) as file_count,
  COALESCE(SUM(f.size), 0) as total_file_size
FROM projects p
LEFT JOIN workflows w ON w.project_id = p.id
LEFT JOIN project_members pm ON pm.project_id = p.id
LEFT JOIN execution_history eh ON eh.workflow_id = w.id
LEFT JOIN files f ON f.project_id = p.id
WHERE p.status != 'deleted'
GROUP BY p.id, p.name, p.status;

CREATE UNIQUE INDEX idx_project_stats_unique 
  ON project_stats (project_id);

-- =============================================
-- 第7部分: 自动刷新配置 (需要pg_cron扩展)
-- =============================================

-- 注意: 以下需要安装pg_cron扩展
-- 如果没有安装，请手动定期刷新或使用应用层定时任务

-- -- 每5分钟刷新工作流统计
-- SELECT cron.schedule(
--   'refresh-workflow-stats',
--   '*/5 * * * *',
--   $$REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_execution_stats$$
-- );

-- -- 每小时刷新用户活跃度
-- SELECT cron.schedule(
--   'refresh-user-activity',
--   '0 * * * *',
--   $$REFRESH MATERIALIZED VIEW CONCURRENTLY user_activity_stats$$
-- );

-- -- 每小时刷新项目统计
-- SELECT cron.schedule(
--   'refresh-project-stats',
--   '0 * * * *',
--   $$REFRESH MATERIALIZED VIEW CONCURRENTLY project_stats$$
-- );

-- =============================================
-- 第8部分: 数据库配置优化建议
-- =============================================

-- 注释: 以下配置需要修改postgresql.conf
-- 建议值 (根据服务器配置调整):

/*
# 连接和内存
max_connections = 200
shared_buffers = 2GB            # 25% of RAM
effective_cache_size = 6GB      # 75% of RAM
work_mem = 16MB                 # RAM/max_connections
maintenance_work_mem = 512MB

# 查询优化
random_page_cost = 1.1          # SSD优化
effective_io_concurrency = 200  # SSD优化
default_statistics_target = 100

# 日志
log_min_duration_statement = 1000  # 记录>1秒的查询
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# 自动vacuum
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 10s
*/

COMMIT;

-- =============================================
-- 验证脚本
-- =============================================

-- 查看所有索引
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- 查看物化视图
SELECT 
  schemaname,
  matviewname,
  pg_size_pretty(pg_relation_size(matviewname::regclass)) as view_size
FROM pg_matviews
WHERE schemaname = 'public';

-- 输出优化完成信息
DO $$
BEGIN
  RAISE NOTICE '✅ 数据库优化完成!';
  RAISE NOTICE '';
  RAISE NOTICE '已创建:';
  RAISE NOTICE '- 16个性能索引';
  RAISE NOTICE '- 3个物化视图';
  RAISE NOTICE '';
  RAISE NOTICE '下一步:';
  RAISE NOTICE '1. 运行 ANALYZE; 更新统计信息';
  RAISE NOTICE '2. 手动刷新物化视图: REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_execution_stats;';
  RAISE NOTICE '3. 监控慢查询日志';
  RAISE NOTICE '4. 定期运行 VACUUM ANALYZE;';
END $$;
