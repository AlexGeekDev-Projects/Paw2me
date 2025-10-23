// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
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
          '@data': './src/data',
          '@assets': './src/assets',
          '@native': './src/native',
          '@config': './src/config',
          '@reactions': './src/reactions',
        },
      },
    ],
    'react-native-reanimated/plugin', // <- SIEMPRE el último
  ],
};
