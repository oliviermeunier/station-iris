// Optional services, configured at build time. Empty = feature hidden.
export const COFFEE_URL: string = import.meta.env.VITE_COFFEE_URL ?? '';
export const GOATCOUNTER_URL: string = import.meta.env.VITE_GOATCOUNTER_URL ?? '';
export const REPO_URL = 'https://github.com/oliviermeunier/station-iris';

export const RADIUS_KM = 10;
export const PROFILE_UP_KM = 30;
export const PROFILE_DOWN_KM = 10;
export const RAIN_THRESHOLD_MM = 1;
