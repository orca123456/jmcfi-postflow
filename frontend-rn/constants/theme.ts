import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// JMCFI PostFlow Design System
export const Colors = {
  // Primary brand colors
  primary: isWeb ? 'var(--color-primary)' : '#0B2545',         // JMCFI Deep Navy Blue
  primaryLight: isWeb ? 'var(--color-primary-light)' : '#134074',    // JMCFI Royal Blue
  primaryDark: isWeb ? 'var(--color-primary-dark)' : '#081F37',     // Dark Navy
  accent: isWeb ? 'var(--color-accent)' : '#FFC72C',          // JMCFI Gold
  wisteria: isWeb ? 'var(--color-wisteria)' : '#EEF4F8',        // Very Light Blue-Gray Tint

  // Background
  background: isWeb ? 'var(--color-background)' : '#F4F6F9',      // Clean neutral light gray
  surface: isWeb ? 'var(--color-surface)' : '#FFFFFF',
  surfaceSecondary: isWeb ? 'var(--color-surface-secondary)' : '#EEF4F8',

  // Text
  textPrimary: isWeb ? 'var(--color-text-primary)' : '#1A1A2E',
  textSecondary: isWeb ? 'var(--color-text-secondary)' : '#6B7280',
  textMuted: isWeb ? 'var(--color-text-muted)' : '#9CA3AF',
  textOnPrimary: isWeb ? 'var(--color-text-on-primary)' : '#FFFFFF',

  // Status colors
  success: isWeb ? 'var(--color-success)' : '#16A34A',
  warning: isWeb ? 'var(--color-warning)' : '#D97706',
  error: isWeb ? 'var(--color-error)' : '#DC2626',
  info: isWeb ? 'var(--color-info)' : '#2563EB',

  // Border
  border: isWeb ? 'var(--color-border)' : '#E5E7EB',
  borderFocus: isWeb ? 'var(--color-border-focus)' : '#0B2545',

  // Role badge colors
  admin: isWeb ? 'var(--color-admin)' : '#7C3AED',
  requestor: isWeb ? 'var(--color-requestor)' : '#2563EB',
  officeHead: isWeb ? 'var(--color-office-head)' : '#D97706',
  vp: isWeb ? 'var(--color-vp)' : '#DC2626',
  president: isWeb ? 'var(--color-president)' : '#0F766E',
  imcQa: isWeb ? 'var(--color-imc-qa)' : '#7C3AED',
  publisher: isWeb ? 'var(--color-publisher)' : '#374151',
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
