// Wspólne typy dla dokumentów

// Typ adresu firmowego z dokumentu
export interface CompanyAddress {
  name: string;
  street: string;
  buildingNumber: string;
  zipCode: string;
  city: string;
  taxId: string;
  energyPercentage?: number; // ✅ MUSI BYĆ number, nie string
  location?: [number, number] | null;
  category?: string;
  source?: string; // Jeśli używane w pdfParser
}

// Interfejs dla parserów dokumentów
export interface DocumentParser<T> {
  parseDocument(document: T): Promise<CompanyAddress[]>;
}

// Typy wyników parsowania
export interface ParseResult {
  success: boolean;
  addresses: CompanyAddress[];
  message?: string;
  documentType?: 'industrial_receivers' | 'energy_companies' | 'unknown';
  totalFound?: number;
  errors?: string[];
}

// Rejestr MIOZ - rozszerzenie istniejącego typu
export interface MIOZRegistry {
  // Istniejące właściwości...
  // Dodane właściwości dla adresów z dokumentów
  addresses?: CompanyAddress[];
}

// Pomocnicze typy dla parsowania PDF
export interface PDFParsingOptions {
  strictMode?: boolean;
  skipInvalidEntries?: boolean;
  maxErrors?: number;
}

// Typ dla metadanych dokumentu
export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  pageCount?: number;
  processingTime?: number;
  source: 'pdf' | 'xml' | 'manual';
}

// Rozszerzony typ wyniku z metadanymi
export interface ExtendedParseResult extends ParseResult {
  metadata?: DocumentMetadata;
  processingStats?: {
    totalProcessed: number;
    successfullyParsed: number;
    failed: number;
    skipped: number;
  };
}

// Typy dla różnych kategorii odbiorców przemysłowych
export type IndustrialReceiverCategory = 
  | 'przemysłowy art. 52 ust. 2 pkt 1'
  | 'pozostały przemysłowy' 
  | 'przemysłowy 25%'
  | 'firma energetyczna'
  | 'nieznana';

// Rozszerzony typ adresu z dodatkowymi informacjami dla odbiorców przemysłowych
export interface IndustrialCompanyAddress extends CompanyAddress {
  category: IndustrialReceiverCategory;
  registrationNumber?: string;
  validFrom?: string;
  validTo?: string;
  regon?: string;
  exciseNumber?: string;
}