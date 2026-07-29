import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Easing, KeyboardAvoidingView, Platform, ScrollView,
  Image, useWindowDimensions, TextInputProps
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, getRoleDashboardPath } from '../../store/auth';

// ── Floating Label Input Component ─────────────────────────────────────────
interface FloatingLabelProps extends TextInputProps {
  label: string;
  secureTextEntry?: boolean;
  rightIcon?: React.ReactNode;
}

const FloatingLabelInput = React.forwardRef<TextInput, FloatingLabelProps>(
  ({ label, value, onChangeText, secureTextEntry, rightIcon, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isElevated, setIsElevated] = useState(!!value);
    const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

    const handleFocus = useCallback(() => {
      setIsFocused(true);
      setIsElevated(true);
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 180,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false,
      }).start();
    }, [animatedValue]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      if (!value) {
        setIsElevated(false);
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 180,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: false,
        }).start();
      }
    }, [animatedValue, value]);

    // Sync animation if value is set externally
    useEffect(() => {
      if (value && !isElevated) {
        setIsElevated(true);
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 0,
          useNativeDriver: false,
        }).start();
      }
    }, [value, animatedValue, isElevated]);

    const labelStyle = {
      position: 'absolute' as const,
      left: 14,
      top: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [14, -8],
      }),
      fontSize: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 12],
      }),
      color: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['#9CA3AF', isFocused ? '#4b0082' : '#6B7280'],
      }),
      backgroundColor: '#fff',
      paddingHorizontal: 4,
      zIndex: 2,
    };

    const borderColor = isFocused ? '#4b0082' : '#D1D5DB';

    return (
      <View style={[styles.flContainer, { borderColor }]}>
        <Animated.Text style={labelStyle}>
          {label}
        </Animated.Text>
        <TextInput
          ref={ref}
          style={styles.flInput}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry}
          placeholder="" // placeholder is handled by floating label
          {...props}
        />
        {rightIcon && (
          <View style={styles.flRightIcon}>
            {rightIcon}
          </View>
        )}
      </View>
    );
  }
);

FloatingLabelInput.displayName = 'FloatingLabelInput';

// ── End Floating Label ──────────────────────────────────────────────────────

const ROLES = [
  { label: 'Content Requestor', value: 'requestor', email: 'maria.delacruz@jmcfi.edu.ph' },
  { label: 'Office Head', value: 'office_head', email: 'office.head@jmcfi.edu.ph' },
  { label: 'Vice President', value: 'vp', email: 'vp@jmcfi.edu.ph' },
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
  const { login, error, clearError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    
    const success = await login(email, password);
    
    setLoading(false);
    
    if (success) {
      const user = useAuthStore.getState().user;
      if (user) {
        router.replace(getRoleDashboardPath(user.role) as any);
      }
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) clearError();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (error) clearError();
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
                <FloatingLabelInput
                  label="Email"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View style={styles.field}>
                <FloatingLabelInput
                  label="Password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6B7280" />
                    </TouchableOpacity>
                  }
                />
              </View>

              {/* ⚠️ Error Trigger Warning — shown when login fails */}
              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.field}>
                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
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
              <Text style={styles.listingLink}>© 2026 JMCFI POSTFLOW System TechNycDev</Text>
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

  // ── Floating Label Styles ──────────────────────────────────────────────
  flContainer: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 6,
    backgroundColor: '#fff',
    justifyContent: 'center',
    minHeight: 52,
  },
  flInput: {
    fontSize: 16,
    color: '#1a1f36',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
    minHeight: 52,
  },
  flRightIcon: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
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
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  footerLink: {
    paddingTop: 24,
    alignItems: 'center',
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
