import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing } from '../../constants/theme';

type BadgeVariant = 'draft' | 'pending' | 'approved' | 'rejected' | 'published' | 'revision' | string;

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  color?: string;
}

const variantColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#F3F4F6', text: '#374151' },
  pending: { bg: '#FEF3C7', text: '#92400E' },
  approved: { bg: '#D1FAE5', text: '#065F46' },
  rejected: { bg: '#FEE2E2', text: '#991B1B' },
  published: { bg: '#DBEAFE', text: '#1E40AF' },
  revision: { bg: '#EDE9FE', text: '#5B21B6' },
};

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'draft', color }) => {
  const style = variantColors[variant] ?? { bg: '#F3F4F6', text: '#374151' };

  return (
    <View style={[styles.badge, { backgroundColor: color ? `${color}20` : style.bg }]}>
      <Text style={[styles.text, { color: color ?? style.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    textTransform: 'capitalize',
  },
});
