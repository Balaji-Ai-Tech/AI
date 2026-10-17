from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from app.db.models import DocumentChunk, UploadedFile
from app.services.ccm_service import chunk_text, build_ccm
from app.services.embedding_service import embed_texts

async def index_source(db: AsyncSession, source: UploadedFile, transformation):
    text = source.extracted_text or ''
    chunks = chunk_text(text)
    if not chunks:
        transformation.canonical_content = await build_ccm('')
        return 0
    vectors = await embed_texts(chunks)
    await db.execute(delete(DocumentChunk).where(DocumentChunk.source_id == source.id))
    for i, (content, vector) in enumerate(zip(chunks, vectors)):
        db.add(DocumentChunk(
            source_id=source.id,
            transformation_id=source.transformation_id,
            chunk_index=i,
            content=content,
            embedding=vector,
        ))
    ccm = await build_ccm(text)
    # Link claims to chunk IDs when the model did not provide source IDs.
    for claim in ccm.get('claims', []) if isinstance(ccm, dict) else []:
        if not claim.get('source_chunk_ids'):
            claim['source_chunk_ids'] = [f'{source.id}:{i}' for i in range(min(2, len(chunks)))]
    transformation.canonical_content = ccm
    transformation.status = 'indexed'
    return len(chunks)
