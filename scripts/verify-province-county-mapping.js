const fs = require('fs');
const path = require('path');

const COUNTY_TO_PROVINCE = require('./county-to-province-mapping.js');

const processedDir = path.join(__dirname, '../public/data/processed');
const files = [
  'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
  'rejestr_wytworców_energii_w_malej_instalacji.json',
  'inf_prezensa_ure_2025.json',
  'rekompensaty_2023_wykaz.json',
  'operatorzy_systemow_elektroenergetycznych.json',
  'lista_sprzedawcow_zobowiazanych.json'
];

console.log('\n🔍 Weryfikacja poprawności mapowania województw i powiatów...\n');

let totalErrors = 0;
const errorExamples = [];

files.forEach(file => {
  const fullPath = path.join(processedDir, file);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  let errorsInFile = 0;

  data.forEach((item, idx) => {
    // Sprawdź province vs county
    if (item.county && item.county !== 'nieznany' && COUNTY_TO_PROVINCE[item.county]) {
      const expectedProvince = COUNTY_TO_PROVINCE[item.county];
      if (item.province !== expectedProvince) {
        errorsInFile++;
        if (errorExamples.length < 10) {
          errorExamples.push({
            file,
            city: item.city,
            county: item.county,
            province: item.province,
            expectedProvince
          });
        }
      }
    }

    // Sprawdź installationProvince vs installationCounty
    if (item.installationCounty && item.installationCounty !== 'nieznany' && COUNTY_TO_PROVINCE[item.installationCounty]) {
      const expectedProvince = COUNTY_TO_PROVINCE[item.installationCounty];
      if (item.installationProvince !== expectedProvince) {
        errorsInFile++;
        if (errorExamples.length < 10) {
          errorExamples.push({
            file,
            city: item.installationCity,
            county: item.installationCounty,
            province: item.installationProvince,
            expectedProvince
          });
        }
      }
    }
  });

  if (errorsInFile > 0) {
    console.log(`❌ ${file}: ${errorsInFile} błędów`);
    totalErrors += errorsInFile;
  } else {
    console.log(`✅ ${file}: wszystko poprawne`);
  }
});

console.log('\n' + '='.repeat(70));

if (totalErrors > 0) {
  console.log(`\n❌ Znaleziono ${totalErrors} niezgodności!\n`);

  console.log('Przykłady błędów:');
  errorExamples.forEach((err, idx) => {
    console.log(`\n${idx + 1}. ${err.city} (${err.file})`);
    console.log(`   Powiat: ${err.county}`);
    console.log(`   Województwo w danych: ${err.province}`);
    console.log(`   Powinno być: ${err.expectedProvince}`);
  });

  console.log('\n⚠️  Uruchom: node scripts/fix-province-by-county.js aby naprawić\n');
} else {
  console.log('\n✅ Wszystkie mapowania są poprawne!\n');
}

// Sprawdź też czy są powiaty, których nie ma w mapowaniu
console.log('\n🔍 Sprawdzanie czy wszystkie powiaty są w mapowaniu...\n');

const unknownCounties = new Set();

files.forEach(file => {
  const fullPath = path.join(processedDir, file);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  data.forEach(item => {
    if (item.county && item.county !== 'nieznany' && !COUNTY_TO_PROVINCE[item.county]) {
      unknownCounties.add(item.county);
    }
    if (item.installationCounty && item.installationCounty !== 'nieznany' && !COUNTY_TO_PROVINCE[item.installationCounty]) {
      unknownCounties.add(item.installationCounty);
    }
  });
});

if (unknownCounties.size > 0) {
  console.log(`⚠️  Znaleziono ${unknownCounties.size} powiatów bez mapowania:\n`);
  Array.from(unknownCounties).sort().forEach((county, idx) => {
    console.log(`${idx + 1}. ${county}`);
  });
  console.log('');
} else {
  console.log('✅ Wszystkie powiaty mają przypisane województwa\n');
}
