const fs = require('fs');
const path = require('path');

// Granice geograficzne dla województw (przybliżone)
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

function isWithinBounds(lat, lon, province) {
  if (!PROVINCE_BOUNDS[province]) return true; // Skip if no bounds defined

  const bounds = PROVINCE_BOUNDS[province];
  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lon >= bounds.minLon && lon <= bounds.maxLon;
}

const processedDir = path.join(__dirname, '../public/data/processed');
const files = [
  'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
  'rejestr_wytworców_energii_w_malej_instalacji.json',
  'inf_prezensa_ure_2025.json',
  'rekompensaty_2023_wykaz.json',
  'operatorzy_systemow_elektroenergetycznych.json',
  'lista_sprzedawcow_zobowiazanych.json'
];

console.log('\n🔍 Szukam błędnych geolokalizacji...\n');

const wrongByProvince = {};
const wrongCities = new Map(); // Map: city -> { province, county, coords, count }

let totalWrong = 0;
let totalChecked = 0;

files.forEach(file => {
  const fullPath = path.join(processedDir, file);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  data.forEach(item => {
    const province = item.installationProvince || item.province;
    const city = item.installationCity || item.city;
    const county = item.installationCounty || item.county;
    const coords = item.coordinates;

    if (!province || !coords || province === 'nieznany') return;

    totalChecked++;

    if (!isWithinBounds(coords[0], coords[1], province)) {
      totalWrong++;

      if (!wrongByProvince[province]) {
        wrongByProvince[province] = [];
      }

      wrongByProvince[province].push({
        city,
        county,
        coords,
        file
      });

      // Track unique cities with wrong coords
      const key = `${city}|${province}`;
      if (!wrongCities.has(key)) {
        wrongCities.set(key, {
          city,
          province,
          county,
          coords,
          count: 1
        });
      } else {
        wrongCities.get(key).count++;
      }
    }
  });
});

console.log(`📊 Statystyki:\n`);
console.log(`Sprawdzonych instalacji: ${totalChecked}`);
console.log(`Błędnych geolokalizacji: ${totalWrong} (${Math.round(totalWrong/totalChecked*100)}%)\n`);

console.log(`\n📍 Błędne geolokalizacje według województw:\n`);

Object.keys(wrongByProvince).sort().forEach(province => {
  const wrong = wrongByProvince[province];
  console.log(`${province}: ${wrong.length} błędnych`);
});

console.log(`\n\n🏙️ Lista unikalnych miast z błędnymi współrzędnymi:\n`);

// Group by province for better readability
const citiesByProvince = {};
wrongCities.forEach((data, key) => {
  if (!citiesByProvince[data.province]) {
    citiesByProvince[data.province] = [];
  }
  citiesByProvince[data.province].push(data);
});

Object.keys(citiesByProvince).sort().forEach(province => {
  console.log(`\n=== ${province.toUpperCase()} ===`);
  citiesByProvince[province].forEach(data => {
    console.log(`  ${data.city} (powiat: ${data.county})`);
    console.log(`    Aktualne współrzędne: [${data.coords[0].toFixed(4)}, ${data.coords[1].toFixed(4)}]`);
    console.log(`    Liczba instalacji: ${data.count}`);
  });
});

// Save to file for correction
const outputPath = path.join(__dirname, 'wrong-coordinates.json');
const outputData = {
  summary: {
    totalChecked,
    totalWrong,
    percentage: Math.round(totalWrong/totalChecked*100)
  },
  citiesByProvince: citiesByProvince
};

fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
console.log(`\n\n💾 Szczegóły zapisane w: ${outputPath}\n`);
