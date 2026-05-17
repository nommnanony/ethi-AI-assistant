import httpx
import asyncio
from typing import List, Optional
from tenacity import retry, stop_after_attempt, wait_exponential
from loguru import logger

from app.config import settings


class OllamaClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or settings.ollama_base_url
        self.client = httpx.AsyncClient(timeout=60.0)
        self._embedding_model = settings.embedding_model
        self._chat_model = settings.chat_model
    
    async def health_check(self) -> bool:
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"Ollama health check failed: {e}")
            return False
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=5))
    async def generate_embedding(self, text: str) -> List[float]:
        try:
            response = await self.client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self._embedding_model, "prompt": text}
            )
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [])
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    async def generate_embeddings_batch(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            tasks = [self.generate_embedding(text) for text in batch]
            embeddings = await asyncio.gather(*tasks, return_exceptions=True)
            
            valid_embeddings = []
            for emb in embeddings:
                if isinstance(emb, list):
                    valid_embeddings.append(emb)
                else:
                    logger.warning(f"Embedding failed: {emb}")
                    valid_embeddings.append([0.0] * 768)
            
            all_embeddings.extend(valid_embeddings)
            logger.info(f"Embedded {len(all_embeddings)}/{len(texts)} texts")
        
        return all_embeddings
    
    async def chat(self, messages: List[dict], stream: bool = True):
        try:
            if stream:
                async with self.client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json={"model": self._chat_model, "messages": messages, "stream": True}
                ) as response:
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = eval(line)
                                if "message" in data:
                                    yield data["message"].get("content", "")
                                elif "done" in data and data["done"]:
                                    break
                            except:
                                pass
            else:
                response = await self.client.post(
                    f"{self.base_url}/api/chat",
                    json={"model": self._chat_model, "messages": messages}
                )
                response.raise_for_status()
                data = response.json()
                return data.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Chat failed: {e}")
            raise
    
    async def chat_complete(self, messages: List[dict]) -> str:
        response = await self.client.post(
            f"{self.base_url}/api/chat",
            json={"model": self._chat_model, "messages": messages}
        )
        response.raise_for_status()
        data = response.json()
        return data.get("message", {}).get("content", "")
    
    async def list_models(self) -> List[dict]:
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            return data.get("models", [])
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []
    
    async def close(self):
        await self.client.aclose()


ollama_client: Optional[OllamaClient] = None


async def get_ollama_client() -> OllamaClient:
    global ollama_client
    if ollama_client is None:
        ollama_client = OllamaClient()
    return ollama_client