import React from 'react';
import { ChevronRight } from 'lucide-react';
import BlurText from './BlurText';

interface LandingProps {
  onStart: () => void;
}

const Landing: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="landing-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', textAlign: 'center' }}>
      {/* Background space effects */}
      <div className="starfield" />
      <div className="shooting-star" />
      <div className="glow-orb top-left" />
      <div className="glow-orb bottom-right" />

      {/* Main Content */}
      <main className="landing-main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 'auto' }}>
        <h1 className="landing-title">
          Welcome to <span className="gradient-text">Astro AI</span>
        </h1>
        
        <BlurText
          text="Your intelligent document assistant. Instantly extract insights and ask questions about your documents in one seamless experience."
          delay={50}
          animateBy="words"
          direction="top"
          className="landing-subtitle"
        />

        <button className="get-started-btn" onClick={onStart}>
          Get Started <ChevronRight size={16} />
        </button>
      </main>

      {/* Footer */}
      <footer className="landing-footer" style={{ position: 'absolute', bottom: '2rem', width: '100%', textAlign: 'center' }}>
        Powered by React, FastAPI, Qdrant & Gemini
      </footer>
    </div>
  );
};

export default Landing;
