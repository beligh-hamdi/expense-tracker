export interface AppSettings {
  spreadsheetId: string;
  currency: string;       // e.g. 'USD', 'EUR'
  firstRunComplete: boolean;
}

export const SETTINGS_COLUMNS = ['key', 'value'] as const;

/** Converts a list of key/value rows from the Settings tab → AppSettings */
export function rowsToSettings(rows: string[][]): Partial<AppSettings> {
  const map = Object.fromEntries(rows.map(([k, v]) => [k, v]));
  return {
    spreadsheetId:    map['spreadsheetId'],
    currency:         map['currency'],
    firstRunComplete: map['firstRunComplete'] === 'true',
  };
}

/** Converts AppSettings → list of key/value rows for the Settings tab */
export function settingsToRows(s: Partial<AppSettings>): string[][] {
  return Object.entries(s)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v)]);
}
