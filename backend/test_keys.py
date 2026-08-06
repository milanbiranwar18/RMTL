import os
from app.config import settings
import httpx

def test_anthropic():
    url = "https://api.anthropic.com/v1/messages"
    headers = {"x-api-key": settings.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    payload = {"model": "claude-3-5-sonnet-20241022", "max_tokens": 10, "messages": [{"role": "user", "content": "hello"}]}
    resp = httpx.post(url, headers=headers, json=payload, timeout=10)
    print("Anthropic:", resp.status_code, resp.text)

def test_openai():
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "content-type": "application/json"}
    payload = {"model": "gpt-4o", "max_tokens": 10, "messages": [{"role": "user", "content": "hello"}]}
    resp = httpx.post(url, headers=headers, json=payload, timeout=10)
    print("OpenAI:", resp.status_code, resp.text)

test_anthropic()
test_openai()
