const fs = require('fs');
const path = require('path');

const PROCESSED_DATA_DIR = path.join(__dirname, '../public/data/processed');

function findTopCities() {
  const cities = {};

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
          const city = (item.installationCity || item.city || '').trim();
          if (city && city.length > 1 && !city.match(/^\d/) && !city.includes(',')) {
            cities[city] = (cities[city] || 0) + 1;
          }
        });
      } catch (err) {
        console.error(`Błąd: ${filename}`);
      }
    }
  });

  const sorted = Object.entries(cities).sort((a, b) => b[1] - a[1]);

  console.log('TOP 200 najczęstszych miejscowości:\n');
  sorted.slice(0, 200).forEach(([city, count], i) => {
    console.log(`${(i + 1).toString().padStart(3)}. ${city.padEnd(40)} - ${count} instalacji`);
  });

  console.log(`\n\nOgółem unikalnych miejscowości: ${sorted.length}`);
  console.log(`Top 200 pokrywa: ${sorted.slice(0, 200).reduce((sum, [_, count]) => sum + count, 0)} instalacji`);
  console.log(`Wszystkie instalacje: ${sorted.reduce((sum, [_, count]) => sum + count, 0)}`);
}

findTopCities();
