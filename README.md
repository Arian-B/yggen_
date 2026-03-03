# wikiyggen\_

**wikiyggen\_** is an AI-enhanced Wikipedia traversal engine designed to transform shallow reading into structured, deeply connected knowledge expeditions.

Instead of reading a flat Wikipedia page and getting lost in tabs, **wikiyggen\_** seamlessly integrates the reading experience with interactive 2D graph visualizations. As users read an article, embedded hyperlinks and "See Also" sections are visually mapped, allowing for intuitive navigation across related concepts. AI summarization provides immediate clarity without the need to read entire articles, while ML-driven tracking builds a comprehensive profile of a user's domain expertise over time.

## Core Philosophy

The fundamental design principle of wikiyggen\_ is **Visual Contextual Learning**.

- **Seamless Traversal**: Reading and graph navigation are unified. Embedded Wikipedia hyperlinks seamlessly trigger smooth animations to a 2D knowledge graph.
- **AI Summarization**: Core insights and summaries are extracted dynamically from Wikipedia text, giving instant "TL;DR" overlays.
- **Expertise Tracking**: The system tracks user journeys to build an evolving map of their knowledge profile and domain expertise via machine learning.
- **Persistent Expeditions**: Explorations are saved as "Expeditions", preserving the learning path and context.

## Technology Stack

### Backend

- **Language**: Python 3.12+
- **Framework**: FastAPI (High-performance async API)
- **Database**: ArangoDB (Multi-model graph database)
- **Data Source**: Wikipedia API
- **AI Orchestration**: Custom AI Engine with LangChain integration
- **Providers**:
  - **Google Gemini** (Primary: Summarization & Reasoning)
  - **Groq / Llama 3** (Primary: High-speed summarization & insights)
  - **OpenRouter** (Fallback: Reliability)

### Frontend

- **Framework**: React (Vite)
- **Language**: TypeScript
- **Styling**: TailwindCSS (Utility-first design system)
- **Visualization**: React Flow (Interactive 2D graph rendering)
- **Animation**: GSAP & Framer Motion

## System Architecture

### 1. The Expedition Model

An **Expedition** represents a user's unique journey initiated from a root Wikipedia search.

- **Root Topic**: The starting Wikipedia page.
- **Graph Context**: The stored graph of navigated hyperlinks and "See Also" relations.
- **Session Memory**: Persists across browser reloads via ArangoDB.

### 2. Node & Link Model

A **Node** represents a unique Wikipedia article.

- **Topic/Title**: The Wikipedia entry title.
- **Content**: HTML/AST representation of the article, parsed for interactive links.
- **Edges (Links)**:
  - `embedded_link`: A hyperlink found within the article text.
  - `see_also_link`: A relation found in the Wikipedia "See Also" section.

### 3. AI Engine & Smart Routing

The backend implements a custom **AIEngine** specialized for rapid summarization and insight extraction from raw Wikipedia text.

- **Multi-Provider Routing**: The engine dynamically selects the optimal LLM based on task type (e.g., Groq for hyper-fast generic summaries, Gemini for deeper structural extraction).
- **Strict JSON Validation**: All AI outputs are parsed and validated against strict schemas.

### 4. ML Expertise Tracking

As users traverse nodes (articles), the system aggregates metadata (categories, domains) to construct a user expertise profile, measuring depth and breadth of knowledge across different subjects.

## Directory Structure

### Backend (`/backend`)

```text
app/
├── core/
│   └── config.py           # Environment and global settings
├── database/
│   └── connection.py       # ArangoDB connection handler
├── models/
│   ├── expedition_models.py # Pydantic schemas for expeditions
│   └── user_models.py      # Tracking user expertise metrics
├── services/
│   ├── wikipedia_service.py # Core integration with Wikipedia API
│   ├── ai_engine.py        # Central Orchestrator for LLM summarization
│   ├── providers/          # Adapter pattern implementations for AI providers
│   └── graph_generator.py  # Builds graph connections from Wikipedia links
├── utils/
│   └── json_validator.py   # Schema enforcement utilities
└── main.py                 # FastAPI application entry point
```

### Frontend (`/frontend`)

```text
src/
├── components/
│   ├── layout/             # UI shell and navigation components
│   └── ui/                 # Summary panels, modals, knowledge indicators
├── pages/
│   ├── LandingPage.tsx     # Wikipedia search entry
│   ├── LearningMode.tsx    # Scrollable article view with interactive wiki links
│   └── MapMode.tsx         # React Flow 2D graph visualization
├── services/
│   └── api.ts              # Typed API client
└── index.css               # Global styles and Tailwind directives
```

## Setup Instructions

### Prerequisites

- Python 3.12+
- Node.js 18+
- ArangoDB 3.10+ (Local or Docker)

### 1. Repository Setup

```bash
git clone https://github.com/Arian-B/yggen_.git
cd yggen_
```

### 2. Backend Configuration

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
ARANGO_HOST=http://localhost:8529
ARANGO_DB=yggen_db
ARANGO_USERNAME=root
ARANGO_PASSWORD=your_password

# AI Providers
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
OPENROUTER_API_KEY=your_key
```

Run the server:

```bash
uvicorn app.main:app --reload
```

### 3. Frontend Configuration

```bash
cd frontend
npm install
npm run dev
```

## Engineering Principles

**API-First Content Sourcing**
Instead of relying on LLMs to hallucinate or generate educational content from scratch, we use the Wikipedia API as the ground truth. LLMs are strictly relegated to summarization and semantic extraction, guaranteeing factual accuracy.

**Fluid UI/UX Integration**
The transition from reading long-form text to viewing high-level graph structures must be animated and seamless to maintain the user's cognitive flow.

**Provider Agnosticism**
The AI system is designed to be resilient to provider outages. The `ModelRouter` and `BaseProvider` abstractions allow swapping underlying models (e.g., switching from Gemini to Claude) without changing business logic.
