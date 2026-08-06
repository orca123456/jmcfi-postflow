import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, BorderRadius, Shadow, Spacing } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

export const Card: React.FC<CardProps> = ({ children, style, padding = Spacing.md }) => {
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: BorderRadius.lg,
    ...Shadow.sm,
  },
});
