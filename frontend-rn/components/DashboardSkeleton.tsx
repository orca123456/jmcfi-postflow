import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

const DashboardSkeleton = () => {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Animated.View style={[styles.skeletonBlock, { width: 250, height: 32, marginBottom: 8, opacity: pulseAnim }]} />
          <Animated.View style={[styles.skeletonBlock, { width: 400, height: 20, opacity: pulseAnim }]} />
        </View>
        <Animated.View style={[styles.skeletonBlock, { width: 180, height: 44, borderRadius: 8, opacity: pulseAnim }]} />
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        {[1, 2, 3, 4].map((item) => (
          <Animated.View key={item} style={[styles.metricCard, { opacity: pulseAnim }]} />
        ))}
      </View>

      {/* Table Section */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Animated.View style={[styles.skeletonBlock, { width: 200, height: 24, opacity: pulseAnim }]} />
          <Animated.View style={[styles.skeletonBlock, { width: 100, height: 32, opacity: pulseAnim }]} />
        </View>
        
        {/* Table Rows */}
        <View style={{ padding: 24 }}>
          {[1, 2, 3, 4, 5].map((row) => (
            <View key={row} style={styles.tableRow}>
              <Animated.View style={[styles.skeletonBlock, { width: 40, height: 40, borderRadius: 20, opacity: pulseAnim }]} />
              <View style={{ flex: 2, paddingHorizontal: 16 }}>
                <Animated.View style={[styles.skeletonBlock, { width: '80%', height: 16, marginBottom: 8, opacity: pulseAnim }]} />
                <Animated.View style={[styles.skeletonBlock, { width: '40%', height: 12, opacity: pulseAnim }]} />
              </View>
              <Animated.View style={[styles.skeletonBlock, { width: '15%', height: 20, borderRadius: 12, opacity: pulseAnim }]} />
              <Animated.View style={[styles.skeletonBlock, { width: '15%', height: 20, borderRadius: 12, marginLeft: 16, opacity: pulseAnim }]} />
              <Animated.View style={[styles.skeletonBlock, { width: 60, height: 32, borderRadius: 6, marginLeft: 'auto', opacity: pulseAnim }]} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Platform.OS === 'web' ? 32 : 16,
    width: '100%',
    maxWidth: 1200,
    marginHorizontal: 'auto',
  },
  skeletonBlock: {
    backgroundColor: '#E5E7EB', // gray-200
    borderRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  metricCard: {
    backgroundColor: '#F3F4F6', // gray-100
    height: 120,
    flex: 1,
    minWidth: 200,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    minHeight: 400,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  }
});

export default DashboardSkeleton;
