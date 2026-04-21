const fs = require('fs');
const path = require('path');
const https = require('https');

const PROCESSED_DATA_DIR = path.join(__dirname, '../public/data/processed');
const COUNTY_MAPPING_FILE = path.join(__dirname, '../src/utils/countyMapping.ts');

// Wczytaj istniejące mapowanie
function loadExistingMapping() {
  const content = fs.readFileSync(COUNTY_MAPPING_FILE, 'utf8');
  const match = content.match(/export const CITY_TO_COUNTY: Record<string, string> = \{([\s\S]*?)\};/);
  if (!match) return {};

  const mapping = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const cityMatch = line.match(/'([^']+)':\s*'([^']+)'/);
    if (cityMatch) {
      mapping[cityMatch[1]] = cityMatch[2];
    }
  }
  return mapping;
}

// Wyciągnij wszystkie unikalne miejscowości z danych
function extractAllCities() {
  const cities = new Set();
  const files = [
    'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
    'rejestr_wytworców_energii_w_malej_instalacji.json',
    'inf_prezensa_ure_2025.json',
    'rekompensaty_2023_wykaz.json',
    'operatorzy_systemow_elektroenergetycznych.json',
    'lista_sprzedawcow_zobowiazanych.json'
  ];

  files.forEach(filename => {
    const filePath = path.join(PROCESSED_DATA_DIR, filename);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        data.forEach(item => {
          if (item.city) cities.add(item.city.trim());
          if (item.installationCity) cities.add(item.installationCity.trim());
        });
      } catch (err) {
        console.error(`Błąd wczytywania ${filename}:`, err.message);
      }
    }
  });

  return Array.from(cities).filter(city =>
    city && city.length > 1 && !city.match(/^\d/) && !city.includes(',')
  ).sort();
}

// Geocoduj miasto używając Nominatim API
function geocodeCity(city) {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(`${city}, Poland`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1`;

    const options = {
      headers: {
        'User-Agent': 'Mapa-Polski-Energy-App/1.0'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.length > 0 && json[0].address) {
            const address = json[0].address;
            // Próbuj znaleźć powiat w różnych polach
            const county = address.county || address.state_district || address.state;
            if (county) {
              // Konwertuj na format bez "powiat" i małymi literami
              const countyName = county
                .toLowerCase()
                .replace(/powiat\s+/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
              resolve(countyName);
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

// Główna funkcja
async function main() {
  console.log('🔍 Wczytywanie istniejącego mapowania...');
  const existingMapping = loadExistingMapping();
  console.log(`✓ Znaleziono ${Object.keys(existingMapping).length} istniejących mapowań\n`);

  console.log('📊 Wyciąganie wszystkich miejscowości z danych...');
  const allCities = extractAllCities();
  console.log(`✓ Znaleziono ${allCities.length} unikalnych miejscowości\n`);

  // Znajdź miejscowości bez mapowania
  const unmappedCities = allCities.filter(city => !existingMapping[city]);
  console.log(`📍 Miejscowości do zmapowania: ${unmappedCities.length}\n`);

  if (unmappedCities.length === 0) {
    console.log('✅ Wszystkie miejscowości są już zmapowane!');
    return;
  }

  console.log('⚠️  UWAGA: Geocodowanie займе ~30-60 sekund na 100 miejscowości');
  console.log('⚠️  Nominatim ma limit 1 zapytanie na sekundę');
  console.log('⚠️  Dla ~4000 miejscowości to zajmie około 1 godziny\n');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('Czy kontynuować? (tak/nie): ', async (answer) => {
    readline.close();

    if (answer.toLowerCase() !== 'tak') {
      console.log('❌ Anulowano');
      return;
    }

    const newMappings = {};
    const failed = [];
    let processed = 0;

    console.log('\n🚀 Rozpoczynam geocodowanie...\n');

    for (const city of unmappedCities) {
      try {
        const county = await geocodeCity(city);
        if (county) {
          newMappings[city] = county;
          console.log(`✓ ${city} → ${county}`);
        } else {
          failed.push(city);
          console.log(`✗ ${city} → brak wyniku`);
        }
      } catch (err) {
        failed.push(city);
        console.log(`✗ ${city} → błąd: ${err.message}`);
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`\n[${processed}/${unmappedCities.length}] Postęp: ${Math.round(processed/unmappedCities.length*100)}%\n`);
      }

      // Odczekaj 1.1 sekundy między zapytaniami (limit Nominatim)
      await new Promise(resolve => setTimeout(resolve, 1100));
    }

    console.log('\n\n📊 Podsumowanie:');
    console.log(`✓ Pomyślnie zmapowano: ${Object.keys(newMappings).length}`);
    console.log(`✗ Nie udało się zmapować: ${failed.length}`);

    if (failed.length > 0) {
      console.log('\nNiemożliwe do zmapowania:');
      failed.forEach(city => console.log(`  - ${city}`));
    }

    // Zapisz wyniki do pliku JSON
    const outputFile = path.join(__dirname, 'geocoded-mappings.json');
    fs.writeFileSync(outputFile, JSON.stringify({
      success: newMappings,
      failed: failed
    }, null, 2));

    console.log(`\n✓ Wyniki zapisane do: ${outputFile}`);
    console.log('\n📝 Następny krok: Uruchom update-county-mapping.js aby zaktualizować countyMapping.ts');
  });
}

main().catch(console.error);
