import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Optional, Any
from loguru import logger
import asyncio

from app.config import settings
from app.chunker.base import Chunk


class VectorStore:
    def __init__(self, persist_directory: Optional[str] = None):
        self.persist_directory = persist_directory or settings.chroma_persist_directory
        self.collection_name = settings.collection_name
        self.client = None
        self.collection = None
        self._lock = asyncio.Lock()
    
    async def initialize(self):
        try:
            self.client = chromadb.PersistentClient(
                path=self.persist_directory,
                settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True)
            )
            
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            
            logger.info(f"Vector store initialized at {self.persist_directory}")
        except Exception as e:
            logger.error(f"Failed to initialize vector store: {e}")
            raise
    
    async def add_chunks(self, chunks: List[Chunk], embeddings: List[List[float]]) -> bool:
        async with self._lock:
            try:
                if len(chunks) != len(embeddings):
                    raise ValueError(f"Chunk count ({len(chunks)}) != embedding count ({len(embeddings)})")
                
                ids = [f"{chunk.file_path}_{chunk.chunk_index}" for chunk in chunks]
                documents = [chunk.content for chunk in chunks]
                metadatas = [
                    {
                        "file_path": chunk.file_path,
                        "language": chunk.language,
                        "chunk_index": chunk.chunk_index,
                        "project_name": chunk.project_name,
                        "start_idx": chunk.start_idx,
                        "end_idx": chunk.end_idx,
                        **chunk.metadata
                    }
                    for chunk in chunks
                ]
                
                batch_size = 100
                for i in range(0, len(ids), batch_size):
                    self.collection.upsert(
                        ids=ids[i:i + batch_size],
                        documents=documents[i:i + batch_size],
                        embeddings=embeddings[i:i + batch_size],
                        metadatas=metadatas[i:i + batch_size]
                    )
                
                logger.info(f"Added {len(chunks)} chunks to vector store")
                return True
                
            except Exception as e:
                logger.error(f"Failed to add chunks: {e}")
                return False
    
    async def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        project_name: Optional[str] = None,
        min_score: float = 0.0
    ) -> List[Dict[str, Any]]:
        try:
            where = {}
            if project_name:
                where["project_name"] = project_name
            
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where if where else None,
                include=["documents", "metadatas", "distances"]
            )
            
            search_results = []
            
            if results and results.get("ids") and results["ids"][0]:
                for i, doc_id in enumerate(results["ids"][0]):
                    distance = results["distances"][0][i]
                    score = 1 - distance
                    
                    if score >= min_score:
                        search_results.append({
                            "id": doc_id,
                            "content": results["documents"][0][i],
                            "metadata": results["metadatas"][0][i],
                            "score": score,
                            "distance": distance
                        })
            
            return search_results
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    async def delete_by_project(self, project_name: str) -> bool:
        async with self._lock:
            try:
                results = self.collection.get(where={"project_name": project_name})
                if results and results.get("ids"):
                    self.collection.delete(ids=results["ids"])
                    logger.info(f"Deleted {len(results['ids'])} chunks for project {project_name}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete project: {e}")
                return False
    
    async def get_stats(self) -> Dict[str, Any]:
        try:
            count = self.collection.count()
            
            results = self.collection.get(limit=1000, include=["metadatas"])
            projects = set()
            files = set()
            
            if results and results.get("metadatas"):
                for meta in results["metadatas"]:
                    if "project_name" in meta:
                        projects.add(meta["project_name"])
                    if "file_path" in meta:
                        files.add(meta["file_path"])
            
            return {"total_chunks": count, "projects": list(projects), "file_count": len(files)}
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {"total_chunks": 0, "projects": [], "file_count": 0}
    
    async def close(self):
        pass
    
    async def reset(self):
        async with self._lock:
            try:
                self.client.delete_collection(self.collection_name)
                self.collection = self.client.get_or_create_collection(name=self.collection_name, metadata={"hnsw:space": "cosine"})
                logger.info("Vector store reset")
            except Exception as e:
                logger.error(f"Failed to reset: {e}")