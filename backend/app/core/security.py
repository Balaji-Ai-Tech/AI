from datetime import datetime, timedelta, timezone
from jose import jwt
from argon2 import PasswordHasher
from app.core.config import settings
ph=PasswordHasher()
def hash_password(password:str)->str: return ph.hash(password)
def verify_password(password:str, password_hash:str)->bool:
    try: return ph.verify(password_hash,password)
    except Exception: return False
def create_access_token(user_id:str)->str:
    exp=datetime.now(timezone.utc)+timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({'sub':user_id,'exp':exp},settings.JWT_SECRET_KEY,algorithm=settings.JWT_ALGORITHM)
