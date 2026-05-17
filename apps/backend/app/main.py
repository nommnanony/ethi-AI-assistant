from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional
import json
from loguru import logger

from app.rag.service import get_rag_service

# Remove default logger
logger.remove()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CHEAT ME IN RAG Backend...")
    try:
        rag_service = await get_rag_service()
        logger.info("RAG service initialized")
    except Exception as e:
        logger.warning(f"RAG service initialization failed: {e}")
    yield


app = FastAPI(
    title="CHEAT ME IN RAG API",
    description="RAG system for AI assistant",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IndexRequest(BaseModel):
    project_path: str
    project_name: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    project_name: Optional[str] = None
    top_k: int = 5


class ChatRequest(BaseModel):
    message: str
    project_name: Optional[str] = None
    conversation_id: Optional[str] = None


@app.get("/health")
async def health_check():
    try:
        rag_service = await get_rag_service()
        stats = await rag_service.get_stats()
        return {"status": "healthy", "ollama_connected": stats.get("ollama_connected", False), "vector_store": stats.get("vector_store", {})}
    except Exception as e:
        return {"status": "healthy", "ollama_connected": False, "error": str(e)}


@app.get("/")
async def root():
    return {"name": "CHEAT ME IN RAG", "version": "1.0.0"}


@app.post("/api/rag/index")
async def index_project(request: IndexRequest):
    rag_service = await get_rag_service()
    result = {}
    async for progress in rag_service.index_project(request.project_path, request.project_name):
        result = progress
    return result


@app.get("/api/rag/status")
async def get_status():
    rag_service = await get_rag_service()
    return await rag_service.get_stats()


@app.get("/api/rag/progress/{project_name}")
async def get_progress(project_name: str):
    rag_service = await get_rag_service()
    return rag_service.get_indexing_progress(project_name)


@app.post("/api/rag/search")
async def search_context(request: SearchRequest):
    rag_service = await get_rag_service()
    return await rag_service.retrieve(request.query, request.project_name, request.top_k)


@app.post("/api/rag/chat")
async def chat(request: ChatRequest):
    rag_service = await get_rag_service()
    response = await rag_service.chat_complete(request.message, request.project_name, request.conversation_id)
    return {"response": response}


@app.websocket("/api/rag/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    rag_service = await get_rag_service()
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            message = message_data.get("message", "")
            project_name = message_data.get("project_name")
            conversation_id = message_data.get("conversation_id")
            
            if not message:
                continue
            
            async for chunk in rag_service.chat(message, project_name, conversation_id, True):
                await websocket.send_text(json.dumps({"type": "chunk", "content": chunk}))
            
            await websocket.send_text(json.dumps({"type": "done"}))
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_text(json.dumps({"type": "error", "error": str(e)}))
        await websocket.close()


@app.get("/api/rag/conversations")
async def list_conversations(project_name: Optional[str] = None):
    rag_service = await get_rag_service()
    if rag_service.memory_store:
        return await rag_service.memory_store.list_conversations(project_name)
    return []


@app.post("/api/rag/conversations")
async def create_conversation(project_name: Optional[str] = None):
    rag_service = await get_rag_service()
    if rag_service.memory_store:
        conv_id = rag_service.create_conversation(project_name)
        return {"conversation_id": conv_id}
    return {"error": "Memory store not initialized"}


@app.delete("/api/rag/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    rag_service = await get_rag_service()
    if rag_service.memory_store:
        rag_service.delete_conversation(conversation_id)
        return {"status": "deleted"}
    return {"error": "Memory store not initialized"}


@app.get("/api/rag/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    rag_service = await get_rag_service()
    if rag_service.memory_store:
        conv = rag_service.get_conversation(conversation_id)
        if conv:
            return {"messages": conv.messages}
    return {"messages": []}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)