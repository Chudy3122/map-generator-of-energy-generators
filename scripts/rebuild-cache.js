const fs = require('fs');
const path = require('path');

console.log('\n🗑️  Czyszczenie starego cache...\n');

const cacheFile = path.join(__dirname, 'geocode-cache.json');
const backupFile = path.join(__dirname, 'geocode-cache-backup.json');

if (fs.existsSync(cacheFile)) {
  // Backup starego cache
  fs.copyFileSync(cacheFile, backupFile);
  console.log(`✓ Backup stworzony: ${backupFile}`);

  // Usuń stary cache
  fs.unlinkSync(cacheFile);
  console.log(`✓ Stary cache usunięty`);
}

console.log('\n✅ Cache wyczyszczony!\n');
console.log('Następne kroki:');
console.log('1. node scripts/preprocess-data.js  (to zajmie ~30-60 min - będzie geokodować wszystkie miasta)');
console.log('2. node scripts/find-wrong-coordinates.js  (sprawdź wyniki)\n');
