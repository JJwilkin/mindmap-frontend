import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectToDatabase, closeDatabase, getSubjectsCollection } from '../db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Get project root (two levels up from src/scripts/)
const projectRoot = path.resolve(__dirname, '../..');

/**
 * Populate MongoDB with data from a JSON file
 * @param {string} subjectName - Name of the subject (e.g., "Data Structures")
 * @param {string} jsonFilePath - Path to the JSON file
 */
async function populateSubject(subjectName, jsonFilePath) {
  try {
    // Connect to database
    await connectToDatabase();
    const collection = getSubjectsCollection();

    // Read JSON file - resolve from project root
    console.log(`Reading JSON file: ${jsonFilePath}`);
    const filePath = path.isAbsolute(jsonFilePath) 
      ? jsonFilePath 
      : path.resolve(projectRoot, jsonFilePath);
    const rawData = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(rawData);

    // Create slug from subject name
    const slug = subjectName.toLowerCase().replace(/\s+/g, '-');

    // Prepare document
    const subjectDocument = {
      name: subjectName,
      slug: slug,
      description: `Interactive learning graph for ${subjectName}`,
      dots: data.dots || [],
      paths: data.paths || [],
      lines: data.lines || { hierarchical: [], connections: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0'
    };

    // Check if subject already exists
    const existing = await collection.findOne({ slug: slug });
    
    if (existing) {
      // Update existing document
      console.log(`Updating existing subject: ${subjectName}`);
      await collection.updateOne(
        { slug: slug },
        {
          $set: {
            ...subjectDocument,
            createdAt: existing.createdAt, // Preserve original creation date
            updatedAt: new Date()
          }
        }
      );
      console.log(`✓ Successfully updated subject: ${subjectName}`);
    } else {
      // Insert new document
      console.log(`Inserting new subject: ${subjectName}`);
      const result = await collection.insertOne(subjectDocument);
      console.log(`✓ Successfully inserted subject: ${subjectName} with ID: ${result.insertedId}`);
    }

    // Print summary
    const dotCount = subjectDocument.dots.length;
    const pathCount = subjectDocument.paths.length;
    const hierarchicalLines = subjectDocument.lines.hierarchical?.length || 0;
    const connectionLines = subjectDocument.lines.connections?.length || 0;

    console.log('\n--- Summary ---');
    console.log(`Subject: ${subjectName}`);
    console.log(`Dots: ${dotCount}`);
    console.log(`Paths: ${pathCount}`);
    console.log(`Hierarchical lines: ${hierarchicalLines}`);
    console.log(`Connection lines: ${connectionLines}`);

  } catch (error) {
    console.error('Error populating database:', error);
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
  
  if (args.length < 2) {
    console.log('Usage: node populateDatabase.js <subject-name> <json-file-path>');
    console.log('Example: node populateDatabase.js "Data Structures" "src/data/dots-with-coordinates.json"');
    process.exit(1);
  }

  const [subjectName, jsonFilePath] = args;
  
  await populateSubject(subjectName, jsonFilePath);
}

main();

