import fs from 'fs';
import path from 'path';

const inputPath = path.resolve('public/data/videos.json');
const outputPath = path.resolve('public/data/videos.jsonl');

try {
  const rawData = fs.readFileSync(inputPath, 'utf8');
  const data = JSON.parse(rawData);

  if (!Array.isArray(data)) {
    throw new Error('Input JSON must be an array of objects');
  }

  // Convert array of objects to JSON Lines (one object per line, no brackets or commas)
  const jsonlContent = data.map(item => JSON.stringify(item)).join('\n');

  fs.writeFileSync(outputPath, jsonlContent, 'utf8');
  console.log(`Successfully converted ${data.length} items to JSON Lines at: ${outputPath}`);
} catch (err) {
  console.error('Conversion failed:', err.message);
}
