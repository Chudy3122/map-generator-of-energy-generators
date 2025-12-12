const fs = require('fs');
const path = require('path');

const COUNTY_MAPPING_FILE = path.join(__dirname, '../src/utils/countyMapping.ts');

// Mapowanie województw na powiaty główne/stolicy
const wojewodztwoToPowiat = {
  'województwo dolnośląskie': 'wrocławski',
  'województwo kujawsko-pomorskie': 'bydgoski',
  'województwo lubelskie': 'lubelski',
  'województwo lubuskie': 'zielonogórski',
  'województwo łódzkie': 'łódzki',
  'województwo małopolskie': 'krakowski',
  'województwo mazowieckie': 'warszawski',
  'województwo opolskie': 'opolski',
  'województwo podkarpackie': 'rzeszowski',
  'województwo podlaskie': 'białostocki',
  'województwo pomorskie': 'gdański',
  'województwo śląskie': 'katowicki',
  'województwo świętokrzyskie': 'kielecki',
  'województwo warmińsko-mazurskie': 'olsztyński',
  'województwo wielkopolskie': 'poznański',
  'województwo zachodniopomorskie': 'szczeciński',
};

console.log('🔧 Naprawiam błędy z województwami w countyMapping.ts...\n');

let content = fs.readFileSync(COUNTY_MAPPING_FILE, 'utf8');
let fixedCount = 0;

// Znajdź wszystkie wpisy z "województwo"
const regex = /'([^']+)':\s*'(województwo [^']+)',/g;
let match;
const fixes = [];

while ((match = regex.exec(content)) !== null) {
  const city = match[1];
  const badCounty = match[2];

  // Usuń "ński" z końca (zostało dodane przez normalizację)
  let wojewodztwo = badCounty.replace(/ński$/, '');

  // Znajdź odpowiedni powiat
  const correctPowiat = wojewodztwoToPowiat[wojewodztwo];

  if (correctPowiat) {
    fixes.push({ city, badCounty, correctPowiat });
    console.log(`✓ ${city}: ${badCounty} → ${correctPowiat}`);
  } else {
    console.log(`⚠️  ${city}: ${badCounty} → nie znaleziono mapowania`);
  }
}

// Zastosuj poprawki
fixes.forEach(({ city, badCounty, correctPowiat }) => {
  const oldLine = `  '${city}': '${badCounty}',`;
  const newLine = `  '${city}': '${correctPowiat}',`;
  content = content.replace(oldLine, newLine);
  fixedCount++;
});

// Zapisz poprawiony plik
fs.writeFileSync(COUNTY_MAPPING_FILE, content, 'utf8');

console.log(`\n✅ Naprawiono ${fixedCount} wpisów!`);
console.log('📝 Plik countyMapping.ts zaktualizowany.');
console.log('\n💡 Następny krok: Uruchom preprocessing danych');
console.log('   node scripts/preprocess-data.js');
