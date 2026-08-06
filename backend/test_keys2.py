import os
from app.config import settings
import httpx

def test_anthropic():
    url = "https://api.anthropic.com/v1/messages"
    headers = {"x-api-key": settings.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    payload = {"model": "claude-3-5-sonnet-latest", "max_tokens": 10, "messages": [{"role": "user", "content": "hello"}]}
    resp = httpx.post(url, headers=headers, json=payload, timeout=10)
    print("Anthropic latest:", resp.status_code, resp.text)

    payload = {"model": "claude-3-5-sonnet-20240620", "max_tokens": 10, "messages": [{"role": "user", "content": "hello"}]}
    resp = httpx.post(url, headers=headers, json=payload, timeout=10)
    print("Anthropic 0620:", resp.status_code, resp.text)

test_anthropic()
