import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateCoordinates } from '../utils/generateCoordinates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Get project root (two levels up from src/scripts/)
const projectRoot = path.resolve(__dirname, '../..');

async function main() {
  try {
    const args = process.argv.slice(2);
    
    // Use command line arguments if provided, otherwise use defaults
    let inputFile = args[0] || 'src/data/dots-without-coordinates.json';
    let outputFile = args[1] || 'src/data/dots-with-coordinates.json';
    
    // Resolve paths from project root
    const inputPath = path.isAbsolute(inputFile) 
      ? inputFile 
      : path.resolve(projectRoot, inputFile);
    const outputPath = path.isAbsolute(outputFile) 
      ? outputFile 
      : path.resolve(projectRoot, outputFile);
    
    console.log(`Reading input file: ${inputPath}`);
    const rawData = await fs.readFile(inputPath, 'utf8');
    const dotsData = JSON.parse(rawData);
    
    // Configuration options
    const options = {
      layout: 'circular',    // 'scattered' or 'circular' (applies to top-level parents)
      parentSpread: 0.45,    // Spread for parent nodes from center
      childSpread: 0.28,     // Radius multiplier for children around their parent (increased for more spread)
      jitter: 15,            // Jitter for parent nodes (children use 30% of this)
      minDistance: 80,       // Minimum distance between parent nodes
      centerWeight: 0.7      // Bias towards center for parent nodes (0-1, higher = more centered)
    };
    
    console.log('Generating coordinates...');
    const processedData = generateCoordinates(dotsData, options);
    
    // Save the processed data
    console.log(`Saving to file: ${outputPath}`);
    await fs.writeFile(
      outputPath,
      JSON.stringify(processedData, null, 2),
      'utf8'
    );
    
    console.log(`✓ Successfully generated coordinates and saved to ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();