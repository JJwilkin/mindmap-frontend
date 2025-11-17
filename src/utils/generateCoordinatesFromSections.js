/**
 * Generates coordinates for dots from a sections -> topics -> concepts structure
 * This version handles the JSON structure from generate_relationships.py
 * @param {Object} sectionsData - The sections data without coordinates
 * @param {Object} options - Configuration options
 * @returns {Object} - The dots data with generated coordinates
 */
export function generateCoordinatesFromSections(sectionsData, options = {}) {
  const {
    canvasWidth = 1920,
    canvasHeight = 1080,
    layout = 'circular',
    parentSpread = 0.45,
    childSpread = 0.28,
    jitter = 15,
    minDistance = 80,
    centerWeight = 0.7
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
    const distanceFromCenter = Math.abs(value - centerX) / (canvasWidth / 2);
    const biasedJitter = rawJitter * (1 - (distanceFromCenter * centerWeight));
    return value + biasedJitter;
  };

  /**
   * Generates a random position with center bias
   */
  const getRandomPosition = (centerPoint, radius) => {
    const angle = Math.random() * Math.PI * 2;
    const rawDistance = Math.random();
    const biasedDistance = Math.pow(rawDistance, 1 + centerWeight) * radius;
    
    const x = centerPoint.x + Math.cos(angle) * biasedDistance;
    const y = centerPoint.y + Math.sin(angle) * biasedDistance;
    
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
   * Creates a mapping from concept ID (from the original structure) to dot ID
   * Also creates a reverse mapping from dot ID to concept ID
   */
  const createIdMappings = (sections) => {
    const conceptIdToDotId = new Map();
    const dotIdToConceptId = new Map();
    let dotId = 1;
    let conceptId = 1;

    sections.forEach(section => {
      section.topics.forEach(topic => {
        topic.concepts.forEach(concept => {
          conceptIdToDotId.set(conceptId, dotId);
          dotIdToConceptId.set(dotId, conceptId);
          conceptId++;
          dotId++; // Each concept becomes a dot
        });
      });
    });

    return { conceptIdToDotId, dotIdToConceptId };
  };

  /**
   * Converts sections structure to dots structure
   * Concepts become the primary dots since connections reference concept IDs
   */
  const convertToDots = (sections, conceptIdToDotId) => {
    const dots = [];
    let conceptId = 1;

    sections.forEach((section, sectionIndex) => {
      const sectionColor = generatePastelColor();
      
      section.topics.forEach((topic, topicIndex) => {
        // Add concepts as top-level dots, grouped by topic
        topic.concepts.forEach((concept, conceptIndex) => {
          const dotId = conceptIdToDotId.get(conceptId);
          
          const conceptDot = {
            id: dotId,
            size: 4, // Medium size for concepts
            text: concept.name,
            details: concept.description ? concept.description.substring(0, 100) + '...' : '',
            fullContent: concept.description || '',
            sectionName: section.name,
            sectionNumber: section.number,
            topicName: topic.name,
            topicNumber: topic.number,
            color: sectionColor,
            parentId: null,
            // Map connections from concept IDs to dot IDs
            connections: (concept.connections || []).map(connConceptId => {
              return conceptIdToDotId.get(connConceptId) || null;
            }).filter(id => id !== null && id !== dotId) // Remove invalid mappings and self-references
          };
          
          dots.push(conceptDot);
          conceptId++;
        });
      });
    });

    return dots;
  };

  /**
   * Generates coordinates for children in a radial pattern around parent
   */
  const generateChildrenCoordinates = (parent, children, radius, parentColor, level = 1) => {
    if (!children || children.length === 0) return [];

    return children.map((child, index) => {
      const angle = (2 * Math.PI * index) / children.length;
      const angleOffset = (level * Math.PI) / (children.length + 1);
      const finalAngle = angle + angleOffset;
      
      const childRadiusMultiplier = child.size ? (1 + (child.size / 10)) : 1;
      const actualRadius = radius * childRadiusMultiplier;
      
      const pos = {
        x: parent.x + Math.cos(finalAngle) * actualRadius,
        y: parent.y + Math.sin(finalAngle) * actualRadius
      };
      
      const minimalJitter = jitter * 0.3;
      pos.x += (Math.random() - 0.5) * minimalJitter;
      pos.y += (Math.random() - 0.5) * minimalJitter;

      const processedChild = {
        ...child,
        color: parentColor,
        x: `centerX + ${Math.round(pos.x - centerX)}`,
        y: `centerY + ${Math.round(pos.y - centerY)}`
      };

      // Recursively process grandchildren
      if (child.children) {
        processedChild.children = generateChildrenCoordinates(
          pos,
          child.children,
          radius * 0.6,
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

  // Create ID mappings
  const { conceptIdToDotId } = createIdMappings(sectionsData.sections);

  // Convert sections structure to dots structure
  const dotsData = convertToDots(sectionsData.sections, conceptIdToDotId);

  // Process top-level dots (concepts) with center bias
  const existingPoints = [];
  const processedDots = dotsData.map((dot, index) => {
    let pos;
    let attempts = 0;
    const maxAttempts = 50;

    const dotColor = dot.color || generatePastelColor();

    do {
      if (layout === 'circular') {
        const angle = (2 * Math.PI * index) / dotsData.length;
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
      color: dotColor,
      x: `centerX + ${Math.round(pos.x - centerX)}`,
      y: `centerY + ${Math.round(pos.y - centerY)}`
    };

    // No children in this structure - concepts are flat
    // But keep the structure in case we want to add hierarchical grouping later

    return processedDot;
  });

  // Collect all lines
  const { hierarchicalLines, connectionLines } = collectLines(processedDots);

  return {
    dots: processedDots,
    paths: [],
    lines: {
      hierarchical: hierarchicalLines,
      connections: connectionLines
    }
  };
}

// Example usage:
/*
const options = {
  layout: 'circular',     // or 'scattered'
  parentSpread: 0.45,     // Use 45% of the canvas for parent spread
  childSpread: 0.28,      // Children spread relative to parent spread
  jitter: 15,            // Random variation amount
  minDistance: 80,        // Minimum distance between parent nodes
  centerWeight: 0.7      // Bias towards center (0-1)
};

const dotsWithCoordinates = generateCoordinatesFromSections(sectionsData, options);
*/

