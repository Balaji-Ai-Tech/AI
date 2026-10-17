from app.workers.celery_app import celery_app


@celery_app.task(name='transformhub.worker_health')
def worker_health() -> dict:
    """Small probe used to verify that Redis and the Celery worker are connected."""
    return {'status': 'ready', 'service': 'transformhub-celery-worker'}
