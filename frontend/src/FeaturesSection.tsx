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

        {/* Professional Flexbox Architecture Flow */}
        <div className="arch-flow-container">
          <div className="arch-flow-tier">
            <div className="arch-node-modern">
              <div className="arch-icon-box" style={{ color: '#61dafb', background: 'rgba(97, 218, 251, 0.05)', border: 'none' }}>
                <Eye size={20} strokeWidth={1.5} />
              </div>
              <span className="arch-node-text">React UI</span>
            </div>
          </div>

          <div className="arch-flow-connector">
            <div className="arch-line-vertical"></div>
          </div>

          <div className="arch-flow-tier">
            <div className="arch-node-modern">
              <div className="arch-icon-box" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.05)', border: 'none' }}>
                <Zap size={20} strokeWidth={1.5} />
              </div>
              <span className="arch-node-text">FastAPI Backend</span>
            </div>
          </div>

          <div className="arch-flow-split">
            <div className="arch-flow-branch">
              <div className="arch-line-horizontal left-branch"></div>
              <div className="arch-line-vertical"></div>
              <div className="arch-node-modern">
                <div className="arch-icon-box" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.05)', border: 'none' }}>
                  <Database size={20} strokeWidth={1.5} />
                </div>
                <span className="arch-node-text">Qdrant Vector DB</span>
              </div>
            </div>

            <div className="arch-flow-branch">
              <div className="arch-line-vertical"></div>
              <div className="arch-node-modern">
                <div className="arch-icon-box" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.05)', border: 'none' }}>
                  <BrainCircuit size={20} strokeWidth={1.5} />
                </div>
                <span className="arch-node-text">Gemini LLM</span>
              </div>
            </div>

            <div className="arch-flow-branch">
              <div className="arch-line-horizontal right-branch"></div>
              <div className="arch-line-vertical"></div>
              <div className="arch-node-modern">
                <div className="arch-icon-box" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', border: 'none' }}>
                  <Network size={20} strokeWidth={1.5} />
                </div>
                <span className="arch-node-text">MySQL Graph DB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-card-step">STEP 01</div>
            <div className="feature-icon-wrapper premium-accent"><BrainCircuit size={20} strokeWidth={2} /></div>
            <h3>Agentic RAG (LangGraph)</h3>
            <p>A cyclic reasoning loop that intelligently decides when to search, trace connections, or directly answer your query.</p>
            <div className="feature-card-number">01</div>
          </div>
          
          <div className="feature-card">
            <div className="feature-card-step">STEP 02</div>
            <div className="feature-icon-wrapper premium-accent"><Network size={20} strokeWidth={2} /></div>
            <h3>Multi-Hop Knowledge Graph</h3>
            <p>Extracts a relational graph from your document into MySQL, making connections visually accessible and actionable.</p>
            <div className="feature-card-number">02</div>
          </div>
          
          <div className="feature-card">
            <div className="feature-card-step">STEP 03</div>
            <div className="feature-icon-wrapper premium-accent"><DatabaseZap size={20} strokeWidth={2} /></div>
            <h3>Recursive CTE Engine</h3>
            <p>AI utilizes advanced MySQL <code>WITH RECURSIVE</code> queries to deductively find paths between complex concepts.</p>
            <div className="feature-card-number">03</div>
          </div>
          
          <div className="feature-card">
            <div className="feature-card-step">STEP 04</div>
            <div className="feature-icon-wrapper premium-accent"><Search size={20} strokeWidth={2} /></div>
            <h3>Local Embeddings</h3>
            <p>Uses <code>sentence-transformers</code> locally. Zero API calls for embedding, and completely private vector search.</p>
            <div className="feature-card-number">04</div>
          </div>
          
          <div className="feature-card">
            <div className="feature-card-step">STEP 05</div>
            <div className="feature-icon-wrapper premium-accent"><Eye size={20} strokeWidth={2} /></div>
            <h3>Interactive Split-View</h3>
            <p>View the Knowledge Graph side-by-side with your chat. Drag nodes into the chat to trigger multi-hop queries instantly.</p>
            <div className="feature-card-number">05</div>
          </div>
          
          <div className="feature-card">
            <div className="feature-card-step">STEP 06</div>
            <div className="feature-icon-wrapper premium-accent"><Scan size={20} strokeWidth={2} /></div>
            <h3>Multimodal OCR</h3>
            <p>Supports seamless ingestion of PDFs and images, extracting text, tables, and charts via Google Gemini Vision.</p>
            <div className="feature-card-number">06</div>
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
