export interface BatchUploadResultItem {
  fileName: string;
  success: boolean;
  uploadId?: string;
  reportDate?: string;
  coversCenter?: 'makkah' | 'madinah' | 'shared' | null;
  totalRecords?: number;
  matchedCount?: number;
  unmatchedCount?: number;
  error?: string;
  errorCode?: 'duplicate' | 'no_date' | 'parse_failed' | 'other';
}
