from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.db.database import get_db
from app.db.models import User, Transformation, DocumentChunk, GeneratedOutput, AuditLog
from app.services.trust_service import validate_output
from app.services.embedding_service import embed_query
from app.services.generation_service import LanguageGenerationUnavailableError, generate_grounded_output, select_executive_evidence
from app.services.ollama_service import OllamaGenerationError
from app.services.languages import OUTPUT_LANGUAGES, normalize_language_code, resolve_output_language_codes
from app.services.export_service import create_export, supported_export_formats

router = APIRouter(prefix='/api/transformations', tags=['Generate, Review & Export'])

class GenerateRequest(BaseModel):
    output_types: list[str] = Field(min_length=1, max_length=30)
    languages: list[str] | None = Field(
        default=None,
        min_length=1,
        max_length=20,
        description='ISO 639-1 output language codes; legacy English language names are also accepted.',
    )

    @field_validator('languages')
    @classmethod
    def validate_languages(cls, languages: list[str] | None) -> list[str] | None:
        if languages is None:
            return None
        try:
            return [normalize_language_code(language) for language in languages]
        except ValueError as exc:
            raise ValueError(str(exc)) from exc

    @field_validator('output_types')
    @classmethod
    def validate_output_types(cls, output_types: list[str]) -> list[str]:
        unique=list(dict.fromkeys(output_types))
        if len(unique) != len(output_types):
            raise ValueError('Select each deliverable only once.')
        return output_types

    @field_validator('languages')
    @classmethod
    def validate_generation_size(cls, languages: list[str] | None, info):
        output_types=info.data.get('output_types', [])
        language_count=len(languages or ['en'])
        if len(output_types) * language_count > 40:
            raise ValueError('Choose no more than 40 deliverable-language combinations per generation. Generate the remaining formats in another run.')
        return languages

class ReviewRequest(BaseModel):
    decision: str = Field(pattern='^(save|approve|reject)$')
    comment: str = Field(default='', max_length=4000)
    edited_content: str | None = Field(default=None, max_length=100000)

async def owned_transformation(id: str, user: User, db: AsyncSession):
    t = (await db.execute(select(Transformation).where(Transformation.id == id, Transformation.user_id == user.id))).scalar_one_or_none()
    if not t: raise HTTPException(404, 'Transformation not found')
    return t

def serialize_output(o: GeneratedOutput):
    return {'id': o.id, 'transformation_id': o.transformation_id, 'output_type': o.output_type,
            'title': o.title, 'content': o.content, 'content_json': o.content_json or {},
            'status': o.status, 'reviewer_comment': o.reviewer_comment,
            'created_at': o.created_at.isoformat(), 'updated_at': o.updated_at.isoformat()}

@router.post('/{id}/generate')
async def generate(id: str, req: GenerateRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = await owned_transformation(id, user, db)
    chunks = (await db.execute(select(DocumentChunk).where(DocumentChunk.transformation_id == id).order_by(DocumentChunk.chunk_index).limit(2000))).scalars().all()
    if not chunks: raise HTTPException(409, 'No indexed source found. Upload a supported source and wait for indexing.')
    config = t.configuration or {}
    all_evidence = [{'chunk_id': c.id, 'chunk_index': c.chunk_index, 'content': c.content} for c in chunks]
    allowed = {'executive_summary','advisory','report','presentation','linkedin','instagram_caption','facebook_post','carousel','x_post','x_thread','infographic','image_prompt','video_package','press_release','professional_email','newsletter','blog_post','proposal','product_description','business_brief','meeting_summary','research_summary','project_description','technical_explanation','documentation','faq','whitepaper','compliance_checklist'}
    try:
        languages = resolve_output_language_codes(req.languages, config)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    for output_type in req.output_types:
        if output_type not in allowed:
            raise HTTPException(400, f'Unsupported output type: {output_type}')

    results = []
    failed_outputs = []
    t.status = 'generating'
    await db.commit()
    for output_type in req.output_types:
        for language_code in languages:
            language = OUTPUT_LANGUAGES[language_code]
            language_config = {**config, 'language': language, 'language_code': language_code}
            try:
                evidence=select_executive_evidence(all_evidence) if output_type == 'executive_summary' else all_evidence[:80]
                data = await generate_grounded_output(output_type, t.title, t.summary or '', language_config, evidence)
                data['language'] = language
                data['language_code'] = language_code
                output = GeneratedOutput(
                    transformation_id=id,
                    output_type=output_type,
                    title=data['title'],
                    content=data['content'],
                    content_json=data,
                    status='needs_review',
                )
                async with db.begin_nested():
                    db.add(output)
                    await db.flush()
                    audit = AuditLog(
                        user_id=user.id,
                        transformation_id=id,
                        output_id=output.id,
                        action='output_generated',
                        details={
                            'output_type': output_type,
                            'language': language,
                            'language_code': language_code,
                            'status': 'needs_review',
                        },
                    )
                    db.add(audit)
                    await db.flush()
                results.append(serialize_output(output))
            except LanguageGenerationUnavailableError as exc:
                failed_outputs.append({
                    'output_type': output_type,
                    'language': language_code,
                    'error': str(exc),
                })
            except OllamaGenerationError as exc:
                failed_outputs.append({
                    'output_type': output_type,
                    'language': language_code,
                    'error': str(exc),
                })
            except Exception:
                failed_outputs.append({
                    'output_type': output_type,
                    'language': language_code,
                    'error': f'Generation failed for {output_type} in {language}. Check the configured language model and try again.',
                })

    t.status = 'partial_in_review' if results and failed_outputs else 'in_review' if results else 'generation_failed'
    await db.commit()
    if not results:
        failure_summary = '; '.join(
            f"{failure['output_type']} ({OUTPUT_LANGUAGES[failure['language']]}): {failure['error']}"
            for failure in failed_outputs
        )
        raise HTTPException(503, failure_summary or 'No outputs could be generated.')
    return {
        'transformation_id': id,
        'status': t.status,
        'outputs': results,
        'failed_outputs': failed_outputs,
    }

@router.get('/{id}/outputs')
async def list_outputs(id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await owned_transformation(id, user, db)
    rows = (await db.execute(select(GeneratedOutput).where(GeneratedOutput.transformation_id == id).order_by(desc(GeneratedOutput.created_at)))).scalars().all()
    return [serialize_output(o) for o in rows]

@router.get('/{id}/outputs/{output_id}')
async def get_output(id: str, output_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await owned_transformation(id, user, db)
    o = (await db.execute(select(GeneratedOutput).where(GeneratedOutput.id == output_id, GeneratedOutput.transformation_id == id))).scalar_one_or_none()
    if not o: raise HTTPException(404, 'Output not found')
    return serialize_output(o)

@router.post('/{id}/outputs/{output_id}/review')
async def review_output(id: str, output_id: str, req: ReviewRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = await owned_transformation(id, user, db)
    o = (await db.execute(select(GeneratedOutput).where(GeneratedOutput.id == output_id, GeneratedOutput.transformation_id == id))).scalar_one_or_none()
    if not o: raise HTTPException(404, 'Output not found')
    if req.edited_content is not None:
        o.content = req.edited_content
        payload = dict(o.content_json or {})
        payload['content'] = req.edited_content
        payload['human_edited'] = True
        o.content_json = payload
    o.reviewer_comment = req.comment.strip() or None
    o.status = 'approved' if req.decision == 'approve' else ('rejected' if req.decision == 'reject' else 'needs_review')
    db.add(AuditLog(user_id=user.id, transformation_id=id, output_id=o.id, action={'save': 'output_edits_saved', 'approve': 'output_approved', 'reject': 'output_rejected'}[req.decision], details={'decision': req.decision, 'comment_present': bool(req.comment.strip())}))
    rows = (await db.execute(select(GeneratedOutput).where(GeneratedOutput.transformation_id == id))).scalars().all()
    if rows and all(x.status == 'approved' for x in rows): t.status = 'approved'
    elif any(x.status == 'approved' for x in rows): t.status = 'partially_approved'
    else: t.status = 'in_review'
    await db.commit(); await db.refresh(o)
    return {'output': serialize_output(o), 'transformation_status': t.status, 'next_step': 'export' if o.status == 'approved' else 'review'}

@router.get('/{id}/outputs/{output_id}/validate')
async def validate_saved_output(id: str, output_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await owned_transformation(id, user, db)
    output = (await db.execute(select(GeneratedOutput).where(GeneratedOutput.id == output_id, GeneratedOutput.transformation_id == id))).scalar_one_or_none()
    if not output:
        raise HTTPException(404, 'Output not found')
    chunks = (await db.execute(select(DocumentChunk.id).where(DocumentChunk.transformation_id == id))).scalars().all()
    result = validate_output(output.content, output.content_json or {}, {str(value) for value in chunks})
    db.add(AuditLog(user_id=user.id, transformation_id=id, output_id=output.id, action='output_validated', details={'passed': result['passed'], 'issue_count': len(result['issues'])}))
    await db.commit()
    return result


@router.get('/{id}/audit-log')
async def get_audit_log(id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await owned_transformation(id, user, db)
    rows = (await db.execute(select(AuditLog).where(AuditLog.transformation_id == id).order_by(desc(AuditLog.created_at)).limit(200))).scalars().all()
    return [{'id': row.id, 'action': row.action, 'output_id': row.output_id, 'details': row.details or {}, 'created_at': row.created_at.isoformat()} for row in rows]

@router.get('/{id}/outputs/{output_id}/export')
async def export_output(id: str, output_id: str, format: str = 'md', user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await owned_transformation(id, user, db)
    o = (await db.execute(select(GeneratedOutput).where(GeneratedOutput.id == output_id, GeneratedOutput.transformation_id == id))).scalar_one_or_none()
    if not o: raise HTTPException(404, 'Output not found')
    if o.status != 'approved': raise HTTPException(409, 'Approve this output before exporting.')
    if format not in supported_export_formats(o.output_type):
        supported = ', '.join(supported_export_formats(o.output_type))
        raise HTTPException(
            400,
            f'Export format "{format}" is not supported for {o.output_type}. Choose from: {supported}.',
        )
    safe = ''.join(ch if ch.isalnum() or ch in '-_' else '_' for ch in o.title).strip('_')[:80] or 'transformhub-output'
    try:
        body, media, ext = create_export(o, format)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    db.add(AuditLog(user_id=user.id, transformation_id=id, output_id=o.id, action='output_exported', details={'format': format}))
    await db.commit()
    return Response(content=body, media_type=media, headers={'Content-Disposition': f'attachment; filename="{safe}.{ext}"'})

@router.get('/{id}/review-status')
async def review_status(id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = await owned_transformation(id, user, db)
    rows = (await db.execute(select(GeneratedOutput).where(GeneratedOutput.transformation_id == id))).scalars().all()
    return {'transformation_id': id, 'status': t.status, 'total': len(rows), 'needs_review': sum(o.status == 'needs_review' for o in rows), 'approved': sum(o.status == 'approved' for o in rows), 'rejected': sum(o.status == 'rejected' for o in rows)}
