import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform, useWindowDimensions, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function NotFoundScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isMobile = width < 640;

  // Hover state for the button
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found', headerShown: false }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        contentContainerStyle={[styles.container, { minHeight: height }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Ambient Glows */}
        {Platform.OS === 'web' && (
          <>
            <View style={[styles.ambientGlow, styles.glowBlue]} />
            <View style={[styles.ambientGlow, styles.glowPurple]} />
          </>
        )}

        {/* Large Background "404" Text */}
        <Text
          style={[
            styles.backgroundText,
            {
              fontSize: isMobile ? Math.min(width * 0.32, 120) : Math.min(width * 0.18, 200),
              letterSpacing: isMobile ? 6 : 16,
              top: isMobile ? 40 : 30,
            },
          ]}
          numberOfLines={1}
        >
          404
        </Text>

        <View style={[styles.contentRow, isMobile && styles.contentColumn]}>
          {/* Speech Bubble */}
          <View style={[styles.speechBubble, isMobile && styles.speechBubbleMobile]}>
            <Text style={[styles.speechText, isMobile && styles.speechTextMobile]}>
              This is not the web page you are looking for.
            </Text>
            {/* Triangular pointer */}
            <View style={isMobile ? styles.triangleBottom : styles.triangleRight} />
          </View>

          {/* Mascot Image */}
          <View style={[styles.mascotWrapper, Platform.OS === 'web' ? ({ mixBlendMode: 'multiply' } as any) : {}]}>
            <Image
              source={require('../assets/images/404-mascot.jpg')}
              style={[
                styles.mascot,
                {
                  width: isMobile ? Math.min(width * 0.55, 220) : Math.min(width * 0.32, 340),
                  height: isMobile ? Math.min(width * 0.55, 220) : Math.min(width * 0.32, 340),
                },
              ]}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Go Back Button */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            isMobile && styles.buttonMobile,
            pressed && styles.buttonPressed,
            isHovered && styles.buttonHovered,
          ]}
          onHoverIn={() => setIsHovered(true)}
          onHoverOut={() => setIsHovered(false)}
          onPress={() => router.replace('/')}
        >
          <Ionicons name="home" size={isMobile ? 18 : 20} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={[styles.buttonText, isMobile && styles.buttonTextMobile]}>Go Back Home</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 30,
    position: 'relative',
  },
  ambientGlow: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: 300,
    opacity: 0.15,
    ...(Platform.OS === 'web' && ({ filter: 'blur(100px)' } as any)),
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
    fontWeight: '900',
    color: '#E5E7EB',
    alignSelf: 'center',
    textAlign: 'center',
    zIndex: 0,
    opacity: 0.85,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginTop: 40,
    maxWidth: '100%',
  },
  contentColumn: {
    flexDirection: 'column',
    marginTop: 20,
    gap: 16,
  },
  mascotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: {
    marginLeft: 0,
  },
  speechBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderRadius: 16,
    marginRight: 16,
    maxWidth: 320,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
    ...(Platform.OS === 'web' && ({ backdropFilter: 'blur(12px)' } as any)),
  },
  speechBubbleMobile: {
    marginRight: 0,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    maxWidth: '90%',
  },
  triangleRight: {
    position: 'absolute',
    right: -14,
    top: '50%',
    marginTop: -10,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 14,
    borderRightWidth: 0,
    borderBottomWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: '#FFFFFF',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
    zIndex: 2,
  },
  triangleBottom: {
    position: 'absolute',
    bottom: -14,
    left: '50%',
    marginLeft: -10,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 14,
    borderBottomWidth: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopColor: '#FFFFFF',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 2,
  },
  speechText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 28,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  speechTextMobile: {
    fontSize: 16,
    lineHeight: 22,
  },
  button: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 44,
    borderRadius: 999,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 10,
    ...(Platform.OS === 'web' && ({ transition: 'all 0.2s ease-in-out' } as any)),
  },
  buttonMobile: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
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
    marginRight: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonTextMobile: {
    fontSize: 15,
  },
});
