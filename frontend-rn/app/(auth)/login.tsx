import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  Image, TextInputProps, ViewStyle, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, getRoleDashboardPath } from '../../store/auth';
import { signalPostflowReady } from '../../utils/postflowReady';
import AuthExperience from '../../components/AuthExperience';
import { useAuthTransition } from '../../components/AuthTransitionContext';
import { beginDashboardHandoff } from '../../utils/dashboardHandoff';
import { queueAssistantWelcome } from '../../utils/assistantWelcome';
import { prepareAssistantAudio, playAssistantError } from '../../utils/assistantSound';
import type { LoginAssistantNotice } from '../../components/AuthExperience.types';

// Web label position follows the actual DOM value, including silent browser autofill.
interface FloatingLabelProps extends TextInputProps {
  label: string;
  secureTextEntry?: boolean;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  id?: string;
  name?: string;
  validationMessage?: string;
  feedbackId?: string;
}

const FloatingLabelInput = React.forwardRef<TextInput, FloatingLabelProps>(
  ({ label, value, onChangeText, secureTextEntry, rightIcon, containerStyle, validationMessage, feedbackId, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const centeredNativeLabel = Platform.OS !== 'web' && !isFocused && !value;
    const fieldId = props.id ? `postflow-${props.id}` : undefined;

    return (<>
      <View nativeID={fieldId ? `${fieldId}-field` : undefined} style={[
        styles.flContainer,
        isFocused ? styles.flContainerFocused : undefined,
        validationMessage ? styles.flContainerError : undefined,
        containerStyle
      ]}>
        <View nativeID={fieldId ? `${fieldId}-label` : undefined} style={[styles.flLabel, centeredNativeLabel && styles.flLabelCentered]} pointerEvents="none">
          <Text style={[styles.flLabelText, centeredNativeLabel && styles.flLabelTextCentered, isFocused && { color: '#6c3baa' }, validationMessage && { color: '#9E3A50' }]}>{label}</Text>
        </View>
        <View style={styles.flInputWrapper}>
          <TextInput
            ref={ref}
            accessibilityLabel={label}
            accessibilityHint={validationMessage}
            aria-invalid={validationMessage ? true : undefined}
            aria-describedby={validationMessage && fieldId ? `${fieldId}-error` : feedbackId}
            style={[
              styles.flInput,
              rightIcon ? { paddingRight: 56 } : undefined,
              Platform.OS === 'web' && { outlineStyle: 'none' } as any
            ]}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            secureTextEntry={secureTextEntry}
            placeholder={Platform.OS === 'web' ? ' ' : ''}
            {...props}
          />
          {rightIcon && (
            <View style={styles.flRightIcon}>
              {rightIcon}
            </View>
          )}
        </View>
      </View>
      {validationMessage && <View nativeID={fieldId ? `${fieldId}-error` : undefined} style={styles.fieldHint} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Ionicons name="information-circle-outline" size={13} color="#9E3A50" style={{ marginTop: 1, marginRight: 5 }} />
        <Text style={styles.fieldHintText}>{validationMessage}</Text>
      </View>}
    </>);
  }
);
FloatingLabelInput.displayName = 'FloatingLabelInput';
// ─────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  useEffect(() => {
    signalPostflowReady();
  }, []);
  const router = useRouter();
  const setAuthTransitionActive = useAuthTransition();
  const { login, error, clearError, lockUntil, setLockUntil } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [assistantNotice, setAssistantNotice] = useState<LoginAssistantNotice | null>(null);
  const noticeSequence = useRef(0);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const loginInFlight = useRef(false);
  const pendingDestination = useRef<string | null>(null);
  const isCredentialError = !!error && /credentials|email or password|incorrect password|invalid password/i.test(error);
  const credentialFeedbackId = isCredentialError && countdown <= 0 ? 'postflow-login-feedback' : undefined;

  useEffect(() => {
    if (isCredentialError && !loading && countdown <= 0) passwordRef.current?.focus();
  }, [isCredentialError, loading, countdown]);

  useEffect(() => () => {
    setAuthTransitionActive(false);
  }, [setAuthTransitionActive]);

  const finishSignIn = useCallback(() => {
    const destination = pendingDestination.current;
    if (!destination) return;
    pendingDestination.current = null;
    beginDashboardHandoff(() => router.replace(destination as any));
  }, [router]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('postflow_') || k.includes('rq-v1') || k === 'auth_token' || k === 'auth_user')
          .forEach(k => localStorage.removeItem(k));
      } catch (_) {}
    }
  }, []);

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
            setAssistantNotice(null);
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
    if (loginInFlight.current || loading || countdown > 0) return;
    prepareAssistantAudio();

    const normalizedEmail = email.trim().toLowerCase();
    const validation: { email?: string; password?: string } = {};
    if (!normalizedEmail) validation.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) validation.email = 'Enter a valid email address.';
    if (!password) validation.password = 'Enter your password.';
    setFieldErrors(validation);
    if (validation.email || validation.password) {
      clearError();
      setAssistantNotice({ id: ++noticeSequence.current, message: validation.email ? normalizedEmail ? 'Check your email address.' : 'Enter your email to sign in.' : 'Please enter your password.' });
      playAssistantError();
      if (validation.email) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    loginInFlight.current = true;
    setAssistantNotice(null);
    setAuthTransitionActive(true);
    setLoading(true);
    const success = await login(normalizedEmail, password);

    if (success) {
      const user = useAuthStore.getState().user;
      if (user) {
        let intended: string | null = null;
        let targetPostId: string | null = null;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          try {
            intended = sessionStorage.getItem('postflow_intended_url') || localStorage.getItem('postflow_intended_url');
            targetPostId = sessionStorage.getItem('postflow_target_post_id') || localStorage.getItem('postflow_target_post_id');
            sessionStorage.removeItem('postflow_intended_url');
            sessionStorage.removeItem('postflow_target_post_id');
            localStorage.removeItem('postflow_intended_url');
            localStorage.removeItem('postflow_target_post_id');
          } catch (e) {}
        }
        if (intended) {
          pendingDestination.current = intended;
        } else if (targetPostId) {
          pendingDestination.current = `${getRoleDashboardPath(user.role, user.department)}?postId=${targetPostId}`;
        } else {
          pendingDestination.current = getRoleDashboardPath(user.role, user.department);
        }
        queueAssistantWelcome(user.id);
        setDeparting(true);
        return;
      }
    } else {
      setPassword('');
      const failure = useAuthStore.getState();
      setAssistantNotice(failure.lockUntil && failure.lockUntil > Date.now() ? null : {
        id: ++noticeSequence.current,
        message: /credentials|email or password|incorrect password|invalid password/i.test(failure.error || '')
          ? 'Check your email and password.'
          : /connect/i.test(failure.error || '') ? 'Can’t connect. Try again.' : 'Sign-in failed. Try again.',
      });
      playAssistantError();
    }
    loginInFlight.current = false;
    setLoading(false);
    setAuthTransitionActive(false);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    const remaining = fieldErrors.password ? 'Please enter your password.' : null;
    setAssistantNotice(current => remaining ? current?.message === remaining ? current : { id: ++noticeSequence.current, message: remaining } : null);
    if (fieldErrors.email) setFieldErrors(current => ({ ...current, email: undefined }));
    if (error && countdown <= 0) clearError();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    const remaining = fieldErrors.email ? email.trim() ? 'Check your email address.' : 'Enter your email to sign in.' : null;
    setAssistantNotice(current => remaining ? current?.message === remaining ? current : { id: ++noticeSequence.current, message: remaining } : null);
    if (fieldErrors.password) setFieldErrors(current => ({ ...current, password: undefined }));
    if (error && countdown <= 0) clearError();
  };

  return (
    <AuthExperience departing={departing} onDepartureComplete={finishSignIn} assistantNotice={assistantNotice} lockSeconds={countdown}>
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
                nativeID="postflow-login-logo"
                resizeMode="contain"
                accessibilityLabel="Jose Maria College logo"
              />
              <Text style={styles.headerTitle}>JMCFI PostFlow</Text>
              <Text style={styles.headerSubtitle}>Sign in to your account</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.field}>
                <FloatingLabelInput
                  ref={emailRef}
                  label="Email"
                  validationMessage={fieldErrors.email}
                  feedbackId={credentialFeedbackId}
                  id="email"
                  name="email"
                  value={email}
                  editable={!loading}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
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
                  validationMessage={fieldErrors.password}
                  feedbackId={credentialFeedbackId}
                  id="password"
                  name="password"
                  value={password}
                  editable={!loading}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  }
                />
              </View>

              {error && countdown <= 0 && !lockUntil ? (
                <View nativeID="postflow-login-feedback" style={[styles.feedback, !!credentialFeedbackId && styles.feedbackCredentials]} accessibilityRole="alert" accessibilityLiveRegion="polite">
                  {credentialFeedbackId ? <>
                    <Ionicons name="information-circle-outline" size={14} color="#934152" style={{ marginRight: 7 }} accessible={false} />
                    <Text style={styles.credentialsText}>Email or password is incorrect.</Text>
                  </> : <>
                  <View style={styles.feedbackIcon}>
                    <Ionicons name="lock-closed-outline" size={16} color="#70448F" accessible={false} />
                  </View>
                  <View style={styles.feedbackCopy}>
                    <Text style={styles.feedbackTitle}>Couldn’t sign in</Text>
                    <Text style={styles.feedbackText}>{error}</Text>
                  </View>
                  </>}
                </View>
              ) : null}

              <View style={styles.field}>
                <TouchableOpacity
                  style={[styles.submitButton, (loading || countdown > 0) && !departing && styles.submitButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading || countdown > 0}
                  accessibilityRole="button"
                  accessibilityLabel={countdown > 0 ? `Try again in ${countdown}s` : departing ? 'Signed in' : loading ? 'Signing in...' : 'Login'}
                  accessibilityState={{ disabled: loading || countdown > 0, busy: loading }}
                >
                  {departing ? <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 10 }} />
                    : loading && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />}
                  <Text style={styles.submitText}>
                    {countdown > 0
                      ? `Try again in ${countdown}s`
                      : (departing ? 'Signed in' : loading ? 'Signing in...' : 'Login')}
                  </Text>
                  {!loading && countdown <= 0 && <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 12 }} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.helpText}>Need access? Contact IT Office.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthExperience>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 0 : 16,
    paddingHorizontal: Platform.OS === 'web' ? 0 : 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Platform.OS === 'web' ? 'transparent' : '#FFFFFF',
    borderRadius: Platform.OS === 'web' ? 0 : 20,
    borderWidth: Platform.OS === 'web' ? 0 : 1,
    borderColor: '#e9dfef',
    paddingTop: Platform.OS === 'web' ? 0 : 38,
    paddingBottom: Platform.OS === 'web' ? 0 : 28,
    paddingHorizontal: Platform.OS === 'web' ? 0 : 30,
    shadowColor: '#4b0082',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: Platform.OS === 'web' ? 0 : 0.05,
    shadowRadius: 36,
    elevation: Platform.OS === 'web' ? 0 : 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: 'Merriweather_700Bold',
    fontSize: 22,
    lineHeight: 29,
    color: '#8A008A',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#756980',
    marginTop: 4,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  field: {
    marginBottom: 10,
  },
  // ── Floating Label Styles ──
  flContainer: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3d9eb',
    backgroundColor: '#fcfafd',
    minHeight: 60,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  flContainerFocused: {
    borderColor: '#6c3baa',
    backgroundColor: '#FFFFFF',
    shadowColor: '#6c3baa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  flContainerError: {
    borderColor: '#CB9AA6',
    backgroundColor: '#FFFBFC',
    shadowColor: '#AC3C51',
  },
  fieldHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 2,
  },
  fieldHintText: {
    flex: 1,
    color: '#9E3A50',
    fontSize: 11,
    lineHeight: 16,
  },
  flInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 58,
  },
  flLabel: {
    position: 'absolute',
    left: 16,
    top: 6,
    zIndex: 1,
  },
  flLabelText: {
    fontSize: 11,
    lineHeight: 15,
    color: '#756980',
  },
  flLabelCentered: {
    top: '50%',
    transform: [{ translateY: -9 }],
  },
  flLabelTextCentered: {
    fontSize: 13,
    lineHeight: 18,
  },
  flInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#30203f',
    minHeight: 58,
  },
  flRightIcon: {
    position: 'absolute',
    right: 6,
    height: '100%',
    justifyContent: 'center',
    zIndex: 2,
  },
  // ────────────────────────────
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FBF8FD',
    borderWidth: 1,
    borderColor: '#E8DDEF',
    borderLeftWidth: 3,
    borderLeftColor: '#AB8EBF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  feedbackCredentials: {
    alignItems: 'center',
    backgroundColor: '#FFFBFC',
    borderColor: '#EAD9DE',
    borderLeftWidth: 1,
    borderLeftColor: '#EAD9DE',
    paddingVertical: 9,
  },
  credentialsText: {
    flex: 1,
    color: '#934152',
    fontSize: 12,
    lineHeight: 17,
  },
  feedbackIcon: {
    width: 28,
    height: 28,
    marginRight: 9,
    borderRadius: 8,
    backgroundColor: '#F0E8F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackCopy: {
    flex: 1,
  },
  feedbackTitle: {
    color: '#523363',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  feedbackText: {
    color: '#756581',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#4B0082',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  footer: {
    marginTop: 4,
    backgroundColor: 'transparent',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0e9f5',
    borderRadius: 2,
    alignItems: 'center',
  },
  footerText: {
    color: '#756980',
    fontSize: 11,
    marginLeft: 7,
  },
  accessNote: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpText: {
    color: '#756980',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 5,
  },
});
