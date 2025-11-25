import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Lottie from 'lottie-react';
import { getApiEndpoint } from './utils/api.js';
import { useAuth } from './context/AuthContext';
import LoginModal from './components/LoginModal';
import loadingAnimation from './assets/loading.json';

// Local testing mode - set to true to bypass API and use local JSON files
// You can also set VITE_USE_LOCAL_DATA=true in your .env file
const USE_LOCAL_DATA = import.meta.env.VITE_USE_LOCAL_DATA === 'true' || false;

const ZoomableCanvas = () => {
  const [subjects, setSubjects] = useState([]);
  const [allDots, setAllDots] = useState([]); // Store all dots from all subjects
  const [allLines, setAllLines] = useState({ hierarchical: [], connections: [] }); // Store all lines
  const [allPaths, setAllPaths] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null); // null = high-level view, otherwise the selected subject
  const [highLevelDots, setHighLevelDots] = useState([]); // Dots representing high-level subjects
  const [dots, setDots] = useState([]); // Currently visible dots (filtered by selectedSubject)
  const [lines, setLines] = useState({ hierarchical: [], connections: [] }); // Currently visible lines
  const [scale, setScale] = useState(0.85);
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
  const [isSearching, setIsSearching] = useState(false);
  const [pendingDotSelection, setPendingDotSelection] = useState(null); // For cross-subject navigation
  const pendingDotProcessed = useRef(false); // Track if we've already processed the pending dot
  const [showFeedback, setShowFeedback] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeModalTab, setActiveModalTab] = useState('overview'); // 'overview', 'chat', 'quiz'
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExitSubjectPrompt, setShowExitSubjectPrompt] = useState(false);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [zoomMousePosition, setZoomMousePosition] = useState(null);
  const [zoomTimeout, setZoomTimeout] = useState(null);
  
  // Chat width state with persistence
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = localStorage.getItem('chatWidth');
    return saved ? parseInt(saved, 10) : 450;
  });
  const [isResizingChat, setIsResizingChat] = useState(false);
  
  // Authentication
  const { user, getToken, justLoggedIn, clearJustLoggedIn } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Function to load local JSON data
  const loadLocalData = async () => {
    const dotsData = await import('./data/operating_systems_coordinates.json');
    const data = dotsData.default;
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

    const processedDots = processDots(data.dots);
    setAllDots(processedDots);
    setDots(processedDots);
    if (data.lines) {
      setAllLines(data.lines);
      setLines(data.lines);
    }
    if (data.paths) {
      setAllPaths(data.paths);
    }
    
    // Create a single high-level dot from JSON metadata
    const subjectName = data.name;
    const subjectSlug = data.slug;
    const subjectDescription = data.description || 'Explore data structures and algorithms concepts';
    
    const fallbackHighLevelX = window.innerWidth / 2;
    const fallbackHighLevelY = window.innerHeight / 2;
    
    const highLevelDot = {
      id: `subject-${subjectSlug}`,
      x: fallbackHighLevelX,
      y: fallbackHighLevelY,
      size: 8,
      text: subjectName,
      details: subjectDescription,
      fullContent: subjectDescription,
      color: 'hsl(200, 70%, 60%)',
      isHighLevel: true,
      parentId: null,
      isParent: true,
      level: 0
    };
    
    setHighLevelDots([highLevelDot]);
    
    // Initially show high-level view
    setDots([highLevelDot]);
    setLines({ hierarchical: [], connections: [] });
    setSelectedSubject(null);
  };

  // Cleanup zoom timeout on unmount
  useEffect(() => {
    return () => {
      if (zoomTimeout) {
        clearTimeout(zoomTimeout);
      }
    };
  }, [zoomTimeout]);

  // Handle chat resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingChat) return;
      
      // Calculate new width based on mouse position (right aligned, so width is window.innerWidth - mouseX)
      const newWidth = window.innerWidth - e.clientX;
      
      // Set limits (min 300px, max 800px or 80% of screen)
      const maxWidth = Math.min(800, window.innerWidth * 0.8);
      const constrainedWidth = Math.max(300, Math.min(maxWidth, newWidth));
      
      setChatWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      if (isResizingChat) {
        setIsResizingChat(false);
        localStorage.setItem('chatWidth', chatWidth);
      }
    };

    if (isResizingChat) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      // Add a class to body to force cursor style everywhere while dragging
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none'; // Prevent text selection
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingChat, chatWidth]);

  // Function to fetch and process subjects data
  const fetchSubjects = async () => {
      // Local testing mode - skip API call
      if (USE_LOCAL_DATA) {
        try {
          setLoading(true);
          console.log('🔧 Local testing mode: Loading data from local JSON files');
          await loadLocalData();
          setLoading(false);
          return;
        } catch (error) {
          console.error('Error loading local data:', error);
          setLoading(false);
          return;
        }
      }

      // Normal mode - fetch from API
      try {
        setLoading(true);
        const response = await fetch(getApiEndpoint('/api/subjects'));
        if (!response.ok) {
          throw new Error('Failed to fetch subjects');
        }
        const subjectsData = await response.json();
        console.log('📡 API Response - Subjects data:', subjectsData);
        console.log('📡 First subject:', subjectsData[0]);
        if (subjectsData[0]?.dots?.[0]) {
          console.log('📡 First dot of first subject:', subjectsData[0].dots[0]);
          console.log('📡 First dot x coordinate type:', typeof subjectsData[0].dots[0].x);
          console.log('📡 First dot x value:', subjectsData[0].dots[0].x);
        }
        setSubjects(subjectsData);
        
        // Check if dots have coordinates, if not generate them
        const subjectsWithCoords = subjectsData.map(subject => {
          // Check if first dot has coordinates
          const firstDot = subject.dots?.[0];
          const hasCoordinates = firstDot && (firstDot.x !== undefined || firstDot.x);
          
          if (!hasCoordinates && subject.dots) {
            console.warn(`Subject "${subject.name}" is missing coordinates. Consider generating them with generateCoordinates.js`);
            // For now, we'll handle this by evaluating expressions or using a fallback
            // In production, all subjects should have coordinates generated beforehand
          }
          
          return subject;
        });
        
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
            // If expr is already a number, return it with cluster offset
            if (typeof expr === 'number') {
              return subjectIndex === 0 ? expr : (isX ? expr + clusterOffsetX : expr + clusterOffsetY);
            }
            
            // If expr is a string, evaluate it
            if (typeof expr === 'string') {
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
            }
            
            console.warn(`⚠️ Unexpected coordinate type: ${typeof expr}`, expr);
            return 0; // Fallback to 0 if coordinate is invalid
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
        console.log('✅ Processed dots count:', allProcessedDots.length);
        console.log('✅ First 3 processed dots:', allProcessedDots.slice(0, 3));
        console.log('✅ Hierarchical lines:', allHierarchicalLines.length);
        console.log('✅ Connection lines:', allConnectionLines.length);
        
        setAllDots(allProcessedDots);
        setAllLines({
          hierarchical: allHierarchicalLines,
          connections: allConnectionLines
        });
        setAllPaths(allPathsData);
        
        // Create high-level subject dots
        const highLevelCenterX = window.innerWidth / 2;
        const highLevelCenterY = window.innerHeight / 2;
        // Increased spacing to spread dots further apart
        const subjectSpacing = Math.min(window.innerWidth, window.innerHeight) * 0.38; 
        const highLevelAngleStep = (2 * Math.PI) / subjectsData.length;
        
        const highLevelSubjectDots = subjectsData.map((subject, index) => {
          // If there's only one subject, center it. Otherwise use circular layout
          let x, y;
          if (subjectsData.length === 1) {
            x = highLevelCenterX;
            y = highLevelCenterY;
          } else {
            // Add -Math.PI/2 to start from top (12 o'clock) instead of right (3 o'clock)
            // or simply keep as is. The screenshot shows nice distribution.
            const angle = index * highLevelAngleStep - Math.PI / 2;
            x = highLevelCenterX + Math.cos(angle) * subjectSpacing;
            y = highLevelCenterY + Math.sin(angle) * subjectSpacing;
          }
          
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

        // Add central Computer Science text node (no dot)
        highLevelSubjectDots.push({
          id: 'cs-central-node',
          originalId: 'cs-central',
          x: highLevelCenterX,
          y: highLevelCenterY,
          size: 0, // Size 0 effectively hides the dot
          text: 'Computer Science',
          details: 'The study of computation, information, and automation.',
          fullContent: 'Computer science is the study of computation, information, and automation. Computer science spans theoretical disciplines (such as algorithms, theory of computation, and information theory) to applied disciplines (including the design and implementation of hardware and software).',
          color: 'transparent', // Transparent color
          isHighLevel: false,
          isParent: true,
          level: -1,
          isTextOnly: true // Flag to identify this as a text-only node
        });
        
        setHighLevelDots(highLevelSubjectDots);
        
        console.log('🎯 High-level dots created:', highLevelSubjectDots.length);
        console.log('🎯 High-level dots:', highLevelSubjectDots);
        
        // Initially show high-level view (no subject selected)
        setDots(highLevelSubjectDots);
        setLines({ hierarchical: [], connections: [] });
        setSelectedSubject(null);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        // Fallback to local data if API fails
        try {
          console.log('⚠️ API failed, falling back to local data');
          await loadLocalData();
          setLoading(false);
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        setLoading(false);
      }
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchSubjects();
  }, []);

  // Refetch subjects when user just logged in (OAuth redirect)
  useEffect(() => {
    if (justLoggedIn) {
      console.log('🔄 OAuth redirect detected, refetching subjects...');
      fetchSubjects();
      clearJustLoggedIn(); // Clear the flag so this only runs once
    }
  }, [justLoggedIn, clearJustLoggedIn]);

  const handleWheel = (e) => {
    e.preventDefault();

    const zoomSensitivity = 0.003; // Increased sensitivity for faster zooming
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
    zoomFactor = Math.max(0.9, Math.min(1.1, zoomFactor));

    // Capture initial mouse position when starting to zoom
    if (!zoomMousePosition) {
      setZoomMousePosition({ x: e.clientX, y: e.clientY });
    }

    // Clear existing timeout and set new one to reset zoom position
    if (zoomTimeout) {
      clearTimeout(zoomTimeout);
    }
    
    const newTimeout = setTimeout(() => {
      setZoomMousePosition(null);
    }, 200); // Reset after 200ms of no scrolling
    
    setZoomTimeout(newTimeout);

    setScale(prevScale => {
      const newScale = Math.min(Math.max(0.1, prevScale * zoomFactor), 5);
      
      const isZoomingIn = newScale > prevScale;
      
      // Only zoom towards mouse when zooming in, use center when zooming out
      if (isZoomingIn && zoomMousePosition) {
        // Use the initial mouse position for zooming in
        const mouseX = zoomMousePosition.x - window.innerWidth / 2;
        const mouseY = zoomMousePosition.y - window.innerHeight / 2;
        
        // Adjust offset to zoom towards initial mouse position
        setOffset(prevOffset => {
          // Calculate how much the mouse position shifts in world coordinates
          const dx = mouseX * (1 / newScale - 1 / prevScale);
          const dy = mouseY * (1 / newScale - 1 / prevScale);
          
          return {
            x: prevOffset.x + dx,
            y: prevOffset.y + dy
          };
        });
      }
      // When zooming out, don't adjust offset (zoom from center)
      
      return newScale;
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
    // Scale the proximity radius based on zoom level
    // When zoomed in (scale > 1), increase the radius
    // When zoomed out (scale < 1), decrease the radius
    const baseProximityRadius = 350;
    const baseFadeStartRadius = 200;
    
    const proximityRadius = baseProximityRadius * scale; // pixels from cursor (scaled with zoom)
    const fadeStartRadius = baseFadeStartRadius * scale; // start fading in at this distance (scaled with zoom)
    
    // Convert dot position to screen coordinates
    // Account for transform-origin: center by calculating the offset caused by scaling
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const screenX = (dotX + offset.x) * scale + centerX * (1 - scale);
    const screenY = (dotY + offset.y) * scale + centerY * (1 - scale);
    
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
    
    // Full opacity when close
    return 1;
  };

  // Proximity glow effect for dots - more performant than scaling
  const getProximityGlow = (dotX, dotY) => {
    // Convert dot position to screen coordinates
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const screenX = (dotX + offset.x) * scale + centerX * (1 - scale);
    const screenY = (dotY + offset.y) * scale + centerY * (1 - scale);
    
    // Calculate distance from mouse
    const dx = screenX - mousePosition.x;
    const dy = screenY - mousePosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Define glow radius (in screen pixels)
    const maxGlowRadius = 150 * scale; // Maximum distance for glow effect
    
    // If too far, no glow
    if (distance > maxGlowRadius) return 0;
    
    // Smooth interpolation for glow intensity (0 to 1)
    const normalizedDistance = distance / maxGlowRadius;
    const glowIntensity = 1 - Math.pow(normalizedDistance, 2);
    
    return glowIntensity;
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
      // Handle local data mode (no subjects array)
      if (USE_LOCAL_DATA || subjects.length === 0) {
        // In local mode, show all dots and lines
        setDots(allDots);
        setLines(allLines);
        setSelectedSubject({ 
          name: dot.text, 
          _id: dot.id,
          slug: 'data-structures' 
        });
        setShowExitSubjectPrompt(false);
        
        // Reset view and zoom to center
        setScale(0.85);
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
        setScale(0.85);
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
    
    // Keep zoom at default scale (1.0) or slightly zoomed in
    const newScale = 1.1; // Slight zoom in from default

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
      setScale(0.85);
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
      setScale(0.85);
      setOffset({ x: 0, y: 0 });
      return;
    }
    
    // Already at high level, just reset view
    setScale(0.85);
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
      <div className="fixed right-4 top-32 bg-white rounded-lg p-4 shadow-lg z-50 w-64">
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

  // Debounce search to avoid excessive API calls
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const debounceTimer = setTimeout(async () => {
      console.log('🔍 Searching for:', searchQuery);
      try {
        // Perform both MongoDB text search and semantic search in parallel
        const [mongoResults, semanticResults] = await Promise.allSettled([
          // MongoDB text search - fast, exact matches
          fetch(getApiEndpoint('/api/topics'))
            .then(res => res.ok ? res.json() : [])
            .then(allTopics => {
              const queryLower = searchQuery.toLowerCase();
              return allTopics
                .filter(topic => 
                  topic.title?.toLowerCase().includes(queryLower) ||
                  topic.details?.toLowerCase().includes(queryLower) ||
                  topic.fullContent?.toLowerCase().includes(queryLower)
                )
                .slice(0, 15) // Top 15 text matches
                .map(topic => ({
                  ...topic,
                  displayText: topic.title,
                  displaySubject: topic.subject,
                  displaySubjectSlug: topic.subjectSlug,
                  matchType: 'text'
                }));
            }),
          
          // Semantic search - intelligent, related topics
          fetch(getApiEndpoint('/api/search/semantic'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: searchQuery, limit: 10 })
          })
            .then(res => res.ok ? res.json() : [])
            .then(results => {
              if (!Array.isArray(results)) return [];
              return results.map(result => ({
                id: result.id,
                dotId: result.id?.split('-dot-')[1],
                title: result.metadata?.topic || result.metadata?.concept || '',
                displayText: result.metadata?.topic || result.metadata?.concept || '',
                displaySubject: result.metadata?.subject || '',
                displaySubjectSlug: result.metadata?.subjectSlug || '',
                details: result.text || '',
                matchType: 'semantic',
                score: result.score || 0
              }));
            })
        ]);

        // Combine results from both searches
        let combinedResults = [];
        
        // Add MongoDB results
        if (mongoResults.status === 'fulfilled' && Array.isArray(mongoResults.value)) {
          console.log('📄 MongoDB results:', mongoResults.value.length);
          combinedResults.push(...mongoResults.value);
        } else if (mongoResults.status === 'rejected') {
          console.warn('⚠️ MongoDB search failed:', mongoResults.reason);
        }
        
        // Add semantic results (avoiding duplicates)
        if (semanticResults.status === 'fulfilled' && Array.isArray(semanticResults.value)) {
          console.log('🤖 Semantic results:', semanticResults.value.length);
          const existingIds = new Set(combinedResults.map(r => r.id));
          const uniqueSemanticResults = semanticResults.value.filter(r => !existingIds.has(r.id));
          combinedResults.push(...uniqueSemanticResults);
        } else if (semanticResults.status === 'rejected') {
          console.warn('⚠️ Semantic search failed:', semanticResults.reason);
        }
        
        // If both failed or returned no results, fallback to local search
        if (combinedResults.length === 0) {
          console.warn('⚠️ Both API searches failed or returned no results, falling back to local search');
          const localResults = dots.filter(dot => 
            dot.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dot.details?.toLowerCase().includes(searchQuery.toLowerCase())
          );
          console.log('💻 Local search results:', localResults.length);
          combinedResults = localResults.map(dot => ({
            ...dot,
            displayText: dot.text,
            displaySubject: selectedSubject?.name || 'Current View',
            displaySubjectSlug: selectedSubject?.slug,
            matchType: 'local'
          }));
        }
        
        // Sort: semantic matches first (by score), then text matches
        combinedResults.sort((a, b) => {
          if (a.matchType === 'semantic' && b.matchType !== 'semantic') return -1;
          if (a.matchType !== 'semantic' && b.matchType === 'semantic') return 1;
          if (a.matchType === 'semantic' && b.matchType === 'semantic') {
            return (b.score || 0) - (a.score || 0);
          }
          return 0;
        });
        
        const finalResults = combinedResults.slice(0, 20); // Limit to top 20 total
        console.log('✅ Total results:', finalResults.length);
        setSearchResults(finalResults);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
        
        // Final fallback to local search
        const results = dots.filter(dot => 
          dot.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dot.details?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(results.map(dot => ({
          ...dot,
          displayText: dot.text,
          displaySubject: selectedSubject?.name || 'Current View',
          displaySubjectSlug: selectedSubject?.slug,
          matchType: 'local'
        })));
        setShowSearchResults(true);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, dots, selectedSubject]);

  // Navigate to a specific dot (handles cross-subject navigation)
  const navigateToDot = (dotIdOrResult) => {
    console.log('🧭 Navigating to dot:', dotIdOrResult);
    
    // Extract necessary info from the parameter
    let targetDotId, targetSubjectSlug, targetSubject;
    
    if (typeof dotIdOrResult === 'object') {
      // It's a search result object
      targetDotId = dotIdOrResult.dotId || dotIdOrResult.id;
      targetSubjectSlug = dotIdOrResult.displaySubjectSlug;
      targetSubject = subjects.find(s => s.slug === targetSubjectSlug);
    } else {
      // It's just a dot ID - try to find it in current dots first
      targetDotId = dotIdOrResult;
      const currentDot = dots.find(d => d.id === targetDotId);
      if (currentDot) {
        // Found in current view, just select it
        setSelectedDot(currentDot);
        setActiveModalTab('overview');
        return;
      }
      
      // Not in current view, search all dots
      const dotInAllDots = allDots.find(d => d.id === targetDotId || d.originalId === targetDotId);
      if (dotInAllDots) {
        targetSubjectSlug = dotInAllDots.subjectSlug;
        targetSubject = subjects.find(s => s.slug === targetSubjectSlug);
      }
    }
    
    // Check if we need to switch subjects
    const needsSubjectSwitch = targetSubjectSlug && targetSubjectSlug !== selectedSubject?.slug;
    
    if (needsSubjectSwitch && targetSubject) {
      console.log('🔄 Switching to subject:', targetSubject.name);
      
      // Set pending dot selection BEFORE switching subjects
      pendingDotProcessed.current = false;
      setPendingDotSelection(targetDotId);
      
      // Find and click the high-level subject dot to switch subjects
      const highLevelDot = highLevelDots.find(d => d.subjectSlug === targetSubjectSlug);
      if (highLevelDot) {
        handleDotClick(highLevelDot);
      }
    } else {
      // Same subject or no subject info, try to find the dot
      const targetDot = dots.find(d => {
        const dotId = typeof targetDotId === 'string' ? parseInt(targetDotId, 10) : targetDotId;
        return d.id === dotId || d.id === targetDotId || d.originalId === targetDotId;
      });
      
      if (targetDot) {
        console.log('✅ Found dot:', targetDot.text);
        setSelectedDot(targetDot);
        setActiveModalTab('overview');
      } else {
        console.warn('⚠️ Could not find dot:', targetDotId);
      }
    }
  };

  // Handle pending dot selection after subject change (for cross-subject navigation)
  useEffect(() => {
    // Only process if we have a pending selection, dots are loaded, and we haven't already processed it
    if (pendingDotSelection && dots.length > 0 && selectedSubject && !pendingDotProcessed.current) {
      console.log('🎯 Looking for pending dot:', pendingDotSelection);
      console.log('🎯 Current dots count:', dots.length);
      console.log('🎯 Sample dot IDs:', dots.slice(0, 3).map(d => ({ id: d.id, originalId: d.originalId, text: d.text })));
      
      // Mark as being processed to prevent infinite loops
      pendingDotProcessed.current = true;
      
      // Try to find the dot by ID (check multiple ID formats)
      // The dot ID might be: original numeric ID, string ID, or prefixed ID
      const targetDot = dots.find(d => {
        // Check if IDs match directly
        if (d.id === pendingDotSelection) return true;
        
        // Check originalId (non-prefixed ID)
        if (d.originalId === pendingDotSelection) return true;
        
        // Check if the prefixed ID ends with the pending selection
        // e.g., "operating-systems-123" ends with "123"
        if (typeof d.id === 'string' && typeof pendingDotSelection === 'string') {
          const idSuffix = d.id.split('-').pop();
          if (idSuffix === pendingDotSelection) return true;
        }
        
        // Try numeric comparison
        const pendingAsNumber = typeof pendingDotSelection === 'string' ? parseInt(pendingDotSelection, 10) : pendingDotSelection;
        const originalIdAsNumber = typeof d.originalId === 'string' ? parseInt(d.originalId, 10) : d.originalId;
        if (!isNaN(pendingAsNumber) && !isNaN(originalIdAsNumber) && pendingAsNumber === originalIdAsNumber) return true;
        
        return false;
      });
      
      if (targetDot) {
        console.log('✅ Found dot:', targetDot.text, 'with ID:', targetDot.id);
        // Clear pending selection and reset flag
        setPendingDotSelection(null);
        pendingDotProcessed.current = false;
        
        // Open the dot modal
        setSelectedDot(targetDot);
        setActiveModalTab('overview');
        
        // Center the dot on screen with a slight zoom
        const newScale = 1.1;
        const newOffset = {
          x: window.innerWidth / 2 - targetDot.x,
          y: window.innerHeight / 2 - targetDot.y,
        };
        setOffset(newOffset);
        setScale(newScale);
      } else {
        console.warn('⚠️ Dot not found:', pendingDotSelection);
        console.warn('⚠️ Available dot IDs:', dots.slice(0, 5).map(d => d.id));
        // Clear and reset
        setPendingDotSelection(null);
        pendingDotProcessed.current = false;
      }
    }
    
    // Reset the flag when pendingDotSelection is cleared
    if (!pendingDotSelection) {
      pendingDotProcessed.current = false;
    }
  }, [pendingDotSelection, dots, selectedSubject]);

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

  const sendChatMessage = async (question, currentMessages) => {
    if (!selectedDot) return;

    setIsChatLoading(true);
    
    try {
      // Prepare conversation history from the messages passed in
      // Exclude the last message (which is the current question we're about to send)
      const conversationHistory = currentMessages.slice(0, -1).map(msg => ({
        sender: msg.sender,
        text: msg.text
      }));

      const token = getToken();
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add Authorization header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Include only the transcript for the currently selected video
      const allTranscripts = selectedDot.transcripts || [];
      const currentTranscript = allTranscripts[selectedVideoIndex];
      const transcripts = currentTranscript ? [currentTranscript] : [];
      
      const response = await fetch(getApiEndpoint('/api/chat'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          topic: selectedDot.text,
          question: question,
          conversationHistory: conversationHistory,
          transcripts: transcripts
        })
      });

      if (response.status === 401) {
        // User is not authenticated
        setShowLoginModal(true);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to get response from chat API');
      }

      const data = await response.json();
      const followUpSuggestions = (data.followUpSuggestions && data.followUpSuggestions.length > 0) 
        ? data.followUpSuggestions 
        : generateFollowUpSuggestions(question);
      
      const aiResponse = {
        id: Date.now() + 1,
        text: data.response || 'Sorry, I could not generate a response.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        followUpSuggestions: followUpSuggestions,
        hasVideoContext: data.hasVideoContext || false
      };
      
      setChatMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error sending chat message:', error);
      const errorResponse = {
        id: Date.now() + 1,
        text: 'Sorry, there was an error getting a response. Please try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        followUpSuggestions: []
      };
      setChatMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    // Check authentication
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const userMessage = chatInput.trim();
    const newMessage = {
      id: Date.now(),
      text: userMessage,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...chatMessages, newMessage];
    setChatMessages(updatedMessages);
    setChatInput('');

    await sendChatMessage(userMessage, updatedMessages);
  };

  const handleQuestionClick = async (question) => {
    if (isChatLoading) return;
    
    // Check authentication
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    
    setChatInput(question);
    // Auto-send the question
    const newMessage = {
      id: Date.now(),
      text: question,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...chatMessages, newMessage];
    setChatMessages(updatedMessages);
    setChatInput('');

    await sendChatMessage(question, updatedMessages);
  };

  const handleAddQuestionToChat = async (questionText) => {
    if (isChatLoading) return;
    
    // Check authentication
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    
    // Switch to chat tab
    setActiveModalTab('chat');
    
    // Auto-send the question
    const newMessage = {
      id: Date.now(),
      text: questionText,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...chatMessages, newMessage];
    setChatMessages(updatedMessages);
    setChatInput('');

    await sendChatMessage(questionText, updatedMessages);
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      setError(null);
      
      const feedbackText = e.target.querySelector('textarea').value;
      const emailText = e.target.querySelector('input[type="email"]').value;
      
      try {
        const apiEndpoint = getApiEndpoint('/api/feedback');
        const token = getToken();
        
        const headers = {
          'Content-Type': 'application/json',
        };
        
        // Add auth token if user is logged in
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: feedbackText,
            email: emailText || undefined,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to submit feedback');
        }
        
        const data = await response.json();
        console.log('Feedback submitted successfully:', data);
        
        setIsSubmitted(true);
        setTimeout(() => {
          setShowFeedback(false);
          setIsSubmitted(false);
        }, 2000);
      } catch (error) {
        console.error('Error submitting feedback:', error);
        setError('Failed to submit feedback. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
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
                  className="w-full h-32 p-2 border rounded-lg mb-4 bg-white text-black placeholder-gray-400"
                  placeholder="Tell us what you think...we really appreciate it!"
                  required
                  disabled={isSubmitting}
                />
                <input
                  type="email"
                  className="w-full p-2 border rounded-lg mb-4 bg-white text-black placeholder-gray-400"
                  placeholder="Email (optional - for follow-up!)"
                  disabled={isSubmitting}
                />
                {error && (
                  <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Send Feedback'}
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
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
        {/* Search Results Dropdown - moved above input */}
        {showSearchResults && (
          <div className="absolute w-full left-0 px-4 mb-4 bottom-full">
            <div className="bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl max-h-96 overflow-y-auto">
              {searchResults.length > 0 ? (
                <>
                  {/* Show section headers for combined results */}
                  {searchResults.some(r => r.matchType === 'text') && searchResults.some(r => r.matchType === 'semantic') && (
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                      <p className="text-xs text-gray-600 font-medium">
                        Showing exact matches and AI-suggested related topics
                      </p>
                    </div>
                  )}
                  {searchResults.map((result, index) => {
                    // Check if this is the first semantic result after text results
                    const showDivider = index > 0 && 
                      result.matchType === 'semantic' && 
                      searchResults[index - 1].matchType === 'text';
                    
                    return (
                      <div key={result.id}>
                        {showDivider && (
                          <div className="px-4 py-2 bg-purple-50 border-y border-purple-100">
                            <p className="text-xs text-purple-700 font-medium flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                              </svg>
                              Related topics (AI-powered)
                            </p>
                          </div>
                        )}
                        <div
                        className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                    onClick={() => {
                      // Close search UI
                      setShowSearchResults(false);
                      setSearchQuery('');
                      
                      // Use the new navigation function
                      navigateToDot(result);
                    }}
                  >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900 text-lg">{result.displayText || result.text || result.title}</div>
                        {result.matchType === 'semantic' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700" title="AI-powered semantic match">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      {result.details && (
                        <div className="text-sm text-gray-500 truncate mt-1">{result.details}</div>
                      )}
                    </div>
                    {result.displaySubject && (
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {result.displaySubject}
                        </span>
                      </div>
                    )}
                  </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm">No topics found matching "{searchQuery}"</p>
                  <p className="text-xs mt-1">Try different keywords or check spelling</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-xl overflow-hidden">
            <div 
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
              }}
            ></div>
            <div className="relative">
              <input
                type="search"
                placeholder="Search across all topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="relative w-full px-8 py-5 pr-12 bg-gradient-to-r from-blue-50/90 via-purple-50/90 to-pink-50/90 hover:from-blue-50 hover:via-purple-50 hover:to-pink-50 transition-colors bg-opacity-80 backdrop-blur-md border border-white/20 text-gray-900 placeholder-gray-500 text-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 rounded-2xl"
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedDot && (
        <div className="fixed inset-y-0 left-0 z-50 flex items-center" style={{
          paddingLeft: '1rem',
          paddingTop: '76px'
        }}>
          <div className="flex flex-col overflow-hidden" style={{
            width: '320px',
            height: 'calc(100vh - 76px - 2rem)',
            background: '#1a1d29',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            padding: '24px',
            position: 'relative'
          }}>
            <button 
              onClick={() => setSelectedDot(null)}
              className="absolute top-2 right-2 text-gray-300 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center p-0 rounded-full bg-[#1f2329] hover:bg-[#2a2d3a] transition-all z-10"
            >
              ×
            </button>
            <div className="overflow-y-auto flex-1">
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
          </div>
        </div>
      )}

      <button
        onClick={handleReset}
        className="fixed top-20 right-4 px-4 py-2 bg-white rounded-md shadow-lg z-10 text-black flex items-center gap-2"
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

      <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2 z-10">
        <button
          onClick={() => setShowFeedback(true)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-md shadow-lg text-white font-medium"
        >
          Feedback
        </button>
        <span className="text-xs text-white bg-gray-800 bg-opacity-80 px-2 py-1 rounded">
          We're still in alpha! All feedback is appreciated!
        </span>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-[#0a0e27] flex items-center justify-center z-50">
          <Lottie 
            animationData={loadingAnimation} 
            loop={true}
            style={{ width: 500, height: 500 }}
          />
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
              className="absolute text-white font-bold pointer-events-none"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%)`,
                fontSize: `${18 / scale}px`,
                opacity: Math.min(1, Math.max(0, (2.5 - scale) / 2)),
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
              }}
            >
              {selectedSubject.name}
            </div>
          )}
          
          {/* High-level view title - REMOVED as it overlaps with search bar */}
          {/* {!selectedSubject && highLevelDots.length > 1 && (
            <div
              className="absolute text-white font-bold pointer-events-none"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%)`,
                fontSize: `${20 / scale}px`,
                opacity: Math.min(1, Math.max(0, (2.5 - scale) / 2)),
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
              }}
            >
              Select a Subject
            </div>
          )} */}

          {/* Connection Lines */}
          <svg 
            className="absolute" 
            style={{
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none'
            }}
          >
            {/* Hierarchical Lines (Solid) - Parent to Child */}
            {lines.hierarchical?.map((line) => {
              const sourceDot = dots.find(d => d.id === line.source);
              const targetDot = dots.find(d => d.id === line.target);
              if (!sourceDot || !targetDot) return null;
              
              const isConnectedToHoveredDot = hoveredDot && (line.source === hoveredDot.id || line.target === hoveredDot.id);
              const isHighlighted = selectedDot?.id === line.source || selectedDot?.id === line.target;
              
              // Keep line width consistent regardless of zoom
              const baseStrokeWidth = (isConnectedToHoveredDot || isHighlighted) ? 3 : 2.5;
              const minStrokeWidth = 0.5;
              const maxStrokeWidth = 8;
              const scaledStrokeWidth = Math.max(minStrokeWidth, Math.min(maxStrokeWidth, baseStrokeWidth / scale));
              
              return (
                <line
                  key={`hierarchical-${line.source}-${line.target}`}
                  x1={sourceDot.x}
                  y1={sourceDot.y}
                  x2={targetDot.x}
                  y2={targetDot.y}
                  stroke={
                    isConnectedToHoveredDot ? 'rgba(100, 200, 255, 0.95)' :
                    isHighlighted ? 'rgba(100, 200, 255, 0.9)' : 
                    'rgba(150, 150, 200, 0.5)'
                  }
                  strokeWidth={scaledStrokeWidth}
                  style={{
                    transition: 'stroke 0.3s ease-out, stroke-width 0.2s ease-out',
                  }}
                />
              );
            })}

            {/* Connection Lines (Dotted) - Related Concepts */}
            {lines.connections?.filter(line => {
              // If a dot is selected, only show connections directly related to it
              if (selectedDot) {
                return line.source === selectedDot.id || line.target === selectedDot.id;
              }
              // If no dot is selected, show all connections
              return true;
            }).map((line) => {
              const sourceDot = dots.find(d => d.id === line.source);
              const targetDot = dots.find(d => d.id === line.target);
              if (!sourceDot || !targetDot) return null;
              
              const lineKey = `${line.source}-${line.target}`;
              const isLineHovered = hoveredLine === lineKey;
              const isConnectedToHoveredDot = hoveredDot && (line.source === hoveredDot.id || line.target === hoveredDot.id);
              const isHighlighted = selectedDot?.id === line.source || selectedDot?.id === line.target;
              
              // Keep line width consistent regardless of zoom
              const baseStrokeWidth = (isLineHovered || isConnectedToHoveredDot) ? 3 : 2;
              const minStrokeWidth = 0.5;
              const maxStrokeWidth = 8;
              const scaledStrokeWidth = Math.max(minStrokeWidth, Math.min(maxStrokeWidth, baseStrokeWidth / scale));
              
              // Keep dash pattern consistent with zoom
              const dashLength = Math.max(4, Math.min(16, 8 / scale));
              const dashGap = Math.max(2, Math.min(8, 4 / scale));
              
              // Determine which dot to navigate to when line is clicked
              const targetDotToNavigate = selectedDot?.id === line.source ? targetDot : sourceDot;
              
              return (
                <g key={`connection-${lineKey}`}>
                  {/* Invisible thicker line for easier clicking */}
                  <line
                    x1={sourceDot.x}
                    y1={sourceDot.y}
                    x2={targetDot.x}
                    y2={targetDot.y}
                    stroke="transparent"
                    strokeWidth={Math.max(10 / scale, scaledStrokeWidth * 5)}
                    style={{
                      pointerEvents: selectedDot ? 'stroke' : 'none',
                      cursor: selectedDot ? 'pointer' : 'default',
                    }}
                    onMouseEnter={() => {
                      if (selectedDot) {
                        setHoveredLine(lineKey);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredLine(null);
                    }}
                    onClick={(e) => {
                      if (selectedDot) {
                        e.stopPropagation();
                        handleDotClick(targetDotToNavigate);
                      }
                    }}
                  />
                  {/* Visible line */}
                  <line
                    x1={sourceDot.x}
                    y1={sourceDot.y}
                    x2={targetDot.x}
                    y2={targetDot.y}
                    stroke={
                      isLineHovered ? 'rgba(100, 200, 255, 1)' : 
                      isConnectedToHoveredDot ? 'rgba(100, 200, 255, 0.9)' :
                      isHighlighted ? 'rgba(100, 200, 255, 0.8)' : 
                      'rgba(100, 150, 255, 0.3)'
                    }
                    strokeWidth={scaledStrokeWidth}
                    strokeDasharray={`${dashLength} ${dashGap}`}
                    style={{
                      transition: 'stroke 0.3s ease-out, stroke-width 0.2s ease-out, stroke-dasharray 0.2s ease-out',
                      pointerEvents: 'none',
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {(() => {
            console.log('🎨 Rendering dots. Count:', dots.length);
            if (dots.length > 0) {
              console.log('🎨 First dot to render:', dots[0]);
              console.log('🎨 First dot coordinates:', { x: dots[0].x, y: dots[0].y });
            }
            return null;
          })()}

          {dots.map((dot) => {
            const proximityOpacity = getProximityOpacity(dot.x, dot.y);
            const proximityGlow = getProximityGlow(dot.x, dot.y);
            const isSubtopic = isSubtopicOfHovered(dot);
            const isHovered = hoveredDot?.id === dot.id;
            
            // For high-level subjects (no selectedSubject), don't use proximity labels
            // Unless it's the central text-only node
            const isHighLevelSubject = !selectedSubject && !dot.parentId && !dot.isTextOnly;
            const isCentralTextNode = !selectedSubject && dot.isTextOnly;
            
            // Show proximity label if:
            // 1. NOT a high-level subject AND (within proximity radius OR subtopic OR hovered)
            const showProximityLabel = !isHighLevelSubject && !isCentralTextNode && (
              proximityOpacity > 0 ||
              isSubtopic ||
              isHovered
            );
            
            // Use full opacity for hovered dot and subtopics, proximity-based for others
            const labelOpacity = isHovered ? 1 : isSubtopic ? 0.95 : proximityOpacity * 0.9;
            
            // Calculate dot size without proximity scaling - much more performant
            const baseSize = dot.size * 6;
            const minSize = 4; // Minimum dot size in pixels
            const maxSize = 120; // Maximum dot size in pixels
            const scaledSize = Math.max(minSize, Math.min(maxSize, baseSize / scale));
            
            return (
              <div
                key={dot.id}
                className="absolute cursor-pointer"
                style={{
                  left: dot.x,
                  top: dot.y,
                  transform: `translate(-50%, -50%)`,
                  zIndex: isCentralTextNode ? 50 : Math.round(dot.size * 100), // Lower z-index for central text so dots can float over if needed
                  pointerEvents: 'all',
                }}
                onClick={() => handleDotClick(dot)}
                onMouseEnter={() => setHoveredDot(dot)}
                onMouseLeave={() => setHoveredDot(null)}
              >
                {/* Central Text Node - Big, static text */}
                {isCentralTextNode && (
                  <div 
                    className="absolute text-white font-bold pointer-events-none text-center"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) scale(${isHovered ? 1.05 : 1})`,
                      opacity: 1,
                      textShadow: '0 0 30px rgba(255, 255, 255, 0.2)',
                      whiteSpace: 'nowrap',
                      transition: 'transform 0.3s ease-out',
                      fontSize: `${Math.max(24, Math.min(48, 36 / scale))}px`, // Much larger font size
                      color: '#ffffff',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {dot.text}
                  </div>
                )}

                {/* Proximity label - fades in as cursor gets closer (only for non-high-level subjects) */}
                {showProximityLabel && (
                  <div 
                    className="absolute text-white font-semibold pointer-events-none"
                    style={{
                      top: `${-scaledSize / 2 - (isHovered ? 12 : 8)}px`,
                      left: '50%',
                      transform: `translateX(-50%) scale(${isHovered ? 1.2 : 1})`,
                      opacity: labelOpacity,
                      textShadow: isHovered 
                        ? '2px 2px 4px rgba(0, 0, 0, 0.9), 0 0 15px rgba(0, 0, 0, 0.6)' 
                        : '1px 1px 3px rgba(0, 0, 0, 0.8), 0 0 10px rgba(0, 0, 0, 0.5)',
                      whiteSpace: 'nowrap',
                      transition: 'opacity 0.2s ease-out, top 0.2s ease-out, transform 0.2s ease-out, font-size 0.2s ease-out',
                      fontSize: `${Math.max(10, Math.min(16, 14 / scale))}px`,
                      color: isSubtopic ? '#E9D5FF' : '#FFFFFF', // Lighter purple tint for subtopics
                    }}
                  >
                    {dot.text}
                  </div>
                )}
                
                {/* Static labels for high-level subjects - always visible, no proximity effects */}
                {isHighLevelSubject && (
                  <div 
                    className="absolute text-white font-bold pointer-events-none"
                    style={{
                      top: `${-scaledSize / 2 - (isHovered ? 25 : 20)}px`, // Increased distance from dot
                      left: '50%',
                      transform: `translateX(-50%) scale(${isHovered ? 1.15 : 1})`,
                      opacity: 1,
                      textShadow: isHovered 
                        ? '2px 2px 6px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 255, 255, 0.5), 0 0 30px rgba(255, 255, 255, 0.3)' 
                        : '2px 2px 4px rgba(0, 0, 0, 0.7)',
                      whiteSpace: 'nowrap',
                      transition: 'transform 0.2s ease-out, top 0.2s ease-out, text-shadow 0.2s ease-out',
                      fontSize: `${Math.max(12, Math.min(18, 15 / scale))}px`,
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
                    background: `
                      radial-gradient(circle at 30% 30%, 
                        rgba(255, 255, 255, 0.3) 0%, 
                        transparent 50%
                      ),
                      radial-gradient(circle at 50% 50%, 
                        ${dot.color} 0%, 
                        ${dot.color} 60%,
                        color-mix(in srgb, ${dot.color} 70%, black) 100%
                      )
                    `,
                    transform: isHighLevelSubject && isHovered ? 'scale(1.1)' : 'scale(1)',
                    transition: 'width 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease-out, transform 0.2s ease-out',
                    boxShadow: selectedDot?.id === dot.id 
                      ? `
                        inset 0 ${-2 / scale}px ${4 / scale}px rgba(0, 0, 0, 0.3),
                        inset 0 ${2 / scale}px ${3 / scale}px rgba(255, 255, 255, 0.2),
                        0 ${4 / scale}px ${8 / scale}px rgba(0, 0, 0, 0.4),
                        0 0 ${15 / scale}px ${5 / scale}px rgba(100, 200, 255, 0.6), 
                        0 0 ${30 / scale}px ${10 / scale}px rgba(100, 200, 255, 0.4), 
                        0 0 ${45 / scale}px ${15 / scale}px rgba(100, 200, 255, 0.2)
                      `
                      : hoveredDot?.id === dot.id
                      ? `
                        inset 0 ${-2 / scale}px ${4 / scale}px rgba(0, 0, 0, 0.3),
                        inset 0 ${2 / scale}px ${3 / scale}px rgba(255, 255, 255, 0.2),
                        0 ${4 / scale}px ${8 / scale}px rgba(0, 0, 0, 0.4),
                        0 0 ${10 / scale}px ${3 / scale}px rgba(255, 255, 255, 0.8), 
                        0 0 ${20 / scale}px ${6 / scale}px rgba(255, 255, 255, 0.4)
                      `
                      : isSubtopic
                      ? `
                        inset 0 ${-2 / scale}px ${4 / scale}px rgba(0, 0, 0, 0.3),
                        inset 0 ${2 / scale}px ${3 / scale}px rgba(255, 255, 255, 0.2),
                        0 ${4 / scale}px ${8 / scale}px rgba(0, 0, 0, 0.4),
                        0 0 ${8 / scale}px ${2 / scale}px rgba(233, 213, 255, 0.6), 
                        0 0 ${16 / scale}px ${4 / scale}px rgba(233, 213, 255, 0.3)
                      `
                      : proximityGlow > 0
                      ? `
                        inset 0 ${-2 / scale}px ${4 / scale}px rgba(0, 0, 0, 0.3),
                        inset 0 ${2 / scale}px ${3 / scale}px rgba(255, 255, 255, 0.2),
                        0 ${4 / scale}px ${8 / scale}px rgba(0, 0, 0, 0.4),
                        0 0 ${8 / scale}px ${3 / scale}px rgba(255, 255, 255, ${proximityGlow * 0.6}), 
                        0 0 ${16 / scale}px ${6 / scale}px rgba(255, 255, 255, ${proximityGlow * 0.3})
                      `
                      : `
                        inset 0 ${-2 / scale}px ${4 / scale}px rgba(0, 0, 0, 0.3),
                        inset 0 ${2 / scale}px ${3 / scale}px rgba(255, 255, 255, 0.2),
                        0 ${4 / scale}px ${8 / scale}px rgba(0, 0, 0, 0.4)
                      `,
                    pointerEvents: 'none',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {!showPathsModal && (
        <button
          onClick={() => setShowPathsModal(true)}
          className="fixed right-4 top-32 bg-white rounded-lg p-2 shadow-lg z-50"
        >
          <span className="text-gray-800">Show Learning Paths</span>
        </button>
      )}

      {showPathsModal && <PathsModal />}

      {/* Line Hover Tooltip */}
      {hoveredLine && selectedDot && (() => {
        const [source, target] = hoveredLine.split('-');
        const targetDot = dots.find(d => d.id === (selectedDot.id === source ? target : source));
        if (!targetDot) return null;
        
        return (
          <div 
            className="fixed pointer-events-none z-50"
            style={{
              left: mousePosition.x + 15,
              top: mousePosition.y + 15,
            }}
          >
            <div className="bg-white px-3 py-2 rounded-lg shadow-lg whitespace-nowrap text-black border border-gray-200">
              <span className="text-sm">Navigate to <span className="font-semibold">{targetDot.text}</span></span>
            </div>
          </div>
        );
      })()}

      {/* Full Content Modal */}
      {showFullContent && selectedDot && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => {
            setShowFullContent(false);
            setChatMessages([]);
            setActiveModalTab('overview');
            setQuizAnswers({});
            setShowQuizResults(false);
          }} />
          <div className="absolute flex flex-col overflow-hidden" style={{
            top: 'calc(76px + 1rem)',
            left: '1rem',
            right: `calc(${chatWidth}px + 2rem)`,
            height: 'calc(100vh - 76px - 2rem)',
            maxWidth: '1400px',
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
                  {/* YouTube Video Section - Only show if videos are available */}
                  {(() => {
                    const availableVideos = selectedDot.videos || selectedDot.videoUrls || (selectedDot.videoUrl ? [selectedDot.videoUrl] : []);
                    if (availableVideos.length === 0) return null;
                    
                    return (
                      <div className="p-6 rounded-lg border border-[rgba(255,255,255,0.12)]" style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
                      }}>
                        <h3 className="text-xl font-semibold mb-4 text-white">Video Tutorial</h3>
                        <div className="aspect-video bg-black flex items-center justify-center overflow-hidden rounded-lg border border-[rgba(255,255,255,0.12)] mb-4">
                          {(() => {
                            const currentVideo = availableVideos[selectedVideoIndex];
                            
                            // Convert YouTube watch URLs to embed URLs
                            const getEmbedUrl = (url) => {
                              if (!url) return null;
                              const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                              if (videoIdMatch) {
                                return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
                              }
                              return url; // Return as-is if already in embed format or not YouTube
                            };
                            
                            const embedUrl = getEmbedUrl(currentVideo);
                            
                            return embedUrl ? (
                              <iframe
                                className="w-full h-full"
                                src={embedUrl}
                                title={`${selectedDot.text} Tutorial ${selectedVideoIndex + 1}`}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            ) : null;
                          })()}
                        </div>
                        
                        {/* Video Selector */}
                        {availableVideos.length > 1 && (
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
                                        ? 'border-[#6495ed]'
                                        : 'border-transparent hover:border-[rgba(255,255,255,0.2)]'
                                    }`}
                                    style={{
                                      background: 'transparent'
                                    }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
                                        selectedVideoIndex === index
                                          ? 'bg-transparent border border-[#6495ed] text-[#6495ed]'
                                          : 'bg-transparent border border-[rgba(255,255,255,0.2)] text-gray-400'
                                      }`}>
                                        {index + 1}
                                      </div>
                                      <span className={`text-sm ${
                                        selectedVideoIndex === index ? 'text-white font-medium' : 'text-gray-400'
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
                        )}
                      </div>
                    );
                  })()}

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
                    <div className="text-gray-200 leading-relaxed text-base markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedDot.fullContent || selectedDot.details}
                      </ReactMarkdown>
                    </div>
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
        <div className="fixed inset-y-0 right-0 z-50 flex items-center" style={{
          paddingRight: '1rem',
          paddingTop: '76px'
        }}>
          {/* Resize Handle */}
          <div 
            className="w-6 h-full cursor-col-resize flex items-center justify-center hover:bg-white/5 transition-colors -mr-3 z-10 select-none"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingChat(true);
            }}
            title="Drag to resize"
          >
            <div className="w-1 h-16 bg-gray-500/30 rounded-full" />
          </div>

          <div className="flex flex-col overflow-hidden ml-auto" style={{
            width: `${chatWidth}px`,
            height: 'calc(100vh - 76px - 2rem)',
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
                {/* Video Context Indicator */}
                {selectedDot.transcripts && selectedDot.transcripts.length > 0 && selectedDot.transcripts[selectedVideoIndex] && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full w-fit" style={{
                    background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.2) 0%, rgba(79, 70, 229, 0.15) 100%)',
                    border: '1px solid rgba(147, 51, 234, 0.3)'
                  }}>
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium text-purple-300">
                      Using Video {selectedVideoIndex + 1} transcript{selectedDot.transcripts.length > 1 ? ` (of ${selectedDot.transcripts.length})` : ''}
                    </span>
                  </div>
                )}
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
                    {(selectedDot.questions && selectedDot.questions.length > 0 
                      ? selectedDot.questions 
                      : getFollowUpQuestions()
                    ).map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuestionClick(question)}
                        disabled={isChatLoading}
                        className="w-full text-left p-3 rounded-lg border border-[rgba(255,255,255,0.18)] transition-all text-sm text-gray-200 hover:border-[rgba(255,255,255,0.25)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                          <div className="text-sm leading-relaxed markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                          </div>
                          {/* Video context indicator for AI messages */}
                          {message.sender === 'ai' && message.hasVideoContext && (
                            <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-[rgba(147,51,234,0.2)]">
                              <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs text-purple-400">Response informed by video transcripts</span>
                            </div>
                          )}
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
                  {/* Loading indicator */}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div
                        className="max-w-[85%] px-4 py-3 rounded-lg border text-gray-200 border-[rgba(255,255,255,0.12)]"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%)'
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm text-gray-400">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
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
                    className="w-full px-4 pr-12 py-3 rounded-lg border border-[rgba(255,255,255,0.12)] focus:outline-none focus:border-[rgba(255,255,255,0.2)] text-white text-sm placeholder-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                    }}
                    disabled={isChatLoading}
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all text-white hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-[rgba(100,149,237,0.4)] hover:border-[rgba(100,149,237,0.6)]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(100,149,237,0.2) 0%, rgba(100,149,237,0.1) 100%)'
                    }}
                    disabled={!chatInput.trim() || isChatLoading}
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
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </div>
  );
};

export default ZoomableCanvas;