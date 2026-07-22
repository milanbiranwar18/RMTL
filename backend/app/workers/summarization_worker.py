from app.workers.celery_app import celery_app

@celery_app.task(acks_late=True)
def summarize_transcript(call_id: str, transcript: str):
    # Logic to call SummarizationService
    print(f"Summarizing transcript for call {call_id}")
    return "Summary result"
