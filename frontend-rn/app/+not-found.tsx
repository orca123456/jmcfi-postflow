import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function NotFoundScreen() {
  const router = useRouter();
  
  // Hover state for the button
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found', headerShown: false }} />
      <View style={styles.container}>
        
        {/* Ambient Glows */}
        {Platform.OS === 'web' && (
          <>
            <View style={[styles.ambientGlow, styles.glowBlue]} />
            <View style={[styles.ambientGlow, styles.glowPurple]} />
          </>
        )}

        {/* Large Background "404" Text - Moved higher up */}
        <Text style={styles.backgroundText}>404</Text>

        <View style={styles.contentRow}>
          
          {/* Speech Bubble */}
          <View style={styles.speechBubble}>
            <Text style={styles.speechText}>This is not the</Text>
            <Text style={styles.speechText}>web page you</Text>
            <Text style={styles.speechText}>are looking for.</Text>
            {/* The little triangle for the speech bubble */}
            <View style={styles.triangle} />
          </View>

          {/* Mascot Image (Static) */}
          <View style={Platform.OS === 'web' ? { mixBlendMode: 'multiply' } as any : {}}>
            <Image 
              source={require('../assets/images/404-mascot.jpg')} 
              style={styles.mascot}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Go Back Button */}
        <Pressable 
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            isHovered && styles.buttonHovered,
          ]}
          onHoverIn={() => setIsHovered(true)}
          onHoverOut={() => setIsHovered(false)}
          onPress={() => router.replace('/')}
        >
          <Ionicons name="home" size={20} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Go Back Home</Text>
        </Pressable>

      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: 300,
    opacity: 0.15,
    ...(Platform.OS === 'web' && { filter: 'blur(100px)' } as any),
  },
  glowBlue: {
    backgroundColor: '#3B82F6',
    top: -150,
    left: -200,
  },
  glowPurple: {
    backgroundColor: '#8B5CF6',
    bottom: -150,
    right: -200,
  },
  backgroundText: {
    position: 'absolute',
    top: 50,
    fontSize: 200,
    fontWeight: '900',
    color: '#D1D5DB', // Darker gray for better visibility
    letterSpacing: 20,
    zIndex: 0,
    transform: [{ scale: 1.1 }],
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginTop: -60,
  },
  mascot: {
    width: 350,
    height: 350,
    marginLeft: 15,
  },
  speechBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginRight: 10,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
    ...(Platform.OS === 'web' && { backdropFilter: 'blur(12px)' } as any),
  },
  triangle: {
    position: 'absolute',
    right: -16,
    top: '50%',
    marginTop: -12,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 16,
    borderRightWidth: 0,
    borderBottomWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: '#FFFFFF',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
    zIndex: 2,
  },
  speechText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  button: {
    marginTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 999, // Pill shape
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 10,
    ...(Platform.OS === 'web' && { transition: 'all 0.2s ease-in-out' } as any),
  },
  buttonHovered: {
    backgroundColor: '#2563EB',
    transform: [{ translateY: -2 }],
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.15,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
