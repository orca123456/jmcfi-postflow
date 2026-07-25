const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Acer/jmcfi-postflow/frontend-rn/app/(app)/dashboard';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && f !== 'it-admin.tsx');

function removeBlock(content, startString) {
  let startIndex = content.indexOf(startString);
  while (startIndex !== -1) {
    // Find previous comment if it exists (e.g. {/* Metrics Row */})
    let searchStart = startIndex;
    const commentMatch = content.substring(Math.max(0, startIndex - 100), startIndex).match(/\{\/\*\s*.*?\s*\*\/\}\s*$/);
    if (commentMatch) {
      searchStart = startIndex - commentMatch[0].length;
    } else {
      // maybe find just the start of the line
      const lineStart = content.lastIndexOf('\n', startIndex);
      if (lineStart !== -1) searchStart = lineStart + 1;
    }

    // Now find the matching closing tag or bracket
    let braceCount = 0;
    let inBlock = false;
    let endIndex = startIndex + startString.length;
    
    // For View or bracket
    const isView = startString.includes('<View');
    
    if (isView) {
      let openTags = 1;
      let currentIndex = endIndex;
      while (openTags > 0 && currentIndex < content.length) {
        const nextOpen = content.indexOf('<View', currentIndex);
        const nextClose = content.indexOf('</View>', currentIndex);
        
        if (nextClose === -1) break; // Error
        
        if (nextOpen !== -1 && nextOpen < nextClose) {
          openTags++;
          currentIndex = nextOpen + 5;
        } else {
          openTags--;
          currentIndex = nextClose + 7;
        }
      }
      endIndex = currentIndex;
    } else {
      // For {activeTab === 'analytics' && ( ... )}
      // Wait, we need to match the outer { ... }
      let openBraces = 1;
      let currentIndex = content.indexOf('{', searchStart) + 1;
      while (openBraces > 0 && currentIndex < content.length) {
        if (content[currentIndex] === '{') openBraces++;
        if (content[currentIndex] === '}') openBraces--;
        currentIndex++;
      }
      endIndex = currentIndex;
    }

    // Remove the block
    content = content.substring(0, searchStart) + content.substring(endIndex);
    
    // Check if there are more
    startIndex = content.indexOf(startString);
  }
  return content;
}

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  const originalLength = content.length;
  
  content = removeBlock(content, "<View style={styles.metricsRow}>");
  content = removeBlock(content, "{activeTab === 'analytics' && (");
  
  if (content.length !== originalLength) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
}
