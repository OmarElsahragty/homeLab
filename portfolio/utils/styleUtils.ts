/**
 * Converts a hex color to a CSS theme class name
 * @param color - Hex color (e.g., '#FFD700')
 * @returns Theme class name (e.g., 'theme-ffd700')
 */
export const getThemeClass = (color: string): string => {
  return `theme-${color.replace('#', '').toLowerCase()}`;
};
