import { defaultClock } from '@gitroom/frontend/ours/locale/locale'; // OURS (2026-11-15): clock follows our default locale
export const isUSCitizen = () => {
  const userLanguage = localStorage.getItem('isUS') || defaultClock() || ((navigator.language || navigator.languages[0]).startsWith('en-US') ? 'US' : 'GLOBAL');
  return userLanguage === 'US';
};
