import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  iconBgColor?: string;
  subtitle?: string;
  isSelected?: boolean;
  onPress?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  color = '#7C3AED',
  iconBgColor,
  subtitle,
  isSelected = false,
  onPress,
}) => {
  const bgCircle = iconBgColor || `${color}18`;

  const cardContent = (
    <View style={[
      styles.card,
      isSelected && styles.cardSelected,
      Platform.OS === 'web' && ({ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as any)
    ]}>
      <View style={[styles.iconContainer, { backgroundColor: bgCircle }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={styles.value}>{value}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity 
        style={styles.touchableWrapper} 
        onPress={onPress} 
        activeOpacity={0.8}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return <View style={styles.touchableWrapper}>{cardContent}</View>;
};

const styles = StyleSheet.create({
  touchableWrapper: {
    flex: 1,
    minWidth: '46%', // 2x2 grid on mobile/tablet
    maxWidth: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    padding: 16,
    gap: 14,
    minHeight: 105,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSelected: {
    borderColor: '#0F172A',
    borderWidth: 2,
    shadowOpacity: 0.12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '800' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  value: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: '#0F172A',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500' as const,
  },
});
