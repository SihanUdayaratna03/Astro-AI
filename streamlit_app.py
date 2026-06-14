import asyncio
from pathlib import Path
import time

import streamlit as st
import inngest
from dotenv import load_dotenv
import os
import requests

load_dotenv()

# ── Page Config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="AstroRAG — Intelligent Document Intelligence",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── CSS ───────────────────────────────────────────────────────────────────────
st.markdown(r"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap');

/* ══ RESET ══════════════════════════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body,
[data-testid="stAppViewContainer"],
[data-testid="stMain"],
[data-testid="stMainBlockContainer"] {
    background: #000000 !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #b0bcd0;
}

#MainMenu, footer, header,
[data-testid="stToolbar"],
[data-testid="stDecoration"],
[data-testid="stSidebarNav"] {
    display: none !important;
    visibility: hidden !important;
}

.block-container {
    padding: 0 3rem 4rem !important;
    max-width: 1180px !important;
    position: relative;
    z-index: 10;
}

/* ══ STARFIELD ══════════════════════════════════════════════════════════════ */
[data-testid="stAppViewContainer"]::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
        radial-gradient(0.8px 0.8px at  8% 12%, rgba(255,255,255,0.55) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 22% 38%, rgba(255,255,255,0.40) 0%, transparent 100%),
        radial-gradient(1.0px 1.0px at 37%  6%, rgba(255,255,255,0.50) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 51% 62%, rgba(255,255,255,0.35) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 67% 22%, rgba(255,255,255,0.55) 0%, transparent 100%),
        radial-gradient(1.0px 1.0px at 79% 78%, rgba(255,255,255,0.40) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 91% 44%, rgba(255,255,255,0.50) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 13% 82%, rgba(255,255,255,0.35) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 58% 91%, rgba(255,255,255,0.30) 0%, transparent 100%),
        radial-gradient(1.0px 1.0px at 33% 55%, rgba(255,255,255,0.45) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at  4% 28%, rgba(255,255,255,0.40) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 44% 72%, rgba(255,255,255,0.50) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 74%  9%, rgba(255,255,255,0.40) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 86% 58%, rgba(255,255,255,0.35) 0%, transparent 100%),
        radial-gradient(1.0px 1.0px at 19% 95%, rgba(255,255,255,0.30) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 49% 33%, rgba(255,255,255,0.55) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 63% 50%, rgba(255,255,255,0.25) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 94% 82%, rgba(255,255,255,0.40) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 28% 18%, rgba(255,255,255,0.30) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 82% 33%, rgba(255,255,255,0.35) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at  2% 65%, rgba(255,255,255,0.40) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 71% 88%, rgba(255,255,255,0.30) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 16% 50%, rgba(255,255,255,0.45) 0%, transparent 100%),
        radial-gradient(1.0px 1.0px at 55% 15%, rgba(255,255,255,0.35) 0%, transparent 100%),
        radial-gradient(0.8px 0.8px at 40% 85%, rgba(255,255,255,0.25) 0%, transparent 100%);
    background-size: 100% 100%;
    pointer-events: none;
    z-index: 0;
    animation: star-pulse 8s ease-in-out infinite alternate;
}

@keyframes star-pulse {
    0%   { opacity: 0.6; }
    100% { opacity: 1.0; }
}

/* Shooting star */
[data-testid="stAppViewContainer"]::after {
    content: '';
    position: fixed;
    top: 22%;
    left: -300px;
    width: 250px;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%);
    transform: rotate(-18deg);
    animation: shooting 14s linear infinite;
    pointer-events: none;
    z-index: 1;
    opacity: 0;
}

@keyframes shooting {
    0%         { left: -300px; opacity: 0; }
    3%         { opacity: 0.7; }
    35%        { opacity: 0.5; }
    50%        { opacity: 0; left: 110vw; }
    51%, 100%  { left: 110vw; opacity: 0; }
}

/* ══ TOPBAR ═════════════════════════════════════════════════════════════════ */
.topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2rem 0 1.8rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    margin-bottom: 0;
    position: relative;
    z-index: 10;
}

.logo-wordmark {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.92rem;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #ffffff;
}

.logo-dot {
    display: inline-block;
    width: 5px; height: 5px;
    background: #ffffff;
    border-radius: 50%;
    margin: 0 10px 1px;
    vertical-align: middle;
    animation: blink 3s ease-in-out infinite;
}

@keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.2; }
}

.topbar-right {
    display: flex;
    align-items: center;
    gap: 24px;
}

.status-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6a7a9a;
}

.status-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
}

.dot-active {
    background: rgba(255,255,255,0.7);
    box-shadow: 0 0 5px rgba(255,255,255,0.5);
    animation: active-pulse 2.5s ease-in-out infinite;
}

@keyframes active-pulse {
    0%, 100% { opacity: 1;   box-shadow: 0 0 5px rgba(255,255,255,0.4); }
    50%       { opacity: 0.4; box-shadow: 0 0 2px rgba(255,255,255,0.2); }
}

/* ══ HERO ════════════════════════════════════════════════════════════════════ */
.hero {
    padding: 5rem 0 4rem;
    max-width: 640px;
    position: relative;
    z-index: 10;
}

.hero-kicker {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #5a6a8a;
    margin-bottom: 1.6rem;
}

.hero-h1 {
    font-size: clamp(2.2rem, 4.5vw, 3.4rem);
    font-weight: 300;
    line-height: 1.12;
    letter-spacing: -0.03em;
    color: #ffffff;
    margin-bottom: 1.4rem;
}

.hero-h1 strong {
    font-weight: 600;
    color: #ffffff;
}

.hero-p {
    font-size: 0.95rem;
    font-weight: 400;
    color: #6a7a9a;
    line-height: 1.75;
    max-width: 480px;
}

/* ══ SECTION GRID ═══════════════════════════════════════════════════════════ */
.section-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #5a6a8a;
    margin-bottom: 1.1rem;
    padding-bottom: 0.7rem;
    border-bottom: 1px solid rgba(255,255,255,0.07);
}

.section-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: #dde5f5;
    margin-bottom: 0.3rem;
    letter-spacing: -0.01em;
}

.section-desc {
    font-size: 0.82rem;
    color: #6a7a9a;
    margin-bottom: 1.4rem;
    line-height: 1.6;
}

/* ══ WIDGET OVERRIDES ═══════════════════════════════════════════════════════ */

/* File uploader — outer wrapper */
[data-testid="stFileUploader"] {
    background: rgba(255,255,255,0.025) !important;
    border: 1px solid rgba(255,255,255,0.14) !important;
    border-radius: 10px !important;
    transition: border-color 0.25s ease, background 0.25s ease !important;
}

[data-testid="stFileUploader"]:hover {
    border-color: rgba(255,255,255,0.28) !important;
    background: rgba(255,255,255,0.04) !important;
}

/* All text inside the file uploader dropzone */
[data-testid="stFileUploaderDropzoneInstructions"],
[data-testid="stFileUploaderDropzoneInstructions"] *,
[data-testid="stFileUploader"] span,
[data-testid="stFileUploader"] small,
[data-testid="stFileUploader"] p {
    color: #8090a8 !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 0.85rem !important;
}

/* The "Browse files" button inside uploader */
[data-testid="stFileUploaderDropzone"] button {
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(255,255,255,0.18) !important;
    border-radius: 6px !important;
    color: #c0cce0 !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 0.78rem !important;
    font-weight: 500 !important;
    padding: 0.45rem 1.1rem !important;
    transition: all 0.2s ease !important;
}

[data-testid="stFileUploaderDropzone"] button:hover {
    background: rgba(255,255,255,0.1) !important;
    border-color: rgba(255,255,255,0.3) !important;
    color: #ffffff !important;
}

[data-testid="stFileUploaderDropzone"] {
    padding: 2rem 1.5rem !important;
}

/* Text input */
[data-testid="stTextInput"] input {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.16) !important;
    border-radius: 8px !important;
    color: #e0e8ff !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 0.93rem !important;
    font-weight: 400 !important;
    caret-color: #ffffff !important;
    transition: border-color 0.2s ease, background 0.2s ease !important;
    padding: 0.75rem 1rem !important;
}

[data-testid="stTextInput"] input:focus {
    border-color: rgba(255,255,255,0.35) !important;
    background: rgba(255,255,255,0.06) !important;
    box-shadow: 0 0 0 3px rgba(255,255,255,0.04) !important;
    outline: none !important;
}

[data-testid="stTextInput"] input::placeholder {
    color: #4a5a78 !important;
    font-style: normal !important;
}

/* Number input */
[data-testid="stNumberInput"] input {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.16) !important;
    border-radius: 8px !important;
    color: #c0cce0 !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 0.88rem !important;
    text-align: center !important;
}

/* Number input arrows */
[data-testid="stNumberInput"] button {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    color: #8090a8 !important;
    border-radius: 6px !important;
}

[data-testid="stNumberInput"] button:hover {
    border-color: rgba(255,255,255,0.28) !important;
    color: #e0e8ff !important;
    background: rgba(255,255,255,0.08) !important;
}

/* Primary submit button */
[data-testid="stFormSubmitButton"] > button {
    background: #ffffff !important;
    border: none !important;
    border-radius: 8px !important;
    color: #000000 !important;
    font-family: 'Inter', sans-serif !important;
    font-weight: 600 !important;
    font-size: 0.82rem !important;
    letter-spacing: 0.04em !important;
    padding: 0.7rem 1.6rem !important;
    transition: all 0.2s ease !important;
    cursor: pointer !important;
}

[data-testid="stFormSubmitButton"] > button:hover {
    background: #e8eaf0 !important;
    transform: none !important;
    box-shadow: 0 0 30px rgba(255,255,255,0.08) !important;
}

/* Secondary button */
[data-testid="stButton"] > button {
    background: transparent !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 8px !important;
    color: #c0c8d8 !important;
    font-family: 'Inter', sans-serif !important;
    font-weight: 500 !important;
    font-size: 0.82rem !important;
    letter-spacing: 0.02em !important;
    padding: 0.65rem 1.4rem !important;
    transition: all 0.2s ease !important;
    cursor: pointer !important;
}

[data-testid="stButton"] > button:hover {
    background: rgba(255,255,255,0.05) !important;
    border-color: rgba(255,255,255,0.22) !important;
    color: #ffffff !important;
}

/* Spinner */
[data-testid="stSpinner"] p {
    color: #6a7a9a !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 0.75rem !important;
    letter-spacing: 0.05em !important;
}

/* Labels */
label,
[data-testid="stWidgetLabel"] p,
[data-testid="stWidgetLabel"] label {
    color: #8090a8 !important;
    font-size: 0.7rem !important;
    font-family: 'JetBrains Mono', monospace !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    margin-bottom: 0.4rem !important;
}

/* Alerts */
[data-testid="stAlert"] {
    border-radius: 8px !important;
    background: rgba(255,255,255,0.03) !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
}

/* ══ FILE PREVIEW CARD ═══════════════════════════════════════════════════════ */
.file-card {
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 0.9rem 1.1rem;
    margin: 0.9rem 0;
    display: flex;
    align-items: center;
    gap: 1rem;
    background: rgba(255,255,255,0.015);
}

.file-card-icon {
    width: 32px; height: 32px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.55rem;
    letter-spacing: 0.05em;
    color: #2d3548;
    flex-shrink: 0;
    text-transform: uppercase;
}

.file-card-name {
    font-family: 'Inter', sans-serif;
    font-size: 0.84rem;
    font-weight: 500;
    color: #e0e8ff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-card-meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    color: #5a6a8a;
    letter-spacing: 0.05em;
    margin-top: 2px;
}

/* ══ ANSWER CARD ═════════════════════════════════════════════════════════════ */
.answer-card {
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    overflow: hidden;
    margin-top: 1.2rem;
    background: rgba(255,255,255,0.015);
    animation: fade-up 0.4s ease forwards;
}

@keyframes fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
}

.answer-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.1rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.02);
}

.answer-card-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #8090b0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.answer-active-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: #ffffff;
    opacity: 0.7;
}

.answer-card-meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: #5a6a8a;
    letter-spacing: 0.06em;
}

.answer-card-body {
    padding: 1.4rem 1.3rem;
    font-family: 'Inter', sans-serif;
    font-size: 0.93rem;
    font-weight: 400;
    line-height: 1.85;
    color: #b0bcd0;
}

.answer-card-sources {
    padding: 0.75rem 1.1rem 0.9rem;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}

.sources-kicker {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #5a6a8a;
    margin-right: 4px;
}

.source-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    color: #7a8aaa;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    padding: 3px 9px;
    letter-spacing: 0.04em;
}

/* ══ PIPELINE BOX ════════════════════════════════════════════════════════════ */
.pipeline {
    margin-top: 1.8rem;
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 8px;
    overflow: hidden;
}

.pipeline-header {
    padding: 0.65rem 1rem;
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #5a6a8a;
}

.pipeline-step {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.2s ease;
}

.pipeline-step:last-child { border-bottom: none; }

.pipeline-step:hover { background: rgba(255,255,255,0.02); }

.step-index {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: #4a5a78;
    letter-spacing: 0.06em;
    flex-shrink: 0;
    padding-top: 2px;
    min-width: 18px;
}

.step-text {
    font-family: 'Inter', sans-serif;
    font-size: 0.82rem;
    color: #7a8aaa;
    line-height: 1.55;
}

/* ══ SUGGESTION CHIPS ════════════════════════════════════════════════════════ */
.chips-wrap {
    margin-top: 1.4rem;
}

.chips-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #5a6a8a;
    margin-bottom: 0.65rem;
}

.chips-row { display: flex; flex-wrap: wrap; gap: 6px; }

.chip {
    font-family: 'Inter', sans-serif;
    font-size: 0.75rem;
    color: #6a7a9a;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    padding: 5px 12px;
    transition: all 0.2s ease;
    cursor: default;
}

.chip:hover {
    border-color: rgba(255,255,255,0.22);
    color: #b0bcd0;
}

/* ══ INLINE ALERT ════════════════════════════════════════════════════════════ */
.inline-alert {
    border-radius: 7px;
    padding: 0.85rem 1rem;
    font-family: 'Inter', sans-serif;
    font-size: 0.82rem;
    margin-top: 0.8rem;
    line-height: 1.5;
}

.alert-success {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.12);
    color: #a0b0c8;
}

.alert-warn {
    background: rgba(255,200,100,0.05);
    border: 1px solid rgba(255,200,100,0.15);
    color: #8a7a5a;
}

.alert-error {
    background: rgba(255,80,80,0.05);
    border: 1px solid rgba(255,80,80,0.15);
    color: #8a5a5a;
}

/* ══ DIVIDER ════════════════════════════════════════════════════════════════ */
.rule {
    height: 1px;
    background: rgba(255,255,255,0.04);
    margin: 1.6rem 0;
}

/* ══ FOOTER ══════════════════════════════════════════════════════════════════ */
.footer {
    padding: 3rem 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(255,255,255,0.06);
    position: relative;
    z-index: 10;
}

.footer-brand {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #3d4f6a;
}

.footer-stack {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: #3d4f6a;
}

/* ══ COLUMN GUTTER FIX ═══════════════════════════════════════════════════════ */
[data-testid="column"] { padding: 0 1rem !important; }
[data-testid="column"]:first-child { padding-left: 0 !important; }
[data-testid="column"]:last-child  { padding-right: 0 !important; }
</style>
""", unsafe_allow_html=True)


# ── Inngest helpers ───────────────────────────────────────────────────────────
@st.cache_resource
def get_inngest_client() -> inngest.Inngest:
    return inngest.Inngest(app_id="rag_app", is_production=False)

def save_uploaded_pdf(file) -> Path:
    p = Path("uploads")
    p.mkdir(parents=True, exist_ok=True)
    fp = p / file.name
    fp.write_bytes(file.getbuffer())
    return fp

async def _send_ingest(pdf_path: Path) -> None:
    await get_inngest_client().send(inngest.Event(
        name="rag/ingest_pdf",
        data={"pdf_path": str(pdf_path.resolve()), "source_id": pdf_path.name},
    ))

async def _send_query(question: str, top_k: int):
    res = await get_inngest_client().send(inngest.Event(
        name="rag/query_pdf_ai",
        data={"question": question, "top_k": top_k},
    ))
    return res[0]

def _api_base() -> str:
    return os.getenv("INNGEST_API_BASE", "http://127.0.0.1:8288/v1")

def fetch_runs(event_id: str) -> list[dict]:
    r = requests.get(f"{_api_base()}/events/{event_id}/runs")
    r.raise_for_status()
    return r.json().get("data", [])

def wait_for_output(event_id: str, timeout: float = 300.0, interval: float = 1.0) -> dict:
    start = time.time()
    last = None
    while True:
        runs = fetch_runs(event_id)
        if runs:
            run = runs[0]
            status = run.get("status", "")
            last = status
            s = status.lower()
            if s in ("completed", "succeeded", "success", "finished"):
                return run.get("output") or {}
            if s in ("failed", "cancelled"):
                raise RuntimeError(f"Run ended with status: {s}")
        if time.time() - start > timeout:
            raise TimeoutError(f"Timed out. Last status: {last}")
        time.sleep(interval)


# ══ TOPBAR ════════════════════════════════════════════════════════════════════
st.markdown("""
<div class="topbar">
    <div class="logo-wordmark">
        AstroRAG<span class="logo-dot"></span>AI
    </div>
    <div class="topbar-right">
        <div class="status-item">
            <span class="status-dot dot-active"></span>
            Vector DB
        </div>
        <div class="status-item">
            <span class="status-dot dot-active"></span>
            Gemini
        </div>
        <div class="status-item">
            <span class="status-dot dot-active"></span>
            Inngest
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# ══ HERO ══════════════════════════════════════════════════════════════════════
st.markdown("""
<div class="hero">
    <div class="hero-kicker">// Document Intelligence Platform</div>
    <h1 class="hero-h1">
        Ask anything.<br>
        <strong>From your documents.</strong>
    </h1>
    <p class="hero-p">
        Upload your PDFs into a semantic vector store. Query them in natural language.
        Receive precise, source-grounded answers powered by Gemini.
    </p>
</div>
""", unsafe_allow_html=True)

# ══ TWO-COLUMN LAYOUT ═════════════════════════════════════════════════════════
col_l, col_r = st.columns([1, 1.08], gap="large")

# ── LEFT — INGEST ─────────────────────────────────────────────────────────────
with col_l:
    st.markdown("""
    <div class="section-label">01 — Upload</div>
    <div class="section-title">Ingest Document</div>
    <div class="section-desc">Upload a PDF to chunk, embed, and index it into the vector store.</div>
    """, unsafe_allow_html=True)

    uploaded = st.file_uploader(
        "Select a PDF file",
        type=["pdf"],
        accept_multiple_files=False,
        label_visibility="visible",
    )

    if uploaded is not None:
        size_kb = round(len(uploaded.getbuffer()) / 1024, 1)
        st.markdown(f"""
        <div class="file-card">
            <div class="file-card-icon">PDF</div>
            <div>
                <div class="file-card-name">{uploaded.name}</div>
                <div class="file-card-meta">{size_kb} KB &nbsp;&middot;&nbsp; Ready to ingest</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        if st.button("Ingest into vector store", use_container_width=True):
            with st.spinner("Chunking and embedding document..."):
                path = save_uploaded_pdf(uploaded)
                asyncio.run(_send_ingest(path))
                time.sleep(0.4)
            st.markdown(f"""
            <div class="inline-alert alert-success">
                Ingestion complete &mdash; <strong>{uploaded.name}</strong> is now indexed and searchable.
            </div>
            """, unsafe_allow_html=True)

    st.markdown("""
    <div class="pipeline">
        <div class="pipeline-header">Pipeline</div>
        <div class="pipeline-step">
            <span class="step-index">01</span>
            <span class="step-text">PDF parsed and split into overlapping semantic chunks</span>
        </div>
        <div class="pipeline-step">
            <span class="step-index">02</span>
            <span class="step-text">Each chunk embedded via Gemini text-embedding model</span>
        </div>
        <div class="pipeline-step">
            <span class="step-index">03</span>
            <span class="step-text">Vectors upserted into Qdrant with metadata payload</span>
        </div>
        <div class="pipeline-step">
            <span class="step-index">04</span>
            <span class="step-text">Query embedded and matched by cosine similarity</span>
        </div>
        <div class="pipeline-step">
            <span class="step-index">05</span>
            <span class="step-text">Supervisor Agent routes query to Document Retriever or Calculation Agents and synthesizes response</span>
        </div>
    </div>
    """, unsafe_allow_html=True)


# ── RIGHT — QUERY ─────────────────────────────────────────────────────────────
with col_r:
    st.markdown("""
    <div class="section-label">02 — Query</div>
    <div class="section-title">Ask a Question</div>
    <div class="section-desc">Run a natural language query against your indexed document corpus.</div>
    """, unsafe_allow_html=True)

    with st.form("rag_query_form", clear_on_submit=False):
        question = st.text_input(
            "Question",
            placeholder="What are the key conclusions in this document?",
            label_visibility="visible",
        )

        btn_col, k_col = st.columns([3, 1])
        with btn_col:
            submitted = st.form_submit_button("Generate answer", use_container_width=True)
        with k_col:
            top_k = st.number_input(
                "Top-K",
                min_value=1, max_value=20, value=5, step=1,
                help="Number of document chunks retrieved as context",
            )

        if submitted and question.strip():
            with st.spinner("Retrieving context and generating response..."):
                try:
                    event_id = asyncio.run(_send_query(question.strip(), int(top_k)))
                    output   = wait_for_output(event_id)
                    answer   = output.get("answer", "")
                    sources  = output.get("sources", [])
                    num_ctx  = output.get("num_contexts", 0)

                    if answer:
                        src_badges = "".join(
                            f'<span class="source-badge">{s}</span>' for s in sources
                        ) if sources else ""

                        sources_block = f"""
                        <div class="answer-card-sources">
                            <span class="sources-kicker">Sources</span>
                            {src_badges}
                        </div>
                        """ if sources else ""

                        st.markdown(f"""
                        <div class="answer-card">
                            <div class="answer-card-header">
                                <div class="answer-card-label">
                                    <div class="answer-active-dot"></div>
                                    Response
                                </div>
                                <div class="answer-card-meta">{num_ctx} chunks &nbsp;&middot;&nbsp; Gemini</div>
                            </div>
                            <div class="answer-card-body">{answer}</div>
                            {sources_block}
                        </div>
                        """, unsafe_allow_html=True)
                    else:
                        st.markdown("""
                        <div class="inline-alert alert-warn">
                            No answer returned. Try rephrasing your question or uploading additional documents.
                        </div>
                        """, unsafe_allow_html=True)

                except Exception as exc:
                    st.markdown(f"""
                    <div class="inline-alert alert-error">
                        Error: {str(exc)[:160]}
                    </div>
                    """, unsafe_allow_html=True)

        elif submitted:
            st.markdown("""
            <div class="inline-alert alert-warn">
                Please enter a question before submitting.
            </div>
            """, unsafe_allow_html=True)

    # Suggestion chips
    st.markdown("""
    <div class="chips-wrap">
        <div class="chips-label">Suggested queries</div>
        <div class="chips-row">
            <span class="chip">Summarize this document</span>
            <span class="chip">What are the main conclusions?</span>
            <span class="chip">List all key terms</span>
            <span class="chip">What methodology was used?</span>
        </div>
    </div>
    """, unsafe_allow_html=True)


# ══ FOOTER ════════════════════════════════════════════════════════════════════
st.markdown("""
<div class="footer">
    <div class="footer-brand">AstroRAG &nbsp;&middot;&nbsp; Document Intelligence</div>
    <div class="footer-stack">Gemini &nbsp;&middot;&nbsp; Qdrant &nbsp;&middot;&nbsp; Inngest</div>
</div>
""", unsafe_allow_html=True)