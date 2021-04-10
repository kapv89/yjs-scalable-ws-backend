import createLogger from './createLogger';

const SERVER = 'SERVER';
const CLI = 'CLI';
const SERVICE = 'SERVICE';
const SHAREDB = 'SHAREDB';
const TEST = 'TEST';

export const serverLogger = createLogger(SERVER);
export const cliLogger = createLogger(CLI);
export const serviceLogger = createLogger(SERVICE);
export const shareDBLogger = createLogger(SHAREDB);
export const testLogger = createLogger(TEST);