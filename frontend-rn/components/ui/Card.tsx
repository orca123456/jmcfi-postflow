import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, BorderRadius, Shadow, Spacing } from '../../constants/theme';
import { useThemeStore } from '../../store/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

export const Card: React.FC<CardProps> = ({ children, style, padding = Spacing.md }) => {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  return (
    <View style={[
      styles.card,
      { 
        padding,
        backgroundColor: isDarkMode ? '#1C2541' : 'rgba(255, 255, 255, 0.65)',
        borderColor: isDarkMode ? '#334155' : 'transparent',
        borderWidth: isDarkMode ? 1 : 0,
      },
      style
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    ...Shadow.sm,
  },
});
