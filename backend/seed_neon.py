import os
import time
import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")

engine = create_engine(DATABASE_URL)
QDC_BASE = "https://api.qurancdn.com/api/qdc"

def seed():
    with engine.connect() as conn:
        # 1. Create tables
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS surahs (
                id SMALLINT PRIMARY KEY,
                name_arabic TEXT NOT NULL,
                name_simple TEXT NOT NULL,
                name_english TEXT NOT NULL,
                revelation_place TEXT NOT NULL,
                verses_count SMALLINT NOT NULL,
                pages_first SMALLINT,
                pages_last SMALLINT
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ayahs (
                id INT PRIMARY KEY,
                surah_id SMALLINT NOT NULL REFERENCES surahs(id),
                verse_number SMALLINT NOT NULL,
                verse_key TEXT NOT NULL UNIQUE,
                text_uthmani TEXT NOT NULL,
                text_simple TEXT NOT NULL,
                juz_number SMALLINT,
                hizb_number SMALLINT,
                page_number SMALLINT,
                sajda BOOLEAN DEFAULT FALSE,
                embedding vector(1536)
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS translations (
                id SERIAL PRIMARY KEY,
                ayah_id INT NOT NULL REFERENCES ayahs(id),
                resource_id SMALLINT NOT NULL,
                translator TEXT NOT NULL,
                language TEXT NOT NULL DEFAULT 'en',
                text TEXT NOT NULL,
                UNIQUE(ayah_id, resource_id)
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS words (
                id SERIAL PRIMARY KEY,
                ayah_id INT NOT NULL REFERENCES ayahs(id),
                position SMALLINT NOT NULL,
                text_uthmani TEXT NOT NULL,
                transliteration TEXT,
                translation TEXT,
                root_arabic TEXT,
                lemma_arabic TEXT,
                char_type TEXT
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tafsir (
                id SERIAL PRIMARY KEY,
                ayah_id INT NOT NULL REFERENCES ayahs(id),
                resource_id SMALLINT NOT NULL,
                scholar TEXT NOT NULL,
                language TEXT NOT NULL DEFAULT 'en',
                text TEXT NOT NULL,
                UNIQUE(ayah_id, resource_id)
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS recitations (
                id SERIAL PRIMARY KEY,
                ayah_id INT NOT NULL REFERENCES ayahs(id),
                reciter_id SMALLINT NOT NULL,
                reciter_name TEXT NOT NULL,
                audio_url TEXT NOT NULL,
                duration_ms INT,
                UNIQUE(ayah_id, reciter_id)
            );
        """))

        conn.execute(text("CREATE INDEX IF NOT EXISTS ayahs_surah_idx ON ayahs(surah_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ayahs_embedding_idx ON ayahs USING hnsw (embedding vector_cosine_ops);"))
        conn.commit()

        # 2. Fetch and insert all 114 surahs
        print("Fetching chapters...")
        res = requests.get(f"{QDC_BASE}/chapters?language=en").json()
        chapters = res.get("chapters", [])

        for ch in chapters:
            conn.execute(text("""
                INSERT INTO surahs (id, name_arabic, name_simple, name_english, revelation_place, verses_count, pages_first, pages_last)
                VALUES (:id, :name_arabic, :name_simple, :name_english, :revelation_place, :verses_count, :pages_first, :pages_last)
                ON CONFLICT (id) DO NOTHING
            """), {
                "id": ch["id"], "name_arabic": ch["nameArabic"], "name_simple": ch["nameSimple"],
                "name_english": ch["translatedName"]["name"], "revelation_place": ch["revelationPlace"],
                "verses_count": ch["versesCount"], "pages_first": ch["pages"][0], "pages_last": ch["pages"][1]
            })
        conn.commit()
        print("✓ surahs seeded")

        # 3. Fetch ayahs per surah (paginated)
        for ch in chapters:
            page = 1
            while True:
                url = f"{QDC_BASE}/verses/by_chapter/{ch['id']}?language=en&words=true&translations=131,85&tafsirs=169&recitations=7&fields=text_uthmani,text_simple,juz_number,hizb_number,page_number,sajda&page={page}&per_page=50"
                res_verses = requests.get(url).json()
                verses = res_verses.get("verses", [])
                
                for v in verses:
                    # Insert ayah
                    conn.execute(text("""
                        INSERT INTO ayahs (id, surah_id, verse_number, verse_key, text_uthmani, text_simple, juz_number, hizb_number, page_number, sajda)
                        VALUES (:id, :surah_id, :verse_number, :verse_key, :text_uthmani, :text_simple, :juz_number, :hizb_number, :page_number, :sajda)
                        ON CONFLICT (id) DO NOTHING
                    """), {
                        "id": v["id"], "surah_id": ch["id"], "verse_number": v["verseNumber"], "verse_key": v["verseKey"],
                        "text_uthmani": v["textUthmani"], "text_simple": v["textSimple"],
                        "juz_number": v.get("juzNumber"), "hizb_number": v.get("hizbNumber"), "page_number": v.get("pageNumber"),
                        "sajda": v.get("sajda", {}).get("applicable", False) if v.get("sajda") else False
                    })

                    # Insert words
                    for w in v.get("words", []):
                        conn.execute(text("""
                            INSERT INTO words (ayah_id, position, text_uthmani, transliteration, translation, root_arabic, lemma_arabic, char_type)
                            VALUES (:ayah_id, :position, :text_uthmani, :transliteration, :translation, :root_arabic, :lemma_arabic, :char_type)
                        """), {
                            "ayah_id": v["id"], "position": w["position"], "text_uthmani": w.get("textUthmani", ""),
                            "transliteration": w.get("transliteration", {}).get("text") if w.get("transliteration") else None,
                            "translation": w.get("translation", {}).get("text") if w.get("translation") else None,
                            "root_arabic": w.get("rootArabic"), "lemma_arabic": w.get("lemmaArabic"), "char_type": w.get("charType")
                        })

                    # Insert translations
                    for t in v.get("translations", []):
                        conn.execute(text("""
                            INSERT INTO translations (ayah_id, resource_id, translator, language, text)
                            VALUES (:ayah_id, :resource_id, :translator, 'en', :text)
                            ON CONFLICT (ayah_id, resource_id) DO NOTHING
                        """), {
                            "ayah_id": v["id"], "resource_id": t["resourceId"], 
                            "translator": t.get("resourceName", "unknown"), "text": t["text"]
                        })

                    # Insert tafsir
                    for tf in v.get("tafsirs", []):
                        conn.execute(text("""
                            INSERT INTO tafsir (ayah_id, resource_id, scholar, language, text)
                            VALUES (:ayah_id, :resource_id, :scholar, 'en', :text)
                            ON CONFLICT (ayah_id, resource_id) DO NOTHING
                        """), {
                            "ayah_id": v["id"], "resource_id": tf["resourceId"], 
                            "scholar": tf.get("resourceName", "unknown"), "text": tf["text"]
                        })

                    # Insert audio
                    for rec in v.get("audio", {}).get("recitations", []):
                        audio_path = rec.get("audioPath")
                        conn.execute(text("""
                            INSERT INTO recitations (ayah_id, reciter_id, reciter_name, audio_url)
                            VALUES (:ayah_id, :reciter_id, :reciter_name, :audio_url)
                            ON CONFLICT (ayah_id, reciter_id) DO NOTHING
                        """), {
                            "ayah_id": v["id"], "reciter_id": rec["recitationId"], 
                            "reciter_name": rec.get("reciterName", ""), 
                            "audio_url": f"https://verses.quran.com/{audio_path}" if audio_path else ""
                        })
                
                conn.commit()
                
                pagination = res_verses.get("pagination", {})
                if not pagination.get("nextPage"):
                    break
                page += 1
                time.sleep(0.2) # Rate limit
                
            print(f"✓ surah {ch['id']} seeded")

    print("✓ corpus complete — run embed_ayahs.py next for pgvector")

if __name__ == "__main__":
    seed()
