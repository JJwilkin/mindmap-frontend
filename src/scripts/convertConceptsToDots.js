import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentId = 1;

function getNextId() {
  return currentId++;
}

function truncateForDetails(fullContent, maxLength = 100) {
  if (!fullContent) return '';
  const truncated = fullContent.slice(0, maxLength);
  return truncated.slice(0, truncated.lastIndexOf(' ')) + '...';
}

function convertConcept(concept, parentId = null) {
  const dot = {
    id: getNextId(),
    size: concept.hierarchy_level === 'level_0' ? 6 : 
          concept.hierarchy_level === 'level_1' ? 4 : 2,
    text: concept.concept_name,
    details: truncateForDetails(concept.description),
    fullContent: concept.description,
    implementations: concept.implementations || [],
    relationships: concept.relationships || [],
    parentId
  };

  if (concept.sub_concepts && concept.sub_concepts.length > 0) {
    dot.children = concept.sub_concepts.map(sub => convertConcept(sub, dot.id));
  }

  return dot;
}

async function main() {
  try {
    const inputPath = path.join(__dirname, '../data/concept_hierarchy.json');
    const outputPath = path.join(__dirname, '../data/dots-without-coordinates.json');

    console.log('Reading concept hierarchy...');
    const rawData = await fs.readFile(inputPath, 'utf8');
    const concepts = JSON.parse(rawData);

    console.log('Converting to dots format...');
    const dots = concepts.map(concept => convertConcept(concept));

    const dotsData = {
      dots,
      paths: [] // You can add paths later if needed
    };

    console.log('Saving to file...');
    await fs.writeFile(
      outputPath,
      JSON.stringify(dotsData, null, 2),
      'utf8'
    );

    console.log(`Successfully converted and saved to ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 