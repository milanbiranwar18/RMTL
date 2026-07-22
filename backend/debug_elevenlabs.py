from elevenlabs.client import ElevenLabs
import elevenlabs

print("elevenlabs dir:", dir(elevenlabs))
try:
    client = ElevenLabs(api_key="test")
    print("ElevenLabs client dir:", dir(client))
    if hasattr(client, 'text_to_speech'):
        print("client.text_to_speech dir:", dir(client.text_to_speech))
except Exception as e:
    print("Error instantiating client:", e)
