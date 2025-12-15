from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, Optional
import json
from app.core.security import decode_access_token
from app.core.user_database import get_user_by_username, SessionLocal
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # map client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        print(f"[WS] Client connected: {client_id}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            print(f"[WS] Client disconnected: {client_id}")

    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception as e:
                print(f"Error sending message to {client_id}: {e}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            try:
                await connection.send_json(message)
            except:
                pass

    async def broadcast_except(self, message: dict, excluded_client_id: str):
        """
        广播给除 excluded_client_id 以外的所有人 (用于协同编辑)
        """
        for cid, connection in self.active_connections.items():
            if cid != excluded_client_id:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    clientId: str,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint with JWT authentication.
    
    Authentication can be provided via:
    1. Query parameter: ws://host/ws?token=<jwt_token>&clientId=<id>
    2. First message: {"type": "AUTH", "token": "<jwt_token>"}
    """
    authenticated = False
    username = None
    
    # Try to authenticate with query parameter token
    if token:
        payload = decode_access_token(token)
        if payload:
            username = payload.get("sub")
            if username:
                # Verify user exists and is active
                db = SessionLocal()
                try:
                    user = get_user_by_username(db, username)
                    if user and user.is_active:
                        authenticated = True
                        logger.info("websocket_authenticated",
                                   client_id=clientId,
                                   username=username,
                                   auth_method="query_param")
                    else:
                        logger.warning("websocket_auth_failed",
                                      client_id=clientId,
                                      reason="user_not_found_or_inactive")
                finally:
                    db.close()
    
    # Accept connection (will check authentication in message loop)
    await manager.connect(websocket, clientId)
    
    # If no token provided in query params, require AUTH message within 5 seconds
    if not authenticated:
        import asyncio
        await websocket.send_json({
            "type": "AUTH_REQUIRED",
            "message": "Authentication required. Send AUTH message with token."
        })
    
    try:
        while True:
            # Receive message from frontend
            data = await websocket.receive_text()
            
            try:
                msg = json.loads(data)
                
                # Handle authentication via first message
                if not authenticated and msg.get("type") == "AUTH":
                    auth_token = msg.get("token")
                    if auth_token:
                        payload = decode_access_token(auth_token)
                        if payload:
                            username = payload.get("sub")
                            db = SessionLocal()
                            try:
                                user = get_user_by_username(db, username)
                                if user and user.is_active:
                                    authenticated = True
                                    logger.info("websocket_authenticated",
                                               client_id=clientId,
                                               username=username,
                                               auth_method="message")
                                    await manager.send_personal_message({
                                        "type": "AUTH_SUCCESS",
                                        "username": username
                                    }, clientId)
                                    continue
                            finally:
                                db.close()
                    
                    # Authentication failed
                    logger.warning("websocket_auth_failed",
                                  client_id=clientId,
                                  reason="invalid_token")
                    await manager.send_personal_message({
                        "type": "AUTH_FAILED",
                        "error": "Invalid or expired token"
                    }, clientId)
                    await websocket.close()
                    break
                
                # Require authentication for all other messages
                if not authenticated:
                    logger.warning("websocket_unauthenticated_message",
                                  client_id=clientId,
                                  message_type=msg.get("type"))
                    await manager.send_personal_message({
                        "type": "ERROR",
                        "error": "Authentication required"
                    }, clientId)
                    continue
                
                # Process authenticated messages
                # Handle collaboration signals (Phase 8)
                if msg.get("type") in ["GRAPH_NODE_MOVE", "GRAPH_NODE_ADD", "GRAPH_LINK_CONNECT", "GRAPH_LINK_REMOVE", "GRAPH_PARAM_CHANGE"]:
                    await manager.broadcast_except(msg, clientId)
                    logger.debug("websocket_collaboration_event",
                                client_id=clientId,
                                event_type=msg.get("type"),
                                username=username)
                elif msg.get("type") == "PING":
                    await manager.send_personal_message({"type": "PONG"}, clientId)
                
            except json.JSONDecodeError:
                logger.warning("websocket_invalid_json",
                              client_id=clientId)
            except Exception as e:
                logger.error("websocket_message_error",
                            client_id=clientId,
                            error=str(e),
                            exc_info=True)
                
    except WebSocketDisconnect:
        logger.info("websocket_disconnected",
                   client_id=clientId,
                   username=username or "unauthenticated")
        manager.disconnect(clientId)
