// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');
const path = require('path');
const { FileStore } = require('metro-cache');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

// On Windows, spawning too many worker processes causes high IPC and Defender scanning overhead.
// 2-4 workers provides maximum throughput with minimum process creation cost.
config.maxWorkers = Math.min(4, Math.max(2, Math.floor(os.cpus().length / 4)));

// Keep the transform cache inside the project (instead of the OS temp dir) so
// restarting Metro reuses it — no full re-bundle after every restart.
config.cacheStores = [new FileStore({ root: path.join(__dirname, '.metro-cache') })];

// Bypass CPU-heavy compression for local dev bundles.
// Over loopback (localhost), uncompressed 10MB transfer takes ~15ms, whereas
// compressing in Node.js zlib/brotli on each request burns seconds of CPU.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url && (req.url.includes('.bundle') || req.url.includes('.map'))) {
        delete req.headers['accept-encoding'];
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
