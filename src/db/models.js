/**
 * Subject Document Schema
 * 
 * Each document represents a high-level subject (e.g., "Data Structures", "Operating Systems")
 * and contains all the dots, paths, and lines for that subject.
 * 
 * @typedef {Object} SubjectDocument
 * @property {string} _id - MongoDB ObjectId (auto-generated)
 * @property {string} name - Subject name (e.g., "Data Structures", "Operating Systems")
 * @property {string} slug - URL-friendly identifier (e.g., "data-structures", "operating-systems")
 * @property {string} description - Brief description of the subject
 * @property {Array<Dot>} dots - Array of dot objects (topics/subtopics)
 * @property {Array<Path>} paths - Array of learning paths
 * @property {Object} lines - Object containing hierarchical and connection lines
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {string} version - Version identifier for the subject data
 */

/**
 * Dot Schema
 * 
 * @typedef {Object} Dot
 * @property {number} id - Unique identifier for the dot
 * @property {number} size - Size of the dot
 * @property {string} text - Display text
 * @property {string} details - Short description
 * @property {string} fullContent - Full detailed content
 * @property {Array<string>} implementations - List of implementations
 * @property {Array<string>} relationships - List of relationships
 * @property {number|null} parentId - ID of parent dot (null for top-level)
 * @property {string} color - Color in RGB format
 * @property {string} x - X coordinate expression (e.g., "centerX + 479")
 * @property {string} y - Y coordinate expression (e.g., "centerY + 0")
 * @property {Array<Dot>} [children] - Nested children dots (optional)
 */

/**
 * Path Schema
 * 
 * @typedef {Object} Path
 * @property {string} id - Unique identifier for the path
 * @property {string} name - Path name
 * @property {string} description - Path description
 * @property {Array<number>} dots - Array of dot IDs in this path
 */

/**
 * Lines Schema
 * 
 * @typedef {Object} Lines
 * @property {Array<Line>} hierarchical - Array of hierarchical relationships
 * @property {Array<Line>} connections - Array of connection relationships
 */

/**
 * Line Schema
 * 
 * @typedef {Object} Line
 * @property {number} source - Source dot ID
 * @property {number} target - Target dot ID
 * @property {string} type - Type of line ("hierarchical" or "connection")
 */

export const SubjectSchema = {
  name: String,
  slug: String,
  description: String,
  dots: Array,
  paths: Array,
  lines: Object,
  createdAt: Date,
  updatedAt: Date,
  version: String
};

