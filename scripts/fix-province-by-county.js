const fs = require('fs');
const path = require('path');

// Mapowanie powiatów do województw
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

console.log('\n🔧 Naprawiam województwa na podstawie powiatów...\n');

let totalFixed = 0;

files.forEach(file => {
  const fullPath = path.join(processedDir, file);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  let fixedInFile = 0;

  data.forEach(item => {
    // Napraw province na podstawie county
    if (item.county && item.county !== 'nieznany' && COUNTY_TO_PROVINCE[item.county]) {
      const correctProvince = COUNTY_TO_PROVINCE[item.county];
      if (item.province !== correctProvince) {
        item.province = correctProvince;
        fixedInFile++;
      }
    }

    // Napraw installationProvince na podstawie installationCounty
    if (item.installationCounty && item.installationCounty !== 'nieznany' && COUNTY_TO_PROVINCE[item.installationCounty]) {
      const correctProvince = COUNTY_TO_PROVINCE[item.installationCounty];
      if (item.installationProvince !== correctProvince) {
        item.installationProvince = correctProvince;
        fixedInFile++;
      }
    }
  });

  if (fixedInFile > 0) {
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✓ ${file}: naprawiono ${fixedInFile} wpisów`);
    totalFixed += fixedInFile;
  } else {
    console.log(`  ${file}: brak błędów`);
  }
});

console.log(`\n✅ Naprawiono łącznie ${totalFixed} województw!\n`);
