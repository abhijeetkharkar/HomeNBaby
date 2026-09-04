export interface LookupPath {
  id: number;
  path: string;
}

export const TableNames = {
  CINEMA: 'cinema',
  LOOKUP_PATH: 'lookup_path'
} as const;

export type TableName = typeof TableNames[keyof typeof TableNames];