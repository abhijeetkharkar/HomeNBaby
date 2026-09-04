import { LookupPath } from './lookup-path.interface';

export interface InitialConfig {
  status: boolean;
  lookupPaths: LookupPath[] | undefined;
}
