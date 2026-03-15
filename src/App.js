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
          <div className="App">
            <p>
              <Link to={`/root`}>Home</Link>--|--
              <Link to={`/bin`}>Bin</Link>--|--
              <Link to={`/sandbox/gp`}>google</Link>--|--
              <Link to={`/sandbox/liked`}>liked</Link>--|--
              <Link to={`/sandbox/nomad`}>nomad</Link>
            </p>
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

