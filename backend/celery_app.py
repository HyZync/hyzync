import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "fi_platform",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["fi_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "fi_tasks.sync_integration": {"queue": "fi_ingestion"},
        "fi_tasks.process_pending": {"queue": "fi_ai"},
        "fi_tasks.run_alerts": {"queue": "fi_alerts"},
    },
)

