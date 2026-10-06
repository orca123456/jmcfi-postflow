import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore, getRoleDashboardPath } from '../../../store/auth';
import { Colors } from '../../../constants/theme';

export default function ApproverPostsIndexScreen() {
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) return;

    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    const rawRole = (user?.roles && user.roles[0]) || user?.role || 'office_head';
    router.replace(getRoleDashboardPath(rawRole) as any);
  }, [user, isInitialized, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Redirecting to dashboard...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
});
