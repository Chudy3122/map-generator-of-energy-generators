const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Rate limiter dla Nominatim (max 1 request/second)
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

async function geocodeCity(city, province, county) {
  try {
    // Try with full location: city, województwo province, Poland
    const query = `${city}, województwo ${province}, Polska`;

    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: 5,
        countrycodes: 'pl'
      },
      headers: {
        'User-Agent': 'MapaWytworco wEnergii/1.0'
      }
    });

    if (response.data && response.data.length > 0) {
      // Find first result within province bounds
      for (const result of response.data) {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        if (isWithinBounds(lat, lon, province)) {
          return [lat, lon];
        }
      }

      // If no result within bounds, return first result anyway
      const first = response.data[0];
      return [parseFloat(first.lat), parseFloat(first.lon)];
    }

    return null;
  } catch (error) {
    console.error(`Błąd geokodowania ${city}:`, error.message);
    return null;
  }
}

async function fixCoordinates() {
  const wrongCoordsPath = path.join(__dirname, 'wrong-coordinates.json');

  if (!fs.existsSync(wrongCoordsPath)) {
    console.log('❌ Najpierw uruchom: node scripts/find-wrong-coordinates.js');
    return;
  }

  const wrongData = JSON.parse(fs.readFileSync(wrongCoordsPath, 'utf8'));
  const corrections = {};
  let processed = 0;
  let total = 0;

  // Count total cities to process
  Object.values(wrongData.citiesByProvince).forEach(cities => {
    total += cities.length;
  });

  console.log(`\n🔧 Naprawa błędnych geolokalizacji...\n`);
  console.log(`Miast do przetworzenia: ${total}\n`);

  for (const [province, cities] of Object.entries(wrongData.citiesByProvince)) {
    console.log(`\n=== ${province.toUpperCase()} ===`);

    for (const cityData of cities) {
      processed++;
      const { city, county } = cityData;

      console.log(`[${processed}/${total}] ${city} (powiat: ${county})...`);

      const newCoords = await geocodeCity(city, province, county);

      if (newCoords) {
        const key = `${city}|${province}`;
        corrections[key] = {
          city,
          province,
          county,
          oldCoords: cityData.coords,
          newCoords,
          count: cityData.count
        };
        console.log(`  ✓ Nowe współrzędne: [${newCoords[0].toFixed(4)}, ${newCoords[1].toFixed(4)}]`);
      } else {
        console.log(`  ❌ Nie znaleziono`);
      }

      // Wait 1 second between requests (Nominatim policy)
      await delay(1000);

      // Save progress every 10 cities
      if (processed % 10 === 0) {
        const progressPath = path.join(__dirname, 'coordinate-corrections-progress.json');
        fs.writeFileSync(progressPath, JSON.stringify(corrections, null, 2), 'utf8');
      }
    }
  }

  // Save final corrections
  const outputPath = path.join(__dirname, 'coordinate-corrections.json');
  fs.writeFileSync(outputPath, JSON.stringify(corrections, null, 2), 'utf8');

  console.log(`\n\n✅ Zakończono! Poprawki zapisane w: ${outputPath}`);
  console.log(`Poprawionych miast: ${Object.keys(corrections).length}/${total}\n`);
}

fixCoordinates().catch(console.error);
