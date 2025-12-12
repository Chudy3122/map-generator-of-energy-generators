const fs = require('fs');
const path = require('path');

const processedDir = path.join(__dirname, '../public/data/processed');
const files = [
  'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
  'rejestr_wytworców_energii_w_malej_instalacji.json',
  'inf_prezensa_ure_2025.json',
  'rekompensaty_2023_wykaz.json',
  'operatorzy_systemow_elektroenergetycznych.json',
  'lista_sprzedawcow_zobowiazanych.json'
];

const missingCities = new Set();
const missingDetails = [];

files.forEach(file => {
  const fullPath = path.join(processedDir, file);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  data.forEach((item, idx) => {
    const hasCounty = item.county || item.installationCounty;
    if (!hasCounty) {
      const city = item.installationCity || item.city;
      if (city) {
        missingCities.add(city);
        missingDetails.push({
          file,
          city,
          name: item.name,
          province: item.installationProvince || item.province
        });
      }
    }
  });
});

console.log('\n📊 Miejscowości bez przypisanego powiatu:\n');
console.log(`Liczba unikalnych miejscowości: ${missingCities.size}\n`);

const sortedCities = Array.from(missingCities).sort();
sortedCities.forEach((city, idx) => {
  console.log(`${idx + 1}. ${city}`);
});

console.log('\n' + '='.repeat(60));
console.log(`\nSzczegóły (pierwsze 20 przykładów):\n`);

missingDetails.slice(0, 20).forEach((detail, idx) => {
  console.log(`${idx + 1}. ${detail.city} (${detail.province})`);
  console.log(`   Plik: ${detail.file}`);
  console.log(`   Nazwa: ${detail.name.substring(0, 60)}${detail.name.length > 60 ? '...' : ''}`);
  console.log('');
});

if (missingDetails.length > 20) {
  console.log(`... i ${missingDetails.length - 20} więcej\n`);
}

console.log('💡 Te miejscowości powinny zostać dodane do countyMapping.ts\n');
