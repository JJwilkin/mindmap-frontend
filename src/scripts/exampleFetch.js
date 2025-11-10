/**
 * Example script showing how to fetch data from MongoDB
 * This demonstrates how you might retrieve subject data for use in your application
 */

import { connectToDatabase, closeDatabase } from '../db/connection.js';
import { getSubjectBySlug, getAllSubjects, searchSubjects } from '../db/subjectService.js';

async function exampleFetch() {
  try {
    // Connect to database
    await connectToDatabase();

    // Example 1: Get a specific subject by slug
    console.log('\n=== Example 1: Get Data Structures ===');
    const dataStructures = await getSubjectBySlug('data-structures');
    if (dataStructures) {
      console.log(`Found: ${dataStructures.name}`);
      console.log(`  Dots: ${dataStructures.dots?.length || 0}`);
      console.log(`  Paths: ${dataStructures.paths?.length || 0}`);
    } else {
      console.log('Data Structures not found. Run populateDatabase.js first.');
    }

    // Example 2: Get all subjects
    console.log('\n=== Example 2: Get All Subjects ===');
    const allSubjects = await getAllSubjects();
    console.log(`Total subjects: ${allSubjects.length}`);
    allSubjects.forEach(subject => {
      console.log(`  - ${subject.name} (${subject.slug})`);
    });

    // Example 3: Search subjects
    console.log('\n=== Example 3: Search Subjects ===');
    const searchResults = await searchSubjects('data');
    console.log(`Found ${searchResults.length} subject(s) matching "data":`);
    searchResults.forEach(subject => {
      console.log(`  - ${subject.name}`);
    });

    // Example 4: Access the data structure (similar to your JSON)
    if (dataStructures) {
      console.log('\n=== Example 4: Access Data Structure ===');
      console.log('The subject document has the same structure as your JSON:');
      console.log('  - dots: Array of dot objects');
      console.log('  - paths: Array of path objects');
      console.log('  - lines: Object with hierarchical and connections arrays');
      console.log('\nYou can use it exactly like your current JSON import:');
      console.log('  const dots = dataStructures.dots;');
      console.log('  const paths = dataStructures.paths;');
      console.log('  const lines = dataStructures.lines;');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closeDatabase();
  }
}

// Run the example
exampleFetch();

