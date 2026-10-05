# ai/ — Problem reader (Phase 3)

The LLM **only** (a) extracts a problem into a structured `SceneSpec` JSON and (b) explains, in
words, results the engine already computed. It never computes numbers or invents simulations.

Pipeline: problem text → LLM (Rust `AIProvider`: Gemini by default in the main edition, Claude in both editions) → JSON → Zod validation →
physical consistency checks → "Tôi hiểu đề như sau" confirmation table → engine.
