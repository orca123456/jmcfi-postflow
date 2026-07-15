// JMCFI PostFlow Design System
export const Colors = {
  // Primary brand colors
  primary: '#0B2545',         // JMCFI Deep Navy Blue
  primaryLight: '#134074',    // JMCFI Royal Blue
  primaryDark: '#081F37',     // Dark Navy
  accent: '#FFC72C',          // JMCFI Gold
  wisteria: '#EEF4F8',        // Very Light Blue-Gray Tint

  // Background
  background: '#F4F6F9',      // Clean neutral light gray
  surface: '#FFFFFF',
  surfaceSecondary: '#EEF4F8',

  // Text
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  // Status colors
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',

  // Border
  border: '#E5E7EB',
  borderFocus: '#0B2545',

  // Role badge colors
  admin: '#7C3AED',
  requestor: '#2563EB',
  officeHead: '#D97706',
  vp: '#DC2626',
  president: '#0F766E',
  imcQa: '#7C3AED',
  publisher: '#374151',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
};
