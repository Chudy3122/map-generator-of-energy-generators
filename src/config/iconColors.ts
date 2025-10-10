// src/config/iconColors.ts
import L from 'leaflet';

// Kolory normalne
export const normalIconColors = {
  'PVA': '#1E88E5', 'WOA': '#43A047', 'BGO': '#E53935', 'BGS': '#9C27B0', 
  'BGM': '#FFC107', 'WIL': '#FB8C00', 'WEE': '#FFC107', 'PCC': '#E53935', 
  'WCC': '#43A047', 'OEE': '#1E88E5', 'DEE': '#9C27B0', 'OPG': '#FB8C00', 
  'PPG': '#000000', 'DPG': '#FFD700', 'OCC': '#757575', '15%': '#1E88E5', 
  '25%': '#E53935', 'OSDe': '#9C27B0', 'default': '#757575'
};

// Kolory dla daltonistów (paleta przyjazna dla deuteranomalii i protanomalii)
export const colorblindIconColors = {
  'PVA': '#0077BB',  // Niebieski
  'WOA': '#33BBEE',  // Cyan
  'BGO': '#EE7733',  // Pomarańczowy
  'BGS': '#CC3311',  // Czerwony
  'BGM': '#EE3377',  // Magenta
  'WIL': '#009988',  // Teal
  'WEE': '#BBBBBB',  // Szary
  'PCC': '#EE7733',  // Pomarańczowy
  'WCC': '#009988',  // Teal
  'OEE': '#0077BB',  // Niebieski
  'DEE': '#33BBEE',  // Cyan
  'OPG': '#EE7733',  // Pomarańczowy
  'PPG': '#000000',  // Czarny
  'DPG': '#DDAA33',  // Żółty
  'OCC': '#BBBBBB',  // Szary
  '15%': '#0077BB',  // Niebieski
  '25%': '#EE7733',  // Pomarańczowy
  'OSDe': '#33BBEE', // Cyan
  'default': '#777777'
};

// Mapowanie kolorów na URL znaczników
const colorToMarkerUrl: { [key: string]: string } = {
  '#1E88E5': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  '#43A047': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  '#E53935': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  '#9C27B0': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  '#FFC107': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  '#FB8C00': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  '#000000': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
  '#FFD700': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  '#757575': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  // Kolory dla daltonistów
  '#0077BB': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  '#33BBEE': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  '#EE7733': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  '#CC3311': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  '#EE3377': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  '#009988': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  '#BBBBBB': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  '#DDAA33': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  '#777777': 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
};

// Funkcja tworząca ikony na podstawie koloru
export const createIconsFromColors = (colorMap: typeof normalIconColors) => {
  const icons: { [key: string]: L.Icon } = {};
  
  Object.entries(colorMap).forEach(([type, color]) => {
    const iconUrl = colorToMarkerUrl[color] || colorToMarkerUrl['#757575'];
    
    icons[type] = new L.Icon({
      iconUrl,
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  });
  
  return icons;
};

// Eksportuj gotowe zestawy ikon
export const normalIcons = createIconsFromColors(normalIconColors);
export const colorblindIcons = createIconsFromColors(colorblindIconColors);