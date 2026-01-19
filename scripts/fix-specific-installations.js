const fs = require('fs');
const path = require('path');

// Poprawki dla konkretnych instalacji (po nazwie firmy)
const INSTALLATION_FIXES = {
  'HORTINO Zakład Przetwórstwa Owocowo-Warzywnego Leżajsk Sp. z o.o.': {
    correctProvince: 'podkarpackie',
    correctCounty: 'leżajski',
    correctCoordinates: [50.26025084938381, 22.417271770850967]
  }
};

function fixSpecificInstallations() {
  const processedDir = path.join(__dirname, '../public/data/processed');

  const files = [
    'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
    'rejestr_wytworców_energii_w_malej_instalacji.json',
    'inf_prezensa_ure_2025.json',
    'rekompensaty_2023_wykaz.json',
    'operatorzy_systemow_elektroenergetycznych.json',
    'lista_sprzedawcow_zobowiazanych.json'
  ];

  console.log('\n🔧 Naprawa konkretnych instalacji po nazwie firmy\n');

  let totalUpdated = 0;

  files.forEach(file => {
    const fullPath = path.join(processedDir, file);

    if (!fs.existsSync(fullPath)) {
      return;
    }

    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    let updatedInFile = 0;

    data.forEach(item => {
      const fix = INSTALLATION_FIXES[item.name];

      if (fix) {
        console.log(`📍 Znaleziono: ${item.name}`);
        console.log(`   Stare: ${item.province}, [${item.coordinates}]`);

        // Zaktualizuj dane
        item.province = fix.correctProvince;
        if (item.installationProvince) item.installationProvince = fix.correctProvince;

        item.county = fix.correctCounty;
        if (item.installationCounty) item.installationCounty = fix.correctCounty;

        item.coordinates = fix.correctCoordinates;

        console.log(`   Nowe: ${item.province}, [${item.coordinates}]`);
        updatedInFile++;
      }
    });

    if (updatedInFile > 0) {
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✓ ${file}: zaktualizowano ${updatedInFile} instalacji\n`);
      totalUpdated += updatedInFile;
    }
  });

  console.log('='.repeat(70));
  console.log(`✅ Zaktualizowano łącznie ${totalUpdated} instalacji`);
  console.log('='.repeat(70) + '\n');
}

fixSpecificInstallations();
