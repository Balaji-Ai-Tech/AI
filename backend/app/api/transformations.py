from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.db.database import get_db
from app.db.models import User, Transformation
from app.schemas.transformation import TransformationCreate, TransformationUpdate

router = APIRouter(prefix='/api/transformations', tags=['Transformations'])

def serialize(t: Transformation):
    return {
        'id': t.id, 'title': t.title, 'summary': t.summary, 'status': t.status,
        'configuration': t.configuration or {}, 'created_at': t.created_at.isoformat(),
    }

@router.post('', status_code=201)
async def create(req: TransformationCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = Transformation(user_id=user.id, title=req.title.strip() or 'New Transformation', summary=req.summary, configuration=req.configuration)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return serialize(t)

@router.get('')
async def list_transformations(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Transformation).where(Transformation.user_id == user.id).order_by(desc(Transformation.created_at)))).scalars().all()
    return [serialize(t) for t in rows]

@router.get('/{id}')
async def get(id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(Transformation).where(Transformation.id == id, Transformation.user_id == user.id))).scalar_one_or_none()
    if not t: raise HTTPException(404, 'Transformation not found')
    return serialize(t)

@router.patch('/{id}')
async def update(id: str, req: TransformationUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(Transformation).where(Transformation.id == id, Transformation.user_id == user.id))).scalar_one_or_none()
    if not t: raise HTTPException(404, 'Transformation not found')
    for key, value in req.model_dump(exclude_none=True).items(): setattr(t, key, value)
    await db.commit()
    await db.refresh(t)
    return serialize(t)
