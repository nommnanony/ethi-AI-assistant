from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "CHEAT ME IN RAG"
    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "nomic-embed-text"
    chat_model: str = "qwen2.5-coder:3b"
    chroma_persist_directory: str = "./chroma_data"
    collection_name: str = "cheatme_rag"
    memory_db_path: str = "./memory.db"
    batch_size: int = 10
    embedding_batch_size: int = 32
    top_k: int = 5
    similarity_threshold: float = 0.7
    max_file_size: int = 10 * 1024 * 1024
    chunk_overlap: int = 100
    chunk_size: int = 800

    class Config:
        env_file = ".env"


settings = Settings()