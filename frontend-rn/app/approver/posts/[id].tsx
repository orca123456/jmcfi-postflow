import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore, getRoleDashboardPath } from '../../../store/auth';
import { Colors } from '../../../constants/theme';

export default function ApproverPostRedirectScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isInitialized } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) return;

    const targetPostId = id || '';
    const destinationPath = `/approver/posts/${targetPostId}`;

    // If not logged in, remember the post destination and send user to login
    if (!user) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('postflow_intended_url', destinationPath);
          sessionStorage.setItem('postflow_target_post_id', targetPostId);
          localStorage.setItem('postflow_intended_url', destinationPath);
          localStorage.setItem('postflow_target_post_id', targetPostId);
        } catch (e) {}
      }
      router.replace('/(auth)/login');
      return;
    }

    // Determine approver role & correct dashboard
    const rawRole = (user?.roles && user.roles[0]) || user?.role || 'office_head';
    const dept = (user?.department || '').toLowerCase();

    let targetDashboard = '/dashboard/office-head';

    if (rawRole === 'vice_president' || dept.includes('vice president')) {
      targetDashboard = '/dashboard/vp';
    } else if (rawRole === 'imc_qa_checker' || dept.includes('institutional marketing communication')) {
      targetDashboard = '/dashboard/imc-qa';
    } else if (rawRole === 'it_publisher' || rawRole === 'it_admin' || rawRole === 'admin') {
      targetDashboard = '/dashboard/it-admin';
    } else if (rawRole === 'office_head' || rawRole === 'approver') {
      targetDashboard = '/dashboard/office-head';
    } else if (rawRole === 'content_requestor' || rawRole === 'requestor') {
      targetDashboard = '/dashboard/requestor';
    } else {
      targetDashboard = getRoleDashboardPath(rawRole);
    }

    // Direct to the system dashboard and auto-open the post for action
    const query = targetPostId ? `?postId=${targetPostId}` : '';
    router.replace(`${targetDashboard}${query}` as any);
  }, [id, user, isInitialized, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Opening content request #{id}...</Text>
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
