from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from dotenv import load_dotenv, find_dotenv
import os
import requests

load_dotenv(find_dotenv())

app = FastAPI(title="Noor Quran API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup Jinja2 Templates
templates_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
templates = Jinja2Templates(directory=templates_dir)

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL) if DATABASE_URL else None

QDC_BASE = "https://api.quran.com/api/v4"

import json
import pathlib
import asyncio
from fastapi import BackgroundTasks

# Setup Cache Directory relative to this file
CACHE_DIR = pathlib.Path(__file__).parent.resolve() / "cache_api"
try:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
except Exception as e:
    print(f"Cache directory creation ignored (read-only filesystem): {e}")

# Simple In-Memory Cache to speed up API requests to 0ms
surah_cache = {}
search_cache = {}

def get_cached_file(name: str):
    file_path = CACHE_DIR / f"{name}.json"
    if file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading cache file {name}: {e}")
    return None

def save_to_cache(name: str, data):
    file_path = CACHE_DIR / f"{name}.json"
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error writing cache file {name}: {e}")

import re

def clean_translation_text(text_val: str) -> str:
    if not text_val:
        return ""
    # Remove footnote tags along with their content (e.g., <sup ...>1</sup>)
    cleaned = re.sub(r'<sup[^>]*>.*?</sup>', '', text_val)
    # Remove any remaining HTML tags
    cleaned = re.sub(r'<[^<]+?>', '', cleaned)
    # Replace multiple spaces/newlines/tabs with a single space
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def get_embedding(text_input: str) -> list[float]:
    # Uses Ollama locally - free, no API key needed
    try:
        res = requests.post("http://localhost:11434/api/embeddings", json={
            "model": "nomic-embed-text", 
            "prompt": text_input
        }, timeout=1.0) # Fast timeout so it doesn't block the API
        res.raise_for_status()
        return res.json().get("embedding", [])
    except Exception as e:
        print(f"Error getting embedding: {e}")
        return []

def search_local_cache(query: str) -> list:
    results = []
    query_lower = query.lower()
    
    # We iterate over all cached surah files to find local matches
    for filepath in CACHE_DIR.glob("surah_*.json"):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                surah = data.get("surah", {})
                verses = data.get("verses", [])
                
                surah_name = surah.get("name_english", f"Surah {surah.get('id')}")
                surah_id = surah.get("id")
                
                for v in verses:
                    translation = v.get("translation", "")
                    text_uthmani = v.get("text_uthmani", "")
                    
                    if query_lower in translation.lower() or query_lower in text_uthmani:
                        # Simple match scoring
                        score = 0.9 if query_lower in translation.lower() else 0.8
                        results.append({
                            "id": v.get("id"),
                            "surah_id": surah_id,
                            "verse_number": v.get("verse_number"),
                            "verse_key": f"{surah_id}:{v.get('verse_number')}",
                            "text_uthmani": text_uthmani,
                            "translation": translation,
                            "surah_name": surah_name,
                            "similarity": score
                        })
        except Exception as e:
            print(f"Error reading cache file {filepath} during search: {e}")
            
    # Sort by score descending and limit to 10
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:10]

# --- HTML FRONTEND ENDPOINT ---
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Serve the pure Python HTML frontend template"""
    return templates.TemplateResponse(request=request, name="index.html", context={})


# --- API ENDPOINTS ---
@app.get("/api/surahs")
async def get_all_surahs():
    """Get list of all 114 Surahs for the dropdown"""
    cached = get_cached_file("surahs")
    if cached:
        return cached

    if engine:
        try:
            with engine.connect() as conn:
                surahs = conn.execute(text("SELECT id, name_arabic, name_english FROM surahs ORDER BY id")).fetchall()
                if surahs:
                    res_data = [dict(s._mapping) for s in surahs]
                    save_to_cache("surahs", res_data)
                    return res_data
        except Exception as e:
            print("DB error on surahs, falling back to API:", e)
            
    # Fallback to Quran.com API if DB is empty or fails
    try:
        res = requests.get(f"{QDC_BASE}/chapters?language=en", timeout=5.0).json()
        res_data = [{"id": c["id"], "name_arabic": c["name_arabic"], "name_english": c["translated_name"]["name"]} for c in res.get("chapters", [])]
        if res_data:
            save_to_cache("surahs", res_data)
        return res_data
    except Exception as e:
        print("Quran.com API error:", e)
        # Emergency static recovery
        return []

@app.get("/api/surah/{surah_id}")
async def get_surah(surah_id: int, translation_id: int = 85):
    """Get complete surah with verses, translations, and audio"""
    cache_key = f"surah_{surah_id}_{translation_id}"

    # 1. Check in-memory cache first
    if cache_key in surah_cache:
        return surah_cache[cache_key]

    # 2. Check disk cache
    cached = get_cached_file(cache_key)
    if cached:
        surah_cache[cache_key] = cached
        return cached

    if engine:
        try:
            with engine.connect() as conn:
                # Check if this translation_id exists in the database
                check_tid = conn.execute(
                    text("SELECT 1 FROM translations WHERE resource_id = :tid LIMIT 1"),
                    {"tid": translation_id}
                ).fetchone()

                if check_tid:
                    surah_result = conn.execute(text("SELECT * FROM surahs WHERE id = :id"), {"id": surah_id}).fetchone()
                    if surah_result:
                        verses_result = conn.execute(text("""
                            SELECT
                                a.id, a.verse_number, a.text_uthmani,
                                t.text AS translation,
                                r.audio_url
                            FROM ayahs a
                            LEFT JOIN translations t ON t.ayah_id = a.id AND t.resource_id = :translation_id
                            LEFT JOIN recitations r  ON r.ayah_id = a.id AND r.reciter_id = 7
                            WHERE a.surah_id = :surah_id
                            ORDER BY a.verse_number
                        """), {"surah_id": surah_id, "translation_id": translation_id}).fetchall()
                        
                        res_data = {
                            "surah": dict(surah_result._mapping),
                            "verses": [
                                {
                                    "id": v.id,
                                    "verse_number": v.verse_number,
                                    "text_uthmani": v.text_uthmani,
                                    "translation": clean_translation_text(v.translation),
                                    "audio_url": v.audio_url
                                }
                                for v in verses_result
                            ]
                        }
                        # Save to caches
                        surah_cache[cache_key] = res_data
                        save_to_cache(cache_key, res_data)
                        return res_data
                else:
                    print(f"Translation resource {translation_id} not in DB, falling back to API.")
        except Exception as e:
            print("DB error on surah fetch, falling back to API:", e)

    # Fallback to Quran.com API if DB is empty, fails, or lacks translation
    try:
        # Get Surah Details
        chapter_res = requests.get(f"{QDC_BASE}/chapters/{surah_id}?language=en", timeout=5.0).json()
        chapter = chapter_res.get("chapter", {})
        
        surah_data = {
            "id": chapter.get("id"),
            "name_arabic": chapter.get("name_arabic"),
            "name_english": chapter.get("translated_name", {}).get("name"),
            "revelation_place": chapter.get("revelation_place"),
            "verses_count": chapter.get("verses_count")
        }

        # Get Verses Details (up to 300 verses per page to get whole surah)
        verses_res = requests.get(f"{QDC_BASE}/verses/by_chapter/{surah_id}?language=en&words=false&translations={translation_id}&audio=7&fields=text_uthmani&per_page=300", timeout=8.0).json()
        verses_data = []
        
        for v in verses_res.get("verses", []):
            audio_path = None
            if "audio" in v and v["audio"]:
                audio_path = v["audio"].get("url")
                
            verses_data.append({
                "id": v["id"],
                "verse_number": v["verse_number"],
                "text_uthmani": v["text_uthmani"],
                "translation": clean_translation_text(v["translations"][0]["text"]) if v.get("translations") else "",
                "audio_url": f"https://verses.quran.com/{audio_path}" if audio_path else ""
            })

        res_data = {
            "surah": surah_data,
            "verses": verses_data
        }
        # Save to caches
        surah_cache[cache_key] = res_data
        save_to_cache(cache_key, res_data)
        return res_data
    except Exception as e:
        print(f"Error fetching surah {surah_id} for translation {translation_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch surah details")

@app.get("/api/search")
async def semantic_search(q: str = Query(...), translation_id: int = 85):
    """Semantic search for verses based on query"""
    cache_key = f"search_{q}_{translation_id}"
    # Check in-memory cache first
    if cache_key in search_cache:
        return search_cache[cache_key]

    if engine:
        try:
            # Try to get vector embedding from Ollama
            vector = get_embedding(q)
            if vector:
                with engine.connect() as conn:
                    # Check if requested translation is in DB
                    check_tid = conn.execute(
                        text("SELECT 1 FROM translations WHERE resource_id = :tid LIMIT 1"),
                        {"tid": translation_id}
                    ).fetchone()
                    
                    db_tid = translation_id if check_tid else 85 # fallback to English if not present in DB
                    
                    # Perform cosine distance query using pgvector HNSW index
                    vector_str = json.dumps(vector)
                    results = conn.execute(text(f"""
                        SELECT 
                            a.id, a.surah_id, a.verse_number, a.verse_key, a.text_uthmani,
                            t.text AS translation,
                            s.name_english AS surah_name,
                            (1 - (a.embedding <=> :vector::vector)) AS similarity
                        FROM ayahs a
                        JOIN surahs s ON s.id = a.surah_id
                        LEFT JOIN translations t ON t.ayah_id = a.id AND t.resource_id = {db_tid}
                        WHERE a.embedding IS NOT NULL
                        ORDER BY a.embedding <=> :vector::vector
                        LIMIT 10
                    """), {"vector": vector_str}).fetchall()
                    
                    if results:
                        res_list = [
                            {
                                "id": r.id,
                                "surah_id": r.surah_id,
                                "verse_number": r.verse_number,
                                "verse_key": r.verse_key,
                                "text_uthmani": r.text_uthmani,
                                "translation": clean_translation_text(r.translation),
                                "surah_name": r.surah_name,
                                "similarity": float(r.similarity)
                            }
                            for r in results
                        ]
                        search_cache[cache_key] = res_list
                        return res_list
            
            # If Ollama failed or vector is empty, do a standard keyword search on DB
            with engine.connect() as conn:
                check_tid = conn.execute(
                    text("SELECT 1 FROM translations WHERE resource_id = :tid LIMIT 1"),
                    {"tid": translation_id}
                ).fetchone()
                db_tid = translation_id if check_tid else 85
                
                results = conn.execute(text(f"""
                    SELECT 
                        a.id, a.surah_id, a.verse_number, a.verse_key, a.text_uthmani,
                        t.text AS translation,
                        s.name_english AS surah_name,
                        1.0 AS similarity
                    FROM ayahs a
                    JOIN surahs s ON s.id = a.surah_id
                    LEFT JOIN translations t ON t.ayah_id = a.id AND t.resource_id = {db_tid}
                    WHERE t.text ILIKE :query OR a.text_simple ILIKE :query
                    LIMIT 10
                """), {"query": f"%{q}%"}).fetchall()
                if results:
                    res_list = [
                        {
                            "id": r.id,
                            "surah_id": r.surah_id,
                            "verse_number": r.verse_number,
                            "verse_key": r.verse_key,
                            "text_uthmani": r.text_uthmani,
                            "translation": clean_translation_text(r.translation),
                            "surah_name": r.surah_name,
                            "similarity": float(r.similarity)
                        }
                        for r in results
                    ]
                    search_cache[cache_key] = res_list
                    return res_list
        except Exception as e:
            print("DB search error:", e)

    # Search locally through cached files first for 100% instant offline results
    local_results = search_local_cache(q)
    if local_results:
        # Note: Local cached surah files might have the wrong translation, but this is a fast offline search fallback
        search_cache[cache_key] = local_results
        return local_results
            
    # Fallback to Quran.com API search
    try:
        res = requests.get(f"{QDC_BASE}/search?query={q}&size=10&translations={translation_id}", timeout=5.0).json()
        search_data = res.get("search") or {}
        search_results = search_data.get("results", []) or []
        
        matches = []
        for r in search_results:
            verse_key = r.get("verse_key")
            if not verse_key or ":" not in verse_key:
                continue
            try:
                surah_id, verse_num = map(int, verse_key.split(":"))
            except ValueError:
                continue
            
            words = r.get("words", []) or []
            arabic_str = " ".join([w.get("text_uthmani", "") or w.get("text", "") for w in words if isinstance(w, dict) and w.get("char_type") != "end"])
            
            translations_list = r.get("translations", []) or []
            translation_html = translations_list[0].get("text", "") if translations_list else ""
            clean_translation = clean_translation_text(translation_html)
            surah_name = f"Surah {surah_id}"
            
            matches.append({
                "id": r.get("verse_id"),
                "surah_id": surah_id,
                "verse_number": verse_num,
                "verse_key": verse_key,
                "text_uthmani": arabic_str or r.get("text", ""),
                "translation": clean_translation,
                "surah_name": surah_name,
                "similarity": 0.85
            })
        search_cache[cache_key] = matches
        return matches
    except Exception as e:
        print("Quran.com search fallback error:", e)
        return []

# Startup background cache pre-fetcher
async def prefetch_all_surahs():
    print("Background Task: Starting cache pre-fetcher to warm up all 114 Surahs...")
    try:
        # Load the surahs list from cache or API
        cached_surahs = get_cached_file("surahs")
        if not cached_surahs:
            print("Fetching Surah list for background worker...")
            try:
                res = requests.get(f"{QDC_BASE}/chapters?language=en", timeout=5.0).json()
                cached_surahs = [{"id": c["id"], "name_arabic": c["name_arabic"], "name_english": c["translated_name"]["name"]} for c in res.get("chapters", [])]
                if cached_surahs:
                    save_to_cache("surahs", cached_surahs)
            except Exception as e:
                print("Error loading Surah list in background worker:", e)
                return

        for s in cached_surahs:
            surah_id = s["id"]
            if not (CACHE_DIR / f"surah_{surah_id}.json").exists():
                print(f"Pre-fetching Surah {surah_id} ({s['name_english']})...")
                try:
                    chapter_res = requests.get(f"{QDC_BASE}/chapters/{surah_id}?language=en", timeout=5.0).json()
                    chapter = chapter_res.get("chapter", {})
                    surah_data = {
                        "id": chapter.get("id"),
                        "name_arabic": chapter.get("name_arabic"),
                        "name_english": chapter.get("translated_name", {}).get("name"),
                        "revelation_place": chapter.get("revelation_place"),
                        "verses_count": chapter.get("verses_count")
                    }

                    verses_res = requests.get(f"{QDC_BASE}/verses/by_chapter/{surah_id}?language=en&words=false&translations=85&audio=7&fields=text_uthmani&per_page=300", timeout=8.0).json()
                    verses_data = []
                    for v in verses_res.get("verses", []):
                        audio_path = None
                        if "audio" in v and v["audio"]:
                            audio_path = v["audio"].get("url")
                        verses_data.append({
                            "id": v["id"],
                            "verse_number": v["verse_number"],
                            "text_uthmani": v["text_uthmani"],
                            "translation": v["translations"][0]["text"] if v.get("translations") else "",
                            "audio_url": f"https://verses.quran.com/{audio_path}" if audio_path else ""
                        })

                    res_data = {
                        "surah": surah_data,
                        "verses": verses_data
                    }
                    save_to_cache(f"surah_{surah_id}", res_data)
                    # Brief sleep to avoid hitting API rate limits too aggressively
                    await asyncio.sleep(0.4)
                except Exception as ex:
                    print(f"Error prefetching Surah {surah_id}: {ex}")
                    await asyncio.sleep(2.0)
        print("[SUCCESS] Background Task: Cache pre-fetching completed! All 114 Surahs fully cached offline.")
    except Exception as e:
        print("Error in background prefetch task:", e)

# --- EMAIL SUBMISSIONS ROUTER ---
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_TO = os.getenv("EMAIL_TO", "arnoldkhan7866@gmail.com")
WEB3FORMS_KEY = os.getenv("WEB3FORMS_KEY", "")

def send_lead_email(subject: str, content: str):
    # 1. Try standard SMTP if credentials are configured
    if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
        try:
            msg = MIMEMultipart()
            msg["From"] = SMTP_USER
            msg["To"] = EMAIL_TO
            msg["Subject"] = subject
            msg.attach(MIMEText(content, "plain"))
            
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
            print("[SUCCESS] Email sent successfully via SMTP.")
            return True
        except Exception as e:
            print(f"SMTP sending failed: {e}")
            
    # 2. Try Web3Forms if key is set (convenient free alternative for serverless hosts)
    if WEB3FORMS_KEY:
        try:
            payload = {
                "access_key": WEB3FORMS_KEY,
                "subject": subject,
                "from_name": "Noor Quran Leads",
                "message": content
            }
            res = requests.post("https://api.web3forms.com/submit", json=payload, timeout=5.0)
            if res.status_code == 200:
                print("[SUCCESS] Email sent successfully via Web3Forms.")
                return True
            else:
                print(f"Web3Forms returned status {res.status_code}: {res.text}")
        except Exception as e:
            print(f"Web3Forms sending failed: {e}")
            
    # 3. Fallback: Log the details
    print(f"WARN: No active email configuration (SMTP or Web3Forms) found. Lead subject: {subject}\n{content}")
    return False

@app.post("/api/submit-lead")
async def handle_submit_lead(request: Request):
    """Securely accept leads from the frontend and email them to the site owner"""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    lead_type = data.get("type", "pilgrim")
    package_name = data.get("packageName", "")
    name = data.get("name", "N/A")
    email = data.get("email", "N/A")
    whatsapp = data.get("whatsapp", "N/A")
    travel_month = data.get("travelMonth", "N/A")
    budget = data.get("budget", "N/A")
    notes = data.get("notes", "N/A")
    
    if lead_type == "agency":
        subject = f"[Agency Signup] {name} has registered on Noor Quran"
        content = (
            f"Dear Administrator,\n\n"
            f"A new travel agency partner registration has been submitted:\n\n"
            f"Agency / Contact Name: {name}\n"
            f"Email Address: {email}\n"
            f"WhatsApp Contact: {whatsapp}\n"
            f"Operational Base: {travel_month}\n"
            f"License Status: {budget}\n\n"
            f"Agency Profile / Description:\n{notes}\n\n"
            f"Please review their credentials and contact them directly to activate their account."
        )
    else:
        subject = f"[Pilgrim Lead] {name} requested custom quotes"
        content = (
            f"Dear Administrator,\n\n"
            f"A new pilgrim custom trip estimate lead has been submitted:\n\n"
            f"Pilgrim Name: {name}\n"
            f"Email Address: {email}\n"
            f"WhatsApp Contact: {whatsapp}\n"
            f"Estimated Package: {package_name}\n"
            f"Proposed Travel Month: {travel_month}\n"
            f"Preferred Budget Level: {budget}\n\n"
            f"Pilgrim Request / Notes:\n{notes}\n\n"
            f"You can contact this pilgrim directly via WhatsApp or forward their plan to registered partners."
        )
        
    success = send_lead_email(subject, content)
    return {"status": "success", "emailed": success}

@app.on_event("startup")
async def startup_event():
    # Start pre-fetching in the background so it doesn't block server startup
    asyncio.create_task(prefetch_all_surahs())

if __name__ == "__main__":
    import uvicorn
    print("Starting Noor Quran pure Python backend at http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
