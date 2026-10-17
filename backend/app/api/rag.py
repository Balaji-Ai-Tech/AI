from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import math
from app.core.auth import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.db.models import User, Transformation, DocumentChunk
from app.services.embedding_service import embed_query

router = APIRouter(prefix='/api/transformations', tags=['CCM & RAG'])

class RAGQuery(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    top_k: int = Field(default=settings.RAG_TOP_K, ge=1, le=20)

@router.get('/{id}/canonical')
async def canonical(id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(Transformation).where(Transformation.id == id, Transformation.user_id == user.id))).scalar_one_or_none()
    if not t:
        raise HTTPException(404, 'Transformation not found')
    return {'transformation_id': id, 'canonical_content': t.canonical_content or {}}

@router.post('/{id}/rag-query')
async def rag_query(id: str, req: RAGQuery, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(Transformation).where(Transformation.id == id, Transformation.user_id == user.id))).scalar_one_or_none()
    if not t:
        raise HTTPException(404, 'Transformation not found')
    try:
        vector = await embed_query(req.query)
        if db.bind and db.bind.dialect.name == 'sqlite':
            rows = (await db.execute(
                select(DocumentChunk).where(DocumentChunk.transformation_id == id)
            )).scalars().all()

            def cosine_distance(candidate: list[float]) -> float:
                dot = sum(left * right for left, right in zip(vector, candidate))
                left_norm = math.sqrt(sum(value * value for value in vector))
                right_norm = math.sqrt(sum(value * value for value in candidate))
                return 1.0 - dot / (left_norm * right_norm) if left_norm and right_norm else 1.0

            rows = sorted(rows, key=lambda row: cosine_distance(row.embedding or []))[:req.top_k]
        else:
            distance = DocumentChunk.embedding.cosine_distance(vector)
            rows = (await db.execute(
                select(DocumentChunk).where(DocumentChunk.transformation_id == id).order_by(distance).limit(req.top_k)
            )).scalars().all()
        return {'transformation_id': id, 'query': req.query, 'results': [
            {'chunk_id': r.id, 'source_id': r.source_id, 'chunk_index': r.chunk_index, 'content': r.content}
            for r in rows
        ]}
    except Exception as exc:
        raise HTTPException(503, f'RAG retrieval unavailable: {exc}')
