import { connectToDatabase, closeDatabase, getSubjectsCollection } from '../db/connection.js';

/**
 * List all subjects in the database
 * @param {Object} options - Query options
 */
async function listSubjects(options = {}) {
  try {
    // Connect to database
    await connectToDatabase();
    const collection = getSubjectsCollection();

    // Build query
    const query = {};
    if (options.name) {
      query.name = { $regex: options.name, $options: 'i' };
    }
    if (options.slug) {
      query.slug = options.slug;
    }

    // Find subjects
    const subjects = await collection.find(query).toArray();

    if (subjects.length === 0) {
      console.log('No subjects found in the database.');
      return [];
    }

    // Display results
    console.log(`\nFound ${subjects.length} subject(s):\n`);
    console.log('─'.repeat(80));

    subjects.forEach((subject, index) => {
      const dotCount = subject.dots?.length || 0;
      const pathCount = subject.paths?.length || 0;
      const hierarchicalLines = subject.lines?.hierarchical?.length || 0;
      const connectionLines = subject.lines?.connections?.length || 0;

      console.log(`\n${index + 1}. ${subject.name}`);
      console.log(`   Slug: ${subject.slug}`);
      console.log(`   Description: ${subject.description || 'N/A'}`);
      console.log(`   Dots: ${dotCount}`);
      console.log(`   Paths: ${pathCount}`);
      console.log(`   Lines: ${hierarchicalLines} hierarchical, ${connectionLines} connections`);
      console.log(`   Created: ${subject.createdAt?.toLocaleString() || 'N/A'}`);
      console.log(`   Updated: ${subject.updatedAt?.toLocaleString() || 'N/A'}`);
      console.log(`   Version: ${subject.version || 'N/A'}`);
    });

    console.log('\n' + '─'.repeat(80) + '\n');

    return subjects;

  } catch (error) {
    console.error('Error listing subjects:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

/**
 * Get a specific subject by name or slug
 * @param {string} identifier - Subject name or slug
 */
async function getSubject(identifier) {
  try {
    await connectToDatabase();
    const collection = getSubjectsCollection();

    // Try to find by slug first, then by name
    const subject = await collection.findOne({
      $or: [
        { slug: identifier.toLowerCase() },
        { name: { $regex: `^${identifier}$`, $options: 'i' } }
      ]
    });

    if (!subject) {
      console.log(`Subject "${identifier}" not found.`);
      return null;
    }

    console.log(`\nSubject: ${subject.name}`);
    console.log(`Slug: ${subject.slug}`);
    console.log(`Description: ${subject.description || 'N/A'}`);
    console.log(`Dots: ${subject.dots?.length || 0}`);
    console.log(`Paths: ${subject.paths?.length || 0}`);
    console.log(`Created: ${subject.createdAt?.toLocaleString() || 'N/A'}`);
    console.log(`Updated: ${subject.updatedAt?.toLocaleString() || 'N/A'}\n`);

    return subject;

  } catch (error) {
    console.error('Error getting subject:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // List all subjects
    await listSubjects();
  } else if (args[0] === '--name' && args[1]) {
    // Search by name
    await listSubjects({ name: args[1] });
  } else if (args[0] === '--slug' && args[1]) {
    // Search by slug
    await listSubjects({ slug: args[1] });
  } else {
    // Get specific subject
    await getSubject(args[0]);
  }
}

main();

