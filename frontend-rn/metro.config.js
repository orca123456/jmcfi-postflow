// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');
const path = require('path');
const { FileStore } = require('metro-cache');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

// Speed up cold bundles by parallelizing transforms across CPU cores.
config.maxWorkers = Math.min(8, Math.max(2, os.cpus().length - 1));

// Keep the transform cache inside the project (instead of the OS temp dir) so
// restarting Metro reuses it — no full re-bundle after every restart.
config.cacheStores = [new FileStore({ root: path.join(__dirname, '.metro-cache') })];

module.exports = config;
