const fs = require('fs');
const path = require('path');

// Granice geograficzne województw
const PROVINCE_BOUNDS = {
  'dolnośląskie': { minLat: 50.2, maxLat: 51.8, minLon: 15.0, maxLon: 17.3 },
  'kujawsko-pomorskie': { minLat: 52.3, maxLat: 53.8, minLon: 17.5, maxLon: 19.7 },
  'lubelskie': { minLat: 50.2, maxLat: 52.0, minLon: 21.5, maxLon: 24.2 },
  'lubuskie': { minLat: 51.3, maxLat: 53.0, minLon: 14.1, maxLon: 16.0 },
  'łódzkie': { minLat: 51.0, maxLat: 52.3, minLon: 18.0, maxLon: 20.5 },
  'małopolskie': { minLat: 49.2, maxLat: 50.5, minLon: 19.0, maxLon: 21.5 },
  'mazowieckie': { minLat: 51.2, maxLat: 53.5, minLon: 19.5, maxLon: 22.8 },
  'opolskie': { minLat: 50.3, maxLat: 51.2, minLon: 17.3, maxLon: 18.6 },
  'podkarpackie': { minLat: 49.0, maxLat: 50.9, minLon: 21.0, maxLon: 23.0 },
  'podlaskie': { minLat: 52.5, maxLat: 54.4, minLon: 22.0, maxLon: 24.2 },
  'pomorskie': { minLat: 53.7, maxLat: 54.9, minLon: 16.8, maxLon: 19.5 },
  'śląskie': { minLat: 49.7, maxLat: 50.9, minLon: 18.4, maxLon: 19.8 },
  'świętokrzyskie': { minLat: 50.2, maxLat: 51.2, minLon: 19.7, maxLon: 21.5 },
  'warmińsko-mazurskie': { minLat: 53.3, maxLat: 54.5, minLon: 19.3, maxLon: 22.8 },
  'wielkopolskie': { minLat: 51.5, maxLat: 53.4, minLon: 15.6, maxLon: 18.8 },
  'zachodniopomorskie': { minLat: 52.8, maxLat: 54.4, minLon: 14.1, maxLon: 17.1 }
};

// Pary powiat-województwo (rozwiązanie problemu duplikatów)
const COUNTY_PROVINCE_PAIRS = require('./county-province-pairs.js');

function getProvinceByCoordinates(lat, lon) {
  for (const [province, bounds] of Object.entries(PROVINCE_BOUNDS)) {
    if (lat >= bounds.minLat && lat <= bounds.maxLat &&
        lon >= bounds.minLon && lon <= bounds.maxLon) {
      return province;
    }
  }
  return null;
}

function getCorrectCountyForProvince(county, province) {
  const pair = `${county}|${province}`;

  // Jeśli para istnieje w naszym mapowaniu, to znaczy że jest poprawna
  if (COUNTY_PROVINCE_PAIRS[pair]) {
    return county;
  }

  // Jeśli nie ma tej pary, szukamy czy ten powiat istnieje w innym województwie
  const allPairs = Object.keys(COUNTY_PROVINCE_PAIRS);
  const countyInOtherProvince = allPairs.find(p => p.startsWith(`${county}|`) && p !== pair);

  if (countyInOtherProvince) {
    // Ten powiat jest w innym województwie - zwróć null, żeby oznaczyć jako błędny
    return null;
  }

  // Powiat nie istnieje w naszym mapowaniu - zostaw jak jest
  return county;
}

function fixByCoordinates() {
  const processedDir = path.join(__dirname, '../public/data/processed');
  const files = [
    'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
    'rejestr_wytworców_energii_w_malej_instalacji.json',
    'inf_prezensa_ure_2025.json',
    'rekompensaty_2023_wykaz.json',
    'operatorzy_systemow_elektroenergetycznych.json',
    'lista_sprzedawcow_zobowiazanych.json'
  ];

  let totalFixed = 0;
  const fixes = [];

  console.log('\n🔧 Naprawa województw na podstawie współrzędnych...\n');

  files.forEach(file => {
    const fullPath = path.join(processedDir, file);
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

    let fixedInFile = 0;

    data.forEach(item => {
      const coords = item.coordinates;
      const currentProvince = item.installationProvince || item.province;
      const currentCounty = item.installationCounty || item.county;
      const city = item.installationCity || item.city;

      if (!coords || coords.length !== 2) return;

      const [lat, lon] = coords;
      const correctProvince = getProvinceByCoordinates(lat, lon);

      if (correctProvince && correctProvince !== currentProvince) {
        // Napraw województwo
        if (item.installationProvince) item.installationProvince = correctProvince;
        if (item.province) item.province = correctProvince;

        // Zweryfikuj czy powiat pasuje do nowego województwa
        if (currentCounty && currentCounty !== 'nieznany') {
          const validCounty = getCorrectCountyForProvince(currentCounty, correctProvince);

          if (!validCounty) {
            // Powiat nie pasuje do nowego województwa - oznacz jako nieznany
            if (item.installationCounty) item.installationCounty = 'nieznany';
            if (item.county) item.county = 'nieznany';

            fixes.push({
              city,
              oldProvince: currentProvince,
              newProvince: correctProvince,
              county: currentCounty,
              countyFixed: true,
              coords: [lat.toFixed(4), lon.toFixed(4)]
            });
          } else {
            fixes.push({
              city,
              oldProvince: currentProvince,
              newProvince: correctProvince,
              county: currentCounty,
              countyFixed: false,
              coords: [lat.toFixed(4), lon.toFixed(4)]
            });
          }
        }

        fixedInFile++;
      }
    });

    if (fixedInFile > 0) {
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✓ ${file}: naprawiono ${fixedInFile} instalacji`);
      totalFixed += fixedInFile;
    } else {
      console.log(`  ${file}: brak napraw`);
    }
  });

  // Zapisz raport
  const reportPath = path.join(__dirname, 'coordinate-based-fixes.json');
  fs.writeFileSync(reportPath, JSON.stringify(fixes, null, 2), 'utf8');

  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ Naprawiono ${totalFixed} instalacji`);
  console.log(`${'='.repeat(70)}\n`);

  if (fixes.length > 0) {
    console.log('Przykłady napraw:');
    fixes.slice(0, 10).forEach(fix => {
      const countyNote = fix.countyFixed ? ' (powiat -> nieznany)' : '';
      console.log(`  ${fix.city}: ${fix.oldProvince} -> ${fix.newProvince} [${fix.coords.join(', ')}]${countyNote}`);
    });
    console.log(`\nPełny raport: ${reportPath}\n`);
  }

  console.log('Następny krok: node scripts/find-wrong-coordinates.js\n');
}

fixByCoordinates();
