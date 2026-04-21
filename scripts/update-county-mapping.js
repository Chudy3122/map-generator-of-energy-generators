const fs = require('fs');
const path = require('path');

const GEOCODED_FILE = path.join(__dirname, 'geocoded-mappings.json');
const COUNTY_MAPPING_FILE = path.join(__dirname, '../src/utils/countyMapping.ts');

// Ładuj wyniki geocodowania
function loadGeocodedMappings() {
  if (!fs.existsSync(GEOCODED_FILE)) {
    console.error('❌ Nie znaleziono pliku geocoded-mappings.json');
    console.error('   Najpierw uruchom: node scripts/auto-geocode-cities.js');
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(GEOCODED_FILE, 'utf8'));
}

// Normalizuj nazwę powiatu do formatu używanego w aplikacji
function normalizeCountyName(county) {
  // Usuń "powiat" z nazwy
  let normalized = county.toLowerCase().trim()
    .replace(/^powiat\s+/i, '')
    .replace(/\s+powiat$/i, '');

  // Mapa specjalnych przypadków (miasta na prawach powiatu)
  const specialCases = {
    'wrocław': 'wrocławski',
    'warszawa': 'warszawski',
    'kraków': 'krakowski',
    'poznań': 'poznański',
    'gdańsk': 'gdański',
    'łódź': 'łódzki',
    'katowice': 'katowicki',
    'szczecin': 'szczeciński',
    'bydgoszcz': 'bydgoski',
    'toruń': 'toruński',
    'lublin': 'lubelski',
    'białystok': 'białostocki',
    'rzeszów': 'rzeszowski',
    'kielce': 'kielecki',
    'olsztyn': 'olsztyński',
    'opole': 'opolski',
    'gorzów wielkopolski': 'gorzowski',
    'zielona góra': 'zielonogórski',
  };

  // Sprawdź specjalne przypadki
  if (specialCases[normalized]) {
    return specialCases[normalized];
  }

  // Jeśli już jest w poprawnym formacie (kończy się na -ski, -cki, itp.)
  if (normalized.match(/(ski|cki|dzki|nski|wski|ński|ecki|ycki)$/)) {
    return normalized;
  }

  // Powiaty złożone (np. "kędzierzyńsko-kozielski")
  if (normalized.includes('-')) {
    // Już zawiera przyrostek w złożonej nazwie
    if (normalized.match(/-(kozielski|lędziński|sędziszowski|trzcianecki|drezdenecki)$/)) {
      return normalized;
    }
  }

  // Próbuj dodać odpowiedni przyrostek w zależności od końcówki
  if (normalized.endsWith('a') || normalized.endsWith('ą')) {
    return normalized.slice(0, -1) + 'ański';
  }
  if (normalized.endsWith('e') || normalized.endsWith('ę')) {
    return normalized.slice(0, -1) + 'eński';
  }
  if (normalized.endsWith('o')) {
    return normalized.slice(0, -1) + 'owski';
  }
  if (normalized.endsWith('ów') || normalized.endsWith('ow')) {
    return normalized + 'ski';
  }
  if (normalized.endsWith('y')) {
    return normalized.slice(0, -1) + 'cki';
  }
  if (normalized.endsWith('c') || normalized.endsWith('ć')) {
    return normalized + 'ki';
  }

  // Domyślnie dodaj 'ski'
  return normalized + 'ski';
}

// Aktualizuj plik countyMapping.ts
function updateCountyMappingFile(newMappings) {
  const content = fs.readFileSync(COUNTY_MAPPING_FILE, 'utf8');

  // Znajdź koniec słownika CITY_TO_COUNTY (przed zamknięciem nawiasu)
  const closingBraceIndex = content.lastIndexOf('};');

  if (closingBraceIndex === -1) {
    console.error('❌ Nie można znaleźć końca słownika CITY_TO_COUNTY');
    process.exit(1);
  }

  // Znajdź ostatni wpis przed zamknięciem (aby dodać po nim)
  const beforeClosing = content.substring(0, closingBraceIndex);
  const lastComma = beforeClosing.lastIndexOf(',');

  // Wygeneruj nowe wpisy
  const entries = Object.entries(newMappings)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([city, county]) => `  '${city}': '${normalizeCountyName(county)}'`)
    .join(',\n');

  // Wstaw nowe wpisy
  const newContent = content.substring(0, lastComma + 1) + '\n\n  // Automatycznie zmapowane miejscowości\n' + entries + '\n' + content.substring(closingBraceIndex);

  // Zapisz zaktualizowany plik
  fs.writeFileSync(COUNTY_MAPPING_FILE, newContent, 'utf8');

  console.log(`✓ Zaktualizowano ${COUNTY_MAPPING_FILE}`);
  console.log(`✓ Dodano ${Object.keys(newMappings).length} nowych mapowań`);
}

// Główna funkcja
function main() {
  console.log('📂 Wczytywanie wyników geocodowania...');
  const geocoded = loadGeocodedMappings();

  console.log(`\n📊 Statystyki:`);
  console.log(`   Pomyślnie zmapowano: ${Object.keys(geocoded.success).length}`);
  console.log(`   Nie udało się zmapować: ${geocoded.failed.length}`);

  if (Object.keys(geocoded.success).length === 0) {
    console.log('\n⚠️  Brak nowych mapowań do dodania');
    return;
  }

  console.log('\n🔧 Aktualizowanie pliku countyMapping.ts...');
  updateCountyMappingFile(geocoded.success);

  console.log('\n✅ Gotowe!');
  console.log('\n📝 Następne kroki:');
  console.log('   1. Sprawdź plik countyMapping.ts pod kątem błędów');
  console.log('   2. Uruchom: node scripts/preprocess-data.js');
  console.log('   3. Przetestuj aplikację');

  if (geocoded.failed.length > 0) {
    console.log('\n⚠️  Uwaga: Niektóre miejscowości nie zostały zmapowane:');
    geocoded.failed.slice(0, 20).forEach(city => console.log(`     - ${city}`));
    if (geocoded.failed.length > 20) {
      console.log(`     ... i ${geocoded.failed.length - 20} więcej`);
    }
    console.log('\n   Te miejscowości będą miały pole county = undefined');
  }
}

main();
