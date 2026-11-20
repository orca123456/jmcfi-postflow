import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '../store/theme';

export interface FormattedDepartment {
  line1?: string;
  line2: string;
}

export function formatDepartment(rawDept?: string): FormattedDepartment {
  const clean = (rawDept || '').trim();
  if (!clean) return { line2: 'Department' };

  let formatted = clean.replace(/_/g, ' ');
  const words = formatted.split(/\s+/);
  formatted = words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (['of', 'and', 'the', 'for', 'in', 'to'].includes(lower) && i > 0) {
        return lower;
      }
      if (w.length <= 5 && w === w.toUpperCase() && !w.includes('_')) {
        return w;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');

  const lower = formatted.toLowerCase();

  // Primary use-case: College of Information Technology Education
  // Balanced 2-line placement (22 chars vs 20 chars) prevents awkward truncation
  if (lower.includes('information technology education')) {
    return {
      line1: 'College of Information',
      line2: 'Technology Education',
    };
  }

  if (lower.includes('engineering education')) {
    return {
      line1: 'College of Engineering',
      line2: 'Education',
    };
  }

  if (lower.includes('information technology office')) {
    return {
      line1: 'Information Technology',
      line2: 'Office',
    };
  }

  if (lower.includes('vice president')) {
    return {
      line1: 'Vice President of',
      line2: 'Academic Affairs',
    };
  }

  if (lower.includes('marketing communication')) {
    return {
      line1: 'Integrated Marketing',
      line2: 'Communications',
    };
  }

  if (lower.startsWith('college of ') && formatted.length <= 26) {
    return {
      line1: 'College of',
      line2: formatted.slice(11).trim(),
    };
  }

  // Short strings under 18 characters (e.g. BSA, Psyc, BSIT Department)
  if (formatted.length <= 18 || words.length <= 2) {
    return { line2: formatted };
  }

  // Dynamically balance 2 lines for any other multi-word department
  let bestSplit = 1;
  let minDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    const diff = Math.abs(l1.length - l2.length);
    if (diff < minDiff) {
      minDiff = diff;
      bestSplit = i;
    }
  }

  return {
    line1: words.slice(0, bestSplit).join(' '),
    line2: words.slice(bestSplit).join(' '),
  };
}

export function DepartmentCell({ department }: { department?: string }) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const { line1, line2 } = formatDepartment(department);

  return (
    <View style={deptStyles.container}>
      {line1 ? (
        <>
          <Text style={[deptStyles.deptText, isDarkMode && deptStyles.deptTextDark]}>
            {line1}
          </Text>
          <Text style={[deptStyles.deptText, isDarkMode && deptStyles.deptTextDark]}>
            {line2}
          </Text>
        </>
      ) : (
        <Text style={[deptStyles.deptText, isDarkMode && deptStyles.deptTextDark]}>
          {line2}
        </Text>
      )}
    </View>
  );
}

const deptStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    minWidth: 0,
    gap: 1,
  },
  deptText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#475569',
    letterSpacing: 0,
  },
  deptTextDark: {
    color: '#94A3B8',
  },
});
