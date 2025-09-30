export interface StaticDataSource {
  id: string;
  name: string;
  filename: string;
  type: 'xml' | 'csv';
  category: 'concessions' | 'generators' | 'other';
  description?: string;
  enabled: boolean;
}

export const STATIC_DATA_SOURCES: StaticDataSource[] = [
  {
    id: 'concessions-other-fuel',
    name: 'Koncesje na paliwa inne',
    filename: 'concessions-other-fuel.xml',
    type: 'xml',
    category: 'concessions',
    description: 'Lista koncesjonariuszy paliw innych',
    enabled: true
  },
  // Dodaj kolejne źródła danych
];