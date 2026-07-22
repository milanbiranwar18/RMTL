from app.workers.celery_app import celery_app

@celery_app.task(acks_late=True)
def transcribe_audio(call_id: str, audio_path: str):
    # Logic to call TranscriptionService
    print(f"Transcribing audio for call {call_id}")
    return "Transcription result"
