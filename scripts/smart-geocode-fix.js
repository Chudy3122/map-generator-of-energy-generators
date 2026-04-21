const fs = require('fs');
const path = require('path');
const axios = require('axios');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Granice geograficzne dla województw
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

async function geocodeWithStrategy(city, province, county) {
  const strategies = [
    // Strategia 1: Miasto, powiat, województwo
    { query: `${city}, powiat ${county}, województwo ${province}, Polska`, priority: 1 },

    // Strategia 2: Miasto, województwo
    { query: `${city}, województwo ${province}, Polska`, priority: 2 },

    // Strategia 3: Miasto, Polska (z filtrowaniem po boundach)
    { query: `${city}, Polska`, priority: 3 }
  ];

  for (const strategy of strategies) {
    try {
      console.log(`    Próba ${strategy.priority}: ${strategy.query}`);

      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: strategy.query,
          format: 'json',
          limit: 10,
          countrycodes: 'pl'
        },
        headers: {
          'User-Agent': 'MapaWytworcowEnergii/1.0'
        }
      });

      await delay(1100); // 1.1 sekundy między requestami dla bezpieczeństwa

      if (response.data && response.data.length > 0) {
        // Szukaj wyniku w granicach województwa
        for (const result of response.data) {
          const lat = parseFloat(result.lat);
          const lon = parseFloat(result.lon);

          if (isWithinBounds(lat, lon, province)) {
            console.log(`    ✓ Znaleziono w granicach: [${lat.toFixed(4)}, ${lon.toFixed(4)}]`);
            return {
              coords: [lat, lon],
              strategy: strategy.priority,
              confidence: 'high',
              displayName: result.display_name
            };
          }
        }

        // Jeśli nie znaleziono w granicach, ale to była strategia 1 lub 2, weź pierwszy wynik
        if (strategy.priority <= 2) {
          const first = response.data[0];
          const lat = parseFloat(first.lat);
          const lon = parseFloat(first.lon);
          console.log(`    ⚠ Poza granicami, ale akceptuję: [${lat.toFixed(4)}, ${lon.toFixed(4)}]`);

          return {
            coords: [lat, lon],
            strategy: strategy.priority,
            confidence: 'medium',
            displayName: first.display_name
          };
        }
      }
    } catch (error) {
      console.error(`    ❌ Błąd strategii ${strategy.priority}:`, error.message);
    }
  }

  return null;
}

async function smartGeocodeFix() {
  const wrongCoordsPath = path.join(__dirname, 'wrong-coordinates.json');
  const progressPath = path.join(__dirname, 'geocode-fix-progress.json');
  const outputPath = path.join(__dirname, 'geocode-corrections.json');

  // Sprawdź czy są dane do poprawy
  if (!fs.existsSync(wrongCoordsPath)) {
    console.log('❌ Najpierw uruchom: node scripts/find-wrong-coordinates.js');
    return;
  }

  // Wczytaj błędne współrzędne
  const wrongData = JSON.parse(fs.readFileSync(wrongCoordsPath, 'utf8'));

  // Wczytaj progress jeśli istnieje
  let corrections = {};
  if (fs.existsSync(progressPath)) {
    corrections = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    console.log(`📂 Wczytano poprzedni progress: ${Object.keys(corrections).length} miast\n`);
  }

  // Zbierz unikalne miasta do przetworzenia
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
  const alreadyDone = Object.keys(corrections).length;

  console.log(`\n🔧 Smart Geocoding Fix\n`);
  console.log(`Miasta do przetworzenia: ${total}`);
  console.log(`Już przetworzone: ${alreadyDone}`);
  console.log(`Pozostało: ${total}\n`);

  if (total === 0) {
    console.log('✅ Wszystko już przetworzone!\n');
    return;
  }

  const startTime = Date.now();
  let processed = 0;
  let successful = 0;
  let failed = 0;

  for (const item of citiesToProcess) {
    processed++;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const rate = processed / elapsed;
    const remaining = (total - processed) / rate;
    const remainingMin = Math.round(remaining / 60);

    console.log(`\n[${ processed}/${total}] (${Math.round(processed/total*100)}%) - Pozostało ~${remainingMin}min`);
    console.log(`${item.city} (${item.province}, powiat ${item.county})`);
    console.log(`  Instalacji: ${item.count}, Stare coords: [${item.oldCoords[0].toFixed(4)}, ${item.oldCoords[1].toFixed(4)}]`);

    const result = await geocodeWithStrategy(item.city, item.province, item.county);

    if (result) {
      corrections[item.key] = {
        city: item.city,
        province: item.province,
        county: item.county,
        oldCoords: item.oldCoords,
        newCoords: result.coords,
        strategy: result.strategy,
        confidence: result.confidence,
        displayName: result.displayName,
        count: item.count
      };
      successful++;
      console.log(`  ✅ Sukces (strategia ${result.strategy}, ${result.confidence})`);
    } else {
      corrections[item.key] = {
        city: item.city,
        province: item.province,
        county: item.county,
        oldCoords: item.oldCoords,
        newCoords: null,
        strategy: null,
        confidence: 'failed',
        count: item.count
      };
      failed++;
      console.log(`  ❌ Nie udało się znaleźć`);
    }

    // Zapisz progress co 5 miast
    if (processed % 5 === 0) {
      fs.writeFileSync(progressPath, JSON.stringify(corrections, null, 2), 'utf8');
      console.log(`  💾 Progress zapisany (${processed}/${total})`);
    }
  }

  // Zapisz finalne wyniki
  fs.writeFileSync(outputPath, JSON.stringify(corrections, null, 2), 'utf8');
  fs.writeFileSync(progressPath, JSON.stringify(corrections, null, 2), 'utf8');

  const totalTime = Math.round((Date.now() - startTime) / 60000);

  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`✅ ZAKOŃCZONO!`);
  console.log(`${'='.repeat(70)}\n`);
  console.log(`Przetworzone miasta: ${Object.keys(corrections).length}`);
  console.log(`Udane: ${successful}`);
  console.log(`Nieudane: ${failed}`);
  console.log(`Czas: ${totalTime} minut\n`);
  console.log(`📁 Wyniki zapisane w: ${outputPath}\n`);
  console.log(`Następny krok: node scripts/apply-coordinate-corrections.js\n`);
}

smartGeocodeFix().catch(console.error);
