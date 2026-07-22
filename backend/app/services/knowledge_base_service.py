from openai import OpenAI
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class KnowledgeBaseService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def create_embeddings(self, text: str):
        """Create vector embeddings for text using OpenAI"""
        try:
            response = self.client.embeddings.create(
                model="text-embedding-ada-002",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Failed to create embeddings: {str(e)}")
            return None
    
    def chunk_text(self, text: str, chunk_size: int = 1000):
        """Split text into chunks for embedding"""
        words = text.split()
        chunks = []
        current_chunk = []
        current_size = 0
        
        for word in words:
            current_chunk.append(word)
            current_size += len(word) + 1
            
            if current_size >= chunk_size:
                chunks.append(' '.join(current_chunk))
                current_chunk = []
                current_size = 0
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    def search_knowledge_base(self, query: str, knowledge_base_id: int, top_k: int = 3):
        """Search knowledge base for relevant information"""
        # This would integrate with a vector database like Pinecone or Weaviate
        # For now, returning placeholder
        return []

# Global knowledge base service instance
kb_service = KnowledgeBaseService()
