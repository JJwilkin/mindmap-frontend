import React from "react";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Graph from "./Graph";
import ZoomableGraph from "./Dots";
// import ZoomableGraph from "./Interactive";
import './App.css';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import LandingPage from './components/LandingPage';

function MainApp() {
  return (
    <div className="app-container">
      <Header />
      <div style={{ marginTop: '60px' }}>
        <ZoomableGraph/>
      </div>
      {/* <h1>Hello World</h1> */}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<MainApp />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
