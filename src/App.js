import React, { useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter as Router, Link, Route, Routes } from "react-router-dom";

import Bin from "./components/Bin";
import Folders from "./components/Folders";
import Sandbox from "./components/Sandbox";

const THEME_STORAGE_KEY = "foto-ill-theme";

const getInitialTheme = () => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "day" || saved === "night") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
};

function App() {
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
  const [theme, setTheme] = useState(getInitialTheme);
  const [generateThumbsLoading, setGenerateThumbsLoading] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === "night" ? "day" : "night"));
  };

  const handleGenerateThumbs = async () => {
    try {
      setGenerateThumbsLoading(true)
      await fetch(`${API_BASE}/generate-thumbs`, { method: "POST"});
      setGenerateThumbsLoading(false)
    } catch (error) {
      console.error("Action failed:", error.message);
    }

  };

  return (
      <Router>
        <div>
          <nav className="app-nav">
            <Link to={`/root`}>Home</Link>
            <span className="sep">·</span>
            <Link to={`/bin`}>Bin</Link>
            <span className="sep">·</span>
            <Link to={`/sandbox/gp`}>Google Photos</Link>
            <span className="sep">·</span>
            <Link to={`/sandbox/liked`}>Liked</Link>
            <span className="sep">·</span>
            <Link to={`/sandbox/nomad`}>Nomad</Link>
            <span className="sep">·</span>
            <Link to={`/sandbox/book`}>Book</Link>

            <span className="sep">·</span>

            <button
                type="button"
                className={`generate-thumbs ${generateThumbsLoading ? 'loading' : ''}`}
                onClick={handleGenerateThumbs}
                disabled={generateThumbsLoading}
            >
              {generateThumbsLoading ? 'Generating...' : 'Generate Thumbs'}
            </button>

            <button type="button" className="theme-toggle" onClick={handleThemeToggle}>
              {theme === "night" ? "Day" : "Night"}
            </button>
          </nav>
          <div className="App">
            <Routes>
              <Route path="/root" element={<Folders />} />
              <Route path="/folders/:id" element={<Folders />} />
              <Route path="/bin" element={<Bin />} />
              <Route path="/sandbox/:id" element={<Sandbox />} />
            </Routes>
          </div>
        </div>
      </Router>
  );
}

export default App;
