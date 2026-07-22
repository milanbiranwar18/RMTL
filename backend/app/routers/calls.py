from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.call import CallCreate, CallUpdate, CallResponse
from app.services import call_service

router = APIRouter(
    prefix="/calls",
    tags=["calls"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=CallResponse)
def create_call(call: CallCreate, db: Session = Depends(get_db)):
    return call_service.create_call(db=db, call=call)

@router.get("/", response_model=List[CallResponse])
def read_calls(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    calls = call_service.get_calls(db, skip=skip, limit=limit)
    return calls

@router.get("/{call_id}", response_model=CallResponse)
def read_call(call_id: int, db: Session = Depends(get_db)):
    db_call = call_service.get_call(db, call_id=call_id)
    if db_call is None:
        raise HTTPException(status_code=404, detail="Call not found")
    return db_call

from fastapi import Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import json
import httpx
import asyncio

@router.post("/{call_id}/twiml")
async def get_twiml(call_id: int, request: Request, db: Session = Depends(get_db)):
    """Generate TwiML to connect call to WebSocket stream"""
    from twilio.twiml.voice_response import VoiceResponse, Connect
    host = request.headers.get('host')
    response = VoiceResponse()
    connect = Connect()
    scheme = "wss" if request.url.scheme == "https" else "ws"
    connect.stream(url=f'{scheme}://{host}/calls/{call_id}/stream')
    response.append(connect)
    return HTMLResponse(content=str(response), media_type="application/xml")

from app.services.voice_service import VoiceService

@router.websocket("/{call_id}/stream")
async def websocket_stream(websocket: WebSocket, call_id: int, db: Session = Depends(get_db)):
    await websocket.accept()
    
    # We will buffer inbound audio and handle STT / TTS.
    voice_service = VoiceService()
    audio_buffer = bytearray()
    stream_sid = None
    
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            if msg['event'] == 'start':
                stream_sid = msg['start']['streamSid']
                print(f"Call {call_id} Stream started: {stream_sid}")
            
            elif msg['event'] == 'media':
                import base64
                payload = msg['media']['payload']
                audio_chunk = base64.b64decode(payload)
                audio_buffer.extend(audio_chunk)
                
                # Simple logic for MVP streaming/retell flow: 
                # After passing a certain buffer threshold (~2 seconds of audio), process it
                if len(audio_buffer) > 16000: # 8kHz mulaw = 16k bytes = 2s
                    # 1. Provide buffer text
                    transcript = await voice_service.transcribe_audio_sarvam(bytes(audio_buffer))
                    print(f"Captured Transcript: {transcript}")
                    
                    audio_buffer.clear() # reset buffer
                    
                    if transcript.strip():
                         # 2. Get LLM response or use simple echo
                         llm_reply = f"You said: {transcript}"
                         
                         # 3. TTS logic
                         audio_base64 = await voice_service.generate_audio_sarvam(llm_reply)
                         if audio_base64:
                             # Send back out
                             await websocket.send_json({
                                 "event": "media",
                                 "streamSid": stream_sid,
                                 "media": {
                                     "payload": audio_base64
                                 }
                             })
                                 
            elif msg['event'] == 'stop':
                print(f"Stream stopped for Call {call_id}")
                break
                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for call {call_id}")
    finally:
        # Evaluate POST-Call webhook feature (like Retell)
        db_call = call_service.get_call(db, call_id=call_id)
        if db_call and hasattr(db_call, 'agent_id'):
            # In a real scenario we'd fetch the Agent details
            pass
            
        # Example triggering a post_call_webhook if present
        # In this minimal replica, we'll imagine it's attached via Call schema
        # A more robust system would async dispatch this via Celery.
        webhook_url = getattr(db_call, 'webhook_url', None) if db_call else None
        if not webhook_url and db_call and hasattr(db_call, 'agent_id'):
             # Try to get from Agent model
             try:
                 from app.models.agent import Agent
                 agent = db.query(Agent).filter(Agent.id == db_call.agent_id).first()
                 if agent and hasattr(agent, 'webhook_url'):
                     webhook_url = agent.webhook_url
             except Exception:
                 pass

        if db_call:
            db_call.status = "completed"
            db.commit()
            
        # Invoke webhook if configured
        if webhook_url:
            payload = {
                "call_id": call_id,
                "status": "completed",
                "summary": "This is a placeholder summary for the conversation.",
                "transcript": "Full conversation transcript would be assembled here."
            }
            try:
                # Use background task or fire and forget
                asyncio.create_task(httpx.AsyncClient().post(webhook_url, json=payload, timeout=10.0))
                print(f"Dispatched post-call webhook to {webhook_url}")
            except Exception as e:
                print(f"Failed to dispatch webhook: {str(e)}")
