"""Synthesizes real DTMF (dual-tone multi-frequency) touch-tone audio for the workflow builder's
"Press Digit" node — e.g. to auto-navigate an IVR menu after a Call Transfer, or to confirm a
menu choice mid-call. No external API involved; this is generated directly from sine waves, then
encoded into whichever raw audio shape the telephony provider's media stream expects — see
services/telephony_service.py's module docstring for why that shape differs per provider:

- Twilio / Exotel / Telnyx / Plivo: 8-bit G.711 mu-law @ 8kHz (`encoding="mulaw"`)
- Vonage: 16-bit signed linear PCM @ 16kHz (`encoding="linear16"`)
"""

import base64
import math
import struct

try:
    import audioop  # stdlib — deprecated since Python 3.11, removed in 3.13; see fallback below
except ImportError:
    audioop = None

# Standard DTMF dual-frequency pairs (ITU-T Q.23).
_DTMF_FREQS = {
    '1': (697, 1209), '2': (697, 1336), '3': (697, 1477), 'A': (697, 1633),
    '4': (770, 1209), '5': (770, 1336), '6': (770, 1477), 'B': (770, 1633),
    '7': (852, 1209), '8': (852, 1336), '9': (852, 1477), 'C': (852, 1633),
    '*': (941, 1209), '0': (941, 1336), '#': (941, 1477), 'D': (941, 1633),
}


def _linear_to_mulaw_byte(sample: int) -> int:
    """Pure-Python G.711 mu-law encoder for a single 16-bit sample — only used if the stdlib
    `audioop` module isn't available (removed in Python 3.13+). Reference: ITU-T G.711."""
    MULAW_MAX, MULAW_BIAS = 0x1FFF, 33
    sign = 0x00
    if sample < 0:
        sample = -sample
        sign = 0x80
    sample += MULAW_BIAS
    if sample > MULAW_MAX:
        sample = MULAW_MAX
    exponent, mask = 7, 0x1000
    while exponent > 0 and not (sample & mask):
        exponent -= 1
        mask >>= 1
    mantissa = (sample >> (exponent + 3)) & 0x0F if exponent > 0 else (sample >> 1) & 0x0F
    return (~(sign | (exponent << 4) | mantissa)) & 0xFF


def _tone_pcm16(digit: str, sample_rate: int, duration_ms: int, amplitude: float = 0.55) -> bytes:
    f1, f2 = _DTMF_FREQS.get(digit.upper(), (0, 0))
    n = int(sample_rate * duration_ms / 1000)
    out = bytearray()
    for i in range(n):
        t = i / sample_rate
        val = amplitude * (math.sin(2 * math.pi * f1 * t) + math.sin(2 * math.pi * f2 * t)) / 2
        out += struct.pack('<h', int(val * 32767))
    return bytes(out)


def generate_dtmf_audio_base64(
    digits: str, sample_rate: int = 8000, encoding: str = "mulaw", tone_ms: int = 180, gap_ms: int = 90
) -> str:
    """Returns base64 of the encoded tone sequence for `digits` (any of 0-9 * # silently
    skipping anything else), ready to drop straight into the outbound audio field of whichever
    provider's media stream protocol this call is using. Empty string if nothing valid to send."""
    pcm = bytearray()
    silence_frame = b'\x00\x00' * int(sample_rate * gap_ms / 1000)
    for digit in digits:
        if digit.upper() not in _DTMF_FREQS:
            continue
        pcm += _tone_pcm16(digit, sample_rate, tone_ms)
        pcm += silence_frame

    if not pcm:
        return ""

    if encoding == "linear16":
        return base64.b64encode(bytes(pcm)).decode()

    if audioop is not None:
        encoded = audioop.lin2ulaw(bytes(pcm), 2)
    else:
        encoded = bytes(_linear_to_mulaw_byte(struct.unpack('<h', pcm[i:i + 2])[0]) for i in range(0, len(pcm), 2))
    return base64.b64encode(encoded).decode()
