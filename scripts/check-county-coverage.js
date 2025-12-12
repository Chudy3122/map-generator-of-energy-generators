const fs = require('fs');
const path = require('path');

const processedDir = path.join(__dirname, '../public/data/processed');
const files = fs.readdirSync(processedDir).filter(f => f.endsWith('.json'));

let totalWithCounty = 0;
let totalInstallations = 0;

console.log('\n📊 Pokrycie mapowania powiatów:\n');

files.forEach(file => {
  const fullPath = path.join(processedDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  let data;

  try {
    data = JSON.parse(content);
  } catch (e) {
    console.log(`⚠️  ${file}: Błąd parsowania JSON`);
    return;
  }

  // Sprawdź czy to tablica czy obiekt
  if (!Array.isArray(data)) {
    console.log(`⚠️  ${file}: Nie jest tablicą (pomijam)`);
    return;
  }

  const withCounty = data.filter(item => item.county || item.installationCounty).length;
  totalWithCounty += withCounty;
  totalInstallations += data.length;

  const pct = Math.round(withCounty / data.length * 100);
  console.log(`${file}: ${withCounty}/${data.length} (${pct}%)`);
});

console.log('\n' + '='.repeat(60));
console.log(`✅ RAZEM: ${totalWithCounty}/${totalInstallations} (${Math.round(totalWithCounty/totalInstallations*100)}%)`);
console.log('='.repeat(60) + '\n');

if (totalWithCounty === totalInstallations) {
  console.log('🎉 SUKCES! Wszystkie instalacje mają przypisany powiat!\n');
} else {
  console.log(`⚠️  Brakuje mapowania dla ${totalInstallations - totalWithCounty} instalacji\n`);
}
