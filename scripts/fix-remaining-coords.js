const fs = require('fs');
const path = require('path');
const axios = require('axios');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  if (!PROVINCE_BOUNDS[province]) return true;
  const bounds = PROVINCE_BOUNDS[province];
  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lon >= bounds.minLon && lon <= bounds.maxLon;
}

async function geocodeWithBounds(city, province, county) {
  const bounds = PROVINCE_BOUNDS[province];
  if (!bounds) {
    console.log(`    ⚠ Brak granic dla ${province}`);
    return null;
  }

  // Bounding box dla Nominatim: left,top,right,bottom (minLon,maxLat,maxLon,minLat)
  const viewbox = `${bounds.minLon},${bounds.maxLat},${bounds.maxLon},${bounds.minLat}`;

  const strategies = [
    { query: `${city}, ${province}, Polska`, bounded: 1 },
    { query: `${city}, Polska`, bounded: 1 },
    { query: `${city}`, bounded: 1 },
  ];

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];

    try {
      console.log(`    Próba ${i + 1}: ${strategy.query} (z boundbox)`);

      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: strategy.query,
          format: 'json',
          limit: 10,
          countrycodes: 'pl',
          viewbox: viewbox,
          bounded: strategy.bounded
        },
        headers: {
          'User-Agent': 'MapaWytworcowEnergii/1.0'
        }
      });

      await delay(1100);

      if (response.data && response.data.length > 0) {
        // Zawsze weryfikuj granice
        for (const result of response.data) {
          const lat = parseFloat(result.lat);
          const lon = parseFloat(result.lon);

          if (isWithinBounds(lat, lon, province)) {
            console.log(`    ✓ [${lat.toFixed(4)}, ${lon.toFixed(4)}] - ${result.display_name.substring(0, 60)}`);
            return [lat, lon];
          }
        }

        console.log(`    ❌ Znaleziono wyniki ale poza granicami województwa`);
      }
    } catch (error) {
      console.error(`    ❌ Błąd:`, error.message);
    }
  }

  return null;
}

async function fixRemainingCoords() {
  const wrongCoordsPath = path.join(__dirname, 'wrong-coordinates.json');
  const progressPath = path.join(__dirname, 'remaining-coords-fix-progress.json');
  const outputPath = path.join(__dirname, 'remaining-coords-corrections.json');

  if (!fs.existsSync(wrongCoordsPath)) {
    console.log('❌ Uruchom najpierw: node scripts/find-wrong-coordinates.js');
    return;
  }

  const wrongData = JSON.parse(fs.readFileSync(wrongCoordsPath, 'utf8'));

  let corrections = {};

  // Sprawdź czy progress nie jest za stary
  if (fs.existsSync(progressPath) && fs.existsSync(outputPath)) {
    const progressStats = fs.statSync(progressPath);
    const wrongStats = fs.statSync(wrongCoordsPath);

    // Jeśli wrong-coordinates.json jest nowszy niż progress, usuń progress
    if (wrongStats.mtime > progressStats.mtime) {
      console.log(`⚠️  wrong-coordinates.json jest nowszy niż progress - resetuję progress\n`);
      fs.unlinkSync(progressPath);
    }
  }

  if (fs.existsSync(progressPath)) {
    corrections = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    console.log(`📂 Wczytano progress: ${Object.keys(corrections).length} miast\n`);
  }

  const citiesToProcess = [];
  const processedKeys = new Set(Object.keys(corrections));

  for (const [province, cities] of Object.entries(wrongData.citiesByProvince)) {
    for (const cityData of cities) {
      const key = `${cityData.city}|${province}`;
      if (!processedKeys.has(key)) {
        citiesToProcess.push({
          key,
          city: cityData.city,
          province,
          county: cityData.county,
          count: cityData.count,
          oldCoords: cityData.coords
        });
      }
    }
  }

  const total = citiesToProcess.length;
  console.log(`\n🔧 Naprawa pozostałych błędnych współrzędnych\n`);
  console.log(`Do przetworzenia: ${total} miast\n`);

  if (total === 0) {
    console.log('✅ Wszystko już przetworzone!\n');
    return;
  }

  let processed = 0;
  let successful = 0;
  let failed = 0;

  for (const item of citiesToProcess) {
    processed++;

    console.log(`\n[${processed}/${total}] ${item.city} (${item.province}, powiat: ${item.county})`);
    console.log(`  Instalacji: ${item.count}`);

    const newCoords = await geocodeWithBounds(item.city, item.province, item.county);

    if (newCoords) {
      corrections[item.key] = {
        city: item.city,
        province: item.province,
        county: item.county,
        oldCoords: item.oldCoords,
        newCoords,
        count: item.count
      };
      successful++;
    } else {
      corrections[item.key] = {
        city: item.city,
        province: item.province,
        county: item.county,
        oldCoords: item.oldCoords,
        newCoords: null,
        count: item.count
      };
      failed++;
      console.log(`  ❌ Nie udało się znaleźć w granicach województwa`);
    }

    if (processed % 5 === 0) {
      fs.writeFileSync(progressPath, JSON.stringify(corrections, null, 2), 'utf8');
      console.log(`  💾 Progress zapisany`);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(corrections, null, 2), 'utf8');
  console.log(`\n\n✅ Zakończono!`);
  console.log(`Udane: ${successful}`);
  console.log(`Nieudane: ${failed}`);
  console.log(`\nWyniki: ${outputPath}\n`);
  console.log(`Następny krok: node scripts/apply-remaining-corrections.js\n`);
}

fixRemainingCoords().catch(console.error);
