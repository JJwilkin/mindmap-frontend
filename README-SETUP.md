# Multi-Subject Graph Setup

This application now supports displaying multiple high-level concepts (subjects) as separate clusters on the graph canvas.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
# Database Configuration (for API mode)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=athena-graph

# Local Testing Mode (optional)
# Set to 'true' to bypass API and use local JSON files directly
VITE_USE_LOCAL_DATA=false
```

**Local Testing Mode**: If you want to test with local JSON files without running the API server, set `VITE_USE_LOCAL_DATA=true` in your `.env` file. This will load data directly from `src/data/data_structures_with_coordinates.json`.

### 3. Populate Database

Populate your subjects into MongoDB:

```bash
# Populate Data Structures
npm run db:populate "Data Structures" "src/data/dots-with-coordinates.json"

# Populate Operating Systems
npm run db:populate "Operating Systems" "src/data/operating-systems-with-coordinates.json"
```

### 4. Start the Application

You have two options:

**Option A: Run both servers separately (recommended for development)**

Terminal 1 - Start the API server:
```bash
npm run server
```

Terminal 2 - Start the frontend:
```bash
npm run dev
```

**Option B: Run both servers together**

```bash
npm run dev:all
```

This uses `concurrently` to run both the API server (port 3001) and the Vite dev server (port 5173) simultaneously.

### 5. Access the Application

Open your browser to `http://localhost:5173`

You should now see multiple subject clusters:
- **Data Structures** cluster (centered)
- **Operating Systems** cluster (offset to the side)

Each cluster displays:
- All dots/topics for that subject
- Connection lines between related concepts
- Subject name label at the cluster center
- Learning paths specific to each subject

## Features

- **Multiple Subject Clusters**: Each subject appears as a separate, visually distinct cluster
- **Circular Layout**: Subjects are arranged in a circular pattern around the center
- **Subject-Specific Paths**: Learning paths are organized by subject
- **Local Testing Mode**: Bypass API and use local JSON files for development
- **Fallback Support**: If the API fails, the app falls back to local JSON data

## API Endpoints

- `GET /api/subjects` - Get all subjects
- `GET /api/subjects/:slug` - Get a specific subject by slug
- `GET /api/health` - Health check

## Troubleshooting

1. **No clusters appearing**: 
   - Make sure MongoDB is running: `brew services list | grep mongodb`
   - Check that subjects are populated: `npm run db:list`
   - Check browser console for errors

2. **API connection errors**:
   - Ensure the API server is running on port 3001
   - Check that `.env` file exists and has correct MongoDB URI

3. **Subjects not loading**:
   - Verify subjects exist in database: `npm run db:view`
   - Check server logs for connection errors

4. **Using Local Testing Mode**:
   - Set `VITE_USE_LOCAL_DATA=true` in your `.env` file
   - Restart the dev server: `npm run dev`
   - The app will load `src/data/data_structures_with_coordinates.json` directly
   - No API server or MongoDB required

