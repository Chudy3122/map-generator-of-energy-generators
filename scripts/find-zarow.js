const axios = require('axios');

(async () => {
  console.log('Szukam Żarów...\n');

  const queries = [
    'Żarów, dolnośląskie, Polska',
    'Żarów, woj. dolnośląskie',
    'Żarów, Polska',
    'Zarow, dolnośląskie, Polska'
  ];

  for (const q of queries) {
    console.log(`Query: ${q}`);
    const r = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q, format: 'json', limit: 3, countrycodes: 'pl' },
      headers: { 'User-Agent': 'MapaWytworcowEnergii/1.0' }
    });

    r.data.forEach(d => console.log(`  [${d.lat}, ${d.lon}] - ${d.display_name}`));
    console.log('');

    await new Promise(resolve => setTimeout(resolve, 1100));
  }
})();
