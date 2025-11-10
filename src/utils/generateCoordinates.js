/**
 * Generates coordinates for dots in a hierarchical structure
 * @param {Object} dotsData - The dots data without coordinates
 * @param {Object} options - Configuration options
 * @returns {Object} - The dots data with generated coordinates
 */
export function generateCoordinates(dotsData, options = {}) {
  const {
    canvasWidth = 1920,
    canvasHeight = 1080,
    layout = 'scattered',
    parentSpread = 0.35,
    childSpread = 0.12,
    jitter = 15,
    minDistance = 80,
    centerWeight = 0.2    // New: 0-1, higher values = more center bias
  } = options;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const parentRadius = Math.min(canvasWidth, canvasHeight) * parentSpread;
  const childRadius = parentRadius * childSpread;

  /**
   * Adds random variation with center bias
   */
  const addJitter = (value, range) => {
    const rawJitter = (Math.random() - 0.5) * range;
    // Apply center bias: reduce jitter based on distance from center
    const distanceFromCenter = Math.abs(value - centerX) / (canvasWidth / 2);
    const biasedJitter = rawJitter * (1 - (distanceFromCenter * centerWeight));
    return value + biasedJitter;
  };

  /**
   * Generates a random position with center bias
   */
  const getRandomPosition = (centerPoint, radius) => {
    // Generate angle normally
    const angle = Math.random() * Math.PI * 2;
    
    // Apply center bias to the distance
    const rawDistance = Math.random();
    const biasedDistance = Math.pow(rawDistance, 1 + centerWeight) * radius;
    
    // Calculate position with bias
    const x = centerPoint.x + Math.cos(angle) * biasedDistance;
    const y = centerPoint.y + Math.sin(angle) * biasedDistance;
    
    // Apply additional center-weighted jitter
    return {
      x: addJitter(x, jitter),
      y: addJitter(y, jitter)
    };
  };

  /**
   * Checks if a position is too close to existing points
   */
  const isTooClose = (pos, existingPoints, minDist) => {
    return existingPoints.some(point => {
      const dx = pos.x - point.x;
      const dy = pos.y - point.y;
      return Math.sqrt(dx * dx + dy * dy) < minDist;
    });
  };

  /**
   * Generates a random pastel color
   */
  const generatePastelColor = () => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgb(${Math.min(255, r + 127)}, ${Math.min(255, g + 127)}, ${Math.min(255, b + 127)})`;
  };

  /**
   * Generates coordinates for children in a radial pattern around parent
   */
  const generateChildrenCoordinates = (parent, children, radius, parentColor, level = 1) => {
    if (!children || children.length === 0) return [];

    const childPositions = [];
    
    return children.map((child, index) => {
      // Always use radial layout for children
      // Distribute children evenly in a circle around the parent
      const angle = (2 * Math.PI * index) / children.length;
      
      // Add slight rotation offset based on level to avoid overlap between nested levels
      const angleOffset = (level * Math.PI) / (children.length + 1);
      const finalAngle = angle + angleOffset;
      
      // Use full radius for cleaner radial pattern, with slight variation by child size
      const childRadiusMultiplier = child.size ? (1 + (child.size / 10)) : 1;
      const actualRadius = radius * childRadiusMultiplier;
      
      const pos = {
        x: parent.x + Math.cos(finalAngle) * actualRadius,
        y: parent.y + Math.sin(finalAngle) * actualRadius
      };
      
      // Add minimal jitter only for visual variety, much less than parent nodes
      const minimalJitter = jitter * 0.3;
      pos.x += (Math.random() - 0.5) * minimalJitter;
      pos.y += (Math.random() - 0.5) * minimalJitter;

      childPositions.push(pos);

      const processedChild = {
        ...child,
        color: parentColor,
        x: `centerX + ${Math.round(pos.x - centerX)}`,
        y: `centerY + ${Math.round(pos.y - centerY)}`
      };

      // Recursively process grandchildren with smaller radius
      if (child.children) {
        processedChild.children = generateChildrenCoordinates(
          pos,
          child.children,
          radius * 0.6,  // Slightly larger multiplier for nested children
          parentColor,
          level + 1
        );
      }

      return processedChild;
    });
  };

  /**
   * Collects all lines from the data structure
   * Returns two types: hierarchical (parent-child) and connection (related concepts)
   */
  const collectLines = (dots) => {
    const hierarchicalLines = [];
    const connectionLines = [];

    const processDotsForLines = (dotsArray) => {
      dotsArray.forEach(dot => {
        // Hierarchical lines (parent to children)
        if (dot.children && dot.children.length > 0) {
          dot.children.forEach(child => {
            hierarchicalLines.push({
              source: dot.id,
              target: child.id,
              type: 'hierarchical'
            });
            // Recursively process children
            if (child.children) {
              processDotsForLines([child]);
            }
          });
        }

        // Connection lines (related concepts)
        if (dot.connections && dot.connections.length > 0) {
          dot.connections.forEach(targetId => {
            // Only add line once (avoid duplicates by checking if source < target)
            if (dot.id < targetId) {
              connectionLines.push({
                source: dot.id,
                target: targetId,
                type: 'connection'
              });
            }
          });
        }
      });
    };

    processDotsForLines(dots);
    return { hierarchicalLines, connectionLines };
  };

  // Process top-level dots with center bias
  const existingPoints = [];
  const processedDots = dotsData.dots.map((dot, index) => {
    let pos;
    let attempts = 0;
    const maxAttempts = 50;

    // Generate a pastel color for the parent dot
    const parentColor = generatePastelColor();

    do {
      if (layout === 'circular') {
        const angle = (2 * Math.PI * index) / dotsData.dots.length;
        // Apply center bias to circular layout
        const biasedRadius = parentRadius * (1 - (Math.random() * centerWeight * 0.3));
        pos = {
          x: centerX + Math.cos(angle) * biasedRadius,
          y: centerY + Math.sin(angle) * biasedRadius
        };
      } else {
        pos = getRandomPosition({ x: centerX, y: centerY }, parentRadius);
      }
      attempts++;
    } while (
      attempts < maxAttempts && 
      isTooClose(pos, existingPoints, minDistance)
    );

    existingPoints.push(pos);

    const processedDot = {
      ...dot,
      color: parentColor,
      x: `centerX + ${Math.round(pos.x - centerX)}`,
      y: `centerY + ${Math.round(pos.y - centerY)}`
    };

    if (dot.children) {
      processedDot.children = generateChildrenCoordinates(
        pos,
        dot.children,
        childRadius,
        parentColor
      );
    }

    return processedDot;
  });

  // Collect all lines
  const { hierarchicalLines, connectionLines } = collectLines(processedDots);

  return {
    ...dotsData,
    dots: processedDots,
    lines: {
      hierarchical: hierarchicalLines,
      connections: connectionLines
    }
  };
}

// Example usage:
/*
const options = {
  layout: 'scattered',     // or 'circular'
  parentSpread: 0.4,      // Use 40% of the canvas for parent spread
  childSpread: 0.15,      // Children spread relative to parent spread
  jitter: 20,            // Random variation amount
  minDistance: 100       // Minimum distance between parent nodes
};

const dotsWithCoordinates = generateCoordinates(dotsWithoutCoordinates, options);
*/ 