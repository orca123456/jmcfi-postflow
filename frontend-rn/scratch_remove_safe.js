const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Acer/jmcfi-postflow/frontend-rn/app/(app)/dashboard';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && f !== 'it-admin.tsx' && f !== 'admin.tsx');

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  const originalLength = content.length;
  
  // 1. Remove Analytics Tab
  content = content.replace(/\{\/\* -+ ANALYTICS TAB -+ \*\/\}([\s\S]*?)(\{\/\* -+ POLICY)/g, '$2');
  
  // 2. Remove metrics rows (carefully matching from the comment to the closing </View> of the metricsRow)
  // We can just match <View style={styles.metricsRow}> and the next 4 Cards, which usually ends with </View>
  // Because all files use 4 metricCards, we can just replace the whole block by regex.
  // Actually, we can use regex to match <View style={styles.metricsRow}>... up to 4 occurrences of </Card> then </View>.
  content = content.replace(/(\{\/\*.*?metrics.*?\*\/\}\s*)?<View style=\{styles\.metricsRow\}>([\s\S]*?<\/Card>\s*){4}<\/View>/g, '');
  
  // Also some files might have 5 cards (requestor has 5)
  content = content.replace(/(\{\/\*.*?Metrics.*?\*\/\}\s*)?<View style=\{styles\.metricsRow\}>([\s\S]*?<\/Card>\s*){5}<\/View>/g, '');
  
  if (content.length !== originalLength) {
    fs.writeFileSync(filePath, content);
    console.log(`Safely updated ${file}`);
  }
}
