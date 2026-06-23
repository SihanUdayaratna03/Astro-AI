import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud, Send, Bot, User, CheckCircle2, AlertCircle, Database,
  Zap, Cpu, Loader2, Image as ImageIcon, FileText, ScanText, Sparkles,
  X, Copy, Check, Camera, BookOpen, Download, Trash2, ArrowDown,
  Layout, List, Map, Maximize, Minimize, Mic, MicOff
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Landing from './Landing';
import BlurText from './BlurText';
import MindMapView from './MindMapView';
import './index.css';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
export type Tab = 'pdf' | 'scan';
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const API = 'http://127.0.0.1:8000/api';
const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

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
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
const ContextMenu: React.FC<{ menu: any, onAction: (a: string) => void }> = ({ menu, onAction }) => {
  if (!menu.show) return null;
  return (
    <div className="highlight-menu" style={{ left: menu.x, top: menu.y }}>
      <button onClick={() => onAction('Explain this')}>Explain</button>
      <button onClick={() => onAction('Summarize')}>Summarize</button>
      <button onClick={() => onAction('Rewrite')}>Rewrite</button>
    </div>
  );
};

const Topbar: React.FC<{ onBackToLanding: () => void }> = ({ onBackToLanding }) => (
  <header className="topbar">
    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
      <button 
        onClick={onBackToLanding} 
        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-secondary)', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', transition: 'all 0.2s' }}
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
    </div>
  </header>
);

const MsgBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={`msg-row ${msg.role}`}>
      <div className={`avatar ${msg.role}`}>
        {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div className={`bubble ${msg.role}`}>
        {msg.role === 'bot' && (
          <button className="copy-msg-btn" onClick={handleCopy} title="Copy message">
            {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
          </button>
        )}
        <div className="markdown-body">
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div className="sources-row">
            <span className="src-label">Sources</span>
            {msg.sources.map((s, i) => <span key={i} className="src-chip">{s}</span>)}
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('pdf');

  // Interactive Features State
  const [isZenMode, setIsZenMode] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [chatViewMode, setChatViewMode] = useState<'linear' | 'graph'>('linear');
  const [highlightMenu, setHighlightMenu] = useState({ show: false, text: '', x: 0, y: 0 });

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle');
  const [pdfMsg, setPdfMsg] = useState('');

  // Scan
  const [scanFile, setScanFile] = useState<ScanFile | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanMsg, setScanMsg] = useState('');
  const [ocrText, setOcrText] = useState('');

  // Chat
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('astro_messages');
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    return [];
  });
  const [inputValue, setInputValue] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [canQuery, setCanQuery] = useState(messages.length > 0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const hasMessages = messages.length > 0;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

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
        if (event.error !== 'no-speech') {
          console.error('Speech recognition error', event.error);
        }
        setIsListening(false);
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Voice recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Speech recognition start error', e);
        setIsListening(false);
      }
    }
  };

  useEffect(() => { localStorage.setItem('astro_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isQuerying]);

  const handleMouseUp = (e: React.MouseEvent) => {
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
    const prompt = `${action}:\n\n"${highlightMenu.text}"`;
    setInputValue(prompt);
    setHighlightMenu({ show: false, text: '', x: 0, y: 0 });
    textareaRef.current?.focus();
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
      setIsQuerying(false);
    }
  };

  const handlePdfIngest = async () => {
    if (!pdfFile) return;
    setPdfStatus('uploading'); setPdfMsg('Uploading PDF...');
    const fd = new FormData(); fd.append('file', pdfFile);
    try {
      const res = await fetch(`${API}/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      setPdfStatus('processing');
      const out = await pollStatus(data.event_id);
      setPdfStatus('success'); setPdfMsg('Ingestion complete.'); setCanQuery(true);
    } catch (err: any) { setPdfStatus('error'); }
  };

  const handleOcrScan = async () => {
    if (!scanFile) return;
    setScanStatus('scanning');
    const fd = new FormData(); fd.append('file', scanFile.file);
    try {
      const res = await fetch(`${API}/ocr-scan`, { method: 'POST', body: fd });
      const data = await res.json();
      setOcrText(data.extracted_text);
      setScanStatus('scanned');
      pollStatus(data.event_id).then(() => { setScanStatus('ready'); setCanQuery(true); });
    } catch (err: any) { setScanStatus('error'); }
  };

  if (!hasStarted) return <Landing onStart={() => setHasStarted(true)} />;

  return (
    <div className={`app-shell ${isZenMode ? 'zen-mode' : ''}`} onMouseUp={handleMouseUp}>
      <div className="starfield" />
      <div className="glow-orb top-left" />
      <div className="glow-orb bottom-right" />
      
      <ContextMenu menu={highlightMenu} onAction={handleQuickAction} />

      {!isZenMode && <Topbar onBackToLanding={() => setHasStarted(false)} />}

      <div className="main-content">
        {/* SIDEBAR */}
        {!isZenMode && (
          <aside className="sidebar">
            <nav className="tab-nav">
              <button className={`tab-btn ${activeTab === 'pdf' ? 'active' : ''}`} onClick={() => setActiveTab('pdf')}><FileText size={14} />Documents</button>
              <button className={`tab-btn scan ${activeTab === 'scan' ? 'active' : ''}`} onClick={() => setActiveTab('scan')}><Camera size={14} />Photo Scan</button>
            </nav>
            <div className="sidebar-inner" style={{padding: '1.5rem'}}>
              {activeTab === 'pdf' ? (
                <div>
                  <div className="sec-label">01 — Documents</div>
                  <input type="file" accept=".pdf" onChange={(e) => e.target.files?.[0] && setPdfFile(e.target.files[0])} style={{marginBottom: 10}} />
                  {pdfFile && <button className="btn btn-primary" onClick={handlePdfIngest}>Ingest PDF</button>}
                  <div style={{marginTop: 10, fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{pdfStatus} {pdfMsg}</div>
                </div>
              ) : (
                <div>
                  <div className="sec-label">02 — Photo Scan</div>
                  <input type="file" accept="image/*" onChange={(e) => {
                    if (e.target.files?.[0]) {
                      const file = e.target.files[0];
                      setScanFile({ file, preview: URL.createObjectURL(file) });
                    }
                  }} style={{marginBottom: 10}} />
                  {scanFile && <button className="btn btn-primary" onClick={handleOcrScan}>Scan Image</button>}
                  <div style={{marginTop: 10, fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{scanStatus}</div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* VIEWER PANE */}
        {isSplitView && (pdfFile || scanFile) && !isZenMode && (
          <div className="viewer-pane">
             {activeTab === 'pdf' && pdfFile && (
               <iframe src={URL.createObjectURL(pdfFile)} title="PDF Viewer" width="100%" height="100%" style={{border: 'none', background: 'white'}} />
             )}
             {activeTab === 'scan' && scanFile && (
               <div style={{width:'100%', height:'100%', overflow:'auto', display:'flex', alignItems:'center', justifyContent:'center'}}>
                 <img src={scanFile.preview} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} />
               </div>
             )}
          </div>
        )}

        {/* CHAT PANEL */}
        <div className="chat-panel" style={{ position: 'relative' }}>
          
          {hasMessages && (
            <div className="chat-tools-header">
              <div className="tools-left">
                {!isZenMode && (
                  <button className={`chat-tool-btn ${isSplitView ? 'active' : ''}`} onClick={() => setIsSplitView(!isSplitView)}>
                    <Layout size={13} /> Split View
                  </button>
                )}
                <button className={`chat-tool-btn ${chatViewMode === 'graph' ? 'active' : ''}`} onClick={() => setChatViewMode(prev => prev === 'linear' ? 'graph' : 'linear')}>
                  {chatViewMode === 'graph' ? <List size={13} /> : <Map size={13} />} {chatViewMode === 'graph' ? 'List View' : 'Map View'}
                </button>
              </div>
              <div className="tools-right">
                {!isZenMode && (
                  <button className="chat-tool-btn" onClick={() => setIsZenMode(true)}>
                    <Maximize size={13} /> Zen Mode
                  </button>
                )}
                <button className="chat-tool-btn danger" onClick={() => setMessages([])}><Trash2 size={13} /> Clear</button>
              </div>
            </div>
          )}

          {isZenMode && (
            <button className="exit-zen-btn" onClick={() => setIsZenMode(false)}>
              <Minimize size={14} /> Exit Zen Mode
            </button>
          )}

          {chatViewMode === 'graph' && hasMessages ? (
            <div style={{flex: 1, overflow: 'hidden', position: 'relative', borderRadius: '8px', border: '1px solid var(--border)', margin: '0 1rem'}}>
              <MindMapView messages={messages} />
            </div>
          ) : (
            <div className="messages-wrap" onScroll={(e) => setShowScrollBottom(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight > 150)}>
              <div className="messages-inner">
                {messages.length === 0 && <div style={{padding: '3rem', textAlign: 'center', opacity: 0.5}}>No messages yet. Ask a question below!</div>}
                {messages.map(m => <MsgBubble key={m.id} msg={m} />)}
                {isQuerying && <div className="msg-row bot"><div className="bubble bot"><Loader2 size={14} className="spin" /> Thinking...</div></div>}
                <div ref={messagesEndRef} style={{ height: 1 }} />
              </div>
            </div>
          )}

          {showScrollBottom && chatViewMode === 'linear' && (
            <button className="scroll-bottom-fab" onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              <ArrowDown size={18} />
            </button>
          )}

          <div className="input-bar-container">
            <div className="input-bar">
              <div className="input-row">
                <textarea
                  ref={textareaRef} className="chat-ta"
                  placeholder="Ask a question..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  disabled={!canQuery} rows={1}
                />
                <button 
                  className={`send-btn ${isListening ? 'listening' : ''}`} 
                  onClick={toggleVoiceInput} 
                  disabled={!canQuery}
                  title="Voice Input"
                  style={{ background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'transparent', color: isListening ? '#ef4444' : 'var(--text-secondary)' }}
                >
                  {isListening ? <Mic className="pulse-anim" size={15} /> : <MicOff size={15} />}
                </button>
                <button className="send-btn" onClick={handleSend} disabled={!canQuery || !inputValue.trim()}>
                  {isQuerying ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
