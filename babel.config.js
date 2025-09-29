// babel.config.js
module.exports = {
  presets: ['@react-native/babel-preset'],
  plugins: [
    ['module-resolver', {
      alias: {
        '@app': './src/app',
        '@navigation': './src/navigation',
        '@screens': './src/screens',
        '@components': './src/components',
        '@hooks': './src/hooks',
        '@store': './src/store',
        '@services': './src/services',
        '@theme': './src/theme',
        '@utils': './src/utils',
        '@models': './src/models',
      },
    }],
    'react-native-reanimated/plugin', // ← obligatorio y al final
  ],
};
