/**
 * Simple logging module to fix path resolution issues
 */
const logger = {
  debug: (message, context = '') => console.debug(`[DEBUG][${context}]`, message),
  info: (message, context = '') => console.info(`[INFO][${context}]`, message),
  warn: (message, context = '') => console.warn(`[WARNING][${context}]`, message),
  error: (message, context = '') => console.error(`[ERROR][${context}]`, message),
  log: (message, level = 'info', context = '') => {
    if (logger[level]) {
      logger[level](message, context);
    } else {
      console.log(`[${level.toUpperCase()}][${context}]`, message);
    }
  }
};

export { logger };
export default logger;