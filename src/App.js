import React from 'react';
import './App.css';
import { BrowserRouter as Router, Link, Route, Routes } from "react-router-dom";

import Bin from "./components/Bin";
import Folders from "./components/Folders";
import Sandbox from "./components/Sandbox";


function App() {
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
