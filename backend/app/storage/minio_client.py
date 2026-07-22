from minio import Minio
from app.config import settings

minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=False
)

def upload_file(file_path: str, object_name: str):
    minio_client.fput_object(
        settings.MINIO_BUCKET_NAME, object_name, file_path,
    )
