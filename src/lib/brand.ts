export const BRAND_LOGO_SRC = '/figma-assets/brand/logo-official.png';
export const BRAND_ICON_SRC = BRAND_LOGO_SRC;

// Tightly-cropped white "OB" wordmark, generated from logo-official.png by
// scripts/generate-brand-assets.mjs (npm run assets:brand). Used in the navbars
// so the mark renders large and visible instead of tiny inside the padded master art.
export const BRAND_WORDMARK_SRC = '/figma-assets/brand/logo-wordmark.png';

// The navbar logo is sized by height; width follows the wordmark's aspect ratio.
export const DESKTOP_BRAND_LOGO_HEIGHT = 56; // navbar bar is 91px tall
export const MOBILE_BRAND_LOGO_HEIGHT = 32;
