// Metro config : les fichiers .wasm (CanvasKit/Skia web) doivent être traités
// comme des assets (copiés dans dist/ et récupérables via require()).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

module.exports = config;