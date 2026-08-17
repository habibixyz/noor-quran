# 🌙 Noor Quran

A premium, immersive, AI-powered Quran experience designed for the modern web.

Noor Quran blends state-of-the-art web technologies and artificial intelligence to create a beautiful, distraction-free environment for spiritual reading, listening, and learning. It features a complete Quran Reader, a hybrid AI-powered Semantic Search engine, and an interactive digital Umrah Companion suite.

**Live Demo**: [quranonbase.vercel.app](https://quranonbase.vercel.app/)

---

## 🏛 Directory Structure

The project is structured as a monorepo containing the frontend client, backend search engine, and Vercel serverless integration:

```text
noor-quran/
├── frontend/              # React + TypeScript + Vite + Tailwind CSS client
│   ├── src/
│   │   ├── components/    # Core components (QuranReader, UmrahCompanion, SemanticSearch, etc.)
│   │   ├── context/       # Audio and UI State Contexts
│   │   └── data/          # Static Quran translations & lists
│   └── public/            # Static assets
├── backend/               # FastAPI Python search engine & lead management API
│   ├── main.py            # Main application router & caching engine
│   ├── seed_neon.py       # Neon Postgres & pgvector seeder
│   └── embed_ayahs.py     # Ayah embedding generator using Ollama
├── api/                   # Vercel serverless integration
│   └── index.py           # Entrypoint for hosting the FastAPI backend on Vercel
├── package.json           # Root build script
└── vercel.json            # Vercel deployment and routing rules
```

---

## ⚡ Core Features

### 1. 📖 Full Quran Reader
* **Immersive Reading Mode**: Clean, beautiful layout displaying authentic Arabic text (Uthmani script) alongside translations.
* **Synchronized Recitations**: Continuous audio streaming of verses and full Surahs from top reciters.
* **Multi-Language Support**: Seamless translation toggling between multiple languages.
* **Instant Offline Access**: High-performance local caching engine stores Surah text and metadata on disk/in-memory for 0ms loading.

### 2. 🔎 Hybrid AI Semantic Search
* **Concept Search**: Search the Quran based on meaning, concepts, or intent (e.g., "finding peace in hardship", "mercy and forgiveness") rather than exact word matches.
* **Vector Databases**: Backed by **Neon Serverless Postgres** with the `pgvector` extension and embedded using `nomic-embed-text`.
* **Multi-Tier Fallbacks**: Instantly degrades gracefully to standard SQL text matching or public API search if database limits are hit or the client is offline.

### 3. 🕋 Interactive Umrah Companion
A complete travel companion suite designed for pilgrims:
* **Interactive Step-by-Step Guide**: Beautiful, collapsible timeline walking pilgrims through Ihram, Tawaf, Sa'i, and Halq/Taqsir.
* **Mechanical Tawaf & Sa'i Counters**: Digital tally interface with haptic/synthesized audio feedback (via Web Audio API) to count rounds offline.
* **Travel Checklist**: Categorized packing and preparation checklist (persisted in LocalStorage).
* **AI Travel Assistant**: Conversational assistant fine-tuned with context on Umrah guidelines and rules to answer pilgrim questions.
* **Saudi Travel Desk**: Real-time Makkah/Madinah weather API, live Saudi Arabia local time, and currency calculators.
* **Cost Estimator & Inquiry System**: Dynamic price estimator based on group size, hotel tier, stay duration, and transport preference. Pilgrims and travel agencies can submit lead requests directly to site administrators (via SMTP / Web3Forms).

---

## 🛠 Tech Stack

### Frontend Client
* **Core**: React 18, TypeScript, Vite
* **Styling**: Tailwind CSS (custom HSL color palette, dark mode transitions, glassmorphism UI)
* **Icons & Animation**: Lucide Icons, Canvas Confetti

### Backend API
* **Framework**: FastAPI (Python)
* **Database**: Neon Serverless PostgreSQL + `pgvector`
* **Embeddings**: Ollama (`nomic-embed-text`)
* **Email Client**: Secure SMTP / Web3Forms API fallback
* **Serverless Hosting**: Vercel Serverless Functions (`@vercel/python`)

---

## 🚀 Setup & Installation

### 1. Frontend Client
Navigate to the `frontend` directory, install packages, and start the Vite local development server:
```bash
cd frontend
npm install
npm run dev
```
The application will be running at `http://localhost:5173`.

### 2. Backend Search Engine & API
To set up the Python backend locally:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/db_name
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_TO=recipient_email@gmail.com
WEB3FORMS_KEY=your_web3forms_key_here
```

Launch the backend API:
```bash
python main.py
```
The API server will run at `http://localhost:8000`.

---

## 🤝 Contributing

Contributions, feature requests, and suggestions are welcome! Feel free to fork the repository and open a Pull Request.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
