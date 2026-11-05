/**
 * Identité visuelle SOLINK — neutre, minimaliste (CLAUDE.md §10).
 * La couleur principale (`primary`) sert aux actions ; `accent` aux liens et à la sélection.
 * Changer ces valeurs suffit à re-teinter toute l'application.
 */
export const theme = {
  /** Encre : boutons principaux, titres, états actifs. */
  primary: '#1d1d1f',
  primaryForeground: '#ffffff',
  /** Bleu de lien, focus et sélection. */
  accent: '#0066cc',
  /** Fond de page (gris très clair, légèrement froid) et surfaces. */
  background: '#f5f5f7',
  surface: '#ffffff',
  /** Échelle de gris unique — appliquée à `gray`, `slate` et `neutral` de Tailwind. */
  neutral: {
    50: '#f7f7f8',
    100: '#efeff1',
    200: '#e4e4e8',
    300: '#d2d2d7',
    400: '#a6a6ad',
    500: '#86868b',
    600: '#6e6e73',
    700: '#515154',
    800: '#2c2c2e',
    900: '#1d1d1f',
    950: '#0e0e10',
  },
  /** Rayons : contrôles 10 px, cartes 16 px. */
  radius: '10px',
  radiusCard: '16px',
} as const;
