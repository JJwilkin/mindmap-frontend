import { connectToDatabase, getSubjectsCollection } from './connection.js';

/**
 * Get a subject by name or slug
 * @param {string} identifier - Subject name or slug
 * @returns {Promise<Object|null>}
 */
export async function getSubjectByIdentifier(identifier) {
  await connectToDatabase();
  const collection = getSubjectsCollection();
  
  const subject = await collection.findOne({
    $or: [
      { slug: identifier.toLowerCase() },
      { name: { $regex: `^${identifier}$`, $options: 'i' } }
    ]
  });

  return subject;
}

/**
 * Get all subjects
 * @returns {Promise<Array>}
 */
export async function getAllSubjects() {
  await connectToDatabase();
  const collection = getSubjectsCollection();
  const subjects = await collection.find({}).toArray();
  return subjects;
}

/**
 * Get subject by slug
 * @param {string} slug - Subject slug
 * @returns {Promise<Object|null>}
 */
export async function getSubjectBySlug(slug) {
  await connectToDatabase();
  const collection = getSubjectsCollection();
  const subject = await collection.findOne({ slug: slug.toLowerCase() });
  return subject;
}

/**
 * Search subjects by name
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>}
 */
export async function searchSubjects(searchTerm) {
  await connectToDatabase();
  const collection = getSubjectsCollection();
  const subjects = await collection.find({
    name: { $regex: searchTerm, $options: 'i' }
  }).toArray();
  return subjects;
}

