import React from 'react';
import { Database, BrainCircuit, Network, Zap, Eye, Scan, DatabaseZap, Search } from 'lucide-react';
import './features.css';

const FeaturesSection: React.FC = () => {
  return (
    <section className="features-section">
      <div className="features-container">
        <h2 className="section-title">Astro AI Architecture & Features</h2>
        <p className="section-subtitle">
          A powerful combination of local embeddings, cyclic LangGraph agents, and MySQL recursive CTEs.
        </p>

        {/* Architecture Diagram (CSS-based) */}
        <div className="architecture-diagram">
          <div className="arch-row">
            <div className="arch-node ui-node">
              <Eye className="arch-icon" />
              <span>React UI</span>
            </div>
          </div>
          <div className="arch-path vertical"></div>
          <div className="arch-row">
            <div className="arch-node api-node">
              <Zap className="arch-icon" />
              <span>FastAPI Backend</span>
            </div>
          </div>
          
          <div className="arch-branches">
            <div className="arch-branch">
              <div className="arch-path vertical branch-line"></div>
              <div className="arch-node db-node">
                <Database className="arch-icon" />
                <span>Qdrant (Local)</span>
              </div>
            </div>
            <div className="arch-branch center-branch">
              <div className="arch-path vertical branch-line"></div>
              <div className="arch-node ai-node">
                <BrainCircuit className="arch-icon" />
                <span>Gemini LLM</span>
              </div>
            </div>
            <div className="arch-branch">
              <div className="arch-path vertical branch-line"></div>
              <div className="arch-node db-node">
                <Network className="arch-icon" />
                <span>MySQL Graph</span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper ai-glow"><BrainCircuit size={22} /></div>
            <h3>Agentic RAG (LangGraph)</h3>
            <p>A cyclic reasoning loop that intelligently decides when to search, trace connections, or directly answer your query.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon-wrapper graph-glow"><Network size={22} /></div>
            <h3>Multi-Hop Knowledge Graph</h3>
            <p>Extracts a relational graph from your document into MySQL, making connections visually accessible and actionable.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon-wrapper db-glow"><DatabaseZap size={22} /></div>
            <h3>Recursive CTE Engine</h3>
            <p>AI utilizes advanced MySQL <code>WITH RECURSIVE</code> queries to deductively find paths between complex concepts.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon-wrapper local-glow"><Search size={22} /></div>
            <h3>Local Embeddings</h3>
            <p>Uses <code>sentence-transformers</code> locally. Zero API calls for embedding, and completely private vector search.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon-wrapper ui-glow"><Eye size={22} /></div>
            <h3>Interactive Split-View</h3>
            <p>View the Knowledge Graph side-by-side with your chat. Drag nodes into the chat to trigger multi-hop queries instantly.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon-wrapper scan-glow"><Scan size={22} /></div>
            <h3>Multimodal OCR</h3>
            <p>Supports seamless ingestion of PDFs and images, extracting text, tables, and charts via Google Gemini Vision.</p>
          </div>
        </div>
      </div>
      
      {/* Footer for the bottom of the scroll */}
      <footer className="features-footer">
        Astro AI Assistant &copy; {new Date().getFullYear()}
      </footer>
    </section>
  );
};

export default FeaturesSection;
