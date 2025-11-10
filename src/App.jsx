import React from "react";
import Graph from "./Graph";
import ZoomableGraph from "./Dots";
// import ZoomableGraph from "./Interactive";
import './App.css';

function App() {
  return (
    <div className="app-container">
      <ZoomableGraph/>
      {/* <h1>Hello World</h1> */}
    </div>
  );
}

export default App;
