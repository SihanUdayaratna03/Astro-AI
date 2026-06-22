import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud, Send, Bot, User, CheckCircle2, AlertCircle, Database,
  Zap, Cpu, Loader2, Image as ImageIcon, FileText, ScanText, Sparkles,
  X, Copy, Check, Camera, BookOpen,
} from 'lucide-react';
import Landing from './Landing';
import BlurText from './BlurText';
import './index.css';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
type Tab = 'pdf' | 'scan';
type PdfStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';
type ScanStatus = 'idle' | 'scanning' | 'scanned' | 'ingesting' | 'ready' | 'error';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  sources?: string[];
  isError?: boolean;
}

interface ScanFile {
  file: File;
  preview: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const API = 'http://127.0.0.1:8000/api';
const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const PDF_CHIPS = [
  'Summarize the main points',
  'What are the key conclusions?',
  'What methodology was used?',
  'List all important numbers',
];

const SCAN_CHIPS = [
  'What does this image say?',
  'Extract all text from the image',
  'Summarize the extracted content',
  'List all numbers and figures',
  'What is the main topic?',
];

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
const getExt = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase();
const fmtBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1_048_576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1_048_576).toFixed(1)} MB`;

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
// ═══════════════════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════════════════
const Topbar: React.FC<{ onBackToLanding: () => void }> = ({ onBackToLanding }) => (
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
    <div className="topbar-badges">
      <div className="status-badge"><Database size={11} /> Qdrant <div className="status-dot" /></div>
      <div className="status-badge"><Cpu size={11} /> Gemini <div className="status-dot" /></div>
      <div className="status-badge"><Zap size={11} /> Inngest <div className="status-dot" /></div>
    </div>
  </header>
);

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
      <div className="sec-title">OCR Image Scanner</div>
      <div className="sec-desc">Upload an image. Gemini Vision will extract all text, tables, and diagram content instantly.</div>

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
const HeroDocuments: React.FC<{ onChip: (q: string) => void }> = ({ onChip }) => (
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

const HeroScan: React.FC<{ onChip: (q: string) => void }> = ({ onChip }) => (
  <div className="hero-empty">
    <div className="hero-kicker ocr">// Image Scanner</div>
    <BlurText
      text="Scan any image. Ask about the content."
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

const MsgBubble: React.FC<{ msg: Message }> = ({ msg }) => (
  <div className={`msg-row ${msg.role}`}>
    <div className={`avatar ${msg.role}`}>
      {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
    </div>
    <div className={`bubble ${msg.role}`}>
      {msg.content.split('\n').map((l, i) => <p key={i}>{l}</p>)}
      {msg.sources && msg.sources.length > 0 && (
        <div className="sources-row">
          <span className="src-label">Sources</span>
          {msg.sources.map((s, i) => <span key={i} className="src-chip">{s}</span>)}
        </div>
      )}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [hasStarted, setHasStarted] = useState(false);

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('pdf');

  // ── PDF state ─────────────────────────────────────────────────────────────────
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle');
  const [pdfMsg, setPdfMsg] = useState('');
  const [pdfChunks, setPdfChunks] = useState<number | null>(null);
  const [pdfDrag, setPdfDrag] = useState(false);

  // ── Scan/OCR state ────────────────────────────────────────────────────────────
  const [scanFile, setScanFile] = useState<ScanFile | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanMsg, setScanMsg] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrCharCount, setOcrCharCount] = useState(0);
  const [ocrEventId, setOcrEventId] = useState<string | null>(null);
  const [scanDrag, setScanDrag] = useState(false);

  // ── Shared chat state ─────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [canQuery, setCanQuery] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isQuerying]);

  // ── PDF handlers ──────────────────────────────────────────────────────────────
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
    } catch (err: any) {
      setPdfStatus('error'); setPdfMsg(err.message || 'Upload failed.');
    }
  };

  // ── Scan handlers ─────────────────────────────────────────────────────────────
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
      // Auto-start background ingestion polling
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
    } catch (err: any) {
      setScanStatus('error'); setScanMsg(`Indexing failed: ${err.message}`);
    }
  };

  // Manual save (if user wants to explicitly trigger — called from OcrPanel)
  const handleSaveToKB = () => {
    if (ocrEventId) handleOcrIngest(ocrEventId);
  };

  // ── Drag handlers (PDF) ───────────────────────────────────────────────────────
  const pdfDragOver = (e: React.DragEvent) => { e.preventDefault(); setPdfDrag(true); };
  const pdfDragLeave = () => setPdfDrag(false);
  const pdfDrop = (e: React.DragEvent) => { e.preventDefault(); setPdfDrag(false); if (e.dataTransfer.files?.[0]) handlePdfSelect(e.dataTransfer.files[0]); };

  // ── Drag handlers (Scan) ──────────────────────────────────────────────────────
  const scanDragOver = (e: React.DragEvent) => { e.preventDefault(); setScanDrag(true); };
  const scanDragLeave = () => setScanDrag(false);
  const scanDrop = (e: React.DragEvent) => { e.preventDefault(); setScanDrag(false); if (e.dataTransfer.files?.[0]) handleScanSelect(e.dataTransfer.files[0]); };

  // ── Chat ──────────────────────────────────────────────────────────────────────
  const handleChipClick = (q: string) => { setInputValue(q); textareaRef.current?.focus(); };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const ta = e.target; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  };

  const handleSend = async () => {
    const q = inputValue.trim();
    if (!q || isQuerying) return;
    const userMsg: Message = { id: `${Date.now()}`, role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsQuerying(true);
    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) throw new Error('Query failed');
      const data = await res.json();
      const out = await pollStatus(data.event_id);
      setMessages(prev => [...prev, { id: `${Date.now() + 1}`, role: 'bot', content: out?.answer || 'No answer returned.', sources: out?.sources }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: `${Date.now() + 1}`, role: 'bot', content: `Error: ${err.message}`, isError: true }]);
    } finally {
      setIsQuerying(false); }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
  const showScanResult = activeTab === 'scan' && ocrText && (scanStatus === 'scanned' || scanStatus === 'ingesting' || scanStatus === 'ready');
  const showScanningAnim = activeTab === 'scan' && scanStatus === 'scanning' && scanFile;
  const hasMessages = messages.length > 0 || isQuerying;

  const canSend = canQuery && inputValue.trim().length > 0 && !isQuerying;

  // What placeholder to show in the textarea
  const inputPlaceholder = !canQuery
    ? activeTab === 'pdf'
      ? 'Upload and ingest a PDF first...'
      : 'Scan an image first to enable Q&A...'
    : activeTab === 'pdf'
      ? 'Ask a question about your document...'
      : 'Ask about the extracted image content...';

  // ── RENDER ────────────────────────────────────────────────────────────────────
  if (!hasStarted) {
    return <Landing onStart={() => setHasStarted(true)} />;
  }

  return (
    <div className="app-shell">
      <div className="starfield" />
      <div className="shooting-star" />
      <div className="glow-orb top-left" />
      <div className="glow-orb bottom-right" />

      <Topbar onBackToLanding={() => setHasStarted(false)} />

      <div className="main-content">
        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          {/* Tab navigation */}
          <nav className="tab-nav">
            <button
              className={`tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
              onClick={() => setActiveTab('pdf')}
            >
              <FileText size={14} />Documents
            </button>
            <button
              className={`tab-btn scan ${activeTab === 'scan' ? 'active' : ''}`}
              onClick={() => setActiveTab('scan')}
            >
              <Camera size={14} />Photo Scan
            </button>
          </nav>

          {/* Tab content */}
          <div className="sidebar-inner">
            {activeTab === 'pdf' ? (
              <PdfSection
                pdfFile={pdfFile} pdfStatus={pdfStatus} pdfMsg={pdfMsg}
                pdfChunks={pdfChunks} pdfDrag={pdfDrag}
                onFileSelect={handlePdfSelect} onIngest={handlePdfIngest}
                onClear={handlePdfClear} onDragOver={pdfDragOver}
                onDragLeave={pdfDragLeave} onDrop={pdfDrop}
              />
            ) : (
              <ScanSection
                scanFile={scanFile} scanStatus={scanStatus} scanMsg={scanMsg}
                scanDrag={scanDrag} onFileSelect={handleScanSelect}
                onScan={handleOcrScan} onClear={handleScanClear}
                onDragOver={scanDragOver} onDragLeave={scanDragLeave} onDrop={scanDrop}
              />
            )}
          </div>
        </aside>

        {/* ── CHAT PANEL ── */}
        <div className="chat-panel">

          {/* OCR result panel (when image scanned) */}
          {showScanResult && scanFile && (
            <OcrPanel
              scanFile={scanFile} ocrText={ocrText} charCount={ocrCharCount}
              scanStatus={scanStatus} onSaveToKB={handleSaveToKB}
            />
          )}

          {/* Scanning animation */}
          {showScanningAnim && <ScanningView preview={scanFile.preview} />}

          {/* Messages / Hero */}
          {!showScanningAnim && !showScanResult && (
            hasMessages ? (
              <div className="messages-wrap">
                {messages.map(m => <MsgBubble key={m.id} msg={m} />)}
                {isQuerying && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              activeTab === 'pdf'
                ? <HeroDocuments onChip={handleChipClick} />
                : <HeroScan onChip={handleChipClick} />
            )
          )}

          {/* Show messages below OCR panel in scan mode when there are messages */}
          {showScanResult && hasMessages && (
            <div className="messages-wrap" style={{ flex: 1 }}>
              {messages.map(m => <MsgBubble key={m.id} msg={m} />)}
              {isQuerying && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input bar — floating pill style */}
          {!showScanningAnim && (
            <div className="input-bar-container">
              <div className="input-bar">
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
                  <button className="send-btn" onClick={handleSend} disabled={!canSend}>
                    {isQuerying ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                  </button>
                </div>
                <div className="input-hint">
                  Enter to send · Shift+Enter for new line
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
