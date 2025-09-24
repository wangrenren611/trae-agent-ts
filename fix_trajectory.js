const fs = require('fs');

// Read the trajectory file
const content = fs.readFileSync('./trajectory.json', 'utf8');

try {
  // Try to parse the JSON
  const trajectory = JSON.parse(content);
  console.log('Original file is valid JSON');
  
  // Write a properly formatted version
  fs.writeFileSync('./trajectory_fixed.json', JSON.stringify(trajectory, null, 2));
  console.log('Fixed file written to trajectory_fixed.json');
} catch (error) {
  console.error('Error parsing JSON:', error.message);
  
  // Try to fix common issues
  let fixedContent = content.trim();
  
  // Ensure the file ends with a closing brace
  if (!fixedContent.endsWith('}')) {
    fixedContent += '}';
  }
  
  try {
    const trajectory = JSON.parse(fixedContent);
    fs.writeFileSync('./trajectory_fixed.json', JSON.stringify(trajectory, null, 2));
    console.log('Fixed file written to trajectory_fixed.json');
  } catch (fixError) {
    console.error('Error fixing JSON:', fixError.message);
  }
}