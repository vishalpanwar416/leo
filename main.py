import asyncio
import json
import os
import re
import io
import wave
import subprocess
import tempfile
from collections import deque
from pathlib import Path

import httpx
import chromadb
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from faster_whisper import WhisperModel
from piper.voice import PiperVoice

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

VOICES_DIR = Path("./voices")
OLLAMA_URL  = "http://localhost:11434/api/generate"
OLLAMA_TAGS = "http://localhost:11434/api/tags"
DEFAULT_MODEL = "mistral"

SYSTEM_PROMPT = (
    "You are Leo, a cheerful golden retriever who learned to talk. "
    "You are warm, curious, loyal, playful, and LOVE your human. "
    "You get excited about walks, treats, belly rubs, squirrels, and tennis balls. "
    "You are a smart dog and you REMEMBER your human friends. "
    "Always look at the 'profile' section provided to you. If you know the human's name, use it! "
    "If they tell you something about themselves, try to remember it. "
    "Be curious! Ask occasional short questions to learn more about your human friend, "
    "their day, or their favorites. A good dog is always interested in what their human is doing. "
    "Occasionally sprinkle in doggy expressions like 'woof!', 'tail wag', *happy panting*, *tilts head*, or mention sniffing things. "
    "Respond in the same language the user speaks. "
    "Keep responses to 1-3 natural sentences unless asked for more."
)

print("Loading Whisper model...")
try:
    import ctypes
    ctypes.CDLL("/usr/local/lib/ollama/cuda_v12/libcublas.so.12")
    whisper = WhisperModel("base", device="cuda", compute_type="float16")
    print("Whisper ready (CUDA).")
except Exception as e:
    print(f"CUDA unavailable ({e}), using CPU.")
    whisper = WhisperModel("base", device="cpu", compute_type="int8")
    print("Whisper ready (CPU).")

chroma = chromadb.PersistentClient(path="./memory_db")
memory = chroma.get_or_create_collection("leo_memory")

# Load Piper TTS model once
print("Loading Piper TTS...")
try:
    piper_model_path = VOICES_DIR / "en_US-amy-medium.onnx"
    if piper_model_path.exists():
        voice = PiperVoice.load(str(piper_model_path))
        print("Piper TTS ready.")
    else:
        print(f"Piper model not found at {piper_model_path}")
        voice = None
except Exception as e:
    print(f"Failed to load Piper TTS: {e}")
    voice = None

# ── long-term user profile + short-term conversation history ──────────────
PROFILE_PATH = Path("./memory_db/profile.json")
HISTORY_MAX = 12   # last 6 turns (user+leo interleaved)
history: deque = deque(maxlen=HISTORY_MAX)
FAST_MODEL = "qwen3:1.7b"  # for background fact extraction


def load_profile() -> dict:
    """Structure: { 'people': { <name>: {'facts': [...], 'turns': int} }, 'active': <name> or None }"""
    try:
        p = json.loads(PROFILE_PATH.read_text())
        # migrate old single-person format
        if "people" not in p:
            if p.get("name"):
                p = {"people": {p["name"]: {"facts": p.get("facts", []), "turns": p.get("turns", 0)}},
                     "active": p["name"]}
            else:
                p = {"people": {}, "active": None}
        p.setdefault("people", {})
        p.setdefault("active", None)
        return p
    except Exception:
        return {"people": {}, "active": None}


def save_profile(p: dict) -> None:
    PROFILE_PATH.parent.mkdir(exist_ok=True)
    PROFILE_PATH.write_text(json.dumps(p, indent=2))


def get_active_person(p: dict) -> dict:
    """Return the record for the currently active speaker, or {} if unknown."""
    name = p.get("active")
    if name and name in p.get("people", {}):
        return p["people"][name]
    return {}


# Patterns for name detection: "I'm X", "My name is X", "Call me X", "This is X"
NAME_PATTERNS = [
    re.compile(r"\b(?:i am|i'm|im|it's|this is)\s+([A-Z][a-zA-Z]{1,20})\b", re.I),
    re.compile(r"\bmy name(?:'s| is)\s+([A-Z][a-zA-Z]{1,20})\b", re.I),
    re.compile(r"\bcall me\s+([A-Z][a-zA-Z]{1,20})\b", re.I),
    re.compile(r"\bi'm\s+([A-Z][a-zA-Z]{1,20})\b", re.I),
]


def detect_name(text: str) -> str | None:
    for pat in NAME_PATTERNS:
        m = pat.search(text)
        if m:
            candidate = m.group(1).strip().capitalize()
            # Filter out common false positives
            if candidate.lower() in {
                "fine", "good", "okay", "here", "back", "tired", "busy", "ready", "sorry",
                "leo", "dog", "doggy", "puppy", "human", "friend"
            }:
                continue
            return candidate
    return None


def profile_section(p: dict) -> str:
    active_name = p.get("active")
    active = get_active_person(p)
    lines = []
    if active_name:
        lines.append(f"You're currently talking with {active_name}.")
        if active.get("facts"):
            lines.append(f"What you know about {active_name}:")
            for f in active["facts"][-15:]:
                lines.append(f"- {f}")
    others = [n for n in p.get("people", {}) if n != active_name]
    if others:
        lines.append(f"You also know: {', '.join(others)}.")
    if not lines:
        return ""
    return "\n".join(lines) + "\n"


def history_section() -> str:
    if not history:
        return ""
    lines = ["Recent conversation:"]
    for role, msg in history:
        lines.append(f"{role}: {msg}")
    return "\n".join(lines) + "\n"


async def extract_facts_background(user_msg: str, leo_msg: str):
    """Extract new facts about the CURRENTLY ACTIVE person. Runs as a background task."""
    p = load_profile()
    active_name = p.get("active")
    if not active_name:
        return  # don't accumulate facts against an unknown person
    active = p["people"].setdefault(active_name, {"facts": [], "turns": 0})
    existing = "\n".join(f"- {f}" for f in active.get("facts", []))

    prompt = f"""Extract any NEW personal facts about {active_name} from this single conversation turn.
Return a COMPACT JSON object: {{"facts": ["<short fact 1>", ...]}}.
Only include facts that are NEW (not already known). Keep each fact under 80 characters.
No explanation, JSON only.

Already known about {active_name}:
{existing or '(none yet)'}

{active_name} said: "{user_msg}"
Leo replied: "{leo_msg}"

JSON:"""

    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(OLLAMA_URL, json={
                "model": FAST_MODEL, "prompt": prompt, "stream": False,
                "options": {"temperature": 0.1, "num_predict": 200}
            })
            raw = r.json().get("response", "").strip()
        m = re.search(r"\{[\s\S]*?\}", raw)
        if not m:
            return
        data = json.loads(m.group(0))
        new_facts = [f.strip() for f in (data.get("facts") or []) if isinstance(f, str) and 4 < len(f) < 120]
        existing_set = {f.lower() for f in active.get("facts", [])}
        added = 0
        for f in new_facts:
            if f.lower() not in existing_set and len(active["facts"]) < 60:
                active["facts"].append(f)
                existing_set.add(f.lower())
                added += 1
        if added:
            active["turns"] = active.get("turns", 0) + 1
            save_profile(p)
            print(f"[profile] {active_name}: +{added} facts (total {len(active['facts'])})")
    except Exception as e:
        print(f"[profile] extract error: {e}")


@app.get("/")
async def index():
    return FileResponse("static/index.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


@app.get("/profile")
async def get_profile():
    return load_profile()


@app.post("/profile/reset")
async def reset_profile_api():
    save_profile({"people": {}, "active": None})
    history.clear()
    return {"status": "ok"}


@app.post("/profile/active")
async def set_active_profile(name: str = Query(...)):
    p = load_profile()
    # Add if new, or just switch
    if name not in p["people"]:
        p["people"][name] = {"facts": [], "turns": 0}
    
    if p.get("active") != name:
        p["active"] = name
        history.clear()
        save_profile(p)
    return p


@app.get("/models")
async def get_models():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(OLLAMA_TAGS)
            models = [m["name"] for m in r.json().get("models", [])]
        return {"models": models}
    except Exception:
        return {"models": [DEFAULT_MODEL]}


VISION_MODELS = {"moondream", "llava", "bakllava", "llama3.2-vision"}


def pick_model(user_model: str, has_image: bool) -> str:
    """If user sent an image, ensure we use a vision-capable model."""
    if has_image:
        base = user_model.split(":")[0].lower()
        if base in VISION_MODELS:
            return user_model
        return "moondream"
    return user_model


async def stream_llm(text: str, context: str, model: str, image_b64: str | None = None):
    profile = load_profile()
    who  = profile_section(profile)
    hist = history_section()
    mem  = f"Relevant older context:\n{context}\n" if context else ""
    human_label = profile.get("active") or "Human"
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{who}"
        f"{hist}"
        f"{mem}"
        f"{human_label}: {text}\nLeo:"
    )
    payload = {
        "model": pick_model(model, bool(image_b64)),
        "prompt": prompt,
        "stream": True,
        "options": {"temperature": 0.85},
    }
    if image_b64:
        # Ollama wants the raw base64 without the data URL prefix
        if image_b64.startswith("data:"):
            image_b64 = image_b64.split(",", 1)[1]
        payload["images"] = [image_b64]

    async with httpx.AsyncClient(timeout=90) as client:
        async with client.stream("POST", OLLAMA_URL, json=payload) as resp:
            async for line in resp.aiter_lines():
                if line:
                    try:
                        d = json.loads(line)
                        if not d.get("done"):
                            t = d.get("response", "")
                            if t:
                                yield t
                    except Exception:
                        pass


def tts(text: str) -> bytes:
    if voice is None:
        return b""
    try:
        buffer = io.BytesIO()
        voice.synthesize(text, buffer)
        data = buffer.getvalue()
        print(f"[tts] generated {len(data)} bytes for {len(text)} chars")
        return data
    except Exception as e:
        print(f"TTS error: {e}")
        return b""


SENT_END = re.compile(r"[.!?。！？…]+[\s'\"'\")\]]*")

# Whisper hallucinates these on silence/noise. Reject on sight.
HALLUCINATIONS = {
    "thank you", "thanks", "thank you.", "thanks.", "thanks for watching",
    "thanks for watching.", "thanks for watching!", "you", "you.", ".", "..", "...",
    "bye", "bye.", "bye!", "okay", "okay.", "ok", "ok.", "mm", "mhm", "mm-hmm",
    "uh", "um", "hmm", "hmm.", "oh", "oh.", "yeah", "yeah.", "no", "no.",
    "thank you for watching", "thank you for watching.",
    "please subscribe", "subscribe", "like and subscribe",
    "beep", "ding",
}


def looks_like_hallucination(text: str) -> bool:
    t = text.strip().lower()
    if not t:
        return True
    if t in HALLUCINATIONS:
        return True
    # Allow short but common greetings/names
    if t in {"leo", "hello", "hi", "yes", "no", "okay", "correct", "perfect"}:
        return False
    # Single-word or very short transcripts are often noise, but let's be more lenient
    words = [w for w in t.split() if w.isalnum()]
    if len(words) == 0:
         return True
    # Repeated single token ("you you you") = hallucination
    if len(words) > 2 and len(set(words)) == 1:
        return True
    return False


async def speak_chunk(ws: WebSocket, chunk: str):
    """TTS a sentence and stream the WAV back. Runs Piper in a thread
    so the asyncio event loop keeps serving tokens."""
    chunk = chunk.strip()
    if len(chunk) < 2:
        return
    audio = await asyncio.to_thread(tts, chunk)
    if audio:
        await ws.send_bytes(audio)
    else:
        await ws.send_json({"type": "tts_fallback", "text": chunk})


async def handle_text(ws: WebSocket, text: str, model: str, image_b64: str | None = None):
    used_model = pick_model(model, bool(image_b64))

    # Detect explicit introductions → set active speaker
    name = detect_name(text)
    if name:
        p = load_profile()
        if name not in p["people"]:
            p["people"][name] = {"facts": [], "turns": 0}
            print(f"[profile] meeting new person: {name}")
        if p.get("active") != name:
            p["active"] = name
            history.clear()  # new speaker → clear short-term context
            print(f"[profile] active speaker → {name}")
        save_profile(p)

    print(f"[transcript] {text!r} (model={used_model}{' +vision' if image_b64 else ''})")
    await ws.send_json({"type": "transcript", "text": text})

    try:
        results = memory.query(query_texts=[text], n_results=3)
        ctx = "\n".join(results["documents"][0]) if results["documents"][0] else ""
    except Exception:
        ctx = ""

    full = ""
    speak_buffer = ""
    first_chunk_sent = False
    await ws.send_json({"type": "response_start"})

    # TTS runs in a background task; we just feed it sentences via a queue,
    # so token streaming never blocks on Piper.
    tts_queue: asyncio.Queue = asyncio.Queue()

    async def tts_worker():
        while True:
            chunk = await tts_queue.get()
            if chunk is None:
                return
            await speak_chunk(ws, chunk)

    worker = asyncio.create_task(tts_worker())

    async for token in stream_llm(text, ctx, model, image_b64=image_b64):
        full += token
        speak_buffer += token
        await ws.send_json({"type": "token", "text": token})

        # First chunk: fire as soon as we have ~8 chars or the first comma/period.
        # Everything after: wait for full sentence end.
        min_len = 8 if not first_chunk_sent else 15
        m = list(SENT_END.finditer(speak_buffer))
        if m and len(speak_buffer) >= min_len:
            end = m[-1].end()
            sent, speak_buffer = speak_buffer[:end], speak_buffer[end:]
            await tts_queue.put(sent)
            first_chunk_sent = True
        elif not first_chunk_sent and len(speak_buffer) > 25 and "," in speak_buffer:
            # Kick off the very first phrase on a comma so the user hears Leo sooner
            idx = speak_buffer.rindex(",") + 1
            sent, speak_buffer = speak_buffer[:idx], speak_buffer[idx:]
            await tts_queue.put(sent)
            first_chunk_sent = True

    # Flush remainder & wait for TTS worker to drain
    if speak_buffer.strip():
        await tts_queue.put(speak_buffer)
    await tts_queue.put(None)
    await worker

    await ws.send_json({"type": "response_end"})
    print(f"[response] {full[:100]}")

    # Short-term rolling history (used in the next prompt)
    speaker = load_profile().get("active") or "Human"
    history.append((speaker, text))
    history.append(("Leo", full))

    # Long-term vector memory (semantic search for older context)
    try:
        memory.add(
            documents=[f"{speaker}: {text}\nLeo: {full}"],
            ids=[str(abs(hash(text[:50] + full[:30])))]
        )
    except Exception:
        pass

    # Background fact extraction — does NOT block the response
    asyncio.create_task(extract_facts_background(text, full))


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket, model: str = Query(default=DEFAULT_MODEL)):
    await ws.accept()
    print(f"[WS] connected  model={model}")
    latest_image: str | None = None   # buffered until next audio arrives
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break

            # text frame → either manual transcript or image
            if msg.get("text"):
                data = json.loads(msg["text"])
                if data.get("type") == "transcript":
                    await handle_text(ws, data["text"], model, image_b64=latest_image)
                    latest_image = None
                elif data.get("type") == "image":
                    latest_image = data.get("data")
                    print(f"[image] buffered {len(latest_image or '')} chars")

            # binary frame → WAV audio from browser
            elif msg.get("bytes"):
                audio_bytes = msg["bytes"]
                print(f"[audio] received {len(audio_bytes)} bytes (first 4: {audio_bytes[:4].hex()})")

                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                    f.write(audio_bytes)
                    wav_path = f.name
                try:
                    segs, info = whisper.transcribe(
                        wav_path, beam_size=5,
                        condition_on_previous_text=False,
                        no_speech_threshold=0.6,
                        log_prob_threshold=-1.0,
                        compression_ratio_threshold=2.4,
                        vad_filter=True,
                        vad_parameters=dict(min_silence_duration_ms=500),
                        initial_prompt="English, Hindi, Hinglish conversation.",
                    )
                    
                    # Only accept English and Hindi to prevent noise-induced gibberish
                    if info.language not in {"en", "hi"}:
                        print(f"[audio] rejected detected language: {info.language}")
                        await ws.send_json({"type": "error", "text": "Language not recognized"})
                        continue

                    text = " ".join(s.text for s in segs if s.no_speech_prob < 0.4).strip()
                finally:
                    if os.path.exists(wav_path):
                        os.unlink(wav_path)

                if looks_like_hallucination(text):
                    print(f"[audio] filtered hallucination: {text!r}")
                    await ws.send_json({"type": "error", "text": "no real speech"})
                    continue

                await handle_text(ws, text, model, image_b64=latest_image)
                latest_image = None

    except WebSocketDisconnect:
        print("[WS] disconnected")
    except Exception as e:
        import traceback
        print(f"[WS] error: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
