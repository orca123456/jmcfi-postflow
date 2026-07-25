import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Easing, KeyboardAvoidingView, Platform, ScrollView,
  Image, useWindowDimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, getRoleDashboardPath } from '../../store/auth';

const ROLES = [
  { label: 'Content Requestor', value: 'requestor', email: 'maria.delacruz@jmcfi.edu.ph' },
  { label: 'Office Head', value: 'office_head', email: 'office.head@jmcfi.edu.ph' },
  { label: 'Vice President', value: 'vp', email: 'vp@jmcfi.edu.ph' },
  { label: 'President', value: 'president', email: 'president@jmcfi.edu.ph' },
  { label: 'IMC/QA Checker', value: 'imc_qa', email: 'imc.qa@jmcfi.edu.ph' },
  { label: 'IT Admin (Publisher)', value: 'it_publisher', email: 'it.support@jmcfi.edu.ph' },
];

const AnimatedBackground = () => {
  const { width, height } = useWindowDimensions();
  const animValue1 = useRef(new Animated.Value(0)).current;
  const animValue2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue1, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(animValue1, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue2, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(animValue2, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' })
      ])
    ).start();
  }, []);

  const offsetA = Math.min(width * 0.26, 160);
  const offsetB = Math.min(width * 0.16, 105);

  const translateA = animValue1.interpolate({ inputRange: [0, 1], outputRange: [0, offsetA] });
  const translateB = animValue2.interpolate({ inputRange: [0, 1], outputRange: [0, -offsetB] });

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F6F0FA', overflow: 'hidden' }]}>
      <Animated.View style={{
        position: 'absolute',
        width: width * 0.7,
        height: height * 0.42,
        backgroundColor: 'rgba(143, 63, 255, 0.22)',
        borderRadius: 90,
        top: -height * 0.08,
        left: -width * 0.08,
        transform: [{ translateX: translateA }, { rotate: '18deg' }],
      }} />

      <Animated.View style={{
        position: 'absolute',
        width: width * 0.55,
        height: height * 0.33,
        backgroundColor: 'rgba(248, 196, 255, 0.28)',
        borderRadius: 72,
        top: height * 0.22,
        right: -width * 0.08,
        transform: [{ translateX: translateB }, { rotate: '-16deg' }],
      }} />

      <Animated.View style={{
        position: 'absolute',
        width: width * 0.46,
        height: height * 0.2,
        backgroundColor: 'rgba(255, 183, 65, 0.24)',
        borderRadius: 64,
        bottom: -height * 0.06,
        left: width * 0.1,
        transform: [{ translateX: translateA }, { rotate: '8deg' }],
      }} />
    </View>
  );
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  
  const [email, setEmail] = useState('it.support@jmcfi.edu.ph');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);

  const handleLogin = async () => {
    setLoading(true);
    
    // Call the store's login function which expects email and password
    const success = await login(email, password);
    
    setLoading(false);
    
    if (success) {
      const user = useAuthStore.getState().user;
      if (user) {
        router.replace(getRoleDashboardPath(user.role) as any);
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AnimatedBackground />
      
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/jmc_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>JMCFI POSTFLOW</Text>
        </View>

        <View style={styles.formbgOuter}>
          <View style={styles.formbg}>
            <View style={styles.formbgInner}>
              <Text style={styles.subtitle}>Sign in to your account</Text>
              
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity 
                      style={styles.eyeIcon} 
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
              </View>



              <View style={styles.field}>
                <TouchableOpacity 
                  style={styles.submitButton}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  <Text style={styles.submitText}>{loading ? 'Signing in...' : 'Login'}</Text>
                </TouchableOpacity>
              </View>


            </View>
          </View>

          <View style={styles.footerLink}>
            <View style={styles.listing}>
              <Text style={styles.listingLink}>© 2026 JMCFI POSTFLOW  System TechNycDev</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F0FA',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    zIndex: 9,
  },
  boxLightWisteria: { backgroundColor: 'rgba(201, 160, 220, 0.15)', borderWidth: 2, borderColor: '#c9a0dc' },
  boxWisteria: { backgroundColor: '#c9a0dc' },
  boxGrape: { backgroundColor: '#6c3baa' },
  boxIndigo: { backgroundColor: '#4b0082' },
  boxSunglow: { backgroundColor: '#FFCC33' },
  
  header: {
    paddingBottom: 24,
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 80,
    height: 80,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#4b0082',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  formbgOuter: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 16,
  },
  formbg: {
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#3c4257',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  formbgInner: {
    padding: 32,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
    color: '#4B5563',
    paddingBottom: 24,
  },
  field: {
    paddingBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 8,
  },
  input: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    backgroundColor: '#fff',
    color: '#1a1f36',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    color: '#1a1f36',
  },
  eyeIcon: {
    padding: 10,
  },
  grid5050: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  forgotLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5469d4',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: 'rgba(60, 66, 87, 0.16)',
    borderRadius: 3,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#5469d4',
    borderColor: '#5469d4',
  },
  checkmark: {
    width: 10,
    height: 10,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#1a1f36',
  },
  submitButton: {
    backgroundColor: '#4b0082',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  ssoLinkContainer: {
    alignItems: 'center',
  },
  ssoLink: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5469d4',
  },
  footerLink: {
    paddingTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#1a1f36',
  },
  linkText: {
    color: '#5469d4',
    fontWeight: '600',
  },
  listing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    flexWrap: 'nowrap',
  },
  listingLink: {
    color: '#9CA3AF',
    fontWeight: '500',
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 0,
  }
});
