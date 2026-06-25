import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud, Send, Bot, User, CheckCircle2, AlertCircle, Database,
  Cpu, Loader2, FileText, ScanText,
  X, Copy, Check, Camera, BookOpen, Mic, MicOff, ArrowDown,
  SquarePen, History, Trash2, MessageSquare, Clock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Landing from './Landing';
import BlurText from './BlurText';
import MindMapView from './MindMapView';
import './index.css';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
type Tab = 'pdf' | 'scan';
type PdfStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';
type ScanStatus = 'idle' | 'scanning' | 'scanned' | 'ingesting' | 'ready' | 'error';

export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  sources?: string[];
  isError?: boolean;
}

export interface ScanFile {
  file: File;
  preview: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const API = 'http://127.0.0.1:8000/api';
const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const STORAGE_KEY = 'astro_conversations';
const ACTIVE_KEY = 'astro_active_conversation_id';

// ═══════════════════════════════════════════════════════════════════════════════
// ASTRO AI MODEL REGISTRY
// To add a new model in the future, simply add a new entry to this array.
// ═══════════════════════════════════════════════════════════════════════════════
export interface AstroModel {
  id: string;          // sent to the backend
  name: string;        // short display name
  fullName: string;    // full brand name shown in selector
  tagline: string;     // one-line description
  badge?: string;      // optional pill label
  isDefault?: boolean;
  isDisabled?: boolean;
}

export const ASTRO_MODELS: AstroModel[] = [
  {
    id: 'nova',
    name: 'Nova',
    fullName: 'Astro AI Nova',
    tagline: 'Fast & lightweight — ideal for quick lookups',
    badge: 'DEFAULT',
    isDefault: true,
  },
  {
    id: 'pulsar',
    name: 'Pulsar',
    fullName: 'Astro AI Pulsar',
    tagline: 'Balanced · Recommended for most tasks',
    badge: 'COMING SOON',
    isDisabled: true,
  },
  {
    id: 'quasar',
    name: 'Quasar',
    fullName: 'Astro AI Quasar',
    tagline: 'Most powerful · Deep reasoning & analysis',
    badge: 'COMING SOON',
    isDisabled: true,
  },
];

const DEFAULT_MODEL = ASTRO_MODELS.find(m => m.isDefault) ?? ASTRO_MODELS[1];

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
const getExt = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase();
const fmtBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1_048_576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1_048_576).toFixed(1)} MB`;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createConversation(): Conversation {
  const now = Date.now();
  return { id: generateId(), title: 'New conversation', createdAt: now, updatedAt: now, messages: [] };
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

async function pollStatus(eventId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`${API}/status/${eventId}`);
        const d = await r.json();
        if (d.status === 'completed') { clearInterval(iv); resolve(d.output); }
        else if (['failed', 'error'].includes(d.status)) { clearInterval(iv); reject(new Error(d.error || 'Processing failed')); }
      } catch (e) { clearInterval(iv); reject(e); }
    }, 1500);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════
interface ModelSelectorProps {
  selected: AstroModel;
  onChange: (m: AstroModel) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="model-selector" ref={ref}>
      <button
        className={`model-selector-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(v => !v)}
        title="Switch Astro AI model"
      >
        <span className="model-trigger-name">{selected.fullName}</span>
        {selected.badge && <span className="model-badge">{selected.badge}</span>}
        <svg className={`model-chevron ${open ? 'flipped' : ''}`} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div className="model-dropdown">
          <div className="model-dropdown-header">Select model</div>
          {ASTRO_MODELS.map(m => (
            <button
              key={m.id}
              className={`model-option ${m.id === selected.id ? 'active' : ''} ${m.isDisabled ? 'disabled' : ''}`}
              disabled={m.isDisabled}
              onClick={() => { if (!m.isDisabled) { onChange(m); setOpen(false); } }}
            >
              <div className="model-option-left">
                <div className="model-option-icon">
                  {m.id === 'nova'   && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
                  {m.id === 'pulsar' && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h3M19 12h3M12 2v3M12 19v3"/></svg>}
                  {m.id === 'quasar' && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="m9 12 2 2 4-4"/><circle cx="19" cy="5" r="3"/></svg>}
                </div>
                <div>
                  <div className="model-option-name">{m.fullName}</div>
                  <div className="model-option-tagline">{m.tagline}</div>
                </div>
              </div>
              <div className="model-option-right">
                {m.badge && <span className={`model-badge ${m.isDisabled ? 'disabled' : ''}`}>{m.badge}</span>}
                {m.id === selected.id && !m.isDisabled && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT MENU (Highlighting)
// ═══════════════════════════════════════════════════════════════════════════════
const ContextMenu: React.FC<{ menu: any, onAction: (a: string) => void }> = ({ menu, onAction }) => {
  if (!menu.show) return null;
  return (
    <div className="highlight-menu" style={{ left: menu.x, top: menu.y, position: 'fixed', zIndex: 9999 }}>
      <button onClick={() => onAction('Explain this')}>Explain</button>
      <button onClick={() => onAction('Summarize')}>Summarize</button>
      <button onClick={() => onAction('Rewrite')}>Rewrite</button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════════════════
interface TopbarProps {
  onBackToLanding: () => void;
  onNewChat: () => void;
  onToggleHistory: () => void;
  historyOpen: boolean;
  selectedModel: AstroModel;
  onModelChange: (m: AstroModel) => void;
}

const Topbar: React.FC<TopbarProps> = ({ onBackToLanding, onNewChat, onToggleHistory, historyOpen, selectedModel, onModelChange }) => (
  <header className="topbar">
    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
      <button
        onClick={onBackToLanding}
        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-secondary)', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', transition: 'all 0.2s' }}
        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        title="Back to Landing Page"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Landing
      </button>
      <div className="topbar-logo">
        Astro <div className="logo-dot" />
        <span style={{ fontWeight: 300, opacity: 0.5, letterSpacing: '0.08em' }}>AI</span>
      </div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className="topbar-badges">
        <div className="status-badge"><Database size={11} /> Qdrant <div className="status-dot" /></div>
        <div className="status-badge"><Cpu size={11} /> Gemini <div className="status-dot" /></div>
      </div>
      {/* New Chat button */}
      <button
        className="topbar-action-btn"
        onClick={onNewChat}
        title="New Chat"
      >
        <SquarePen size={15} />
        <span>New Chat</span>
      </button>
      {/* History toggle */}
      <button
        className={`topbar-action-btn ${historyOpen ? 'active' : ''}`}
        onClick={onToggleHistory}
        title="Chat History"
      >
        <History size={15} />
      </button>
    </div>
  </header>
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT HISTORY PANEL
// ═══════════════════════════════════════════════════════════════════════════════
interface ChatHistoryPanelProps {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  conversations, activeId, onSelect, onDelete, onNewChat, onClose
}) => {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <div className="history-panel-title">
          <Clock size={14} />
          Chat History
        </div>
        <button className="history-close-btn" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      <button className="history-new-btn" onClick={onNewChat}>
        <SquarePen size={13} />
        New conversation
      </button>

      <div className="history-list">
        {sorted.length === 0 && (
          <div className="history-empty">
            <MessageSquare size={28} />
            <p>No conversations yet</p>
            <span>Start chatting to save history</span>
          </div>
        )}
        {sorted.map((conv) => (
          <div
            key={conv.id}
            className={`history-item ${conv.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(conv.id)}
          >
            <div className="history-item-icon">
              <MessageSquare size={13} />
            </div>
            <div className="history-item-body">
              <div className="history-item-title">{conv.title}</div>
              <div className="history-item-meta">
                <span>{relativeTime(conv.updatedAt)}</span>
                <span>{conv.messages.length} msg{conv.messages.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <button
              className="history-delete-btn"
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              title="Delete conversation"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PDF SIDEBAR SECTION
// ═══════════════════════════════════════════════════════════════════════════════
interface PdfSectionProps {
  pdfFile: File | null;
  pdfStatus: PdfStatus;
  pdfMsg: string;
  pdfChunks: number | null;
  pdfDrag: boolean;
  onFileSelect: (f: File) => void;
  onIngest: () => void;
  onClear: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

const PdfSection: React.FC<PdfSectionProps> = ({
  pdfFile, pdfStatus, pdfMsg, pdfChunks, pdfDrag,
  onFileSelect, onIngest, onClear, onDragOver, onDragLeave, onDrop,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoading = pdfStatus === 'uploading' || pdfStatus === 'processing';

  return (
    <div>
      <div className="sec-label">01 — Documents</div>
      <div className="sec-title">Upload PDF</div>
      <div className="sec-desc">Upload a PDF document to chunk, embed, and index into the vector store.</div>

      {!pdfFile ? (
        <div
          className={`dropzone ${pdfDrag ? 'drag-over' : ''}`}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.[0]) onFileSelect(e.target.files[0]); }} />
          <UploadCloud className="dz-icon" size={32} />
          <div className="dz-title">Drop PDF or click to browse</div>
          <div className="dz-sub">PDF up to 50 MB</div>
        </div>
      ) : (
        <div className="file-card" style={{ marginBottom: '0.75rem' }}>
          <div className="file-card-body">
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <span className="fc-ext">PDF</span>
              <div className="fc-name">{pdfFile.name}</div>
              <div className="fc-meta">{fmtBytes(pdfFile.size)} · Text extraction</div>
            </div>
            {!isLoading && (
              <button className="clear-btn" onClick={onClear} title="Remove"><X size={13} /></button>
            )}
          </div>
        </div>
      )}

      {pdfFile && pdfStatus !== 'success' && (
        <button className="btn btn-primary" onClick={onIngest} disabled={isLoading} style={{ marginBottom: '0.65rem' }}>
          {isLoading
            ? <><Loader2 size={14} className="spin" />{pdfStatus === 'uploading' ? 'Uploading...' : 'Processing...'}</>
            : <><FileText size={14} />Ingest into vector store</>}
        </button>
      )}

      {pdfStatus !== 'idle' && (
        <div className={`alert ${pdfStatus === 'success' ? 'success' : pdfStatus === 'error' ? 'error' : 'processing'}`}>
          {pdfStatus === 'success' && <CheckCircle2 size={13} style={{ flexShrink: 0 }} />}
          {pdfStatus === 'error' && <AlertCircle size={13} style={{ flexShrink: 0 }} />}
          {isLoading && <Loader2 size={13} className="spin" style={{ flexShrink: 0 }} />}
          <span>
            {pdfMsg}
            {pdfChunks !== null && pdfStatus === 'success' && <> · <strong>{pdfChunks} chunks</strong> indexed</>}
          </span>
        </div>
      )}

      <div style={{ marginTop: '1.4rem' }}>
        <div className="pipeline">
          <div className="pipeline-hdr">Ingestion pipeline</div>
          <div className="pipeline-step"><span className="step-n">01</span><span className="step-t">PDF parsed and split into chunks</span></div>
          <div className="pipeline-step"><span className="step-n">02</span><span className="step-t">Gemini Embedding model vectorises each chunk</span></div>
          <div className="pipeline-step"><span className="step-n">03</span><span className="step-t">Vectors upserted into Qdrant</span></div>
          <div className="pipeline-step"><span className="step-n">04</span><span className="step-t">LangGraph agent synthesises grounded responses</span></div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHOTO SCAN SIDEBAR SECTION
// ═══════════════════════════════════════════════════════════════════════════════
interface ScanSectionProps {
  scanFile: ScanFile | null;
  scanStatus: ScanStatus;
  scanMsg: string;
  scanDrag: boolean;
  onFileSelect: (f: File) => void;
  onScan: () => void;
  onClear: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

const ScanSection: React.FC<ScanSectionProps> = ({
  scanFile, scanStatus, scanMsg, scanDrag,
  onFileSelect, onScan, onClear, onDragOver, onDragLeave, onDrop,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoading = scanStatus === 'scanning' || scanStatus === 'ingesting';

  return (
    <div>
      <div className="sec-label">02 — Photo Scan</div>
      <div className="sec-title">Image and Photo Scanner</div>
      <div className="sec-desc">Extract insights from any image. Ask any question.</div>

      {!scanFile ? (
        <div
          className={`dropzone scan-zone ${scanDrag ? 'drag-over' : ''}`}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp" style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.[0]) onFileSelect(e.target.files[0]); }} />
          <Camera className="dz-icon" size={32} />
          <div className="dz-title">Drop image or click to browse</div>
          <div className="dz-sub">PNG · JPG · WEBP</div>
        </div>
      ) : (
        <div className="file-card" style={{ marginBottom: '0.75rem' }}>
          <img src={scanFile.preview} alt="preview" className="file-card-img" />
          <div className="file-card-body">
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span className="fc-ext">{getExt(scanFile.file.name).replace('.', '').toUpperCase()}</span>
                <span className="ocr-tag"><ScanText size={9} />OCR</span>
              </div>
              <div className="fc-name">{scanFile.file.name}</div>
              <div className="fc-meta">{fmtBytes(scanFile.file.size)} · Gemini Vision</div>
            </div>
            {!isLoading && (
              <button className="clear-btn" onClick={onClear} title="Remove"><X size={13} /></button>
            )}
          </div>
        </div>
      )}

      {scanFile && scanStatus === 'idle' && (
        <button className="btn btn-ocr" onClick={onScan}>
          <ScanText size={14} />Scan &amp; Extract Text
        </button>
      )}

      {isLoading && (
        <button className="btn btn-ocr" disabled>
          <Loader2 size={14} className="spin" />
          {scanStatus === 'scanning' ? 'Scanning with Gemini Vision...' : 'Indexing into knowledge base...'}
        </button>
      )}

      {scanStatus !== 'idle' && (
        <div className={`alert ${
          scanStatus === 'ready' ? 'success' :
          scanStatus === 'error' ? 'error' :
          scanStatus === 'scanned' ? 'ocr' : 'processing'
        }`}>
          {scanStatus === 'ready' && <CheckCircle2 size={13} style={{ flexShrink: 0 }} />}
          {scanStatus === 'error' && <AlertCircle size={13} style={{ flexShrink: 0 }} />}
          {scanStatus === 'scanned' && <ScanText size={13} style={{ flexShrink: 0 }} />}
          {isLoading && <Loader2 size={13} className="spin" style={{ flexShrink: 0 }} />}
          <span>{scanMsg}</span>
        </div>
      )}

      {(scanStatus === 'scanned' || scanStatus === 'ingesting' || scanStatus === 'ready') && (
        <div style={{ marginTop: '1.2rem' }}>
          <div className="pipeline">
            <div className="pipeline-hdr">OCR pipeline</div>
            <div className="pipeline-step"><span className="step-n">01</span><span className="step-t hi">Gemini Vision OCR — text, tables, diagrams extracted</span></div>
            <div className="pipeline-step"><span className="step-n">02</span><span className="step-t">Extracted text split into semantic chunks</span></div>
            <div className="pipeline-step"><span className="step-n">03</span><span className="step-t">Chunks embedded and indexed in Qdrant</span></div>
            <div className="pipeline-step"><span className="step-n">04</span><span className="step-t">LangGraph RAG agent answers your questions</span></div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// OCR RESULT PANEL (shows above chat in scan mode)
// ═══════════════════════════════════════════════════════════════════════════════
interface OcrPanelProps {
  scanFile: ScanFile;
  ocrText: string;
  charCount: number;
  scanStatus: ScanStatus;
  onSaveToKB: () => void;
}

const OcrPanel: React.FC<OcrPanelProps> = ({ scanFile, ocrText, charCount, scanStatus, onSaveToKB }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(ocrText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isIngesting = scanStatus === 'ingesting';
  const isReady = scanStatus === 'ready';

  return (
    <div className="ocr-result-panel">
      <div className="ocr-panel-header">
        <div className="ocr-panel-title">
          <ScanText size={13} />
          Extracted Text
        </div>
        <div className="ocr-panel-meta">{charCount.toLocaleString()} chars · {scanFile.file.name}</div>
      </div>

      <div className="ocr-panel-body">
        {/* Image thumbnail */}
        <div className="ocr-img-col">
          <img src={scanFile.preview} alt={scanFile.file.name} />
        </div>
        {/* OCR text */}
        <div className="ocr-text-col">
          <pre className="ocr-text-content">{ocrText}</pre>
        </div>
      </div>

      <div className="ocr-panel-footer">
        <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          {copied ? <><Check size={11} />Copied!</> : <><Copy size={11} />Copy text</>}
        </button>

        {!isReady && !isIngesting && (
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0.42rem 1rem', fontSize: '0.72rem' }} onClick={onSaveToKB}>
            <BookOpen size={13} />Save to Knowledge Base
          </button>
        )}
        {isIngesting && (
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0.42rem 1rem', fontSize: '0.72rem' }} disabled>
            <Loader2 size={13} className="spin" />Indexing...
          </button>
        )}
        {isReady && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--success-text)' }}>
            <CheckCircle2 size={13} />Indexed — Q&amp;A enabled
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCANNING ANIMATION VIEW
// ═══════════════════════════════════════════════════════════════════════════════
const ScanningView: React.FC<{ preview: string }> = ({ preview }) => (
  <div className="scan-view">
    <div className="scan-label">
      <Loader2 size={14} className="spin" />
      Gemini Vision OCR — Scanning image...
    </div>
    <div className="scan-frame">
      <img src={preview} alt="scanning" />
      <div className="scan-overlay" />
      <div className="scan-line" />
      <div className="scan-corners" />
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
      Extracting text, tables &amp; diagrams
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// HERO STATES
// ═══════════════════════════════════════════════════════════════════════════════
const HeroDocuments: React.FC<{ onChip: (q: string) => void }> = () => (
  <div className="hero-empty">
    <div className="hero-kicker">// Image Scanner</div>
    <BlurText
      text="Ask anything. From your documents."
      delay={50}
      animateBy="words"
      direction="top"
      className="hero-h1"
    />
    <p className="hero-p">Upload a PDF in the sidebar, ingest it, then ask natural language questions to get precise, source-grounded answers.</p>
  </div>
);

const HeroScan: React.FC<{ onChip: (q: string) => void }> = () => (
  <div className="hero-empty">
    <div className="hero-kicker ocr">// Image Scanner</div>
    <BlurText
      text="Extract insights from any image. Ask any question."
      delay={50}
      animateBy="words"
      direction="top"
      className="hero-h1"
    />
    <p className="hero-p">Upload a photo, screenshot, handwritten note, or any image. The system will extract all visible text and let you ask questions about it.</p>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
const TypingIndicator: React.FC = () => (
  <div className="msg-row">
    <div className="avatar bot"><Bot size={15} /></div>
    <div className="bubble bot">
      <div className="typing-dots">
        <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
      </div>
    </div>
  </div>
);

const MsgBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`msg-row ${msg.role}`}>
      <div className={`avatar ${msg.role}`}>
        {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div className={`bubble ${msg.role} relative group`}>
        {msg.role === 'bot' && (
          <button
            className="copy-msg-btn"
            style={{ opacity: copied ? 1 : undefined }}
            onClick={handleCopy}
            title="Copy message"
          >
            {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
          </button>
        )}
        <div className="markdown-body">
          <ReactMarkdown
            components={{
              code({node, inline, className, children, ...props}: any) {
                const match = /language-(\w+)/.exec(className || '')
                return !inline && match ? (
                  <SyntaxHighlighter
                    {...props}
                    children={String(children).replace(/\n$/, '')}
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                  />
                ) : (
                  <code {...props} className={className}>
                    {children}
                  </code>
                )
              }
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div className="sources-row mt-2">
            <span className="src-label text-xs font-semibold uppercase tracking-wider opacity-60">Sources</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {msg.sources.map((s, i) => <span key={i} className="src-chip text-xs bg-black/20 rounded px-2 py-0.5 border border-white/5">{s}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [hasStarted, setHasStarted] = useState(false);

  // ── Selected Astro AI model (persists in localStorage) ────────────────────
  const [selectedModel, setSelectedModel] = useState<AstroModel>(() => {
    const saved = localStorage.getItem('astro_selected_model');
    if (saved) {
      const found = ASTRO_MODELS.find(m => m.id === saved);
      if (found) return found;
    }
    return DEFAULT_MODEL;
  });

  const handleModelChange = (m: AstroModel) => {
    setSelectedModel(m);
    localStorage.setItem('astro_selected_model', m.id);
  };

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('pdf');

  // ── PDF state ────────────────────────────────────────────────────────────────
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle');
  const [pdfMsg, setPdfMsg] = useState('');
  const [pdfChunks, setPdfChunks] = useState<number | null>(null);
  const [pdfDrag, setPdfDrag] = useState(false);

  // ── Scan/OCR state ───────────────────────────────────────────────────────────
  const [scanFile, setScanFile] = useState<ScanFile | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanMsg, setScanMsg] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrCharCount, setOcrCharCount] = useState(0);
  const [ocrEventId, setOcrEventId] = useState<string | null>(null);
  const [scanDrag, setScanDrag] = useState(false);

  // ── Multi-conversation state ──────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const loaded = loadConversations();
    if (loaded.length > 0) return loaded;
    const fresh = createConversation();
    return [fresh];
  });

  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_KEY);
    const loaded = loadConversations();
    if (saved && loaded.find(c => c.id === saved)) return saved;
    if (loaded.length > 0) return loaded[0].id;
    return conversations[0]?.id ?? '';
  });

  // Derive active conversation
  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];

  // Persist conversations whenever they change
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Persist active conversation id
  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeConversationId);
  }, [activeConversationId]);

  // ── History panel state ───────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Input / querying state ────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [canQuery, setCanQuery] = useState(messages.length > 0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Update canQuery when switching conversations
  useEffect(() => {
    setCanQuery(messages.length > 0);
  }, [activeConversationId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distFromBottom < 120;
    setShowScrollBottom(distFromBottom > 120);
  };

  const scrollToBottom = () => {
    isNearBottomRef.current = true;
    scrollContainerToBottom(true);
  };

  // ── Feature states ───────────────────────────────────────────────────────────
  const [isZenMode, setIsZenMode] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [chatViewMode, setChatViewMode] = useState<'linear' | 'graph'>('linear');
  const [highlightMenu, setHighlightMenu] = useState({ show: false, text: '', x: 0, y: 0 });
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesWrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track whether the user is near the bottom so we don't force-scroll while they read history
  const isNearBottomRef = useRef(true);

  // Scroll the container (not the page) to the bottom
  const scrollContainerToBottom = useCallback((smooth = true) => {
    const el = messagesWrapRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Auto-scroll only when already near the bottom or on a fresh send
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollContainerToBottom(true);
    }
  }, [messages, isQuerying, scrollContainerToBottom]);

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue((prev) => (prev ? prev + ' ' : '') + transcript);
      };
      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech') console.error('Speech error', event.error);
        setIsListening(false);
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  // ── Conversation helpers ──────────────────────────────────────────────────────
  /**
   * Update the messages of the active conversation and auto-save.
   */
  const updateConversationMessages = useCallback((
    convId: string,
    updater: (msgs: Message[]) => Message[],
    titleFromFirst?: boolean
  ) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      const newMessages = updater(c.messages);
      // Auto-title: use the first user message content (truncated)
      let title = c.title;
      if (titleFromFirst && c.title === 'New conversation') {
        const firstUser = newMessages.find(m => m.role === 'user');
        if (firstUser) {
          title = firstUser.content.slice(0, 52).trim();
          if (firstUser.content.length > 52) title += '…';
        }
      }
      return { ...c, messages: newMessages, updatedAt: Date.now(), title };
    }));
  }, []);

  const handleNewChat = useCallback(() => {
    const fresh = createConversation();
    setConversations(prev => [fresh, ...prev]);
    setActiveConversationId(fresh.id);
    setCanQuery(false);
    setInputValue('');
    setHistoryOpen(false);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setHistoryOpen(false);
    // canQuery will be updated by the effect above
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const remaining = prev.filter(c => c.id !== id);
      if (remaining.length === 0) {
        // Always keep at least one conversation
        const fresh = createConversation();
        setActiveConversationId(fresh.id);
        setCanQuery(false);
        return [fresh];
      }
      // If deleting the active one, switch to the most recent
      if (id === activeConversationId) {
        const next = remaining.sort((a, b) => b.updatedAt - a.updatedAt)[0];
        setActiveConversationId(next.id);
        setCanQuery(next.messages.length > 0);
      }
      return remaining;
    });
  }, [activeConversationId]);

  // ── Event Handlers ───────────────────────────────────────────────────────────
  const handleMouseUp = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && text.length > 0) {
        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setHighlightMenu({ show: true, text, x: rect.left + rect.width / 2, y: rect.top - 10 });
      } else {
        setHighlightMenu(prev => ({ ...prev, show: false }));
      }
    }, 10);
  };

  const handleQuickAction = (action: string) => {
    setInputValue(`${action}:\n\n"${highlightMenu.text}"`);
    setHighlightMenu({ show: false, text: '', x: 0, y: 0 });
    textareaRef.current?.focus();
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) { alert('Voice not supported.'); return; }
    if (isListening) recognitionRef.current.stop();
    else { try { recognitionRef.current.start(); } catch (e) { setIsListening(false); } }
  };

  // ── PDF handlers ─────────────────────────────────────────────────────────────
  const handlePdfSelect = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setPdfStatus('error'); setPdfMsg('Only PDF files are accepted.'); return;
    }
    setPdfFile(file); setPdfStatus('idle'); setPdfMsg(''); setPdfChunks(null);
  }, []);

  const handlePdfClear = () => { setPdfFile(null); setPdfStatus('idle'); setPdfMsg(''); setPdfChunks(null); };

  const handlePdfIngest = async () => {
    if (!pdfFile) return;
    setPdfStatus('uploading'); setPdfMsg('Uploading PDF...');
    const fd = new FormData(); fd.append('file', pdfFile);
    try {
      const res = await fetch(`${API}/upload`, { method: 'POST', body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Upload failed'); }
      const data = await res.json();
      setPdfStatus('processing'); setPdfMsg('Extracting text and generating embeddings...');
      const out = await pollStatus(data.event_id);
      setPdfChunks(out?.ingested ?? null); setPdfStatus('success');
      setPdfMsg('Ingestion complete.');
      setCanQuery(true);
      const sysMsg: Message = {
        id: `sys-${Date.now()}`,
        role: 'bot',
        content: `**Document Uploaded:** ${pdfFile.name}\n\nSuccessfully extracted text and indexed ${out?.ingested ?? 0} chunks into the knowledge base. You can now ask questions about this document.`
      };
      updateConversationMessages(activeConversationId, prev => [...prev, sysMsg]);
    } catch (err: any) {
      setPdfStatus('error'); setPdfMsg(err.message || 'Upload failed.');
    }
  };

  // ── Scan handlers ────────────────────────────────────────────────────────────
  const handleScanSelect = useCallback((file: File) => {
    const e = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!IMG_EXTS.has(e)) {
      setScanStatus('error'); setScanMsg('Only PNG, JPG, JPEG, WEBP images accepted.'); return;
    }
    if (scanFile?.preview) URL.revokeObjectURL(scanFile.preview);
    const preview = URL.createObjectURL(file);
    setScanFile({ file, preview }); setScanStatus('idle'); setScanMsg('');
    setOcrText(''); setOcrEventId(null);
  }, [scanFile]);

  const handleScanClear = () => {
    if (scanFile?.preview) URL.revokeObjectURL(scanFile.preview);
    setScanFile(null); setScanStatus('idle'); setScanMsg('');
    setOcrText(''); setOcrCharCount(0); setOcrEventId(null);
  };

  const handleOcrScan = async () => {
    if (!scanFile) return;
    setScanStatus('scanning'); setScanMsg('Gemini Vision is scanning the image...');
    const fd = new FormData(); fd.append('file', scanFile.file);
    try {
      const res = await fetch(`${API}/ocr-scan`, { method: 'POST', body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'OCR failed'); }
      const data = await res.json();
      setOcrText(data.extracted_text); setOcrCharCount(data.char_count);
      setOcrEventId(data.event_id);
      setScanStatus('scanned'); setScanMsg(`OCR complete — ${data.char_count.toLocaleString()} characters extracted.`);
      handleOcrIngest(data.event_id);
    } catch (err: any) {
      setScanStatus('error'); setScanMsg(err.message || 'OCR failed. Please try again.');
    }
  };

  const handleOcrIngest = async (eventId: string) => {
    setScanStatus('ingesting'); setScanMsg('Indexing extracted text into knowledge base...');
    try {
      await pollStatus(eventId);
      setScanStatus('ready'); setScanMsg('Indexed — you can now ask questions about this image.');
      setCanQuery(true);
      if (scanFile) {
        const sysMsg: Message = {
          id: `sys-${Date.now()}`,
          role: 'bot',
          content: `**Image Scanned and Indexed:** ${scanFile.file.name}\n\nSuccessfully extracted ${ocrCharCount} characters. You can now ask questions about this image.`
        };
        updateConversationMessages(activeConversationId, prev => [...prev, sysMsg]);
      }
    } catch (err: any) {
      setScanStatus('error'); setScanMsg(`Indexing failed: ${err.message}`);
    }
  };

  const handleSaveToKB = () => {
    if (ocrEventId) handleOcrIngest(ocrEventId);
  };

  const pdfDragOver = (e: React.DragEvent) => { e.preventDefault(); setPdfDrag(true); };
  const pdfDragLeave = () => setPdfDrag(false);
  const pdfDrop = (e: React.DragEvent) => { e.preventDefault(); setPdfDrag(false); if (e.dataTransfer.files?.[0]) handlePdfSelect(e.dataTransfer.files[0]); };

  const scanDragOver = (e: React.DragEvent) => { e.preventDefault(); setScanDrag(true); };
  const scanDragLeave = () => setScanDrag(false);
  const scanDrop = (e: React.DragEvent) => { e.preventDefault(); setScanDrag(false); if (e.dataTransfer.files?.[0]) handleScanSelect(e.dataTransfer.files[0]); };

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const handleChipClick = (q: string) => { setInputValue(q); textareaRef.current?.focus(); };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const ta = e.target; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  };

  const exportChat = () => {
    let content = "# Astro AI Conversation Export\n\n";
    messages.forEach(m => {
      content += `## ${m.role === 'user' ? 'You' : 'Astro AI'}\n${m.content}\n\n`;
      if (m.sources && m.sources.length > 0) content += `> Sources: ${m.sources.join(', ')}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'chat.md';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleSend = async () => {
    const q = inputValue.trim();
    if (!q) return;

    // Slash Commands Interception
    if (q === '/split') { setIsSplitView(v => !v); setInputValue(''); return; }
    if (q === '/zen') { setIsZenMode(v => !v); setInputValue(''); return; }
    if (q === '/map') { setChatViewMode(v => v === 'linear' ? 'graph' : 'linear'); setInputValue(''); return; }
    if (q === '/export') { exportChat(); setInputValue(''); return; }
    if (q === '/clear') {
      updateConversationMessages(activeConversationId, () => []);
      setInputValue('');
      setCanQuery(false);
      return;
    }

    if (isQuerying) return;
    // Always scroll to bottom when user deliberately sends a message
    isNearBottomRef.current = true;
    const userMsg: Message = { id: `${Date.now()}`, role: 'user', content: q };
    const isFirstMessage = messages.length === 0;
    updateConversationMessages(activeConversationId, prev => [...prev, userMsg], true);
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsQuerying(true);

    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, model: selectedModel.id }),
      });
      if (!res.ok) throw new Error('Query failed');
      const data = await res.json();
      const out = await pollStatus(data.event_id);
      const botMsg: Message = { id: `${Date.now() + 1}`, role: 'bot', content: out?.answer || 'No answer returned.', sources: out?.sources };
      updateConversationMessages(activeConversationId, prev => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: Message = { id: `${Date.now() + 1}`, role: 'bot', content: `Error: ${err.message}`, isError: true };
      updateConversationMessages(activeConversationId, prev => [...prev, errMsg]);
    } finally {
      setIsQuerying(false);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────
  const showScanResult = activeTab === 'scan' && ocrText && (scanStatus === 'scanned' || scanStatus === 'ingesting' || scanStatus === 'ready');
  const showScanningAnim = activeTab === 'scan' && scanStatus === 'scanning' && scanFile;
  const hasMessages = messages.length > 0 || isQuerying;
  const canSend = (canQuery && inputValue.trim().length > 0 && !isQuerying) || inputValue.trim().startsWith('/');

  const inputPlaceholder = !canQuery
    ? activeTab === 'pdf' ? 'Upload and ingest a PDF first...' : 'Scan an image first to enable Q&A...'
    : activeTab === 'pdf' ? 'Ask a question about your document...' : 'Ask about the extracted image content...';

  if (!hasStarted) {
    return <Landing onStart={() => setHasStarted(true)} />;
  }

  return (
    <div className={`app-shell ${isZenMode ? 'zen-mode' : ''}`} onMouseUp={handleMouseUp}>
      <div className="starfield" />
      <div className="shooting-star" />
      <div className="glow-orb top-left" />
      <div className="glow-orb bottom-right" />

      <ContextMenu menu={highlightMenu} onAction={handleQuickAction} />

      {!isZenMode && (
        <Topbar
          onBackToLanding={() => setHasStarted(false)}
          onNewChat={handleNewChat}
          onToggleHistory={() => setHistoryOpen(v => !v)}
          historyOpen={historyOpen}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
        />
      )}

      {isZenMode && (
        <button onClick={() => setIsZenMode(false)} style={{position: 'fixed', top: 20, right: 20, zIndex: 1000, background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '5px 10px', borderRadius: 6, color: 'var(--text-secondary)'}}>
          Exit Zen Mode
        </button>
      )}

      <div className="main-content" style={{ position: 'relative' }}>
        {/* ── SIDEBAR ── */}
        {!isZenMode && (
          <aside className="sidebar">
            <nav className="tab-nav">
              <button className={`tab-btn ${activeTab === 'pdf' ? 'active' : ''}`} onClick={() => setActiveTab('pdf')}>
                <FileText size={14} />Documents
              </button>
              <button className={`tab-btn scan ${activeTab === 'scan' ? 'active' : ''}`} onClick={() => setActiveTab('scan')}>
                <Camera size={14} />Photo Scan
              </button>
            </nav>

            <div className="sidebar-inner">
              {activeTab === 'pdf' ? (
                <PdfSection
                  pdfFile={pdfFile} pdfStatus={pdfStatus} pdfMsg={pdfMsg} pdfChunks={pdfChunks} pdfDrag={pdfDrag}
                  onFileSelect={handlePdfSelect} onIngest={handlePdfIngest} onClear={handlePdfClear}
                  onDragOver={pdfDragOver} onDragLeave={pdfDragLeave} onDrop={pdfDrop}
                />
              ) : (
                <ScanSection
                  scanFile={scanFile} scanStatus={scanStatus} scanMsg={scanMsg} scanDrag={scanDrag}
                  onFileSelect={handleScanSelect} onScan={handleOcrScan} onClear={handleScanClear}
                  onDragOver={scanDragOver} onDragLeave={scanDragLeave} onDrop={scanDrop}
                />
              )}
            </div>
          </aside>
        )}

        {/* ── SPLIT VIEWER ── */}
        {isSplitView && (pdfFile || scanFile) && !isZenMode && (
          <div className="viewer-pane" style={{ borderRight: '1px solid var(--border)', width: '35%', background: '#fff' }}>
             {activeTab === 'pdf' && pdfFile && (
               <iframe src={URL.createObjectURL(pdfFile)} title="PDF Viewer" width="100%" height="100%" style={{border: 'none'}} />
             )}
             {activeTab === 'scan' && scanFile && (
               <div style={{width:'100%', height:'100%', overflow:'auto', display:'flex', alignItems:'center', justifyContent:'center'}}>
                 <img src={scanFile.preview} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} />
               </div>
             )}
          </div>
        )}

        {/* ── CHAT PANEL ── */}
        <div className="chat-panel" style={{ position: 'relative' }}>

          {!isZenMode && showScanResult && scanFile && (
            <OcrPanel scanFile={scanFile} ocrText={ocrText} charCount={ocrCharCount} scanStatus={scanStatus} onSaveToKB={handleSaveToKB} />
          )}

          {!isZenMode && showScanningAnim && <ScanningView preview={scanFile.preview} />}

          {chatViewMode === 'graph' && hasMessages ? (
             <div style={{flex: 1, overflow: 'hidden', position: 'relative', margin: '1rem', borderRadius: 8, border: '1px solid var(--border)'}}>
               <MindMapView messages={messages} />
             </div>
          ) : (
             <>
                {!showScanningAnim && !showScanResult && (
                  hasMessages ? (
                    <div className="messages-wrap" ref={messagesWrapRef} onScroll={handleScroll}>
                      {messages.map(m => <MsgBubble key={m.id} msg={m} />)}
                      {isQuerying && <TypingIndicator />}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    activeTab === 'pdf' ? <HeroDocuments onChip={handleChipClick} /> : <HeroScan onChip={handleChipClick} />
                  )
                )}

                {showScanResult && hasMessages && (
                  <div className="messages-wrap" ref={messagesWrapRef} style={{ flex: 1 }} onScroll={handleScroll}>
                    {messages.map(m => <MsgBubble key={m.id} msg={m} />)}
                    {isQuerying && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                  </div>
                )}
             </>
          )}

          {showScrollBottom && hasMessages && (
            <button
              onClick={scrollToBottom}
              style={{
                position: 'absolute', bottom: '100px', right: '40px', zIndex: 50,
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                borderRadius: '50%', width: '40px', height: '40px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-primary)', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
            >
              <ArrowDown size={18} />
            </button>
          )}

          {/* Input bar */}
          {!showScanningAnim && (
            <div className="input-bar-container">
              <div className="input-bar">
                <div style={{ display: 'flex', marginBottom: '8px', paddingLeft: '8px' }}>
                  <ModelSelector selected={selectedModel} onChange={handleModelChange} />
                </div>
                <div className="input-row">
                  <textarea
                    ref={textareaRef}
                    className="chat-ta"
                    placeholder={inputPlaceholder}
                    value={inputValue}
                    onChange={handleTextareaChange}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    disabled={!canQuery}
                    rows={1}
                  />
                  <button
                    className="send-btn"
                    onClick={toggleVoiceInput}
                    disabled={!canQuery}
                    title="Voice Input"
                    style={{ background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'transparent', color: isListening ? '#ef4444' : 'var(--text-secondary)', marginRight: '5px' }}
                  >
                    {isListening ? <Mic className="pulse-anim" size={15} /> : <MicOff size={15} />}
                  </button>
                  <button className="send-btn" onClick={handleSend} disabled={!canSend}>
                    {isQuerying ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                  </button>
                </div>
                <div className="input-hint" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span>Enter to send · Shift+Enter for new line</span>
                  <span style={{opacity: 0.5}}>Try /zen, /split, /map, /export</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── HISTORY PANEL ── */}
        {historyOpen && !isZenMode && (
          <ChatHistoryPanel
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onDelete={handleDeleteConversation}
            onNewChat={handleNewChat}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
