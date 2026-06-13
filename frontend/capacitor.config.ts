import type { CapacitorConfig } from '@capacitor/cli'
import { BRAND_BG, BRAND_BG_DARK } from './src/lib/brand'

const config: CapacitorConfig = {
  appId: 'com.casita.app',
  appName: 'Casita',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: BRAND_BG,
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Default',
      backgroundColor: BRAND_BG,
    },
  },
}

export default config
