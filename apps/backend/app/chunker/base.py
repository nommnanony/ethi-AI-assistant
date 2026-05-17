from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List


@dataclass
class Chunk:
    content: str
    start_idx: int
    end_idx: int
    file_path: str
    language: str
    chunk_index: int
    project_name: str
    metadata: dict


class BaseChunker(ABC):
    def __init__(self, chunk_size: int = 1000, overlap: int = 100):
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    @abstractmethod
    def chunk(self, content: str, file_path: str, project_name: str) -> List[Chunk]:
        pass
    
    def detect_language(self, file_path: str) -> str:
        ext = file_path.split('.')[-1].lower()
        lang_map = {'py': 'python', 'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescript', 'jsx': 'javascript', 'md': 'markdown', 'txt': 'text', 'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'xml': 'xml', 'html': 'html', 'css': 'css', 'sql': 'sql', 'sh': 'bash', 'bash': 'bash'}
        return lang_map.get(ext, 'text')