import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  Image, ImageBackground, Animated, TextInputProps, Easing, ViewStyle
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, getRoleDashboardPath } from '../../store/auth';

// ── Floating Label Input Component (Facebook Style) ───────────────
interface FloatingLabelProps extends TextInputProps {
  label: string;
  secureTextEntry?: boolean;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  id?: string;
  name?: string;
}

const FloatingLabelInput = React.forwardRef<TextInput, FloatingLabelProps>(
  ({ label, value, onChangeText, secureTextEntry, rightIcon, containerStyle, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isElevated, setIsElevated] = useState(!!value);
    const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

    const handleFocus = useCallback(() => {
      setIsFocused(true);
      setIsElevated(true);
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    }, [animatedValue]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      if (!value) {
        setIsElevated(false);
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false,
        }).start();
      }
    }, [animatedValue, value]);

    useEffect(() => {
      if (value && !isElevated) {
        setIsElevated(true);
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 0,
          useNativeDriver: false,
        }).start();
      }
    }, [value, isElevated, animatedValue]);

    const labelStyle = {
      position: 'absolute' as const,
      left: 16,
      top: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [18, 6],
      }),
      fontSize: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [15, 12],
      }),
      color: isFocused ? '#1877F2' : '#9CA3AF',
      zIndex: 1,
    };

    return (
      <View style={[
        styles.flContainer,
        isFocused ? styles.flContainerFocused : undefined,
        containerStyle
      ]}>
        <Animated.Text style={labelStyle}>
          {label}
        </Animated.Text>
        <View style={styles.flInputWrapper}>
          <TextInput
            ref={ref}
            style={[
              styles.flInput,
              Platform.OS === 'web' && { outlineStyle: 'none' } as any
            ]}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={secureTextEntry}
            placeholder=""
            {...props}
          />
          {rightIcon && (
            <View style={styles.flRightIcon}>
              {rightIcon}
            </View>
          )}
        </View>
      </View>
    );
  }
);
FloatingLabelInput.displayName = 'FloatingLabelInput';
// ─────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { login, error, clearError, lockUntil, setLockUntil } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const passwordRef = useRef<TextInput>(null);

  // Focus tracking for animation (placeholder behavior if needed)
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);

  useEffect(() => {
    if (lockUntil) {
      // Calculate initial countdown
      const initialRemaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setCountdown(initialRemaining);
      
      if (initialRemaining > 0) {
        const interval = setInterval(() => {
          const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
          setCountdown(remaining);
          if (remaining <= 0) {
            setLockUntil(null);
            clearError();
            clearInterval(interval);
          }
        }, 1000);
        return () => clearInterval(interval);
      } else {
        setLockUntil(null);
        clearError();
      }
    } else {
      setCountdown(0);
    }
  }, [lockUntil, setLockUntil, clearError]);

  const handleLogin = async () => {
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    
    if (success) {
      const user = useAuthStore.getState().user;
      if (user) {
        router.replace(getRoleDashboardPath(user.role) as any);
      }
    } else {
      setPassword('');
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
    <ImageBackground 
      source={require('../../assets/images/jmcbg2.jpeg')}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.9 }}
      blurRadius={2}
    >
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.header}>
              <Image
                source={require('../../assets/images/jmc_logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle}>JMCFI PostFLow</Text>
            </View>
            
            <View style={styles.formContainer}>
              <View style={styles.field}>
                <FloatingLabelInput
                  label="Email"
                  id="email"
                  name="email"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              <View style={styles.field}>
                <FloatingLabelInput
                  ref={passwordRef}
                  label="Password"
                  id="password"
                  name="password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  }
                />
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>
                    {countdown > 0 ? `Too many login attempts. Please try again in ${countdown} seconds.` : error}
                  </Text>
                </View>
              ) : null}

              <View style={styles.field}>
                <TouchableOpacity
                  style={[styles.submitButton, (loading || countdown > 0) && styles.submitButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading || countdown > 0}
                >
                  <Text style={styles.submitText}>
                    {countdown > 0 
                      ? `Try again in ${countdown}s` 
                      : (loading ? 'Signing in...' : 'Login')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>© 2026 JMCFI POSTFLOW System TechNycDev</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#000000',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Kameron_700Bold',
    fontSize: 22,
    color: '#8A008A',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  field: {
    marginBottom: 16,
  },
  // ── Floating Label Styles ──
  flContainer: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#F0F2F5',
    minHeight: 56,
    justifyContent: 'center',
    position: 'relative',
  },
  flContainerFocused: {
    borderColor: '#1877F2',
    backgroundColor: '#FFFFFF',
    shadowColor: '#1877F2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  flInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  flInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 6,
    fontSize: 15,
    color: '#111827',
    minHeight: 56,
  },
  flRightIcon: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    zIndex: 2,
  },
  // ────────────────────────────
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
    backgroundColor: '#4B0082',
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    marginTop: 24,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    borderRadius: 2,
    alignItems: 'center',
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
});
