import re
from typing import List
from app.chunker.base import BaseChunker, Chunk


class RecursiveChunker(BaseChunker):
    CODE_DELIMITERS = {
        'python': ['\nclass ', '\ndef ', '\nasync def ', '\n    def ', '\n\n'],
        'javascript': ['\nfunction ', '\nconst ', '\nlet ', '\nvar ', '\nclass ', '\nexport ', '\nimport '],
        'typescript': ['\nfunction ', '\nconst ', '\nlet ', '\nvar ', '\nclass ', '\nexport ', '\nimport ', '\ninterface ', '\ntype '],
        'markdown': ['\n## ', '\n### ', '\n#### ', '\n---\n'],
        'sql': ['\nSELECT ', '\nFROM ', '\nWHERE ', '\nJOIN ', '\nGROUP BY ', '\nORDER BY '],
        'html': ['<div', '<span', '<section', '<article', '<header', '<footer', '<main'],
        'css': ['\n.', '\n#', '\n@', '\n'],
    }
    
    def __init__(self, chunk_size: int = 800, overlap: int = 100):
        super().__init__(chunk_size, overlap)
    
    def chunk(self, content: str, file_path: str, project_name: str) -> List[Chunk]:
        language = self.detect_language(file_path)
        
        if self._is_code_file(language):
            return self._chunk_code(content, file_path, language, project_name)
        return self._chunk_text(content, file_path, language, project_name)
    
    def _is_code_file(self, language: str) -> bool:
        return language in {'python', 'javascript', 'typescript', 'sql', 'html', 'css'}
    
    def _chunk_code(self, content: str, file_path: str, language: str, project_name: str) -> List[Chunk]:
        chunks = []
        delimiters = self.CODE_DELIMITERS.get(language, ['\n\n'])
        
        sections = self._split_by_delimiters(content, delimiters)
        
        if len(sections) == 1 or len(content.split()) <= self.chunk_size:
            return self._chunk_text(content, file_path, language, project_name)
        
        current_chunk = ""
        chunk_idx = 0
        
        for section in sections:
            if len((current_chunk + section).split()) <= self.chunk_size:
                current_chunk += section
            else:
                if current_chunk.strip():
                    start_idx = content.find(current_chunk[:50]) if current_chunk else 0
                    chunks.append(Chunk(content=current_chunk.strip(), start_idx=start_idx, end_idx=start_idx + len(current_chunk), file_path=file_path, language=language, chunk_index=chunk_idx, project_name=project_name, metadata={"type": "code"}))
                    chunk_idx += 1
                
                overlap_text = current_chunk[-self.overlap:] if current_chunk else ""
                current_chunk = overlap_text + section
        
        if current_chunk.strip():
            start_idx = content.find(current_chunk[:50]) if current_chunk else 0
            chunks.append(Chunk(content=current_chunk.strip(), start_idx=start_idx, end_idx=len(content), file_path=file_path, language=language, chunk_index=chunk_idx, project_name=project_name, metadata={"type": "code"}))
        
        return chunks
    
    def _split_by_delimiters(self, content: str, delimiters: List[str]) -> List[str]:
        pattern = '|'.join(re.escape(d.strip()) for d in delimiters if d.strip())
        if not pattern:
            return [content]
        
        parts = re.split(f'({pattern})', content)
        result = []
        current = ""
        
        for part in parts:
            if not part:
                continue
            is_delimiter = any(d.strip() == part for d in delimiters if d.strip())
            if is_delimiter and current:
                result.append(current)
                current = ""
            current += part
        
        if current:
            result.append(current)
        
        return result if result else [content]
    
    def _chunk_text(self, content: str, file_path: str, language: str, project_name: str) -> List[Chunk]:
        chunks = []
        content_length = len(content)
        
        start = 0
        chunk_idx = 0
        
        while start < content_length:
            end = min(start + self.chunk_size, content_length)
            
            if end < content_length:
                break_point = content.rfind('. ', start, end)
                if break_point > start + self.chunk_size // 2:
                    end = break_point + 1
            
            chunk_content = content[start:end].strip()
            
            if chunk_content:
                chunks.append(Chunk(content=chunk_content, start_idx=start, end_idx=end, file_path=file_path, language=language, chunk_index=chunk_idx, project_name=project_name, metadata={"type": "text"}))
            
            start = end - self.overlap
            chunk_idx += 1
        
        return chunks