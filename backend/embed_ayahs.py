import os
import time
import requests
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")

engine = create_engine(DATABASE_URL)

def get_embedding(text_input: str) -> list[float]:
    # Uses Ollama locally - free, no API key needed
    try:
        res = requests.post("http://localhost:11434/api/embeddings", json={
            "model": "nomic-embed-text", 
            "prompt": text_input
        })
        res.raise_for_status()
        return res.json().get("embedding", [])
    except Exception as e:
        print(f"Error getting embedding: {e}")
        return []

def run():
    with engine.connect() as conn:
        # Fetch ayahs that do not have embeddings yet
        result = conn.execute(text("""
            SELECT a.id, a.verse_key, t.text
            FROM ayahs a
            JOIN translations t ON t.ayah_id = a.id AND t.resource_id = 131
            WHERE a.embedding IS NULL
            LIMIT 6236
        """))
        ayahs = result.fetchall()
        
        print(f"Found {len(ayahs)} ayahs to embed.")
        
        for ayah in ayahs:
            ayah_id, verse_key, ayah_text = ayah
            vector = get_embedding(ayah_text)
            
            if vector:
                # pgvector expects string representation like '[0.1, 0.2, ...]'
                vector_str = json.dumps(vector)
                conn.execute(text("""
                    UPDATE ayahs SET embedding = :vector::vector
                    WHERE id = :id
                """), {"vector": vector_str, "id": ayah_id})
                conn.commit()
                print(f"✓ embedded {verse_key}")
            
            time.sleep(0.05)

if __name__ == "__main__":
    run()
