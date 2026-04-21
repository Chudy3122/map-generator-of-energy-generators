const fs = require('fs');
const path = require('path');

const correctionsPath = path.join(__dirname, 'geocode-corrections.json');
const corrections = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));

const byProvince = {};

Object.values(corrections).forEach(item => {
  if (!byProvince[item.province]) {
    byProvince[item.province] = { successful: 0, failed: 0, examples: [] };
  }

  if (item.newCoords) {
    byProvince[item.province].successful++;
  } else {
    byProvince[item.province].failed++;
    if (byProvince[item.province].examples.length < 5) {
      byProvince[item.province].examples.push(item);
    }
  }
});

console.log('\n📊 Wyniki geokodowania według województw:\n');

Object.keys(byProvince).sort().forEach(province => {
  const data = byProvince[province];
  const total = data.successful + data.failed;
  const pct = Math.round(data.successful / total * 100);

  console.log(`${province}:`);
  console.log(`  Udane: ${data.successful}/${total} (${pct}%)`);

  if (data.failed > 0) {
    console.log(`  Nieudane przykłady:`);
    data.examples.forEach(ex => {
      console.log(`    - ${ex.city} (powiat: ${ex.county})`);
    });
  }
  console.log('');
});
