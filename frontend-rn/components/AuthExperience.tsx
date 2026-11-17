import React, { useEffect } from 'react';
import { ImageBackground, StyleSheet } from 'react-native';
import type { AuthExperienceProps } from './AuthExperience.types';

/** Native keeps the existing campus backdrop; web adds the interactive introduction. */
export default function AuthExperience({ children, departing = false, onDepartureComplete }: AuthExperienceProps) {
  useEffect(() => {
    if (departing) onDepartureComplete?.();
  }, [departing, onDepartureComplete]);

  return (
    <ImageBackground source={require('../assets/images/jmcbg2.jpeg')} style={styles.background} blurRadius={2}>
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({ background: { flex: 1, width: '100%', height: '100%', backgroundColor: '#f8f5fb' } });
