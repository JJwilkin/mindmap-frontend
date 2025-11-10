import React, { useState } from 'react';
import { Minus, Plus, Move } from 'lucide-react';

const ZoomableGraph = () => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);

  // Define graph nodes with content
  const nodes = [
    {
      id: 1,
      x: 0,
      y: -120,
      shape: 'circle',
      color: '#3B82F6',
      title: 'Analytics',
      content: 'Real-time data processing and visualization pipeline'
    },
    {
      id: 2,
      x: -100,
      y: 0,
      shape: 'rect',
      color: '#10B981',
      title: 'Database',
      content: 'Distributed storage system with high availability'
    },
    {
      id: 3,
      x: 100,
      y: 0,
      shape: 'triangle',
      color: '#F59E0B',
      title: 'API',
      content: 'RESTful endpoints with OAuth authentication'
    },
    {
      id: 4,
      x: 0,
      y: 120,
      shape: 'star',
      color: '#EC4899',
      title: 'Frontend',
      content: 'React-based user interface with modern design'
    }
  ];

  const edges = [
    { from: 1, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 4 },
    { from: 3, to: 4 }
  ];

  const handleZoom = (factor) => {
    setScale(prev => Math.min(Math.max(0.1, prev * factor), 5));
  };

  const handleWheel = (e) => {
    if (!isDragging) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      handleZoom(factor);
    }
  };

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'svg' || e.target.classList.contains('drag-area')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node.id);
    setScale(2);
    setPosition({
      x: -node.x * 1,
      y: -node.y * 1
    });
  };

  const handleEdgeClick = (edge) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    
    if (selectedNode === edge.from) {
      handleNodeClick(toNode);
    } else if (selectedNode === edge.to) {
      handleNodeClick(fromNode);
    } else {
      handleNodeClick(fromNode);
    }
  };

  const renderShape = (node) => {
    const isSelected = selectedNode === node.id;
    const baseClassName = "transition-all duration-300 cursor-pointer";
    const className = isSelected 
      ? `${baseClassName} stroke-white stroke-2` 
      : `${baseClassName} hover:fill-opacity-80`;

    // Text content that appears when zoomed in
    const textContent = (
      <foreignObject
        x={node.x - 100}
        y={node.y - 50}
        width="200"
        height="100"
        style={{ 
          opacity: isSelected ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: isSelected ? 'auto' : 'none'
        }}
      >
        <div className="text-center">
          <h3 className="font-bold text-lg mb-2">{node.title}</h3>
          <p className="text-sm text-gray-600">{node.content}</p>
        </div>
      </foreignObject>
    );

    switch (node.shape) {
      case 'circle':
        return (
          <g onClick={() => handleNodeClick(node)}>
            <circle
              cx={node.x}
              cy={node.y}
              r="30"
              fill={isSelected ? 'white' : node.color}
              className={className}
            />
            {textContent}
          </g>
        );
      case 'rect':
        return (
          <g onClick={() => handleNodeClick(node)}>
            <rect
              x={node.x - 25}
              y={node.y - 25}
              width="50"
              height="50"
              fill={isSelected ? 'white' : node.color}
              className={className}
            />
            {textContent}
          </g>
        );
      case 'triangle':
        return (
          <g onClick={() => handleNodeClick(node)}>
            <polygon
              points={`${node.x},${node.y - 25} ${node.x + 29},${node.y + 25} ${node.x - 29},${node.y + 25}`}
              fill={isSelected ? 'white' : node.color}
              className={className}
            />
            {textContent}
          </g>
        );
      case 'star':
        return (
          <g onClick={() => handleNodeClick(node)}>
            <path
              d={`M${node.x},${node.y - 30} L${node.x + 8},${node.y - 8} L${node.x + 32},${node.y - 8} L${node.x + 13},${node.y + 6} L${node.x + 20},${node.y + 30} L${node.x},${node.y + 15} L${node.x - 20},${node.y + 30} L${node.x - 13},${node.y + 6} L${node.x - 32},${node.y - 8} L${node.x - 8},${node.y - 8} Z`}
              fill={isSelected ? 'white' : node.color}
              className={className}
            />
            {textContent}
          </g>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-screen bg-gray-100 relative overflow-hidden">
      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-lg z-10">
        <button
          onClick={() => {
            setScale(1);
            setPosition({ x: 0, y: 0 });
            setSelectedNode(null);
          }}
          className="p-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => handleZoom(1.1)}
          className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          <Plus size={20} />
        </button>
        <button
          onClick={() => handleZoom(0.9)}
          className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          <Minus size={20} />
        </button>
        <div className="p-2 bg-gray-200 rounded">
          <Move size={20} />
        </div>
      </div>

      <div
        className="w-full h-full cursor-move drag-area"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.3s ease-out'
          }}
          className="absolute top-1/2 left-1/2"
        >
          <svg width="400" height="400" viewBox="-200 -200 400 400" className="">
            <g className="">
              {edges.map((edge, index) => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                const isConnectedToSelected = selectedNode === edge.from || selectedNode === edge.to;
                
                return (
                  <g key={index}>
                    <line
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      stroke={isConnectedToSelected ? '#475569' : '#94A3B8'}
                      strokeWidth={isConnectedToSelected ? "3" : "2"}
                      className="opacity-60 hover:stroke-gray-400 hover:opacity-100 transition-all cursor-pointer"
                      onClick={() => handleEdgeClick(edge)}
                    />
                    <polygon
                      points="0,-3 6,0 0,3"
                      fill={isConnectedToSelected ? '#475569' : '#94A3B8'}
                      className="opacity-60 hover:opacity-100 transition-all"
                      transform={`translate(${(fromNode.x + toNode.x) / 2},${(fromNode.y + toNode.y) / 2}) 
                                 rotate(${Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) * 180 / Math.PI})`}
                      onClick={() => handleEdgeClick(edge)}
                    />
                  </g>
                );
              })}
            </g>
            
            <g className="">
              {nodes.map((node) => (
                <g key={node.id}>
                  {renderShape(node)}
                  {!selectedNode && (
                    <text
                      x={node.x}
                      y={node.y + 45}
                      textAnchor="middle"
                      fill="#475569"
                      className="text-sm select-none pointer-events-none"
                    >
                      {node.title}
                    </text>
                  )}
                </g>
              ))}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default ZoomableGraph;