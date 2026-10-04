# PhysioFlow

**AI-assisted clinical evidence scoping tool for physiotherapy.**

Turn a patient profile into a curated, quality-rated, meta-analyzed evidence brief in under 3 minutes, powered by a 6-agent pipeline that follows PRISMA methodology across 7+ free scientific databases.

> ⚠️ PhysioFlow is a decision-support tool, not a substitute for a formal systematic review. All outputs are labeled and time-stamped.

---

## Why this exists

Evidence-based physiotherapy is stuck in a bottleneck: a clinician has ~5 minutes between patients, but a proper literature search takes hours. Existing tools (PubMed, Google Scholar) return raw lists with no screening, no quality rating, and no synthesis. PhysioFlow closes that gap by running the same PRISMA workflow a research assistant would, in the time a clinician actually has.

---

## What it does

Input a patient profile (age, condition, comorbidities, goals). The pipeline:

1. **Translates** the profile into a structured PICOS query
2. **Searches** 7+ databases in parallel (PubMed, OpenAlex, Europe PMC, SciELO, ClinicalTrials.gov, medRxiv, Semantic Scholar)
3. **Screens** results through a 3-level PRISMA pipeline with dual reviewer logic
4. **Rates quality** using Cochrane RoB 2, PEDro, and Oxford CEBM levels
5. **Extracts** quantitative outcomes from included studies
6. **Meta-analyzes** using random-effects DerSimonian-Laird with Hedges' *g*, then outputs SVG forest plots
7. **Rates confidence** with GRADE and delivers a plain-language brief with citations

Every step is logged and traceable back to the source paper.

---

## Architecture

Six independent agents coordinated by a pipeline orchestrator:

| Agent | Responsibility |
|-------|----------------|
| `picos_translator` | Patient profile to structured PICOS |
| `search` | Parallel query across 7+ databases |
| `screener` | 3-level PRISMA screening (title/abstract/full-text) |
| `quality` | RoB 2 / PEDro / Oxford CEBM rating |
| `extractor` | Quantitative outcome extraction |
| `synthesizer` | Random-effects meta-analysis + GRADE + brief |

Each agent returns strict JSON and is independently testable.

---

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **LLM:** DeepSeek API (OpenAI-compatible) for agent reasoning
- **Statistics:** Custom random-effects meta-analysis implementation (DerSimonian-Laird, Hedges' *g*)
- **Visualization:** SVG forest plots (no charting library dependency)
- **Deployment:** Vercel

---

## Getting started

```bash
# 1. Clone
git clone https://github.com/victorgomezadapty/physioflow.git
cd physioflow

# 2. Install
npm install

# 3. Configure
cp .env.example .env.local
# Fill in DEEPSEEK_API_KEY and optional PUBMED_API_KEY / SEMANTIC_SCHOLAR_API_KEY

# 4. Run
npm run dev
# Open http://localhost:3000
```

The app works without a PubMed API key. The key only raises rate limits.

---

## Project status

**MVP functional.** The end-to-end pipeline runs with real searches and real papers, under active development toward:

- [ ] Public demo deployment
- [ ] Editable inclusion/exclusion criteria per query
- [ ] Session persistence and shareable briefs
- [ ] Additional condition-specific PICOS templates
- [ ] User-facing quality rating explanations

See [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md) for the detailed build plan.

---

## Design principles

- **Transparency over convenience.** Every claim in the output is linked to its source.
- **Honest labeling.** This is a scoping tool, not a systematic review, and it says so.
- **Bilingual by default.** Spanish patient-facing labels, English technical terms.
- **Zero patient data storage.** Queries are stateless and nothing is retained server-side.

---

## Author

Built by **Víctor Andrés Gómez López**, physiotherapist, doctoral researcher in physical activity and sport, founder of [ADAPTY](https://adapty.global). Currently Head Physiotherapist at Optimo Gym (Riyadh) and building clinical AI tools full time.

Contact: [LinkedIn](https://linkedin.com/in/victorgomezadapty)

---

## License

Source available for review and evaluation. Contact the author for commercial or clinical deployment inquiries.
