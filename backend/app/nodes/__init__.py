from app.core.registry import node_registry

# 手动注册 (Phase 1 暂时这么做)
# 之后可以在 main.py 启动时自动扫描
import app.nodes.audit_nodes
import app.nodes.file_nodes
import app.nodes.script_nodes
import app.nodes.viz_nodes
import app.nodes.clean_nodes
import app.nodes.ai_nodes

node_registry.register_nodes_from_module("app.nodes.audit_nodes")
node_registry.register_nodes_from_module("app.nodes.file_nodes")
node_registry.register_nodes_from_module("app.nodes.script_nodes")
node_registry.register_nodes_from_module("app.nodes.viz_nodes")
node_registry.register_nodes_from_module("app.nodes.clean_nodes")
node_registry.register_nodes_from_module("app.nodes.ai_nodes")
