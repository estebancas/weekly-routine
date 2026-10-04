import { createAppleSplashScreens, defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const background = '#2a3235';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0, resizeOptions: { background } },
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
    // iOS startup images for every device the generator knows. The app is dark-only, so
    // there is a single variant (no darkResizeOptions) on the manifest background colour.
    appleSplashScreens: createAppleSplashScreens({
      padding: 0.3,
      resizeOptions: { background, fit: 'contain' },
      linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/', xhtml: true },
      png: { compressionLevel: 9, quality: 60 },
      name: (landscape, size) =>
        `apple-splash-${landscape ? 'landscape' : 'portrait'}-${size.width}x${size.height}.png`,
    }),
  },
  images: ['public/icon.svg'],
});
