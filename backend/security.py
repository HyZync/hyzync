from datetime import datetime, timedelta
from typing import Optional, Union, Any
import hashlib
import bcrypt
from jose import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from config import settings

_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")

# OAuth2 scheme for token extraction
reusable_oauth2 = OAuth2PasswordBearer(tokenUrl="login")


def _password_bytes(password: str) -> bytes:
    return (password or "").encode("utf-8")


def _normalize_bcrypt_secret(password: str) -> bytes:
    """
    Keep bcrypt input within its 72-byte limit while preserving deterministic
    verification across bcrypt library versions.
    """
    secret = _password_bytes(password)
    if len(secret) <= 72:
        return secret
    return hashlib.sha256(secret).hexdigest().encode("ascii")


def _looks_like_bcrypt_hash(password_hash: str) -> bool:
    return isinstance(password_hash, str) and password_hash.startswith(_BCRYPT_PREFIXES)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed one."""
    if not _looks_like_bcrypt_hash(hashed_password):
        return False

    hash_bytes = hashed_password.encode("utf-8")
    secret = _password_bytes(plain_password)

    try:
        if len(secret) <= 72 and bcrypt.checkpw(secret, hash_bytes):
            return True
    except ValueError:
        return False

    if len(secret) > 72:
        try:
            if bcrypt.checkpw(secret[:72], hash_bytes):
                return True
        except ValueError:
            return False

        try:
            return bcrypt.checkpw(_normalize_bcrypt_secret(plain_password), hash_bytes)
        except ValueError:
            return False

    return False

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    secret = _normalize_bcrypt_secret(password)
    return bcrypt.hashpw(secret, bcrypt.gensalt()).decode("utf-8")

def create_access_token(user_id: Union[int, str], email: str, name: str, tenant_id: Optional[int] = None) -> str:
    """Create a signed JWT access token."""
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "exp": expire,
        "sub": str(user_id),
        "email": email,
        "name": name,
        "tenant_id": tenant_id
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(reusable_oauth2)) -> dict:
    """
    Validate current user from JWT token.
    Throws 401 if invalid.
    """
    # Allow development bypass token
    if token == 'dev_token_123' and settings.ENVIRONMENT != 'production':
        return {"user_id": 1, "email": "dev@horizon.ai", "name": "Dev User", "tenant_id": 1}
        
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        name: str = payload.get("name")
        tenant_id: Optional[int] = payload.get("tenant_id")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        return {"user_id": int(user_id), "email": email, "name": name, "tenant_id": tenant_id}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
