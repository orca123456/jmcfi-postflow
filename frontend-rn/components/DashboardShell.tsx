import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
  Image,
  Platform,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, getRoleLabel, getRoleColor } from '../store/auth';
import { useThemeStore } from '../store/theme';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';
import { ChatBot } from './ChatBot';

interface DashboardShellProps {
  title: string;
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function DashboardShell({
  title,
  children,
  activeTab,
  onTabChange,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { width } = useWindowDimensions();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isHamburgerHovered, setIsHamburgerHovered] = React.useState(false);
  const [sidebarOpenedByHover, setSidebarOpenedByHover] = React.useState(false);
  const { isDarkMode, toggleDarkMode } = useThemeStore();

  const MIN_WIDTH = 64;
  const MAX_WIDTH = 240;
  const sidebarWidthAnim = React.useRef(new Animated.Value(MIN_WIDTH)).current;

  const openSidebar = React.useCallback(() => {
    setIsSidebarOpen(true);
    Animated.spring(sidebarWidthAnim, {
      toValue: MAX_WIDTH,
      useNativeDriver: false, // width animation doesn't support native driver
      tension: 70,
      friction: 12,
    }).start();
  }, [sidebarWidthAnim]);

  const closeSidebar = React.useCallback(() => {
    Animated.spring(sidebarWidthAnim, {
      toValue: MIN_WIDTH,
      useNativeDriver: false,
      tension: 70,
      friction: 12,
    }).start(() => {
      setIsSidebarOpen(false);
      setSidebarOpenedByHover(false);
    });
  }, [sidebarWidthAnim]);

  const toggleSidebar = () => {
    if (isSidebarOpen) {
      closeSidebar();
    } else {
      setSidebarOpenedByHover(false);
      openSidebar();
    }
  };

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;

    const styleId = 'postflow-theme-styles';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      styleTag.innerHTML = `
        :root {
          --color-primary: #0B2545;
          --color-primary-light: #134074;
          --color-primary-dark: #081F37;
          --color-accent: #FFC72C;
          --color-wisteria: #EEF4F8;
          --color-background: #F4F6F9;
          --color-surface: #FFFFFF;
          --color-surface-secondary: #EEF4F8;
          --color-text-primary: #1A1A2E;
          --color-text-secondary: #6B7280;
          --color-text-muted: #9CA3AF;
          --color-text-on-primary: #FFFFFF;
          --color-success: #16A34A;
          --color-warning: #D97706;
          --color-error: #DC2626;
          --color-info: #2563EB;
          --color-border: #E5E7EB;
          --color-border-focus: #0B2545;
          --color-admin: #7C3AED;
          --color-requestor: #2563EB;
          --color-office-head: #D97706;
          --color-vp: #DC2626;
          --color-imc-qa: #7C3AED;
          --color-publisher: #374151;
        }
        
        .dark-theme {
          --color-primary: #1E293B;
          --color-primary-light: #334155;
          --color-primary-dark: #0F172A;
          --color-accent: #FFD15C;
          --color-wisteria: #1E293B;
          --color-background: #0B1329;
          --color-surface: #1C2541;
          --color-surface-secondary: #1E293B;
          --color-text-primary: #F8FAFC;
          --color-text-secondary: #94A3B8;
          --color-text-muted: #64748B;
          --color-text-on-primary: #FFFFFF;
          --color-success: #22C55E;
          --color-warning: #F59E0B;
          --color-error: #EF4444;
          --color-info: #3B82F6;
          --color-border: #334155;
          --color-border-focus: #FFC72C;
          --color-admin: #A78BFA;
          --color-requestor: #60A5FA;
          --color-office-head: #F59E0B;
          --color-vp: #F87171;
          --color-imc-qa: #C084FC;
          --color-publisher: #9CA3AF;
        }
      `;
      document.head.appendChild(styleTag);
    }

    if (isDarkMode) {
      document.documentElement.classList.add('dark-theme');
      document.body.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
      document.body.classList.remove('dark-theme');
    }
  }, [isDarkMode]);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const isDesktop = width > 768;
  const roleColor = getRoleColor(user?.role ?? '');
  const userRole = user?.role ?? 'requestor';

  const getSidebarNavItems = () => {
    if (userRole === 'requestor') {
      const active = activeTab ?? 'dashboard';
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' as const, active: active === 'dashboard' },
        { id: 'request', label: 'Request', icon: 'document-text-outline' as const, active: active === 'request' || active === 'post-requests' },
        { id: 'draft', label: 'Draft', icon: 'create-outline' as const, active: active === 'draft' },
        { id: 'rejected', label: 'Rejected', icon: 'close-circle-outline' as const, active: active === 'rejected' },
        { id: 'policy-rules', label: 'Policy Rules', icon: 'book-outline' as const, active: active === 'policy-rules' },
      ];
    }

    if (
      userRole === 'office_head' ||
      userRole === 'imc_qa_checker' ||
      userRole === 'vice_president'
    ) {
      const active = activeTab ?? 'dashboard';
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' as const, active: active === 'dashboard' },
        { id: 'approved', label: 'Approved', icon: 'checkmark-circle-outline' as const, active: active === 'approved' },
        { id: 'rejected', label: 'Rejected', icon: 'close-circle-outline' as const, active: active === 'rejected' },
        { id: 'policy-rules', label: 'Policy Rules', icon: 'book-outline' as const, active: active === 'policy-rules' },
      ];
    }

    if (userRole === 'it_publisher') {
      const active = activeTab ?? 'overview';
      return [
        { id: 'overview', label: 'Overview', icon: 'grid-outline' as const, active: active === 'overview' },
        { id: 'user-management', label: 'User Management', icon: 'people-outline' as const, active: active === 'user-management' },
        { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' as const, active: active === 'analytics' },
        { id: 'audit-logs', label: 'Audit Logs', icon: 'shield-checkmark-outline' as const, active: active === 'audit-logs' },
        { id: 'policy-rules', label: 'Policy Rules', icon: 'book-outline' as const, active: active === 'policy-rules' },
      ];
    }

    // Default fallback
    const active = activeTab ?? 'overview';
    return [
      { id: 'overview', label: 'Overview', icon: 'grid-outline' as const, active: active === 'overview' },
      { id: 'policy-rules', label: 'Policy Rules', icon: 'book-outline' as const, active: active === 'policy-rules' },
    ];
  };

  const sidebarNavItems = getSidebarNavItems();

  return (
    <SafeAreaView style={styles.safe}>
        {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Hamburger with hover ripple */}
          <TouchableOpacity
            style={[
              styles.hamburgerBtn,
              isHamburgerHovered && styles.hamburgerBtnHovered,
            ]}
            onPress={toggleSidebar}
            {...(Platform.OS === 'web' ? {
              // @ts-ignore
              onMouseEnter: () => setIsHamburgerHovered(true),
              onMouseLeave: () => setIsHamburgerHovered(false),
            } : {})}
          >
            <Ionicons name="menu-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Image 
            source={require('../assets/images/jmc_logo.png')} 
            style={{ width: 28, height: 28, borderRadius: 14 }} 
            resizeMode="contain"
          />
          <Text style={styles.logoText}>JMCFI PostFLow</Text>
        </View>
        <View style={styles.headerRight}>
          {/* DARK MODE TOGGLE */}
          <TouchableOpacity 
            onPress={toggleDarkMode}
            style={styles.headerIconButton}
          >
            <Ionicons 
              name={isDarkMode ? "sunny-outline" : "moon-outline"} 
              size={18} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>

          {userRole === 'requestor' && isDesktop && (
            <View style={styles.topRightNav}>
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" style={styles.navIconSpacing} />
            </View>
          )}
          <View style={{ position: 'relative', zIndex: 100 }}>
            {/* PROFILE TRIGGER */}
            <TouchableOpacity 
              style={styles.profileTrigger} 
              onPress={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            >
              <View style={[styles.avatarCircleMini, { backgroundColor: roleColor || '#FFC72C' }]}>
                <Text style={styles.avatarTextMini}>
                  {user?.name?.substring(0, 2).toUpperCase() ?? 'EH'}
                </Text>
              </View>
              {isDesktop && (
                <View style={styles.triggerTextContainer}>
                  <Text style={styles.triggerNameText}>{user?.name ?? 'Esther Howard'}</Text>
                </View>
              )}
              <Ionicons name="chevron-down" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </TouchableOpacity>

            {/* DROPDOWN OVERLAY */}
            {isProfileDropdownOpen && (
              <View style={styles.dropdownContainer}>
                {/* Header Info */}
                <View style={styles.dropdownHeader}>
                  <View style={[styles.avatarCircleLarge, { backgroundColor: roleColor || Colors.primary }]}>
                    <Text style={styles.avatarTextLarge}>
                      {user?.name?.substring(0, 2).toUpperCase() ?? 'EH'}
                    </Text>
                  </View>
                  <View style={styles.headerTextContainer}>
                    <Text style={styles.dropdownNameText}>{user?.name ?? 'Esther Howard'}</Text>
                    <Text style={styles.dropdownEmailText}>{user?.email ?? 'estherhoward@gmail.com'}</Text>
                  </View>
                </View>
                
                <View style={styles.dropdownDivider} />
                
                {/* Menu items */}
                <ScrollView style={styles.dropdownItemsList}>
                  {userRole === 'it_publisher' && (
                    <TouchableOpacity 
                      style={styles.dropdownItem} 
                      onPress={() => { setIsProfileDropdownOpen(false); if (onTabChange) onTabChange('user-management'); }}
                    >
                      <Ionicons name="people-outline" size={18} color="#4B5563" />
                      <View style={styles.itemTextContainer}>
                        <Text style={styles.itemTitle}>User Management</Text>
                        <Text style={styles.itemSubtitle}>Manage members, access & more</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.dropdownItem} 
                    onPress={() => { 
                      setIsProfileDropdownOpen(false); 
                      if (onTabChange) onTabChange('account-settings');
                    }}
                  >
                    <Ionicons name="settings-outline" size={18} color="#4B5563" />
                    <View style={styles.itemTextContainer}>
                      <Text style={styles.itemTitle}>Account settings</Text>
                      <Text style={styles.itemSubtitle}>Manage defaults, privacy & more</Text>
                    </View>
                  </TouchableOpacity>



                  <TouchableOpacity 
                    style={styles.dropdownItem} 
                    onPress={() => { setIsProfileDropdownOpen(false); handleLogout(); }}
                  >
                    <Ionicons name="log-out-outline" size={18} color="#4B5563" />
                    <View style={styles.itemTextContainer}>
                      <Text style={styles.itemTitle}>Sign out</Text>
                    </View>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Main Layout Container */}
      <View style={styles.mainContainer}>
        {/* ── Animated Sidebar (Pushes content, Google Classroom style) ── */}
        {isDesktop && (
          <Animated.View
            style={[
              styles.sidebar,
              { width: sidebarWidthAnim }
            ]}
            {...(Platform.OS === 'web' ? {
              // @ts-ignore
              onMouseEnter: () => {
                if (!isSidebarOpen) {
                  setSidebarOpenedByHover(true);
                  openSidebar();
                }
              },
              onMouseLeave: () => {
                if (sidebarOpenedByHover) {
                  closeSidebar();
                }
              },
            } : {})}
          >
            {/* Inner fixed width container to prevent text wrapping during animation */}
            <View style={[styles.sidebarInner, { width: MAX_WIDTH }]}>
              <View>
                <View style={styles.sidebarHeaderContainer}>
                  <Image
                    source={require('../assets/images/jmc_logo.png')}
                    style={{ width: 36, height: 36, borderRadius: 18 }}
                    resizeMode="contain"
                  />
                  <View style={styles.sidebarHeader}>
                    <Text style={styles.sidebarTitle}>COBE</Text>
                  </View>
                </View>

                <View style={styles.sidebarDivider} />

                <View style={styles.sidebarNav}>
                  {sidebarNavItems.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.sidebarNavItem,
                        item.active && styles.sidebarNavItemActivePurple,
                      ]}
                      onPress={() => {
                        if (onTabChange) onTabChange(item.id);
                        if (sidebarOpenedByHover) closeSidebar();
                      }}
                    >
                      <View style={styles.sidebarNavIconWrapper}>
                        <Ionicons name={item.icon} size={22} color="#FFFFFF" />
                      </View>
                      <Animated.View style={{ 
                        opacity: sidebarWidthAnim.interpolate({
                          inputRange: [MIN_WIDTH, MAX_WIDTH],
                          outputRange: [0, 1]
                        }) 
                      }}>
                        <Text
                          style={[
                            styles.sidebarNavLabel,
                            item.active && styles.sidebarNavLabelActivePurple,
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      </Animated.View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Bottom footer */}
              <View style={styles.sidebarFooter}>
                <TouchableOpacity style={styles.sidebarNavItem} onPress={() => alert('Help Center is under development.')}>
                  <View style={styles.sidebarNavIconWrapper}>
                    <Ionicons name="help-circle-outline" size={22} color="rgba(255,255,255,0.8)" />
                  </View>
                  <Animated.View style={{ 
                    opacity: sidebarWidthAnim.interpolate({
                      inputRange: [MIN_WIDTH, MAX_WIDTH],
                      outputRange: [0, 1]
                    }) 
                  }}>
                    <Text style={styles.sidebarFooterLabel} numberOfLines={1}>Help Center</Text>
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Content Wrapper — full width always since sidebar overlays */}
        <View style={styles.contentWrapper}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>

      {/* Bottom Nav - Mobile only */}
      {!isDesktop && (
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => alert('Dashboard is under development.')}>
            <Ionicons name="grid-outline" size={22} color={Colors.textSecondary} />
            <Text style={styles.navLabel}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => alert('Post Requests is under development.')}>
            <Ionicons name="document-text-outline" size={22} color={Colors.primary} />
            <Text style={styles.navLabel}>Requests</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
            <Text style={styles.navLabel}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating ChatBot */}
      <ChatBot />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4C007C', // Deep purple matching screenshot
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3B0061',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    fontFamily: 'Kameron_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRightNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginRight: Spacing.sm,
  },
  topRightNavLink: {
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    fontWeight: FontWeight.medium,
  },
  topRightNavLinkActive: {
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
    paddingBottom: 4,
  },
  navIconSpacing: {
    marginLeft: 8,
  },
  profileTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  avatarCircleMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFC72C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextMini: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  triggerTextContainer: {
    marginRight: 4,
  },
  triggerNameText: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  triggerSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 1,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 42,
    right: 0,
    width: 280,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 999,
    paddingVertical: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarCircleLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextLarge: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  dropdownNameText: {
    fontSize: FontSize.sm + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  dropdownEmailText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  dropdownItemsList: {
    maxHeight: 350,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  itemSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  // Hamburger button
  hamburgerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
    backgroundColor: 'transparent',
  },
  hamburgerBtnHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },

  // Left edge hover detection zone (REMOVED)
  
  // Backdrop overlay (REMOVED)
  
  // Sidebar — now inline, animated width
  sidebar: {
    backgroundColor: '#4C007C',
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: '#3B0061',
  },
  sidebarInner: {
    flex: 1,
    paddingTop: Spacing.md,
    justifyContent: 'space-between',
  },
  sidebarHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 16,
    marginBottom: Spacing.sm,
  },
  schoolIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarHeader: {
    flex: 1,
  },
  sidebarTitle: {
    fontSize: FontSize.lg + 2,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: Spacing.md,
    marginTop: 4,
    marginHorizontal: Spacing.md,
  },
  sidebarNav: {
    flex: 1,
    gap: 6,
    paddingHorizontal: 8,
  },
  sidebarNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 20, // Rounded pill shape matching screenshot
  },
  sidebarNavIconWrapper: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarNavItemActivePurple: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)', // Lighter purple pill fill for active tab
  },
  sidebarNavLabel: {
    fontSize: FontSize.md,
    color: '#FFFFFF',
    fontWeight: FontWeight.medium,
  },
  sidebarNavLabelActivePurple: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  sidebarFooter: {
    paddingVertical: Spacing.md,
    paddingHorizontal: 8,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  sidebarFooterLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  contentWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  navLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
