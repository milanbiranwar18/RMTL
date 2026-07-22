from celery import Celery
from app.config import settings

celery_app = Celery(
    "worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.task_routes = {
    "app.workers.transcription_worker.transcribe_audio": "transcription-queue",
    "app.workers.summarization_worker.summarize_transcript": "summarization-queue",
}
