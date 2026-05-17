import asyncio
import os
import aiofiles
from typing import List, Dict, Optional, Any, AsyncGenerator
from pathlib import Path
from loguru import logger

from app.config import settings
from app.chunker.recursive import RecursiveChunker
from app.vectorstore.chromadb_store import VectorStore
from app.embeddings.ollama_client import get_ollama_client, OllamaClient
from app.memory.store import MemoryStore


class RAGService:
    def __init__(self):
        self.chunker = RecursiveChunker(chunk_size=settings.chunk_size, overlap=settings.chunk_overlap)
        self.vector_store: Optional[VectorStore] = None
        self.ollama_client: Optional[OllamaClient] = None
        self.memory_store: Optional[MemoryStore] = None
        self._indexing_progress: Dict[str, Any] = {}
    
    async def initialize(self):
        self.vector_store = VectorStore()
        await self.vector_store.initialize()
        
        self.ollama_client = await get_ollama_client()
        
        self.memory_store = MemoryStore()
        await self.memory_store.initialize()
        
        logger.info("RAG service initialized")
    
    async def index_project(
        self,
        project_path: str,
        project_name: Optional[str] = None,
        on_progress: Optional[callable] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        if not project_name:
            project_name = os.path.basename(project_path)
        
        logger.info(f"Indexing project: {project_name}")
        
        self._indexing_progress[project_name] = {"status": "scanning", "progress": 0}
        
        if on_progress:
            on_progress({"status": "scanning", "progress": 0})
        
        try:
            files = await self._scan_project(project_path)
            logger.info(f"Found {len(files)} files to index")
            
            if on_progress:
                on_progress({"status": "scanning", "progress": 10, "files": len(files)})
            
            await self.vector_store.delete_by_project(project_name)
            
            all_chunks = []
            all_embeddings = []
            
            batch_size = settings.batch_size
            total_files = len(files)
            
            for i in range(0, total_files, batch_size):
                batch = files[i:i + batch_size]
                batch_chunks, batch_embeddings = await self._process_files_batch(batch, project_name)
                
                all_chunks.extend(batch_chunks)
                all_embeddings.extend(batch_embeddings)
                
                progress = 10 + int((i + len(batch)) / total_files * 80)
                self._indexing_progress[project_name] = {"status": "indexing", "progress": progress, "chunks": len(all_chunks)}
                
                if on_progress:
                    on_progress({"status": "indexing", "progress": progress, "chunks": len(all_chunks), "file": batch[-1] if batch else None})
                
                await asyncio.sleep(0.1)
            
            if all_chunks:
                await self.vector_store.add_chunks(all_chunks, all_embeddings)
            
            final_result = {"status": "complete", "progress": 100, "files": total_files, "chunks": len(all_chunks)}
            self._indexing_progress[project_name] = final_result
            
            if on_progress:
                on_progress(final_result)
            
            yield final_result
            
        except Exception as e:
            logger.error(f"Indexing failed: {e}")
            error_result = {"status": "error", "progress": 0, "error": str(e)}
            self._indexing_progress[project_name] = error_result
            if on_progress:
                on_progress(error_result)
    
    async def _scan_project(self, project_path: str) -> List[str]:
        files = []
        ignored = set(['node_modules', '.git', 'dist', 'build', 'venv', '__pycache__', '.next', '.nuxt', 'target', '.cache', 'vendor', 'bin', 'obj'])
        
        for root, dirs, filenames in os.walk(project_path):
            dirs[:] = [d for d in dirs if d not in ignored]
            
            for filename in filenames:
                file_path = os.path.join(root, filename)
                ext = os.path.splitext(filename)[1].lower()
                
                if ext in ['.py', '.js', '.ts', '.tsx', '.jsx', '.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.sql', '.sh', '.bash']:
                    try:
                        if os.path.getsize(file_path) <= settings.max_file_size:
                            files.append(file_path)
                    except:
                        pass
        
        return files
    
    async def _process_files_batch(self, file_paths: List[str], project_name: str) -> tuple:
        chunks = []
        embeddings = []
        
        for file_path in file_paths:
            try:
                async with aiofiles.open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = await f.read()
                
                file_chunks = self.chunker.chunk(content, file_path, project_name)
                
                if file_chunks:
                    texts = [chunk.content for chunk in file_chunks]
                    chunk_embeddings = await self.ollama_client.generate_embeddings_batch(texts, batch_size=settings.embedding_batch_size)
                    
                    chunks.extend(file_chunks)
                    embeddings.extend(chunk_embeddings)
                    
            except Exception as e:
                logger.warning(f"Failed to process {file_path}: {e}")
        
        return chunks, embeddings
    
    async def retrieve(self, query: str, project_name: Optional[str] = None, top_k: int = 5) -> Dict[str, Any]:
        query_embedding = await self.ollama_client.generate_embedding(query)
        
        results = await self.vector_store.search(
            query_embedding=query_embedding,
            top_k=top_k,
            project_name=project_name
        )
        
        memory_context = []
        if self.memory_store:
            memory_context = await self.memory_store.get_recent_context(limit=3)
        
        return {"query": query, "results": results, "memory_context": memory_context, "total_results": len(results)}
    
    async def chat(self, message: str, project_name: Optional[str] = None, conversation_id: Optional[str] = None, stream: bool = True) -> AsyncGenerator[str, None]:
        retrieval_result = await self.retrieve(query=message, project_name=project_name, top_k=settings.top_k)
        
        context_text = self._build_context_prompt(retrieval_result)
        
        system_prompt = f"""You are an AI coding assistant helping with a project.

Available context from the project:
{context_text}

Instructions:
- Use the provided context to answer questions accurately
- If the context doesn't contain relevant information, say so
- Reference specific files when possible
- Be concise and helpful"""

        messages = [{"role": "system", "content": system_prompt}]
        
        if conversation_id and self.memory_store:
            history = await self.memory_store.get_conversation(conversation_id)
            for msg in history[-10:]:
                messages.append(msg)
        
        messages.append({"role": "user", "content": message})
        
        if stream:
            async for chunk in self.ollama_client.chat(messages, stream=True):
                yield chunk
        else:
            response = await self.ollama_client.chat_complete(messages)
            yield response
    
    async def chat_complete(self, message: str, project_name: Optional[str] = None, conversation_id: Optional[str] = None) -> str:
        full_response = ""
        
        if conversation_id and self.memory_store:
            await self.memory_store.add_message(conversation_id, {"role": "user", "content": message})
        
        async for chunk in self.chat(message, project_name, conversation_id, True):
            full_response += chunk
        
        if conversation_id and self.memory_store:
            await self.memory_store.add_message(conversation_id, {"role": "assistant", "content": full_response})
        
        return full_response
    
    def _build_context_prompt(self, retrieval_result: Dict) -> str:
        context_parts = []
        
        for result in retrieval_result.get("results", [])[:5]:
            meta = result.get("metadata", {})
            context_parts.append(f"File: {meta.get('file_path', 'unknown')}\nContent:\n{result.get('content', '')}\n")
        
        for mem in retrieval_result.get("memory_context", []):
            context_parts.append(f"Previous: {mem.get('content', '')}")
        
        return "\n\n".join(context_parts[:10])
    
    def get_indexing_progress(self, project_name: str) -> Dict[str, Any]:
        return self._indexing_progress.get(project_name, {"status": "unknown"})
    
    def create_conversation(self, project_name: Optional[str] = None) -> str:
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self.memory_store.create_conversation(project_name))
    
    def get_conversation(self, conversation_id: str):
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self.memory_store.get_conversation(conversation_id))
    
    def list_conversations(self, project_name: Optional[str] = None):
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self.memory_store.list_conversations(project_name))
    
    def delete_conversation(self, conversation_id: str):
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self.memory_store.delete_conversation(conversation_id))
    
    async def get_stats(self) -> Dict[str, Any]:
        vector_stats = await self.vector_store.get_stats()
        memory_stats = await self.memory_store.get_stats() if self.memory_store else {}
        ollama_connected = await self.ollama_client.health_check()
        
        return {"vector_store": vector_stats, "memory": memory_stats, "ollama_connected": ollama_connected}
    
    async def close(self):
        if self.vector_store:
            await self.vector_store.close()
        if self.ollama_client:
            await self.ollama_client.close()
        if self.memory_store:
            await self.memory_store.close()


rag_service: Optional[RAGService] = None


async def get_rag_service() -> RAGService:
    global rag_service
    if rag_service is None:
        rag_service = RAGService()
        await rag_service.initialize()
    return rag_service