import React from "react";
import Graph from "./Graph";
import ZoomableGraph from "./Dots";
// import ZoomableGraph from "./Interactive";
import './App.css';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';

function App() {
  return (
    <AuthProvider>
      <div className="app-container">
        <Header />
        <div style={{ marginTop: '60px' }}>
          <ZoomableGraph/>
        </div>
        {/* <h1>Hello World</h1> */}
      </div>
    </AuthProvider>
  );
}

export default App;
