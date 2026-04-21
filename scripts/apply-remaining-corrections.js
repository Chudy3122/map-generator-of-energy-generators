const fs = require('fs');
const path = require('path');

function applyRemainingCorrections() {
  const correctionsPath = path.join(__dirname, 'remaining-coords-corrections.json');

  if (!fs.existsSync(correctionsPath)) {
    console.log('❌ Brak pliku z poprawkami. Najpierw uruchom: node scripts/fix-remaining-coords.js');
    return;
  }

  const corrections = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));

  // Stwórz mapę: city|province -> newCoords
  const coordsMap = new Map();
  let validCorrections = 0;
  let failedCorrections = 0;

  Object.values(corrections).forEach(correction => {
    const key = `${correction.city}|${correction.province}`;

    if (correction.newCoords) {
      coordsMap.set(key, correction.newCoords);
      validCorrections++;
    } else {
      failedCorrections++;
    }
  });

  console.log(`\n📝 Aplikowanie pozostałych poprawek...\n`);
  console.log(`Poprawki do zastosowania: ${validCorrections}`);
  console.log(`Nieudane geokodowania: ${failedCorrections}\n`);

  const processedDir = path.join(__dirname, '../public/data/processed');
  const files = [
    'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
    'rejestr_wytworców_energii_w_malej_instalacji.json',
    'inf_prezensa_ure_2025.json',
    'rekompensaty_2023_wykaz.json',
    'operatorzy_systemow_elektroenergetycznych.json',
    'lista_sprzedawcow_zobowiazanych.json'
  ];

  let totalUpdated = 0;

  files.forEach(file => {
    const fullPath = path.join(processedDir, file);
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

    let updatedInFile = 0;

    data.forEach(item => {
      const province = item.installationProvince || item.province;
      const city = item.installationCity || item.city;

      if (!province || !city) return;

      const key = `${city}|${province}`;

      if (coordsMap.has(key)) {
        const newCoords = coordsMap.get(key);
        item.coordinates = newCoords;
        updatedInFile++;
      }
    });

    if (updatedInFile > 0) {
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✓ ${file}: zaktualizowano ${updatedInFile} instalacji`);
      totalUpdated += updatedInFile;
    } else {
      console.log(`  ${file}: brak aktualizacji`);
    }
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ Zaktualizowano ${totalUpdated} instalacji`);
  console.log(`${'='.repeat(70)}\n`);
  console.log(`Następny krok: Zweryfikuj poprawki uruchamiając:`);
  console.log(`node scripts/find-wrong-coordinates.js\n`);
}

applyRemainingCorrections();
