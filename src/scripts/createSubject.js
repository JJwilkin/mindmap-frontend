import { connectToDatabase, closeDatabase, getSubjectsCollection } from '../db/connection.js';

/**
 * Create a new subject with empty structure
 * @param {string} subjectName - Name of the subject
 * @param {string} description - Description of the subject
 */
async function createSubject(subjectName, description = '') {
  try {
    // Connect to database
    await connectToDatabase();
    const collection = getSubjectsCollection();

    // Create slug from subject name
    const slug = subjectName.toLowerCase().replace(/\s+/g, '-');

    // Check if subject already exists
    const existing = await collection.findOne({ slug: slug });
    
    if (existing) {
      console.log(`Subject "${subjectName}" already exists with slug: ${slug}`);
      console.log('Use populateDatabase.js to update it with data.');
      return existing;
    }

    // Create empty subject document
    const subjectDocument = {
      name: subjectName,
      slug: slug,
      description: description || `Interactive learning graph for ${subjectName}`,
      dots: [],
      paths: [],
      lines: {
        hierarchical: [],
        connections: []
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0'
    };

    // Insert document
    console.log(`Creating new subject: ${subjectName}`);
    const result = await collection.insertOne(subjectDocument);
    console.log(`✓ Successfully created subject: ${subjectName} with ID: ${result.insertedId}`);
    console.log(`  Slug: ${slug}`);
    console.log(`  You can now populate it using:`);
    console.log(`  node src/scripts/populateDatabase.js "${subjectName}" <json-file-path>`);

    return subjectDocument;

  } catch (error) {
    console.error('Error creating subject:', error);
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
  
  if (args.length < 1) {
    console.log('Usage: node createSubject.js <subject-name> [description]');
    console.log('Example: node createSubject.js "Operating Systems" "Learn about OS concepts"');
    process.exit(1);
  }

  const [subjectName, description] = args;
  
  await createSubject(subjectName, description);
}

main();

