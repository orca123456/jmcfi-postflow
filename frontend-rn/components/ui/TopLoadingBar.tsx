import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Platform } from 'react-native';
import { useLoadingBar } from '../../store/loadingBar';

export const TopLoadingBar: React.FC = () => {
  const { progress, visible } = useLoadingBar();
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.timing(animatedOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: false,
      }).start();

      Animated.timing(animatedWidth, {
        toValue: progress,
        duration: progress === 100 ? 150 : 200,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(animatedOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        setIsMounted(false);
        animatedWidth.setValue(0);
      });
    }
  }, [progress, visible, animatedOpacity, animatedWidth]);

  if (!isMounted && !visible) {
    return null;
  }

  const widthPercent = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          opacity: animatedOpacity,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.bar,
          {
            width: widthPercent,
          },
        ]}
      >
        <View style={styles.glow} />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0,
    left: 0,
    right: 0,
    height: 3.5,
    zIndex: 9999999,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  bar: {
    height: '100%',
    backgroundColor: '#FFC72C', // JMC Gold
    ...(Platform.OS === 'web'
      ? {
          backgroundImage: 'linear-gradient(90deg, #FFC72C 0%, #F59E0B 50%, #FFD15C 100%)',
          boxShadow: '0 0 10px #FFC72C, 0 0 5px #F59E0B',
        }
      : {}),
  },
  glow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 0 14px #FFFFFF, 0 0 8px #FFC72C',
        }
      : {}),
  },
});
