import { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';

const ZoomableCanvas = () => {
  const [subjects, setSubjects] = useState([]);
  const [allDots, setAllDots] = useState([]); // Store all dots from all subjects
  const [allLines, setAllLines] = useState({ hierarchical: [], connections: [] }); // Store all lines
  const [allPaths, setAllPaths] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null); // null = high-level view, otherwise the selected subject
  const [highLevelDots, setHighLevelDots] = useState([]); // Dots representing high-level subjects
  const [dots, setDots] = useState([]); // Currently visible dots (filtered by selectedSubject)
  const [lines, setLines] = useState({ hierarchical: [], connections: [] }); // Currently visible lines
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedDot, setSelectedDot] = useState(null);
  const [hoveredDot, setHoveredDot] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activePath, setActivePath] = useState(null);
  const [pathPosition, setPathPosition] = useState(0);
  const [showPathsModal, setShowPathsModal] = useState(true);
  const [pathDots, setPathDots] = useState([]);
  const [showFullContent, setShowFullContent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeModalTab, setActiveModalTab] = useState('overview'); // 'overview', 'chat', 'quiz'
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExitSubjectPrompt, setShowExitSubjectPrompt] = useState(false);

  // Fetch subjects from API
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/subjects');
        if (!response.ok) {
          throw new Error('Failed to fetch subjects');
        }
        const subjectsData = await response.json();
        setSubjects(subjectsData);
        
        // Process all subjects
        const canvasCenterX = window.innerWidth / 2;
        const canvasCenterY = window.innerHeight / 2;
        
        // Calculate cluster positions in a grid or circular layout
        const clusterSpacing = Math.min(window.innerWidth, window.innerHeight) * 0.6;
        const clusterAngleStep = (2 * Math.PI) / subjectsData.length;
        
        const allProcessedDots = [];
        const allHierarchicalLines = [];
        const allConnectionLines = [];
        const allPathsData = [];
        
        subjectsData.forEach((subject, subjectIndex) => {
          // Calculate cluster center offset
          const angle = subjectIndex * clusterAngleStep;
          const clusterOffsetX = Math.cos(angle) * clusterSpacing;
          const clusterOffsetY = Math.sin(angle) * clusterSpacing;
          
          // Function to evaluate position expressions with cluster offset
          const evaluatePosition = (expr, isX = true) => {
            // Replace centerX and centerY with actual values, then add cluster offset
            let baseValue;
            if (isX) {
              baseValue = eval(expr.replace('centerX', canvasCenterX).replace('centerY', canvasCenterY));
              // For the first subject, keep it centered; others get offset
              return subjectIndex === 0 ? baseValue : baseValue + clusterOffsetX;
            } else {
              baseValue = eval(expr.replace('centerX', canvasCenterX).replace('centerY', canvasCenterY));
              // For the first subject, keep it centered; others get offset
              return subjectIndex === 0 ? baseValue : baseValue + clusterOffsetY;
            }
          };

          // Process lines with subject-specific IDs (add prefix to avoid conflicts)
          const idPrefix = `${subject.slug}-`;
          
          // Function to process dots and their children
          const processDots = (dotsArray, parentId = null, level = 0, subjectId = subject._id) => {
            const processedDots = [];
            
            dotsArray.forEach(dot => {
              const processedDot = {
                ...dot,
                x: evaluatePosition(dot.x, true),
                y: evaluatePosition(dot.y, false),
                isParent: !!dot.children,
                level: level,
                parentId: parentId ? `${idPrefix}${parentId}` : null,
                subjectId: subjectId,
                subjectName: subject.name,
                subjectSlug: subject.slug
              };
              delete processedDot.children;
              processedDots.push(processedDot);

              // Recursively process children if they exist
              if (dot.children) {
                processedDots.push(...processDots(dot.children, dot.id, level + 1, subjectId));
              }
            });

            return processedDots;
          };
          
          // Process dots for this subject
          const subjectDots = processDots(subject.dots || []);
          
          // Update dot IDs to include prefix for line matching
          subjectDots.forEach(dot => {
            dot.originalId = dot.id;
            dot.id = `${idPrefix}${dot.id}`;
            // Also update parentId if it exists
            if (dot.parentId && !dot.parentId.startsWith(idPrefix)) {
              dot.parentId = `${idPrefix}${dot.parentId}`;
            }
          });
          
          allProcessedDots.push(...subjectDots);
          if (subject.lines?.hierarchical) {
            subject.lines.hierarchical.forEach(line => {
              allHierarchicalLines.push({
                ...line,
                source: `${idPrefix}${line.source}`,
                target: `${idPrefix}${line.target}`,
                subjectId: subject._id
              });
            });
          }
          if (subject.lines?.connections) {
            subject.lines.connections.forEach(line => {
              allConnectionLines.push({
                ...line,
                source: `${idPrefix}${line.source}`,
                target: `${idPrefix}${line.target}`,
                subjectId: subject._id
              });
            });
          }
          
          // Process paths
          if (subject.paths) {
            subject.paths.forEach(path => {
              allPathsData.push({
                ...path,
                subjectId: subject._id,
                subjectName: subject.name,
                dots: path.dots.map(dotId => `${idPrefix}${dotId}`)
              });
            });
          }
        });
        
        // Store all data
        setAllDots(allProcessedDots);
        setAllLines({
          hierarchical: allHierarchicalLines,
          connections: allConnectionLines
        });
        setAllPaths(allPathsData);
        
        // Create high-level subject dots
        const highLevelCenterX = window.innerWidth / 2;
        const highLevelCenterY = window.innerHeight / 2;
        const subjectSpacing = Math.min(window.innerWidth, window.innerHeight) * 0.3;
        const highLevelAngleStep = (2 * Math.PI) / subjectsData.length;
        
        const highLevelSubjectDots = subjectsData.map((subject, index) => {
          const angle = index * highLevelAngleStep;
          const x = highLevelCenterX + Math.cos(angle) * subjectSpacing;
          const y = highLevelCenterY + Math.sin(angle) * subjectSpacing;
          
          return {
            id: `subject-${subject.slug}`,
            originalId: subject._id,
            x: x,
            y: y,
            size: 8,
            text: subject.name,
            details: subject.description || `Explore ${subject.name}`,
            fullContent: subject.description || `Explore topics and concepts related to ${subject.name}`,
            color: `hsl(${(index * 360) / subjectsData.length}, 70%, 60%)`,
            isHighLevel: true,
            subjectId: subject._id,
            subjectName: subject.name,
            subjectSlug: subject.slug,
            parentId: null,
            isParent: true,
            level: 0
          };
        });
        
        setHighLevelDots(highLevelSubjectDots);
        
        // Initially show high-level view (no subject selected)
        setDots(highLevelSubjectDots);
        setLines({ hierarchical: [], connections: [] });
        setSelectedSubject(null);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        // Fallback to local data if API fails
        try {
          const dotsData = await import('./data/dots-with-coordinates.json');
          const fallbackCenterX = window.innerWidth / 2;
          const fallbackCenterY = window.innerHeight / 2;
          
          const evaluatePosition = (expr) => {
            return eval(expr.replace('centerX', fallbackCenterX).replace('centerY', fallbackCenterY));
          };

          const processDots = (dotsArray, parentId = null, level = 0) => {
            const allDots = [];
            dotsArray.forEach(dot => {
              const parentDot = {
                ...dot,
                x: evaluatePosition(dot.x),
                y: evaluatePosition(dot.y),
                isParent: !!dot.children,
                level: level,
                parentId: parentId
              };
              delete parentDot.children;
              allDots.push(parentDot);
              if (dot.children) {
                allDots.push(...processDots(dot.children, dot.id, level + 1));
              }
            });
            return allDots;
          };

          const processedDots = processDots(dotsData.default.dots);
          setAllDots(processedDots);
          setDots(processedDots);
          if (dotsData.default.lines) {
            setAllLines(dotsData.default.lines);
            setLines(dotsData.default.lines);
          }
          if (dotsData.default.paths) {
            setAllPaths(dotsData.default.paths);
          }
          
          // Create a single high-level dot for fallback
          const fallbackHighLevelX = window.innerWidth / 2;
          const fallbackHighLevelY = window.innerHeight / 2;
          setHighLevelDots([{
            id: 'subject-data-structures',
            x: fallbackHighLevelX,
            y: fallbackHighLevelY,
            size: 8,
            text: 'Data Structures',
            details: 'Explore Data Structures',
            fullContent: 'Explore topics and concepts related to Data Structures',
            color: 'hsl(270, 70%, 60%)',
            isHighLevel: true,
            parentId: null,
            isParent: true,
            level: 0
          }]);
          setSelectedSubject(null);
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  const handleWheel = (e) => {
    e.preventDefault();

    const zoomSensitivity = 0.001; // Adjust this value to control zoom speed
    const delta = e.deltaY;

    // Normalize delta based on deltaMode
    let zoomFactor = 1;
    if (e.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
      zoomFactor = 1 - delta * zoomSensitivity;
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      zoomFactor = 1 - delta * zoomSensitivity * 10;
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      zoomFactor = 1 - delta * zoomSensitivity * 100;
    }

    // Clamp zoomFactor to prevent extreme zooming
    zoomFactor = Math.max(0.95, Math.min(1.05, zoomFactor));

    setScale(prevScale => {
      const newScale = prevScale * zoomFactor;
      return Math.min(Math.max(0.1, newScale), 5);
    });
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - (offset.x * scale),
      y: e.clientY - (offset.y * scale)
    });
  };

  const handleMouseMove = (e) => {
    // Update mouse position for proximity labels
    setMousePosition({ x: e.clientX, y: e.clientY });
    
    if (isDragging) {
      setOffset({
        x: (e.clientX - dragStart.x) / scale,
        y: (e.clientY - dragStart.y) / scale
      });
    }
  };

  // Calculate opacity for proximity labels based on distance from cursor
  const getProximityOpacity = (dotX, dotY) => {
    const proximityRadius = 350; // pixels from cursor (increased for more coverage)
    const fadeStartRadius = 200; // start fading in at this distance
    
    // Convert dot position to screen coordinates
    const screenX = (dotX + offset.x) * scale;
    const screenY = (dotY + offset.y) * scale;
    
    // Calculate distance from mouse
    const dx = screenX - mousePosition.x;
    const dy = screenY - mousePosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If too far, don't show
    if (distance > proximityRadius) return 0;
    
    // If within fade start radius, calculate opacity
    if (distance > fadeStartRadius) {
      // Fade from 1 (at fadeStartRadius) to 0 (at proximityRadius)
      return 1 - ((distance - fadeStartRadius) / (proximityRadius - fadeStartRadius));
    }
    
    // If very close, full opacity
    return 1;
  };

  // Check if a dot is a subtopic of the hovered dot
  const isSubtopicOfHovered = (dot) => {
    if (!hoveredDot) return false;
    return dot.parentId === hoveredDot.id;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getNextPathDot = (currentDot) => {
    if (!activePath || !currentDot) return null;
    const currentIndex = pathDots.findIndex(dot => dot.id === currentDot.id);
    if (currentIndex < 0 || currentIndex >= pathDots.length - 1) return null;
    return pathDots[currentIndex + 1];
  };

  const handleDotClick = (dot) => {
    // If clicking on a high-level subject dot, zoom into that subject
    if (dot.isHighLevel) {
      const subject = subjects.find(s => s._id === dot.originalId || s.slug === dot.subjectSlug);
      if (subject) {
        // Filter dots and lines for this subject
        let subjectDots = allDots.filter(d => d.subjectId === subject._id);
        const subjectLines = {
          hierarchical: allLines.hierarchical.filter(l => l.subjectId === subject._id),
          connections: allLines.connections.filter(l => l.subjectId === subject._id)
        };
        
        // Calculate the center of the subject's dots
        if (subjectDots.length > 0) {
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          
          // Find the bounding box of all dots
          const minX = Math.min(...subjectDots.map(d => d.x));
          const maxX = Math.max(...subjectDots.map(d => d.x));
          const minY = Math.min(...subjectDots.map(d => d.y));
          const maxY = Math.max(...subjectDots.map(d => d.y));
          
          // Calculate the center of the subject's dots
          const subjectCenterX = (minX + maxX) / 2;
          const subjectCenterY = (minY + maxY) / 2;
          
          // Calculate offset needed to center the subject
          const offsetX = centerX - subjectCenterX;
          const offsetY = centerY - subjectCenterY;
          
          // Recenter all dots
          subjectDots = subjectDots.map(d => ({
            ...d,
            x: d.x + offsetX,
            y: d.y + offsetY
          }));
          
          // Recenter all lines by updating their source/target dot positions
          // (Lines reference dots by ID, so we just need to ensure dots are centered)
        }
        
        setDots(subjectDots);
        setLines(subjectLines);
        setSelectedSubject(subject);
        setShowExitSubjectPrompt(false);
        
        // Reset view and zoom to center
        setScale(1);
        setOffset({ x: 0, y: 0 });
        setSelectedDot(null);
        setActivePath(null);
        setPathDots([]);
        setPathPosition(0);
        
        // Reset chat when switching subjects
        setChatMessages([]);
        setActiveModalTab('overview');
        setSelectedVideoIndex(0);
        setShowVideoSelector(false);
        setQuizAnswers({});
        setShowQuizResults(false);
        return;
      }
    }
    
    // If we're in a path, check if the clicked dot is in the path
    if (activePath) {
      const dotIndex = pathDots.findIndex(pathDot => pathDot.id === dot.id);
      if (dotIndex !== -1) {
        setPathPosition(dotIndex);
      }
    }
    
    // Calculate zoom level - reduced multiplier for less aggressive zooming
    const targetSize = 6;
    const baseScale = targetSize / dot.size;
    // Use a smaller multiplier and cap the maximum zoom
    const newScale = Math.min(2.5, baseScale * 1.2); // Reduced from * 2 to * 1.2, max zoom of 2.5

    const newOffset = {
      x: window.innerWidth / 2 - dot.x,
      y: window.innerHeight / 2 - dot.y,
    };
    
        setOffset(newOffset);
        setScale(newScale);
        setSelectedDot(dot);
        setShowExitSubjectPrompt(false);
        
        // Reset chat when switching topics
        setChatMessages([]);
        setActiveModalTab('overview');
        setSelectedVideoIndex(0);
        setShowVideoSelector(false);
        setQuizAnswers({});
        setShowQuizResults(false);
  };

  const handleReset = () => {
    // If a topic is selected, reset to subject view (show all topics)
    if (selectedDot && selectedSubject) {
      setSelectedDot(null);
      setActivePath(null);
      setPathDots([]);
      setPathPosition(0);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setShowExitSubjectPrompt(false);
      return;
    }
    
    // If at subject view (no selectedDot but selectedSubject exists), show prompt
    if (selectedSubject && !selectedDot) {
      if (showExitSubjectPrompt) {
        // Second Esc press - go back to high-level view
        setDots(highLevelDots);
        setLines({ hierarchical: [], connections: [] });
        setSelectedSubject(null);
        setShowExitSubjectPrompt(false);
      } else {
        // First Esc press - show prompt
        setShowExitSubjectPrompt(true);
        // Auto-hide prompt after 3 seconds
        setTimeout(() => setShowExitSubjectPrompt(false), 3000);
      }
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    
    // Already at high level, just reset view
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setShowExitSubjectPrompt(false);
  };

  const startPath = (pathId) => {
    // Only allow paths for the currently selected subject
    if (!selectedSubject) return;
    
    const path = allPaths.find(p => p.id === pathId && p.subjectId === selectedSubject._id);
    if (path) {
      setActivePath(path);
      setPathPosition(0);
      
      // Create the ordered list of dots for this path
      const orderedPathDots = path.dots.map(dotId => 
        dots.find(d => d.id === dotId)
      ).filter(Boolean); // Remove any undefined entries
      
      setPathDots(orderedPathDots);
      
      // Select the first dot
      if (orderedPathDots.length > 0) {
        const firstDot = orderedPathDots[0];
        handleDotClick(firstDot);
      }
    }
  };

  const PathsModal = () => {
    return (
      <div className="fixed right-4 top-20 bg-white rounded-lg p-4 shadow-lg z-50 w-64">
        <h3 className="font-bold text-black mb-4 text-lg">Available Learning Paths</h3>
        
        {activePath ? (
          // Path Navigation View
          <div>
            <div className="mb-4">
              <h4 className="font-semibold text-gray-800 mb-2">{activePath.name}</h4>
              <button 
                onClick={() => setActivePath(null)} 
                className="w-full text-sm bg-red-100 hover:bg-red-200 text-red-700 flex items-center justify-center gap-1 py-2 rounded transition-colors"
              >
                <span>Exit Learning Path</span>
                <span className="text-red-500">(Esc)</span>
              </button>
            </div>
            
            <div className="space-y-2">
              {activePath.dots.map((dotId, index) => {
                const dot = dots.find(d => d.id === dotId);
                const isCurrentDot = selectedDot?.id === dotId;
                return (
                  <div 
                    key={dotId}
                    onClick={() => {
                      if (dot) {
                        setPathPosition(index);
                        handleDotClick(dot);
                      }
                    }}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      isCurrentDot 
                        ? 'bg-blue-100 border-2 border-blue-500' 
                        : index < pathPosition 
                        ? 'bg-gray-100 hover:bg-gray-200' 
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                        isCurrentDot 
                          ? 'bg-blue-100 text-blue-800' 
                          : index < pathPosition 
                          ? 'bg-gray-100 text-gray-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <span className={`text-sm ${
                        isCurrentDot 
                          ? 'text-blue-800 font-medium' 
                          : index < pathPosition 
                          ? 'text-gray-700' 
                          : 'text-gray-600'
                      }`}>
                        {dot?.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Path Selection View
          <div className="space-y-2">
            {selectedSubject ? (
              // Show paths for selected subject only
              allPaths
                .filter(path => path.subjectId === selectedSubject._id)
                .map(path => (
                  <button
                    key={path.id}
                    onClick={() => startPath(path.id)}
                    className="w-full p-3 text-left bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg transition-colors"
                  >
                    <div className="font-medium">{path.name}</div>
                    <div className="text-sm text-blue-600">
                      {path.dots.length} points
                    </div>
                  </button>
                ))
            ) : (
              // Show all subjects at high level
              <div className="text-sm text-gray-600">
                Select a subject to view learning paths
              </div>
            )}
          </div>
        )}
        
        <button 
          onClick={() => setShowPathsModal(false)}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center p-0"
        >
          ×
        </button>
      </div>
    );
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't handle shortcuts if we're in an input or textarea
      if (e.target.matches('input, textarea')) {
        return;
      }

      if (e.key === '/' && !e.target.matches('input')) {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="search"]');
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Handle 'b' key to go back to parent topic
      if ((e.key === 'b' || e.key === 'B') && !e.target.matches('input, textarea, [contenteditable]')) {
        if (selectedDot && selectedDot.parentId) {
          const parentDot = dots.find(dot => dot.id === selectedDot.parentId);
          if (parentDot) {
            e.preventDefault();
            handleDotClick(parentDot);
            return;
          }
        }
      }

      if (e.code === 'Escape') {
        // If in a path, exit the path
        if (activePath) {
          setActivePath(null);
          setShowFullContent(false);
          setShowExitSubjectPrompt(false);
          return;
        }
        
        // Close modal first
        if (showFullContent) {
          e.preventDefault();
          setShowFullContent(false);
          setChatMessages([]);
          setActiveModalTab('overview');
          setQuizAnswers({});
          setShowQuizResults(false);
          setShowExitSubjectPrompt(false);
          return;
        }
        
        // Handle Esc based on current view level
        e.preventDefault();
        handleReset();
        return;
      }

      // Handle Enter key for fullContent modal
      if (e.code === 'Enter' && selectedDot && !showFullContent) {
        e.preventDefault();
        setShowFullContent(true);
        return;
      }

      // Handle number keys (1-9) for navigating subtopics
      if (selectedDot && /^[1-9]$/.test(e.key)) {
        const subtopicIndex = parseInt(e.key) - 1;
        const subtopics = dots.filter(dot => dot.parentId === selectedDot.id);
        
        if (subtopics.length > 0 && subtopicIndex < subtopics.length) {
          e.preventDefault();
          const subtopic = subtopics[subtopicIndex];
          if (subtopic) {
            handleDotClick(subtopic);
          }
        }
        return;
      }

      // Handle letter keys (q, w, e, r, t, y, u, i, o) for navigating connected concepts
      if (selectedDot && /^[qwertyui]$/i.test(e.key)) {
        const letterIndex = 'qwertyui'.indexOf(e.key.toLowerCase());
        if (letterIndex !== -1) {
          const connectedConcepts = (() => {
            if (!lines.connections || lines.connections.length === 0) return [];
            return lines.connections
              .filter(line => line.source === selectedDot.id || line.target === selectedDot.id)
              .map(line => {
                const connectedId = line.source === selectedDot.id ? line.target : line.source;
                return dots.find(d => d.id === connectedId);
              })
              .filter(Boolean);
          })();
          
          if (connectedConcepts.length > 0 && letterIndex < connectedConcepts.length) {
            e.preventDefault();
            const connectedConcept = connectedConcepts[letterIndex];
            if (connectedConcept) {
              handleDotClick(connectedConcept);
            }
          }
        }
        return;
      }

      // Handle starting a path with right arrow
      if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && selectedDot && !activePath) {
        const pathToStart = allPaths.find(path => path.dots[0] === selectedDot.id);
        if (pathToStart) {
          startPath(pathToStart.id);
        }
        return;
      }

      // Existing path navigation logic
      if (!activePath || !selectedDot) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          // Navigate forward
          if (pathPosition < pathDots.length - 1) {
            const nextDot = pathDots[pathPosition + 1];
            setPathPosition(pathPosition + 1);
            if (nextDot) handleDotClick(nextDot);
          }
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          // Navigate backward
          if (pathPosition > 0) {
            const previousDot = pathDots[pathPosition - 1];
            setPathPosition(pathPosition - 1);
            if (previousDot) handleDotClick(previousDot);
          }
          break;
        case 'Escape':
          // Exit the path
          setActivePath(null);
          setPathDots([]);
          setPathPosition(0);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activePath, selectedDot, pathPosition, pathDots, allPaths, dots, handleDotClick, showFullContent, lines, selectedSubject, showExitSubjectPrompt, highLevelDots]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Search in current visible dots (either high-level or selected subject)
    const results = dots.filter(dot => 
      dot.text.toLowerCase().includes(query.toLowerCase()) ||
      dot.details?.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(results);
    setShowSearchResults(true);
  };

  // Generate contextual follow-up questions based on user's question
  const generateFollowUpSuggestions = (userQuestion) => {
    if (!selectedDot) return [];
    
    const topicName = selectedDot.text;
    const questionLower = userQuestion.toLowerCase();
    
    // Generate contextual follow-ups based on the question
    const suggestions = [];
    
    if (questionLower.includes('what') || questionLower.includes('explain')) {
      suggestions.push(`Can you give me a practical example of ${topicName}?`);
      suggestions.push(`What are the real-world applications of ${topicName}?`);
    } else if (questionLower.includes('how') || questionLower.includes('implement')) {
      suggestions.push(`What is the time complexity of ${topicName}?`);
      suggestions.push(`What are the advantages of using ${topicName}?`);
    } else if (questionLower.includes('when') || questionLower.includes('use')) {
      suggestions.push(`What are the disadvantages of ${topicName}?`);
      suggestions.push(`How does ${topicName} compare to similar structures?`);
    } else if (questionLower.includes('advantage') || questionLower.includes('benefit')) {
      suggestions.push(`What are the disadvantages of ${topicName}?`);
      suggestions.push(`When should I avoid using ${topicName}?`);
    } else {
      // Default suggestions
      suggestions.push(`Can you explain ${topicName} in more detail?`);
      suggestions.push(`What are common use cases for ${topicName}?`);
    }
    
    // Return 1-2 random suggestions
    return suggestions.slice(0, 2);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    const newMessage = {
      id: Date.now(),
      text: userMessage,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setChatMessages([...chatMessages, newMessage]);
    setChatInput('');

    // Simulate AI response (in real app, this would call an API)
    setTimeout(() => {
      const followUpSuggestions = generateFollowUpSuggestions(userMessage);
      const aiResponse = {
        id: Date.now() + 1,
        text: `This is a placeholder response about "${selectedDot?.text}". In a production app, this would connect to an AI service to provide intelligent answers about the topic.`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        followUpSuggestions: followUpSuggestions
      };
      setChatMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const handleQuestionClick = (question) => {
    setChatInput(question);
    // Auto-send the question
    const newMessage = {
      id: Date.now(),
      text: question,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setChatMessages([...chatMessages, newMessage]);
    setChatInput('');

    // Simulate AI response
    setTimeout(() => {
      const followUpSuggestions = generateFollowUpSuggestions(question);
      const aiResponse = {
        id: Date.now() + 1,
        text: `This is a placeholder response about "${selectedDot?.text}". In a production app, this would connect to an AI service to provide intelligent answers about the topic.`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        followUpSuggestions: followUpSuggestions
      };
      setChatMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const handleAddQuestionToChat = (questionText) => {
    // Switch to chat tab
    setActiveModalTab('chat');
    
    // Auto-send the question
    const newMessage = {
      id: Date.now(),
      text: questionText,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setChatMessages([...chatMessages, newMessage]);
    setChatInput('');

    // Simulate AI response
    setTimeout(() => {
      const followUpSuggestions = generateFollowUpSuggestions(questionText);
      const aiResponse = {
        id: Date.now() + 1,
        text: `This is a placeholder response about "${selectedDot?.text}". In a production app, this would connect to an AI service to provide intelligent answers about the topic.`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        followUpSuggestions: followUpSuggestions
      };
      setChatMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  // Generate follow-up questions based on the selected topic
  const getFollowUpQuestions = () => {
    if (!selectedDot) return [];
    
    const topicName = selectedDot.text;
    const baseQuestions = [
      `What is the time complexity of ${topicName}?`,
      `When should I use ${topicName}?`,
      `What are the main advantages of ${topicName}?`,
      `What are the disadvantages of ${topicName}?`,
      `How is ${topicName} implemented?`,
      `Can you give me an example of ${topicName}?`,
      `What are common use cases for ${topicName}?`,
      `How does ${topicName} compare to similar data structures?`
    ];

    // Add topic-specific questions if available
    if (selectedDot.isParent) {
      baseQuestions.unshift(`What are the different types of ${topicName}?`);
    }

    if (selectedDot.parentId) {
      const parentName = dots.find(d => d.id === selectedDot.parentId)?.text || 'parent';
      baseQuestions.unshift(`How does ${topicName} relate to ${parentName}?`);
    }

    return baseQuestions.slice(0, 6); // Show up to 6 questions
  };

  // Sample Q&A data (in real app, this would come from backend)
  const getQuizQuestions = () => {
    if (!selectedDot) return [];
    
    // Generate quiz questions based on the selected topic
    return [
      {
        id: 1,
        question: `What is the primary characteristic of ${selectedDot.text}?`,
        options: [
          selectedDot.details?.split('.')[0] || "A data structure that organizes data efficiently",
          "A sorting algorithm",
          "A search algorithm",
          "A programming language"
        ],
        correctAnswer: 0,
        explanation: selectedDot.details || "This is the main characteristic of this data structure."
      },
      {
        id: 2,
        question: `When would you typically use ${selectedDot.text}?`,
        options: [
          "When you need fast insertion and deletion",
          "When you need to store data in a specific order",
          "When you need to search for elements quickly",
          "All of the above"
        ],
        correctAnswer: 3,
        explanation: "The choice depends on your specific requirements and use case."
      },
      {
        id: 3,
        question: `What is a common application of ${selectedDot.text}?`,
        options: [
          "Web development",
          "Database indexing",
          "Game development",
          "All of the above"
        ],
        correctAnswer: 3,
        explanation: "This data structure has applications across many domains."
      }
    ];
  };

  const FeedbackModal = () => {
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = (e) => {
      e.preventDefault();
      const feedbackText = e.target.querySelector('textarea').value;
      const emailText = e.target.querySelector('input[type="email"]').value;
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      // Log the values being used
      
      emailjs.send(
        serviceId,
        templateId,
        { message: feedbackText, email: emailText },
        publicKey
      ).then(
        (result) => {
          console.log('Email sent successfully:', result.text);
          setIsSubmitted(true);
          setTimeout(() => {
            setShowFeedback(false);
            setIsSubmitted(false);
          }, 2000);
        },
        (error) => {
          console.error('Failed to send email:', error.text);
        }
      );
    };

    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowFeedback(false)} />
        <div className="relative bg-white rounded-lg p-6 max-w-md w-full m-4">
          <button 
            onClick={() => setShowFeedback(false)}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center p-0"
          >
            ×
          </button>
          {isSubmitted ? (
            <div className="text-center py-8">
              <h2 className="text-xl font-bold mb-2 text-green-600">Thank You!</h2>
              <p className="text-gray-600">Your feedback has been submitted.</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-4 text-gray-900">Send Feedback</h2>
              <form onSubmit={handleSubmit}>
                <textarea
                  className="w-full h-32 p-2 border rounded-lg mb-4 text-black placeholder-gray-400"
                  placeholder="Tell us what you think...we really appreciate it!"
                  required
                />
                <input
                  type="email"
                  className="w-full p-2 border rounded-lg mb-4 text-black placeholder-gray-400"
                  placeholder="Email (optional - for follow-up!)"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  Send Feedback
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-gray-900">
      {/* Add Search Bar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-64">
        <input
          type="search"
          placeholder="Learn about anything..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-4 py-2 bg-white rounded-lg shadow-lg text-black"
        />
        
        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute w-full mt-2 bg-white rounded-lg shadow-lg max-h-96 overflow-y-auto">
            {searchResults.map(dot => (
              <div
                key={dot.id}
                className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                onClick={() => {
                  handleDotClick(dot);
                  setShowSearchResults(false);
                  setSearchQuery('');
                }}
              >
                <div className="font-medium text-black">{dot.text}</div>
                {dot.details && (
                  <div className="text-sm text-gray-600 truncate">{dot.details}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedDot && (
        <div className="fixed left-4 top-1/2 -translate-y-1/2 w-80 rounded-lg shadow-lg p-6 z-50 max-h-[85vh] overflow-y-auto border border-[rgba(255,255,255,0.12)]" style={{
          background: '#1a1d29'
        }}>
          <button 
            onClick={() => setSelectedDot(null)}
            className="absolute top-2 right-2 text-gray-300 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center p-0 rounded-full bg-[#1f2329] hover:bg-[#2a2d3a] transition-all"
          >
            ×
          </button>
          <h2 className="text-xl font-bold mb-4 text-white">{selectedDot.text}</h2>
          <p className="text-gray-300 mb-4 text-sm">
            Position: ({selectedDot.x}, {selectedDot.y})
          </p>
          <div className="text-white mb-4">
            <h3 className="font-semibold mb-2">Description:</h3>
            <p className="text-gray-200">{selectedDot.text}</p>
          </div>
          <div className="text-white mb-4">
            <h3 className="font-semibold mb-2">Additional Details:</h3>
            <p className="text-gray-200">{selectedDot.details}</p>
            <button
              onClick={() => setShowFullContent(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 text-white font-semibold rounded-lg transition-all border border-[rgba(100,149,237,0.4)] hover:border-[rgba(100,149,237,0.6)]"
              style={{
                background: 'linear-gradient(135deg, rgba(100,149,237,0.2) 0%, rgba(100,149,237,0.1) 100%)'
              }}
            >
              <span>Expand this Topic</span>
              <span className="text-sm text-blue-300">(Enter)</span>
            </button>
          </div>
          
          {/* Show subtopics section only for parent dots */}
          {selectedDot && selectedDot.isParent && (
            <div className="text-white mb-4">
              <h3 className="font-semibold mb-2">Subtopics:</h3>
              <div className="space-y-2 max-h-70 overflow-y-auto">
                {dots
                  .filter(dot => dot.parentId === selectedDot.id)
                  .map((dot, index) => (
                    <div 
                      key={dot.id} 
                      className="p-2 rounded-lg cursor-pointer transition-all border border-[rgba(255,255,255,0.18)] hover:border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.08)] flex items-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)'
                      }}
                      onClick={() => handleDotClick(dot)}
                    >
                      <kbd className="px-1.5 py-0.5 rounded text-xs font-mono text-white min-w-[20px] text-center border border-[rgba(255,255,255,0.25)] font-bold" style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
                      }}>{index + 1}</kbd>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">{dot.text}</p>
                        <p className="text-sm text-gray-300 truncate">{dot.details}</p>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-2 text-xs text-gray-300 italic">
                Press <kbd className="px-1.5 py-0.5 rounded text-xs border border-[rgba(255,255,255,0.25)] text-white font-semibold" style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
                }}>1-{Math.min(dots.filter(dot => dot.parentId === selectedDot.id).length, 9)}</kbd> to navigate
              </div>
            </div>
          )}
          
          {/* Connected Concepts - get from lines data */}
          {selectedDot && lines.connections && lines.connections.length > 0 && (() => {
            const connectedConcepts = lines.connections
              .filter(line => line.source === selectedDot.id || line.target === selectedDot.id)
              .map(line => {
                const connectedId = line.source === selectedDot.id ? line.target : line.source;
                return dots.find(d => d.id === connectedId);
              })
              .filter(Boolean);
            
            if (connectedConcepts.length === 0) return null;
            
            const keybindLetters = 'qwertyui';
            
            return (
              <div className="text-white mb-4">
                <h3 className="font-semibold mb-2">Connected Concepts:</h3>
                <div className="space-y-2">
                  {connectedConcepts.map((connectedDot, index) => {
                    if (!connectedDot) return null;
                    const keybind = index < keybindLetters.length ? keybindLetters[index] : null;
                    return (
                      <div 
                        key={connectedDot.id}
                        className="p-2 rounded-lg cursor-pointer transition-all border border-[rgba(255,255,255,0.18)] hover:border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.08)] flex items-center gap-2"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)'
                        }}
                        onClick={() => handleDotClick(connectedDot)}
                      >
                        {keybind && (
                          <kbd className="px-1.5 py-0.5 rounded text-xs font-mono text-white min-w-[20px] text-center flex-shrink-0 border border-[rgba(255,255,255,0.25)] font-bold" style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
                          }}>{keybind}</kbd>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white">{connectedDot.text}</p>
                          <p className="text-sm text-gray-300 truncate">{connectedDot.details}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-gray-300 italic">
                  Press <kbd className="px-1.5 py-0.5 rounded text-xs border border-[rgba(255,255,255,0.25)] text-white font-semibold" style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
                  }}>q-{keybindLetters[Math.min(connectedConcepts.length - 1, keybindLetters.length - 1)]}</kbd> to navigate
                </div>
              </div>
            );
          })()}
          
          {/* Show "Back to [Parent Name]" button only for child dots */}
          {selectedDot && selectedDot.parentId && (
            <div className="mt-6">
              <button
                onClick={() => {
                  const parentDot = dots.find(dot => dot.id === selectedDot.parentId);
                  if (parentDot) {
                    // If we're in a path, check if parent is in the path
                    if (activePath) {
                      const parentIndex = pathDots.findIndex(dot => dot.id === parentDot.id);
                      if (parentIndex !== -1) {
                        setPathPosition(parentIndex);
                      }
                    }
                    handleDotClick(parentDot);
                  }
                }}
                className="w-full py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 border border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.2)] text-white"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                }}
              >
                <span>← Back to {dots.find(dot => dot.id === selectedDot.parentId)?.text || 'Parent'}</span>
                <span className="text-xs text-gray-400">(B)</span>
              </button>
            </div>
          )}
          
          {selectedDot && allPaths.some(path => path.dots[0] === selectedDot.id) && !activePath && (
            <button
              onClick={() => startPath(allPaths.find(path => path.dots[0] === selectedDot.id).id)}
              className="mt-4 w-full py-2 px-4 rounded-lg transition-colors border border-[rgba(255,255,255,0.2)] hover:border-[rgba(255,255,255,0.3)] text-white"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
              }}
            >
              Start Learning Path
            </button>
          )}

          {/* Add navigation buttons when in an active path */}
          {activePath && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  if (pathPosition > 0) {
                    const previousDot = dots.find(d => d.id === activePath.dots[pathPosition - 1]);
                    setPathPosition(pathPosition - 1);
                    if (previousDot) handleDotClick(previousDot);
                  }
                }}
                disabled={pathPosition === 0}
                className="flex-1 py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 border border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.2)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                }}
              >
                <span>Back</span>
                <span className="text-sm text-gray-400">(←)</span>
              </button>
              <button
                onClick={() => {
                  if (pathPosition < pathDots.length - 1) {
                    const nextDot = pathDots[pathPosition + 1];
                    setPathPosition(pathPosition + 1);
                    if (nextDot) handleDotClick(nextDot);
                  }
                }}
                disabled={pathPosition >= pathDots.length - 1}
                className="flex-1 py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 border border-[rgba(255,255,255,0.2)] hover:border-[rgba(255,255,255,0.3)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
                }}
              >
                <span>Next</span>
                <span className="text-sm text-gray-400">(→)</span>
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleReset}
        className="fixed top-4 right-4 px-4 py-2 bg-white rounded-md shadow-lg z-10 text-black flex items-center gap-2"
      >
        <span>
          {selectedDot && selectedSubject 
            ? 'Reset View' 
            : selectedSubject 
            ? 'Back to Subjects' 
            : 'Reset View'}
        </span>
        {!activePath && <span className="text-sm text-gray-500">(Esc)</span>}
      </button>
      
      {/* Exit Subject Confirmation Prompt */}
      {showExitSubjectPrompt && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md mx-4 pointer-events-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Exit Subject?</h3>
            <p className="text-gray-600 mb-4">
              Press <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Esc</kbd> again to go back to subject selection.
            </p>
            <button
              onClick={() => setShowExitSubjectPrompt(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowFeedback(true)}
        className="fixed bottom-4 right-4 px-4 py-2 bg-white rounded-md shadow-lg z-10 text-black"
      >
        Feedback
      </button>

      {loading && (
        <div className="fixed inset-0 bg-[#0a0e27] flex items-center justify-center z-50">
          <div className="text-white text-xl">Loading subjects...</div>
        </div>
      )}

      <div
        className="w-full h-full canvas-container"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="w-full h-full relative"
          style={{
            transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
            transition: isDragging ? 'none' : 'transform 0.5s ease-out',
            transformOrigin: 'center',
          }}
        >
          {/* Subject Title - Show when viewing a specific subject */}
          {selectedSubject && (
            <div
              className="absolute text-white text-lg font-bold pointer-events-none"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${1 / scale})`,
                opacity: Math.min(1, Math.max(0, (2.5 - scale) / 2)),
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
              }}
            >
              {selectedSubject.name}
            </div>
          )}
          
          {/* High-level view title */}
          {!selectedSubject && (
            <div
              className="absolute text-white text-xl font-bold pointer-events-none"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${1 / scale})`,
                opacity: Math.min(1, Math.max(0, (2.5 - scale) / 2)),
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
              }}
            >
              Select a Subject
            </div>
          )}

          {/* Connection Lines */}
          <svg 
            className="absolute pointer-events-none" 
            style={{
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible'
            }}
          >
            {/* Hierarchical Lines (Solid) - Parent to Child */}
            {lines.hierarchical?.map((line) => {
              const sourceDot = dots.find(d => d.id === line.source);
              const targetDot = dots.find(d => d.id === line.target);
              if (!sourceDot || !targetDot) return null;
              
              const isHighlighted = selectedDot?.id === line.source || selectedDot?.id === line.target;
              
              // Scale line width with zoom, with min/max limits
              const baseStrokeWidth = isHighlighted ? 3 : 2.5;
              const minStrokeWidth = 0.5;
              const maxStrokeWidth = 8;
              const scaledStrokeWidth = Math.max(minStrokeWidth, Math.min(maxStrokeWidth, baseStrokeWidth * scale));
              
              return (
                <line
                  key={`hierarchical-${line.source}-${line.target}`}
                  x1={sourceDot.x}
                  y1={sourceDot.y}
                  x2={targetDot.x}
                  y2={targetDot.y}
                  stroke={isHighlighted ? 'rgba(100, 200, 255, 0.9)' : 'rgba(150, 150, 200, 0.5)'}
                  strokeWidth={scaledStrokeWidth}
                  style={{
                    transition: 'stroke 0.3s ease-out, stroke-width 0.2s ease-out',
                  }}
                />
              );
            })}

            {/* Connection Lines (Dotted) - Related Concepts */}
            {lines.connections?.map((line) => {
              const sourceDot = dots.find(d => d.id === line.source);
              const targetDot = dots.find(d => d.id === line.target);
              if (!sourceDot || !targetDot) return null;
              
              const isHighlighted = selectedDot?.id === line.source || selectedDot?.id === line.target;
              
              // Scale line width with zoom, with min/max limits
              const baseStrokeWidth = 2;
              const minStrokeWidth = 0.5;
              const maxStrokeWidth = 6;
              const scaledStrokeWidth = Math.max(minStrokeWidth, Math.min(maxStrokeWidth, baseStrokeWidth * scale));
              
              // Scale dash array with zoom
              const dashLength = Math.max(4, Math.min(16, 8 * scale));
              const dashGap = Math.max(2, Math.min(8, 4 * scale));
              
              return (
                <line
                  key={`connection-${line.source}-${line.target}`}
                  x1={sourceDot.x}
                  y1={sourceDot.y}
                  x2={targetDot.x}
                  y2={targetDot.y}
                  stroke={isHighlighted ? 'rgba(100, 200, 255, 0.8)' : 'rgba(100, 150, 255, 0.3)'}
                  strokeWidth={scaledStrokeWidth}
                  strokeDasharray={`${dashLength} ${dashGap}`}
                  style={{
                    transition: 'stroke 0.3s ease-out, stroke-width 0.2s ease-out, stroke-dasharray 0.2s ease-out',
                  }}
                />
              );
            })}
          </svg>

          {dots.map((dot) => {
            const proximityOpacity = getProximityOpacity(dot.x, dot.y);
            const isSubtopic = isSubtopicOfHovered(dot);
            
            // Show proximity label if:
            // 1. Within proximity radius AND not hovering AND not dragging
            // 2. OR it's a subtopic of the currently hovered dot
            const showProximityLabel = (
              (proximityOpacity > 0 && !hoveredDot && !isDragging) ||
              (isSubtopic && !isDragging)
            ) && dot.id !== hoveredDot?.id; // Don't show label for the hovered dot itself
            
            // Use full opacity for subtopics, proximity-based for others
            const labelOpacity = isSubtopic ? 0.95 : proximityOpacity * 0.9;
            
            // Calculate dot size based on zoom level with min/max limits
            // Base size scales with zoom, but clamped between min and max
            const baseSize = dot.size * 6;
            const minSize = 4; // Minimum dot size in pixels
            const maxSize = 120; // Maximum dot size in pixels
            const scaledSize = Math.max(minSize, Math.min(maxSize, baseSize * scale));
            
            return (
              <div
                key={dot.id}
                className="absolute cursor-pointer"
                style={{
                  left: dot.x,
                  top: dot.y,
                  transform: `translate(-50%, -50%)`,
                  zIndex: Math.round(dot.size * 100),
                  pointerEvents: 'all',
                }}
                onClick={() => handleDotClick(dot)}
                onMouseEnter={() => setHoveredDot(dot)}
                onMouseLeave={() => setHoveredDot(null)}
              >
                {/* Proximity label - fades in as cursor gets closer */}
                {showProximityLabel && (
                  <div 
                    className="absolute text-white text-sm font-semibold pointer-events-none"
                    style={{
                      top: `${-scaledSize / 2 - 8}px`,
                      left: '50%',
                      transform: `translateX(-50%)`,
                      opacity: labelOpacity,
                      textShadow: '1px 1px 3px rgba(0, 0, 0, 0.8), 0 0 10px rgba(0, 0, 0, 0.5)',
                      whiteSpace: 'nowrap',
                      transition: 'opacity 0.2s ease-out, top 0.2s ease-out',
                      fontSize: `${Math.max(10, Math.min(16, 14 * scale))}px`,
                      color: isSubtopic ? '#E9D5FF' : '#FFFFFF', // Lighter purple tint for subtopics
                    }}
                  >
                    {dot.text}
                  </div>
                )}
                
                {/* Only show text for parent dots that are top-level (no parentId) */}
                {dot.isParent && !dot.parentId && scale < 1.5 && scale > 0.5 && !showProximityLabel && (
                  <div 
                    className="absolute text-white text-lg font-bold pointer-events-none"
                    style={{
                      top: `${-scaledSize / 2 - 10}px`,
                      left: '50%',
                      transform: `translateX(-50%)`,
                      opacity: Math.min(1, Math.max(0, (scale - 0.5) * 2)),
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
                      whiteSpace: 'nowrap',
                      transition: 'opacity 0.3s ease-out, top 0.3s ease-out',
                      fontSize: `${Math.max(12, Math.min(20, 18 * scale))}px`,
                    }}
                  >
                    {dot.text}
                  </div>
                )}
                
                <div 
                  className="rounded-full"
                  style={{
                    width: `${scaledSize}px`,
                    height: `${scaledSize}px`,
                    backgroundColor: dot.color,
                    transition: 'width 0.2s ease-out, height 0.2s ease-out, box-shadow 0.3s ease-out',
                    boxShadow: selectedDot?.id === dot.id 
                      ? `0 0 ${15 * scale}px ${5 * scale}px rgba(100, 200, 255, 0.6), 0 0 ${30 * scale}px ${10 * scale}px rgba(100, 200, 255, 0.4), 0 0 ${45 * scale}px ${15 * scale}px rgba(100, 200, 255, 0.2)`
                      : hoveredDot?.id === dot.id
                      ? `0 0 ${10 * scale}px ${3 * scale}px rgba(255, 255, 255, 0.8), 0 0 ${20 * scale}px ${6 * scale}px rgba(255, 255, 255, 0.4)`
                      : isSubtopic
                      ? `0 0 ${8 * scale}px ${2 * scale}px rgba(233, 213, 255, 0.6), 0 0 ${16 * scale}px ${4 * scale}px rgba(233, 213, 255, 0.3)`
                      : `0 ${2 * scale}px ${4 * scale}px rgba(0, 0, 0, 0.1)`,
                    pointerEvents: 'none',
                  }}
                />
                
                {/* Hover tooltip - only shows on direct hover */}
                {hoveredDot?.id === dot.id && (
                  <div className="absolute left-6 top-0 bg-white px-3 py-2 rounded-lg shadow-lg whitespace-nowrap text-black">
                    {dot.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!showPathsModal && (
        <button
          onClick={() => setShowPathsModal(true)}
          className="fixed right-4 top-20 bg-white rounded-lg p-2 shadow-lg z-50"
        >
          <span className="text-gray-800">Show Learning Paths</span>
        </button>
      )}

      {showPathsModal && <PathsModal />}

      {/* Full Content Modal */}
      {showFullContent && selectedDot && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => {
            setShowFullContent(false);
            setChatMessages([]);
            setActiveModalTab('overview');
            setQuizAnswers({});
            setShowQuizResults(false);
          }} />
          <div className="relative max-w-[1400px] w-full max-h-[90vh] flex flex-col overflow-hidden" style={{
            marginRight: 'calc(450px + 2rem)', // Account for chat modal width + spacing
            background: '#1a1d29',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 flex-shrink-0 border-b border-[rgba(255,255,255,0.12)]">
              <h2 className="text-3xl font-bold text-white tracking-tight">{selectedDot.text}</h2>
              <button 
                onClick={() => {
                  setShowFullContent(false);
                  setChatMessages([]);
                  setActiveModalTab('overview');
                  setQuizAnswers({});
                  setShowQuizResults(false);
                }}
                className="text-gray-300 hover:text-white text-2xl font-bold w-10 h-10 flex items-center justify-center transition-all rounded-full bg-[#1f2329] hover:bg-[#2a2d3a]"
              >
                ✕
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tab Navigation */}
                <div className="flex px-4 gap-1 flex-shrink-0 py-3 border-b border-[rgba(255,255,255,0.12)]">
                  <button
                    onClick={() => setActiveModalTab('overview')}
                    className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
                      activeModalTab === 'overview'
                        ? 'text-white border-b-2 border-white bg-[#2a2d3a]'
                        : 'text-[#6495ed] hover:text-white bg-[#1f2329] hover:bg-[#2a2d3a]'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveModalTab('quiz')}
                    className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
                      activeModalTab === 'quiz'
                        ? 'text-white border-b-2 border-white bg-[#2a2d3a]'
                        : 'text-[#6495ed] hover:text-white bg-[#1f2329] hover:bg-[#2a2d3a]'
                    }`}
                  >
                    Quiz
                  </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
              {/* Overview Tab */}
              {activeModalTab === 'overview' && (
                <div className="space-y-8">
                  {/* YouTube Video Section */}
                  <div className="p-6 rounded-lg border border-[rgba(255,255,255,0.12)]" style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
                  }}>
                    <h3 className="text-xl font-semibold mb-4 text-white">Video Tutorial</h3>
                    <div className="aspect-video bg-black flex items-center justify-center overflow-hidden rounded-lg border border-[rgba(255,255,255,0.12)] mb-4">
                      {(() => {
                        const availableVideos = selectedDot.videoUrls || (selectedDot.videoUrl ? [selectedDot.videoUrl] : []);
                        const currentVideo = availableVideos[selectedVideoIndex];
                        
                        return currentVideo ? (
                          <iframe
                            className="w-full h-full"
                            src={currentVideo}
                            title={`${selectedDot.text} Tutorial ${selectedVideoIndex + 1}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <div className="text-center text-gray-300 py-12">
                            <svg className="w-20 h-20 mx-auto mb-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                            </svg>
                            <p className="text-lg font-medium text-white">No video available for this topic</p>
                            <p className="text-sm mt-2 text-gray-300">Check back later for tutorials</p>
                          </div>
                        );
                      })()}
                    </div>
                    
                    {/* Video Selector */}
                    {(() => {
                      const availableVideos = selectedDot.videoUrls || (selectedDot.videoUrl ? [selectedDot.videoUrl] : []);
                      if (availableVideos.length <= 1) return null;
                      
                      return (
                        <div className="space-y-3">
                          <button
                            onClick={() => setShowVideoSelector(!showVideoSelector)}
                            className="w-full py-2.5 px-4 rounded-lg transition-all border border-[rgba(100,149,237,0.4)] hover:border-[rgba(100,149,237,0.6)] text-white font-semibold"
                            style={{
                              background: 'linear-gradient(135deg, rgba(100,149,237,0.2) 0%, rgba(100,149,237,0.1) 100%)'
                            }}
                          >
                            {showVideoSelector ? 'Hide Video Options' : 'Show another video'}
                          </button>
                          
                          {showVideoSelector && (
                            <div className="grid grid-cols-1 gap-2 p-3 rounded-lg border border-[rgba(255,255,255,0.12)]" style={{
                              background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                            }}>
                              {availableVideos.map((videoUrl, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    setSelectedVideoIndex(index);
                                    setShowVideoSelector(false);
                                  }}
                                  className={`w-full text-left p-3 rounded-lg transition-all border ${
                                    selectedVideoIndex === index
                                      ? 'border-[rgba(100,149,237,0.5)] bg-[rgba(100,149,237,0.15)]'
                                      : 'border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.03)]'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
                                      selectedVideoIndex === index
                                        ? 'bg-[#6495ed] text-white'
                                        : 'bg-[rgba(255,255,255,0.1)] text-gray-300'
                                    }`}>
                                      {index + 1}
                                    </div>
                                    <span className={`text-sm ${
                                      selectedVideoIndex === index ? 'text-white font-medium' : 'text-gray-300'
                                    }`}>
                                      Video Tutorial {index + 1}
                                    </span>
                                    {selectedVideoIndex === index && (
                                      <span className="ml-auto text-xs text-[#6495ed]">Currently playing</span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Summary Section */}
                  <div className="p-6 rounded-lg border border-[rgba(255,255,255,0.12)]" style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
                  }}>
                    <h3 className="text-xl font-semibold mb-4 text-white">Summary</h3>
                    <p className="text-gray-200 leading-relaxed text-base">
                      {selectedDot.details}
                    </p>
                  </div>

                  {/* Full Content Section */}
                  <div className="p-6 rounded-lg border border-[rgba(255,255,255,0.12)]" style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
                  }}>
                    <h3 className="text-xl font-semibold mb-4 text-white">Detailed Explanation</h3>
                    <p className="text-gray-200 leading-relaxed text-base whitespace-pre-wrap">
                      {selectedDot.fullContent || selectedDot.details}
                    </p>
                  </div>

                  {/* Implementations */}
                  {selectedDot.implementations && selectedDot.implementations.length > 0 && (
                    <div className="p-6 rounded-lg border border-[rgba(255,255,255,0.12)]" style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
                    }}>
                      <h3 className="text-xl font-semibold mb-4 text-white">Implementations</h3>
                      <ul className="space-y-2 text-gray-200">
                        {selectedDot.implementations.map((impl, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-white mr-3 mt-1 font-bold">▸</span>
                            <span className="text-base">{impl}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Relationships */}
                  {selectedDot.relationships && selectedDot.relationships.length > 0 && (
                    <div className="p-6 rounded-lg border border-[rgba(255,255,255,0.12)]" style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
                    }}>
                      <h3 className="text-xl font-semibold mb-4 text-white">Relationships</h3>
                      <ul className="space-y-2 text-gray-200">
                        {selectedDot.relationships.map((rel, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-white mr-3 mt-1 font-bold">▸</span>
                            <span className="text-base">{rel}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Subtopics */}
                  {selectedDot.isParent && (
                    <div className="p-6 rounded-lg border border-[rgba(255,255,255,0.08)]" style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)'
                    }}>
                      <h3 className="text-xl font-semibold mb-4 text-white">Subtopics</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {dots
                          .filter(dot => dot.parentId === selectedDot.id)
                          .map(dot => (
                            <div 
                              key={dot.id} 
                              className="p-4 rounded-lg border border-[rgba(255,255,255,0.12)] cursor-pointer transition-all hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.03)]"
                              style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                              }}
                              onClick={() => handleDotClick(dot)}
                            >
                              <p className="font-semibold text-white mb-2">{dot.text}</p>
                              <p className="text-sm text-gray-300 line-clamp-2">{dot.details}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quiz Tab */}
              {activeModalTab === 'quiz' && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-2xl font-semibold text-white mb-2">Test Your Knowledge</h3>
                    <p className="text-base text-gray-300">Answer questions about {selectedDot.text}</p>
                  </div>

                  {(() => {
                    const quizQuestions = getQuizQuestions();
                    
                    if (showQuizResults) {
                      const correctCount = quizQuestions.filter((q, idx) => quizAnswers[q.id] === q.correctAnswer).length;
                      const totalQuestions = quizQuestions.length;
                      const percentage = Math.round((correctCount / totalQuestions) * 100);
                      
                      return (
                        <div className="space-y-5">
                          <div className="p-6 rounded-lg border border-[rgba(255,255,255,0.12)] text-center" style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
                          }}>
                            <h3 className="text-2xl font-bold text-white mb-2">Quiz Results</h3>
                            <div className="text-4xl font-bold mb-4" style={{
                              color: percentage >= 70 ? '#4ade80' : percentage >= 50 ? '#fbbf24' : '#ef4444'
                            }}>
                              {percentage}%
                            </div>
                            <p className="text-gray-300 mb-4">
                              You got {correctCount} out of {totalQuestions} questions correct
                            </p>
                            <button
                              onClick={() => {
                                setShowQuizResults(false);
                                setQuizAnswers({});
                              }}
                              className="px-6 py-2.5 rounded-lg transition-all border border-[rgba(100,149,237,0.4)] hover:border-[rgba(100,149,237,0.6)] text-white font-semibold"
                              style={{
                                background: 'linear-gradient(135deg, rgba(100,149,237,0.2) 0%, rgba(100,149,237,0.1) 100%)'
                              }}
                            >
                              Retake Quiz
                            </button>
                          </div>
                          
                          {quizQuestions.map((question) => {
                            const userAnswer = quizAnswers[question.id];
                            const isCorrect = userAnswer === question.correctAnswer;
                            
                            return (
                              <div key={question.id} className="p-6 rounded-lg border border-[rgba(255,255,255,0.12)]" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
                              }}>
                                <div className="flex items-start gap-2 mb-4">
                                  <span className="text-white font-bold text-lg">Q{question.id}:</span>
                                  <h4 className="font-semibold text-white flex-1">{question.question}</h4>
                                </div>
                                
                                <div className="space-y-2 mb-4">
                                  {question.options.map((option, optIdx) => {
                                    const isSelected = userAnswer === optIdx;
                                    const isCorrectOption = optIdx === question.correctAnswer;
                                    
                                    return (
                                      <div
                                        key={optIdx}
                                        className={`p-3 rounded-lg border ${
                                          isCorrectOption
                                            ? 'border-green-500 bg-green-500/10'
                                            : isSelected && !isCorrect
                                            ? 'border-red-500 bg-red-500/10'
                                            : 'border-[rgba(255,255,255,0.12)]'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
                                            isCorrectOption
                                              ? 'bg-green-500 text-white'
                                              : isSelected && !isCorrect
                                              ? 'bg-red-500 text-white'
                                              : 'bg-[rgba(255,255,255,0.1)] text-gray-300'
                                          }`}>
                                            {String.fromCharCode(65 + optIdx)}
                                          </div>
                                          <span className={`text-sm flex-1 ${
                                            isCorrectOption ? 'text-green-300' : isSelected && !isCorrect ? 'text-red-300' : 'text-gray-300'
                                          }`}>
                                            {option}
                                          </span>
                                          {isCorrectOption && (
                                            <span className="text-green-400 text-xs font-semibold">✓ Correct</span>
                                          )}
                                          {isSelected && !isCorrect && (
                                            <span className="text-red-400 text-xs font-semibold">✗ Your answer</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                
                                <div className="mt-4 p-3 rounded-lg border border-[rgba(100,149,237,0.2)] bg-[rgba(100,149,237,0.05)]">
                                  <p className="text-sm text-gray-200 mb-3">
                                    <span className="font-semibold text-[#6495ed]">Explanation:</span> {question.explanation}
                                  </p>
                                  <button
                                    onClick={() => handleAddQuestionToChat(question.question)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all border border-[rgba(100,149,237,0.4)] hover:border-[rgba(100,149,237,0.6)] text-sm text-[#6495ed] hover:text-white"
                                    style={{
                                      background: 'linear-gradient(135deg, rgba(100,149,237,0.1) 0%, rgba(100,149,237,0.05) 100%)'
                                    }}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    Add to chat
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-5">
                        {quizQuestions.map((question) => {
                          const selectedAnswer = quizAnswers[question.id];
                          
                          return (
                            <div key={question.id} className="p-6 rounded-lg border border-[rgba(255,255,255,0.12)]" style={{
                              background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
                            }}>
                              <div className="flex items-start gap-2 mb-4">
                                <span className="text-white font-bold text-lg">Q{question.id}:</span>
                                <h4 className="font-semibold text-white flex-1">{question.question}</h4>
                              </div>
                              
                              <div className="space-y-2">
                                {question.options.map((option, optIdx) => (
                                  <button
                                    key={optIdx}
                                    onClick={() => {
                                      setQuizAnswers({
                                        ...quizAnswers,
                                        [question.id]: optIdx
                                      });
                                    }}
                                    className={`w-full text-left p-3 rounded-lg transition-all border ${
                                      selectedAnswer === optIdx
                                        ? 'border-[rgba(100,149,237,0.5)]'
                                        : 'border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.2)]'
                                    }`}
                                    style={selectedAnswer === optIdx ? {
                                      background: 'linear-gradient(135deg, rgba(100,149,237,0.15) 0%, rgba(100,149,237,0.08) 100%)'
                                    } : {
                                      background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                                    }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
                                        selectedAnswer === optIdx
                                          ? 'bg-[#6495ed] text-white'
                                          : 'bg-[rgba(255,255,255,0.08)] text-gray-200'
                                      }`}>
                                        {String.fromCharCode(65 + optIdx)}
                                      </div>
                                      <span className={`text-sm flex-1 ${
                                        selectedAnswer === optIdx ? 'text-white' : 'text-gray-200'
                                      }`}>
                                        {option}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        
                        <div className="flex justify-center pt-4">
                          <button
                            onClick={() => {
                              if (Object.keys(quizAnswers).length === quizQuestions.length) {
                                setShowQuizResults(true);
                              }
                            }}
                            disabled={Object.keys(quizAnswers).length !== quizQuestions.length}
                            className="px-8 py-3 rounded-lg transition-all border border-[rgba(100,149,237,0.4)] hover:border-[rgba(100,149,237,0.6)] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: 'linear-gradient(135deg, rgba(100,149,237,0.2) 0%, rgba(100,149,237,0.1) 100%)'
                            }}
                          >
                            Submit Quiz
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 flex-shrink-0 border-t border-[rgba(255,255,255,0.12)]">
              <div className="flex items-center gap-4 mb-3">
                {selectedDot.parentId && (
                  <button
                    onClick={() => {
                      const parentDot = dots.find(dot => dot.id === selectedDot.parentId);
                      if (parentDot) {
                        handleDotClick(parentDot);
                      }
                    }}
                    className="px-5 py-2.5 text-white transition-all text-sm font-semibold flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.2)]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                    }}
                  >
                    <span>← Back to {dots.find(dot => dot.id === selectedDot.parentId)?.text || 'Parent'}</span>
                    <kbd className="px-2 py-1 rounded text-xs font-semibold border border-[rgba(255,255,255,0.2)] text-white" style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%)'
                    }}>B</kbd>
                  </button>
                )}
                <div className="text-sm text-gray-300 flex items-center gap-2">
                  <span>Press</span>
                  <kbd className="px-3 py-1.5 rounded text-xs font-semibold border border-[rgba(255,255,255,0.2)] text-white" style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%)'
                  }}>Esc</kbd>
                  <span>to close</span>
                </div>
              </div>
              
              {/* Subtopic Navigation Keybinds */}
              {selectedDot && (() => {
                const subtopics = dots.filter(dot => dot.parentId === selectedDot.id);
                if (subtopics.length === 0) return null;
                
                return (
                  <div className="flex items-center gap-3 pt-3 border-t border-[rgba(255,255,255,0.12)]">
                    <span className="text-sm text-white font-semibold">Navigate subtopics:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {subtopics.slice(0, 9).map((subtopic, index) => (
                        <button
                          key={subtopic.id}
                          onClick={() => handleDotClick(subtopic)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.12)] transition-all text-xs font-semibold hover:border-[rgba(255,255,255,0.2)]"
                          style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                          }}
                        >
                          <kbd className="px-2 py-0.5 rounded text-xs font-mono font-bold border border-[rgba(255,255,255,0.2)] text-white" style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%)'
                          }}>{index + 1}</kbd>
                          <span className="text-white font-medium">{subtopic.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Separate Chat Modal */}
      {showFullContent && selectedDot && (
        <div className="fixed inset-y-0 right-0 z-50 p-4" style={{
          paddingRight: '1rem',
          paddingLeft: '1rem'
        }}>
          <div className="w-[450px] flex flex-col overflow-hidden ml-auto" style={{
            height: 'calc(100vh - 2rem)',
            background: '#1a1d29',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Chat Header */}
            <div className="px-6 py-5 flex-shrink-0 border-b border-[rgba(255,255,255,0.12)] flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">Ask Questions</h3>
                <p className="text-sm text-gray-300">Get instant answers about {selectedDot.text}</p>
              </div>
              <button 
                onClick={() => {
                  setChatMessages([]);
                }}
                className="text-gray-300 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center transition-all rounded-full bg-[#1f2329] hover:bg-[#2a2d3a]"
                title="Clear chat"
              >
                ↻
              </button>
            </div>
            
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col">
                  <div className="text-center mb-6">
                    <svg className="w-12 h-12 mx-auto mb-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm font-semibold text-white mb-1">Suggested Questions</p>
                    <p className="text-xs text-gray-300">Click a question to get started</p>
                  </div>
                  <div className="space-y-3 flex-1">
                    {getFollowUpQuestions().map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuestionClick(question)}
                        className="w-full text-left p-3 rounded-lg border border-[rgba(255,255,255,0.18)] transition-all text-sm text-gray-200 hover:border-[rgba(255,255,255,0.25)] hover:text-white"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)'
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 mt-0.5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                          <span className="flex-1 leading-relaxed">{question}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map(message => (
                    <div key={message.id}>
                      <div
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] px-4 py-3 rounded-lg border ${
                            message.sender === 'user'
                              ? 'text-white border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.08)]'
                              : 'text-gray-200 border-[rgba(255,255,255,0.12)]'
                          }`}
                          style={message.sender === 'user' ? {} : {
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%)'
                          }}
                        >
                          <p className="text-sm leading-relaxed">{message.text}</p>
                        </div>
                      </div>
                      {/* Show follow-up suggestions below AI messages */}
                      {message.sender === 'ai' && message.followUpSuggestions && message.followUpSuggestions.length > 0 && (
                        <div className="flex justify-start mt-2 ml-0">
                          <div className="flex flex-col gap-2 max-w-[85%]">
                            {message.followUpSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                onClick={() => handleQuestionClick(suggestion)}
                                className="text-left px-3 py-2 rounded-lg border border-[rgba(100,149,237,0.4)] transition-all text-xs text-[#6495ed] hover:border-[rgba(100,149,237,0.6)] hover:text-white hover:bg-[rgba(100,149,237,0.1)]"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(100,149,237,0.08) 0%, rgba(100,149,237,0.03) 100%)'
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 flex-shrink-0 border-t border-[rgba(255,255,255,0.12)]">
              <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question..."
                    className="w-full px-4 pr-12 py-3 rounded-lg border border-[rgba(255,255,255,0.12)] focus:outline-none focus:border-[rgba(255,255,255,0.2)] text-white text-sm placeholder-gray-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                    }}
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all text-white hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-[rgba(100,149,237,0.4)] hover:border-[rgba(100,149,237,0.6)]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(100,149,237,0.2) 0%, rgba(100,149,237,0.1) 100%)'
                    }}
                    disabled={!chatInput.trim()}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showFeedback && <FeedbackModal />}
    </div>
  );
};

export default ZoomableCanvas;