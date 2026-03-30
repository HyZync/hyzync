import os
import json
from typing import Annotated, List
from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

class Settings(BaseSettings):
    # Core API Settings
    PROJECT_NAME: str = "Hyzync Intelligence API"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Security
    # In production, these MUST be set via environment variables
    SECRET_KEY: str = os.getenv("SECRET_KEY", "b404d0c9f8a84c8a2e1d7a8d9f1e0b5c4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9") 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_PATH: str = os.path.join(os.path.dirname(__file__), "data", "app.db")
    TELEMETRY_DB_PATH: str = os.path.join(os.path.dirname(__file__), "admin_telemetry.db")
    
    # CORS
    ALLOWED_ORIGINS: Annotated[List[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ]
    
    # LLM Service
    OLLAMA_URL: str = os.getenv("OLLAMA_URL", "https://ai.hyzync.com")
    OLLAMA_FALLBACK_URLS: str = os.getenv("OLLAMA_FALLBACK_URLS", "")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen3.5:4b")
    # Keep defaults practical for remote inference latency; override via env when needed.
    OLLAMA_NUM_CTX: int = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
    ANALYSIS_CONTEXT_WINDOW_TOKENS: int = int(os.getenv("ANALYSIS_CONTEXT_WINDOW_TOKENS", "8192"))
    ANALYSIS_CONTEXT_HEADROOM: float = float(os.getenv("ANALYSIS_CONTEXT_HEADROOM", "0.85"))
    OLLAMA_REQUEST_TIMEOUT_SECONDS: int = int(os.getenv("OLLAMA_REQUEST_TIMEOUT_SECONDS", "90"))
    OLLAMA_REQUEST_RETRIES: int = int(os.getenv("OLLAMA_REQUEST_RETRIES", "1"))
    WINDOW_IDLE_FALLBACK_SECONDS: int = int(os.getenv("WINDOW_IDLE_FALLBACK_SECONDS", "0"))
    OLLAMA_PREFLIGHT_TIMEOUT_SECONDS: int = int(os.getenv("OLLAMA_PREFLIGHT_TIMEOUT_SECONDS", "30"))
    LLM_MAX_CONCURRENCY: int = 3
    LLM_WINDOW_MAX_WORKERS_REMOTE: int = 3
    LLM_WINDOW_MAX_WORKERS_LOCAL: int = 4
    LLM_BILLING_RATE_PER_1K_TOKENS: float = float(os.getenv("LLM_BILLING_RATE_PER_1K_TOKENS", "0.0015"))
    
    # Rate Limiting
    DEFAULT_RATE_LIMIT: str = "200/minute"
    AUTH_RATE_LIMIT: str = "5/minute"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value):
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
                raise ValueError("ALLOWED_ORIGINS JSON value must be a list")
            return [origin.strip() for origin in raw.split(",") if origin.strip()]

        if isinstance(value, (list, tuple)):
            return [str(item).strip() for item in value if str(item).strip()]

        return value
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra='ignore'
    )

settings = Settings()
