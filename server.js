import express from 'express';
import cors from 'cors';
import { connectToDatabase } from './src/db/connection.js';
import { getAllSubjects, getSubjectBySlug } from './src/db/subjectService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all subjects
app.get('/api/subjects', async (req, res) => {
  try {
    await connectToDatabase();
    const subjects = await getAllSubjects();
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Get a specific subject by slug
app.get('/api/subjects/:slug', async (req, res) => {
  try {
    await connectToDatabase();
    const subject = await getSubjectBySlug(req.params.slug);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(subject);
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

