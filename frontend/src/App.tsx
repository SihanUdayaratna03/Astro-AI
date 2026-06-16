import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Zap, 
  Cpu
} from 'lucide-react';

// --- Types ---
type Message = {
  id: string;
  role: 'user' | 'bot';
  content: string;
  sources?: string[];
};

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

// --- API Service ---
const API_BASE = 'http://localhost:8000/api';

const pollStatus = async (eventId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/status/${eventId}`);
        if (!res.ok) throw new Error('Failed to fetch status');
        const data = await res.json();
        
        if (data.status === 'completed') {
          clearInterval(interval);
          resolve(data.output);
        } else if (data.status === 'failed' || data.status === 'error') {
          clearInterval(interval);
          reject(data.error);
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 1500);
  });
};

// --- Components ---

const Topbar = () => (
  <div className="topbar">
    <div className="logo">
      AstroRAG
      <div className="logo-dot" />
    </div>
    <div className="status-badges">
      <div className="status-badge">
        <Database size={12} /> Qdrant <div className="status-dot" />
      </div>
      <div className="status-badge">
        <Cpu size={12} /> Gemini <div className="status-dot" />
      </div>
      <div className="status-badge">
        <Zap size={12} /> Inngest <div className="status-dot" />
      </div>
    </div>
  </div>
);

const Hero = () => (
  <div className="hero">
    <h1>
      Ask anything.<br />
      <strong>From your documents.</strong>
    </h1>
    <p>
      Upload your PDFs into a semantic vector store. Query them in natural language.
      Receive precise, source-grounded answers powered by Gemini.
    </p>
  </div>
);

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isQuerying]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.pdf')) {
      setUploadStatus('error');
      setStatusMessage('Please upload a PDF file.');
      return;
    }

    setFile(selectedFile);
    setUploadStatus('uploading');
    setStatusMessage('Uploading document...');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      setUploadStatus('processing');
      setStatusMessage('Extracting text and generating embeddings...');
      
      const output = await pollStatus(data.event_id);
      console.log("Upload processing complete:", output);
      
      setUploadStatus('success');
      setStatusMessage(`Successfully processed and indexed ${output.ingested} chunks.`);
    } catch (err: any) {
      console.error(err);
      setUploadStatus('error');
      setStatusMessage(err.message || 'An error occurred during upload.');
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isQuerying) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsQuerying(true);

    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg.content }),
      });
      
      if (!res.ok) throw new Error('Query failed');
      const data = await res.json();
      
      const output = await pollStatus(data.event_id);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: output.answer,
        sources: output.sources
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: `Error: ${err.message || 'Failed to retrieve answer.'}`
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsQuerying(false);
    }
  };

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <p key={i}>{line}</p>
    ));
  };

  return (
    <>
      <Topbar />
      <div className="container">
        {messages.length === 0 && <Hero />}

        {messages.length === 0 && (
          <div 
            className={`upload-container ${uploadStatus === 'uploading' ? 'drag-active' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
          >
            <input 
              type="file" 
              accept=".pdf" 
              className="file-input" 
              onChange={handleFileChange}
              disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
            />
            
            <UploadCloud className="upload-icon" size={48} />
            <div className="upload-title">
              {file ? file.name : 'Click or drag a PDF to upload'}
            </div>
            <div className="upload-subtitle">
              Max file size 50MB. Secure local processing.
            </div>

            {uploadStatus !== 'idle' && (
              <div className={`status-info ${uploadStatus === 'error' ? 'error' : uploadStatus === 'success' ? 'success' : ''}`}>
                {(uploadStatus === 'uploading' || uploadStatus === 'processing') && <div className="spinner" />}
                {uploadStatus === 'success' && <CheckCircle2 size={18} color="var(--success-color)" />}
                {uploadStatus === 'error' && <AlertCircle size={18} color="var(--error-color)" />}
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        )}

        {(messages.length > 0 || isQuerying) && (
          <div className="chat-container">
            <div className="chat-history">
              {messages.map(msg => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className={`avatar ${msg.role}`}>
                    {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                  </div>
                  <div className="message-content">
                    {renderContent(msg.content)}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="message-sources">
                        {msg.sources.map((src, i) => (
                          <div key={i} className="source-badge">{src}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isQuerying && (
                <div className="message bot">
                  <div className="avatar bot"><Loader2 className="spinner" size={18} /></div>
                  <div className="message-content" style={{ display: 'flex', alignItems: 'center' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Analyzing documents...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        <div className="input-area">
          <textarea 
            className="input-box"
            placeholder={file ? "Ask a question about your document..." : "Upload a document first..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isQuerying || (!file && messages.length === 0)}
            rows={1}
          />
          <button 
            className="send-button"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isQuerying}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
