/**
 * Script to view data from MongoDB in a readable format
 */

import { connectToDatabase, closeDatabase, getSubjectsCollection } from '../db/connection.js';

async function viewData() {
  try {
    await connectToDatabase();
    const collection = getSubjectsCollection();

    // Get all subjects
    const subjects = await collection.find({}).toArray();

    if (subjects.length === 0) {
      console.log('No subjects found in the database.');
      return;
    }

    console.log(`\nFound ${subjects.length} subject(s) in the database:\n`);
    console.log('═'.repeat(80));

    subjects.forEach((subject, index) => {
      console.log(`\n${index + 1}. ${subject.name}`);
      console.log(`   Slug: ${subject.slug}`);
      console.log(`   Description: ${subject.description || 'N/A'}`);
      console.log(`   Created: ${subject.createdAt?.toLocaleString() || 'N/A'}`);
      console.log(`   Updated: ${subject.updatedAt?.toLocaleString() || 'N/A'}`);
      console.log(`   Version: ${subject.version || 'N/A'}`);
      
      // Show dots summary
      const dotCount = subject.dots?.length || 0;
      console.log(`\n   Dots (${dotCount}):`);
      if (dotCount > 0) {
        subject.dots.slice(0, 5).forEach(dot => {
          console.log(`     - ${dot.text} (ID: ${dot.id})`);
        });
        if (dotCount > 5) {
          console.log(`     ... and ${dotCount - 5} more`);
        }
      }

      // Show paths summary
      const pathCount = subject.paths?.length || 0;
      console.log(`\n   Paths (${pathCount}):`);
      if (pathCount > 0) {
        subject.paths.forEach(path => {
          console.log(`     - ${path.name} (${path.dots?.length || 0} dots)`);
        });
      }

      // Show lines summary
      const hierarchicalLines = subject.lines?.hierarchical?.length || 0;
      const connectionLines = subject.lines?.connections?.length || 0;
      console.log(`\n   Lines: ${hierarchicalLines} hierarchical, ${connectionLines} connections`);

      console.log('\n' + '─'.repeat(80));
    });

    // Option to view full details of a specific subject
    const args = process.argv.slice(2);
    if (args.length > 0) {
      const subjectName = args[0];
      const subject = subjects.find(s => 
        s.name.toLowerCase() === subjectName.toLowerCase() || 
        s.slug === subjectName.toLowerCase()
      );

      if (subject) {
        console.log(`\n\n📋 Full Details for "${subject.name}":\n`);
        console.log(JSON.stringify(subject, null, 2));
      } else {
        console.log(`\nSubject "${subjectName}" not found.`);
      }
    }

  } catch (error) {
    console.error('Error viewing data:', error);
  } finally {
    await closeDatabase();
  }
}

viewData();

