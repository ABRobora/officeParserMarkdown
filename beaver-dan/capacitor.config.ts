import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.robora.beaverdan',
  appName: 'Beaver Dan',
  webDir: 'dist',
  backgroundColor: '#1d2b3a',
  ios: {
    contentInset: 'never'
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
