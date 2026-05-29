import { useWindowDimensions } from 'react-native';

/**
 * Breakpoint phân biệt phone (portrait) vs tablet/POS (landscape, wide screen).
 * Sunmi T2 thường ~1920dp ngang → tablet.
 * Phone Android: 360-430dp ngang → phone.
 */
export const TABLET_BREAKPOINT = 700;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isPhone = width < TABLET_BREAKPOINT;
  return {
    width,
    height,
    isPhone,
    isTablet: !isPhone,
    isLandscape: width > height,
  };
}
