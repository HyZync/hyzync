from typing import Any, Dict, Optional

import fi_platform
from celery_app import celery_app


@celery_app.task(name="fi_tasks.sync_integration")
def sync_integration(
    tenant_id: int,
    integration: str,
    config: Optional[Dict[str, Any]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 200,
) -> Dict[str, Any]:
    return fi_platform.ingest_from_integration(
        tenant_id=tenant_id,
        integration=integration,
        config=config or {},
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        run_pipeline=True,
    )


@celery_app.task(name="fi_tasks.process_pending")
def process_pending(tenant_id: int) -> Dict[str, Any]:
    return fi_platform.process_pending_feedback(tenant_id)


@celery_app.task(name="fi_tasks.run_alerts")
def run_alerts(tenant_id: int) -> Dict[str, Any]:
    alerts = fi_platform.run_alert_rules(tenant_id)
    return {"alerts_triggered": len(alerts), "alerts": alerts}

