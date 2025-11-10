# Database Scripts

This directory contains helper scripts for managing subjects in MongoDB.

## Setup

1. Install dependencies:
```bash
npm install mongodb dotenv
# or
yarn add mongodb dotenv
```

2. Create a `.env` file in the project root with the following content:
```bash
# Create .env file
cat > .env << EOF
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=athena-graph
EOF
```

   Or manually create `.env` with:
   ```
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=athena-graph
   ```

   For MongoDB Atlas (cloud), use:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
   MONGODB_DB_NAME=athena-graph
   ```

## Scripts

### populateDatabase.js

Populate or update a subject in MongoDB from a JSON file.

**Usage:**
```bash
node src/scripts/populateDatabase.js <subject-name> <json-file-path>
```

**Example:**
```bash
# Populate Data Structures from existing JSON
node src/scripts/populateDatabase.js "Data Structures" "../data/dots-with-coordinates.json"
```

This will:
- Create a new subject document if it doesn't exist
- Update an existing subject if it already exists (preserving creation date)
- Store all dots, paths, and lines from the JSON file

### createSubject.js

Create a new empty subject in the database.

**Usage:**
```bash
node src/scripts/createSubject.js <subject-name> [description]
```

**Examples:**
```bash
# Create Operating Systems subject
node src/scripts/createSubject.js "Operating Systems" "Learn about operating system concepts"

# Create Algorithms subject
node src/scripts/createSubject.js "Algorithms"
```

### listSubjects.js

List all subjects in the database or search for specific subjects.

**Usage:**
```bash
# List all subjects
node src/scripts/listSubjects.js

# Get a specific subject by name or slug
node src/scripts/listSubjects.js "Data Structures"

# Search by name (case-insensitive)
node src/scripts/listSubjects.js --name "data"

# Search by slug
node src/scripts/listSubjects.js --slug "data-structures"
```

## Database Structure

Each subject document in MongoDB has the following structure:

```javascript
{
  _id: ObjectId,
  name: "Data Structures",
  slug: "data-structures",
  description: "Interactive learning graph for Data Structures",
  dots: [
    {
      id: 1,
      size: 6,
      text: "Arrays",
      details: "...",
      fullContent: "...",
      implementations: [...],
      relationships: [...],
      parentId: null,
      color: "rgb(255, 152, 255)",
      x: "centerX + 479",
      y: "centerY + 0",
      children: [...] // Optional nested children
    },
    // ... more dots
  ],
  paths: [
    {
      id: "fundamentals",
      name: "Data Structure Fundamentals",
      description: "...",
      dots: [1, 2, 3, 4]
    },
    // ... more paths
  ],
  lines: {
    hierarchical: [
      { source: 5, target: 6, type: "hierarchical" },
      // ... more hierarchical lines
    ],
    connections: [
      { source: 1, target: 2, type: "connection" },
      // ... more connection lines
    ]
  },
  createdAt: ISODate,
  updatedAt: ISODate,
  version: "1.0.0"
}
```

## Quick Start Example

1. **Create a new subject:**
```bash
node src/scripts/createSubject.js "Operating Systems"
```

2. **Populate it with data (when you have a JSON file):**
```bash
node src/scripts/populateDatabase.js "Operating Systems" "../data/operating-systems.json"
```

3. **List all subjects:**
```bash
node src/scripts/listSubjects.js
```

4. **View a specific subject:**
```bash
node src/scripts/listSubjects.js "Operating Systems"
```

## Using the Database Service

You can also use the database service functions in your code:

```javascript
import { connectToDatabase, closeDatabase } from './db/connection.js';
import { getSubjectBySlug, getAllSubjects } from './db/subjectService.js';

// Connect to database
await connectToDatabase();

// Get a specific subject
const dataStructures = await getSubjectBySlug('data-structures');

// Get all subjects
const allSubjects = await getAllSubjects();

// Don't forget to close the connection when done
await closeDatabase();
```

## Example: Populate Data Structures

To populate your existing "Data Structures" data:

```bash
npm run db:populate "Data Structures" "../data/dots-with-coordinates.json"
```

Or using yarn:
```bash
yarn db:populate "Data Structures" "../data/dots-with-coordinates.json"
```

