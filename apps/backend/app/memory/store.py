import sqlite3
import asyncio
import uuid
from typing import List, Dict, Optional, Any
from datetime import datetime
from loguru import logger
from pathlib import Path

from app.config import settings


class MemoryStore:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.memory_db_path
        self.conn: Optional[sqlite3.Connection] = None
        self._lock = asyncio.Lock()
    
    async def initialize(self):
        await asyncio.to_thread(self._init_db)
        logger.info(f"Memory store initialized at {self.db_path}")
    
    def _init_db(self):
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                project_name TEXT,
                title TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT,
                role TEXT,
                content TEXT,
                timestamp TEXT,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            )
        """)
        
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)")
        
        self.conn.commit()
    
    async def create_conversation(self, project_name: Optional[str] = None) -> str:
        async with self._lock:
            conversation_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            await asyncio.to_thread(
                self.conn.execute,
                "INSERT INTO conversations (id, project_name, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (conversation_id, project_name, "New Conversation", now, now)
            )
            
            return conversation_id
    
    async def add_message(self, conversation_id: str, message: Dict[str, str]) -> bool:
        async with self._lock:
            try:
                now = datetime.utcnow().isoformat()
                
                await asyncio.to_thread(
                    self.conn.execute,
                    "INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                    (conversation_id, message.get("role", "user"), message.get("content", ""), now)
                )
                
                await asyncio.to_thread(
                    self.conn.execute,
                    "UPDATE conversations SET updated_at = ? WHERE id = ?",
                    (now, conversation_id)
                )
                
                return True
            except Exception as e:
                logger.error(f"Failed to add message: {e}")
                return False
    
    async def get_conversation(self, conversation_id: str, limit: int = 50) -> List[Dict[str, str]]:
        async with self._lock:
            cursor = self.conn.execute(
                "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC LIMIT ?",
                (conversation_id, limit)
            )
            
            rows = await asyncio.to_thread(cursor.fetchall)
            
            return [{"role": row["role"], "content": row["content"]} for row in rows]
    
    async def get_recent_context(self, limit: int = 3) -> List[Dict]:
        async with self._lock:
            cursor = self.conn.execute(
                "SELECT role, content, timestamp FROM messages ORDER BY timestamp DESC LIMIT ?",
                (limit,)
            )
            
            rows = await asyncio.to_thread(cursor.fetchall)
            
            return [{"role": row["role"], "content": row["content"], "timestamp": row["timestamp"]} for row in reversed(rows)]
    
    async def list_conversations(self, project_name: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        async with self._lock:
            if project_name:
                cursor = self.conn.execute(
                    "SELECT * FROM conversations WHERE project_name = ? ORDER BY updated_at DESC LIMIT ?",
                    (project_name, limit)
                )
            else:
                cursor = self.conn.execute(
                    "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?",
                    (limit,)
                )
            
            rows = await asyncio.to_thread(cursor.fetchall)
            
            return [{"id": row["id"], "project_name": row["project_name"], "title": row["title"], "created_at": row["created_at"], "updated_at": row["updated_at"]} for row in rows]
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        async with self._lock:
            try:
                await asyncio.to_thread(self.conn.execute, "DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
                await asyncio.to_thread(self.conn.execute, "DELETE FROM conversations WHERE id = ?", (conversation_id,))
                return True
            except Exception as e:
                logger.error(f"Failed to delete conversation: {e}")
                return False
    
    async def get_stats(self) -> Dict[str, Any]:
        async with self._lock:
            conv_count = await asyncio.to_thread(lambda: self.conn.execute("SELECT COUNT(*) FROM conversations").fetchone()[0])
            msg_count = await asyncio.to_thread(lambda: self.conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0])
            
            return {"conversations": conv_count, "messages": msg_count}
    
    async def close(self):
        if self.conn:
            await asyncio.to_thread(self.conn.close)