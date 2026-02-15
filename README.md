# yggen\_

**yggen\_** is an AI-powered knowledge traversal engine designed to combat shallow information consumption by structuring knowledge into a directed graph of dependencies and extensions. Unlike traditional search or wiki-walking, yggen\_ enforces a recursive learning path where every concept is contextually anchored to its prerequisites and advanced applications.

The system utilizes a multi-provider AI architecture to dynamically generate, validate, and expand knowledge graphs, ensuring that users traverse complex topics with varying levels of abstraction and difficulty.

## Core Philosophy

The fundamental design principle of yggen\_ is **State-Aware Graph Growth**. The system does not merely generate isolated content; it maintains a persistent memory of the user's "expedition" (learning session).

- **Recursive Depth**: Knowledge is not flat. Every node has a depth level relative to the root topic.
- **Context Injection**: The AI engine is aware of the current graph structure before generating new nodes, preventing duplication and ensuring logical continuity.
- **Guided Traversal**: Users do not manually search. The system determines the optimal next step based on the graph topology and the user's traversal history.

## Technology Stack

### Backend

- **Language**: Python 3.12+
- **Framework**: FastAPI (High-performance async API)
- **Database**: ArangoDB (Multi-model graph database)
- **AI Orchestration**: Custom AI Engine with LangChain integration
- **Providers**:
  - **Google Gemini** (Primary: Structure & Reasoning)
  - **Groq / Llama 3** (Primary: High-speed Validation)
  - **OpenRouter** (Fallback: Reliability)
  - **Cohere** (Reserved: Embeddings)

### Frontend

- **Framework**: React (Vite)
- **Language**: TypeScript
- **Styling**: TailwindCSS (Utility-first design system)
- **Visualization**: React Flow (Interactive graph rendering)
- **Animation**: GSAP & Framer Motion

## System Architecture

### 1. The Expedition Model

An **Expedition** represents a user's unique journey through a topic. It is the root container for all state.

- **Root Topic**: The starting seed concept.
- **Global Layout**: Tracks the maximum depth reached in both prerequisite (negative) and advanced (positive) directions.
- **Session Memory**: Persists across browser reloads via ArangoDB.

### 2. The Node Model

A **Node** is a discrete unit of knowledge.

- **Topic**: The core concept name.
- **Level**: Integer distance from the Root (0). Negative values encompass foundational knowledge; positive values encompass advanced applications.
- **Scores**:
  - `difficulty_score` (0-100): Technical complexity.
  - `abstraction_score` (0-100): Theoretical vs. concrete rating.

### 3. Edge Taxonomy

Graph connections are strictly typed to enforce semantic meaning:

- `prerequisite_of`: A must be known before B.
- `advanced_of`: A is a logical extension of B.
- `conceptual_link`: Lateral connection between parallel domains.

### 4. AI Engine & Smart Routing

The backend implements a custom **AIEngine** specialized for state-aware generation.

- **Multi-Provider Routing**: The engine dynamically selects the optimal Learning Large Model (LLM) based on task type.
  - _Structure Generation_ -> Gemini 1.5 Pro (Superior logic)
  - _Reflection Grading_ -> Llama 3 on Groq (Low latency)
  - _Failover_ -> GPT-4o via OpenRouter (High availability)
- **Context Snapshots**: Before any generation request, the engine aggregates a compressed summary of the current expedition and injects it into the system prompt. This allows the AI to "see" the existing graph.
- **Strict JSON Validation**: All AI outputs are parsed and validated against strict schemas before database insertion. Malformed outputs trigger automatic retries.

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
│   └── node_models.py      # Pydantic schemas for graph nodes
├── services/
│   ├── ai_engine.py        # Central Orchestrator for LLM interactions
│   ├── providers/          # Adapter pattern implementations for AI providers
│   ├── graph_generator.py  # Logic for expanding the knowledge graph
│   └── traversal_engine.py # Logic for determining next user steps
├── utils/
│   └── json_validator.py   # Schema enforcement utilities
└── main.py                 # FastAPI application entry point
```

### Frontend (`/frontend`)

```text
src/
├── components/
│   ├── canvas/             # Custom scroll-based animation system
│   └── layout/             # UI shell and navigation components
├── layouts/                # Route-based layout wrappers
├── pages/
│   ├── LearningMode.tsx    # Scrollable content view
│   └── MapMode.tsx         # React Flow graph visualization
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
COHERE_API_KEY=your_key
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

**Separation of Concerns**
The AI layer is strictly decoupled from business logic. The `AIEngine` handles the "how" of intelligence (retries, context, providers), while specific services (`GraphGenerator`, `ContentGenerator`) handle the "what" (prompts, domain logic).

**Database as Source of Truth**
The AI is stateless between requests. The ArangoDB graph defines the reality of the expedition. We do not rely on LLM conversation history for state management, eliminating context drift over long sessions.

**Provider Agnosticism**
The system is designed to be resilient to provider outages. The `ModelRouter` and `BaseProvider` abstractions allow swapping underlying models (e.g., switching from Gemini to Claude) without changing business logic.

## Roadmap

- **Adaptive Traversal Engine**: Heuristics to adjust difficulty dynamically based on user reflection scores.
- **Semantic Search**: Integration of Cohere embeddings for vector-based node lookup.
- **Public Expeditions**: Ability to publish and share curated knowledge paths.
- **Cloud Deployment**: Docker containerization and Kubernetes orchestration.
