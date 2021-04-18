import createLogger from './createLogger.js';

const SERVER = 'SERVER';
const CLI = 'CLI';
const SERVICE = 'SERVICE';
const TEST = 'TEST';

export const serverLogger = createLogger(SERVER);
export const cliLogger = createLogger(CLI);
export const serviceLogger = createLogger(SERVICE);
export const testLogger = createLogger(TEST);