from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.database import get_db

router = APIRouter()

@router.post("/")
async def upload_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Logic to upload file to MinIO and create a Call record
    return {"filename": file.filename, "message": "File uploaded successfully"}
