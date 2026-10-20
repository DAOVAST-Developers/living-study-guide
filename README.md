# Living Study Guide 🧠

> A private, human-in-the-loop study companion that turns raw notes into verified flashcards and quiz questions — without hallucinated facts or ungrounded claims.

---

## The Problem: AI Hallucinations in Study Guides

When standard AI tools generate study guides or flashcards, they often introduce subtle factual inaccuracies: fabricated dates, invented causes, or external assumptions never present in your course material. If you memorize these unchecked, you risk failing exams or internalizing misinformation.

**Living Study Guide solves this through strict human-in-the-loop verification:**
1. **Verbatim Excerpt Tethering**: Every AI-generated card must quote the exact sentence from your notes word-for-word.
2. **Deterministic Verification**: Before any card enters the queue, the client scans your notes to confirm the excerpt actually exists.
3. **The Review Gatekeeper**: Generated cards **never** go directly into your library. They wait in a review queue side-by-side with your original note and sentence highlight until you approve, edit, or discard them.
4. **Adversarial AI Claim Checker**: A built-in "Check against source" feature asks Gemini to act as a strict prosecutor, detecting whether a card rephrases valid source facts or sneaks in external claims not found in the excerpt.

---

## 🔒 Honest Privacy & Cryptographic Security Limits

We believe in radical honesty regarding privacy and security:

### What the Privacy Lock Does:
- **Client-Side Encryption at Rest**: When you set a passphrase, all your data — including your notes, cards, study logs, and your Gemini API key — is encrypted using the **Web Crypto API** (**PBKDF2** key derivation with 120,000 iterations of SHA-256 and **AES-GCM 256** authenticated encryption).
- **Zero Backend / Serverless**: There is no remote database, no user account server, and no analytics tracker. Your data lives in your browser's IndexedDB.
- **Direct API Communication**: Your browser calls Google's Gemini REST API directly using your personal key. Your key is never sent to any intermediary server.

### What it Does NOT Do (Plain Language Limits):
- **Not a Multi-Tenant Server Login**: The lock screen is not a website account login. It is a client-side cryptographic decryptor for data stored *on this specific device*.
- **No Remote Key Recovery**: If you lose your passphrase, your encrypted data cannot be decrypted by anyone. Keep your passphrase safe or maintain JSON backups.
- **Device & Browser Scope**: If you clear your browser's site data/cache without exporting a backup, your local vault will be deleted. Always use the **Download Backup** button in Settings before wiping browser storage.

---

## Key Features

- **📄 Source Decomposition**: Paste raw notes or upload `.txt` / `.md` files. Notes are automatically parsed into numbered sentences `[1]`, `[2]`, ... for easy citation.
- **⚖️ Split Review Queue**: Inspect candidate flashcards and multiple-choice questions side-by-side with your original notes. Excerpts are highlighted in real-time in the text.
- **🔍 "Check Against Source"**: An adversarial verification button that tests whether the card adds ungrounded claims.
- **📚 Searchable Library**: Only approved items reach the library. Features full-text search, tag filter pills, and automatic grouping by concept.
- **⚡ Flashcard Study Mode**: Realistic 3D flip card experience with keyboard shortcuts (`Space` to flip, `1` for Still Learning, `2` for I Know This) and session summaries.
- **📝 Interactive Quizzes**: 4-option multiple choice questions with instant correctness feedback, detailed explanations, and source excerpt references.
- **📊 Retention Dashboard**: Real-time metrics for items awaiting review, approved cards, discarded items, concept distribution bars, and quiz score history over time.
- **💾 JSON Backup & Restore**: One-click unencrypted backup export and validated JSON import.
- **⚡ Built-in Demo Mode**: Includes ~400 words of original notes on *"How the Internet and the Web Work (Basics)"* and 8 pre-loaded cards (including one deliberately flawed card with an added cause so you can practice catching hallucinations).

---

## Quick Start (Zero Build Step)

Because Living Study Guide has no compilation or build pipeline, you can run it immediately with any static file server:

```bash
# Clone the repository
git clone https://github.com/DAOVAST-Developers/living-study-guide.git
cd living-study-guide

# Start any local static server (e.g. Python)
python -m http.server 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

Alternatively:
- **Replit**: Open [https://replit.com/github.com/DAOVAST-Developers/living-study-guide](https://replit.com/github.com/DAOVAST-Developers/living-study-guide) and click **Run**.
- **Netlify Drop**: Drag and drop the folder into [Netlify Drop](https://app.netlify.com/drop).

---

## Running Automated Tests

Unit tests verify sentence splitting, excerpt verification, search filtering, quiz scoring, and Web Crypto round-trips:

```bash
node tests/test-logic.js
```

---

## Architecture & Code Structure

```
living-study-guide/
├── index.html              # Main application shell & lock screen
├── css/
│   └── main.css            # Calm, responsive academic design system
├── js/
│   ├── app.js              # Application coordinator & event wiring
│   ├── crypto.js           # Web Crypto PBKDF2 + AES-GCM encryption
│   ├── storage.js          # IndexedDB encrypted storage layer
│   ├── gemini.js           # Gemini REST API direct client
│   ├── verification.js     # Sentence splitter & excerpt matching logic
│   ├── demo-data.js        # ~400 word notes & 8 sample pending cards
│   ├── study.js            # Flashcard 3D flip session & quiz state machine
│   ├── search-scoring.js   # Pure search filtering & quiz score math
│   └── backup.js           # JSON export & validated restoration
├── tests/
│   └── test-logic.js       # Node-compatible test suite
├── .gitignore              # Ignores node_modules, .env*, .DS_Store
├── .replit                 # Replit static server configuration
├── DEPLOY.md               # Detailed deployment instructions & checks
└── README.md               # Architecture, privacy notice & user guide
```

---

## License

MIT License. Crafted for lifelong learners, students, and researchers who demand verified truth over unchecked AI output.
