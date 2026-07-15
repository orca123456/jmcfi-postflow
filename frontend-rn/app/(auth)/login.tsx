import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Easing, KeyboardAvoidingView, Platform, ScrollView,
  Dimensions, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore, getRoleDashboardPath } from '../../store/auth';
import { Colors } from '../../constants/theme';

const ROLES = [
  { label: 'Administrator', value: 'admin', email: 'admin@jmcfi.edu.ph' },
  { label: 'Content Requestor', value: 'requestor', email: 'maria.delacruz@jmcfi.edu.ph' },
  { label: 'Office Head', value: 'office_head', email: 'office.head@jmcfi.edu.ph' },
  { label: 'Vice President', value: 'vp', email: 'vp@jmcfi.edu.ph' },
  { label: 'President', value: 'president', email: 'president@jmcfi.edu.ph' },
  { label: 'IMC/QA Checker', value: 'imc_qa', email: 'imc.qa@jmcfi.edu.ph' },
  { label: 'IT Publisher', value: 'it_publisher', email: 'it.publisher@jmcfi.edu.ph' },
];

const AnimatedBackground = () => {
  const animValue1 = useRef(new Animated.Value(0)).current;
  const animValue2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue1, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(animValue1, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue2, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(animValue2, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();
  }, []);

  const moveLR3s = animValue1.interpolate({ inputRange: [0, 1], outputRange: [0, 100] });
  const moveRL3s = animValue1.interpolate({ inputRange: [0, 1], outputRange: [0, -100] });
  
  const moveLR4s = animValue2.interpolate({ inputRange: [0, 1], outputRange: [0, 100] });
  const moveRL4s = animValue2.interpolate({ inputRange: [0, 1], outputRange: [0, -100] });

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#F6F0FA', overflow: 'hidden' }]}>
      <View style={{
        flex: 1,
        transform: [{ rotate: '-12deg' }, { skewY: '-12deg' }],
        position: 'absolute',
        top: -200, bottom: -200, left: -200, right: -200,
        flexDirection: 'row'
      }}>
        <View style={{ flex: 1 }}>
          {/* Top light gradient area */}
          <View style={{ height: '40%', backgroundColor: '#FAF5FF' }} />
          
          <Animated.View style={[styles.boxLightWisteria, { transform: [{ translateX: moveLR3s }], height: 60, marginTop: 40, width: '40%', alignSelf: 'flex-start' }]} />
          
          <View style={[styles.boxGrape, { height: 100, marginTop: 60, width: '25%' }]} />
          
          <Animated.View style={[styles.boxWisteria, { transform: [{ translateX: moveLR3s }], height: 150, width: '35%', marginTop: 20 }]} />
          
          <Animated.View style={[styles.boxIndigo, { transform: [{ translateX: moveLR3s }], height: 80, width: '20%', marginLeft: '25%', marginTop: 20 }]} />
        </View>

        <View style={{ flex: 1, alignItems: 'flex-end', paddingTop: '20%' }}>
          <Animated.View style={[styles.boxSunglow, { transform: [{ translateX: moveRL4s }], height: 120, width: '30%', marginRight: '10%' }]} />
          
          <Animated.View style={[styles.boxWisteria, { transform: [{ translateX: moveRL3s }], height: 200, width: '40%', marginTop: 20 }]} />
          
          <Animated.View style={[styles.boxIndigo, { transform: [{ translateX: moveRL4s }], height: 90, width: '15%', marginRight: '5%', marginTop: 20 }]} />
          
          <Animated.View style={[styles.boxLightWisteria, { transform: [{ translateX: moveRL3s }], height: 60, width: '25%', marginRight: '15%', marginTop: 20 }]} />
        </View>
      </View>
    </View>
  );
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  
  const [email, setEmail] = useState('admin@jmcfi.edu.ph');
  const [password, setPassword] = useState('password123');
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
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
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
              <Text style={styles.listingLink}>© {new Date().getFullYear()} JMCFI PostFlow • System • TechNyc Dev •</Text>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  formbgOuter: {
    width: '100%',
    maxWidth: 448,
    paddingHorizontal: 16,
  },
  formbg: {
    backgroundColor: '#fff',
    borderRadius: 4,
    shadowColor: '#3c4257',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  formbgInner: {
    padding: 48,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    color: '#1a1f36',
    paddingBottom: 24,
  },
  field: {
    paddingBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1f36',
    marginBottom: 10,
  },
  input: {
    fontSize: 16,
    lineHeight: 28,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: 4,
    backgroundColor: '#fff',
    color: '#1a1f36',
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
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
    borderBottomWidth: 3,
    borderBottomColor: Colors.accent,
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
    paddingTop: 24,
    paddingBottom: 24,
    gap: 20,
  },
  listingLink: {
    color: Colors.primaryLight,
    fontWeight: '600',
    fontSize: 14,
    opacity: 0.8,
  }
});
