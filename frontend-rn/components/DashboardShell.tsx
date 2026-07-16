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
  const { isDarkMode, toggleDarkMode } = useThemeStore();

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
          --color-president: #0F766E;
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
          --color-president: #14B8A6;
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

  // Dynamic sidebar navigation items depending on the user's role
  const getSidebarNavItems = () => {
    if (userRole === 'requestor') {
      const active = activeTab ?? 'approval-queue';
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' as const, active: active === 'dashboard' },
        { id: 'approval-queue', label: 'Approval Queue', icon: 'checkbox-outline' as const, active: active === 'approval-queue' },
        { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' as const, active: active === 'analytics' },
        { id: 'policy-rules', label: 'Policy Rules', icon: 'book-outline' as const, active: active === 'policy-rules' },
      ];
    }

    if (
      userRole === 'office_head' ||
      userRole === 'vice_president' ||
      userRole === 'president' ||
      userRole === 'imc_qa_checker' ||
      userRole === 'it_publisher'
    ) {
      const active = activeTab ?? 'dashboard';
      const queueLabel = userRole === 'it_publisher' ? 'Publishing Queue' : 'Approval Queue';
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' as const, active: active === 'dashboard' },
        { id: 'approval-queue', label: queueLabel, icon: 'checkbox-outline' as const, active: active === 'approval-queue' },
        { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' as const, active: active === 'analytics' },
        { id: 'policy-rules', label: 'Policy Rules', icon: 'book-outline' as const, active: active === 'policy-rules' },
      ];
    }

    // Default admin items
    const active = activeTab ?? 'overview';
    return [
      { id: 'overview', label: 'Overview', icon: 'grid-outline' as const, active: active === 'overview' },
      { id: 'user-management', label: 'User Management', icon: 'people-outline' as const, active: active === 'user-management' },
      { id: 'all-posts', label: 'All Posts', icon: 'document-text-outline' as const, active: active === 'all-posts' },
      { id: 'policy-rules', label: 'Policy Rules', icon: 'book-outline' as const, active: active === 'policy-rules' },
    ];
  };

  const sidebarNavItems = getSidebarNavItems();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logoText}>JMCFI POSTFLOW</Text>
          <View style={styles.headerDivider} />
          <Text style={styles.logoSubtitle}>Submission Approval System</Text>
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
              color={Colors.textSecondary} 
            />
          </TouchableOpacity>

          {userRole === 'requestor' && isDesktop && (
            <View style={styles.topRightNav}>
              <Ionicons name="notifications-outline" size={18} color={Colors.textSecondary} style={styles.navIconSpacing} />
            </View>
          )}
          <View style={{ position: 'relative', zIndex: 100 }}>
            {/* PROFILE TRIGGER */}
            <TouchableOpacity 
              style={styles.profileTrigger} 
              onPress={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            >
              <View style={[styles.avatarCircleMini, { backgroundColor: roleColor || Colors.primary }]}>
                <Text style={styles.avatarTextMini}>
                  {user?.name?.substring(0, 2).toUpperCase() ?? 'EH'}
                </Text>
              </View>
              {isDesktop && (
                <View style={styles.triggerTextContainer}>
                  <Text style={styles.triggerNameText}>{user?.name ?? 'Esther Howard'}</Text>
                </View>
              )}
              <Ionicons name="chevron-down" size={14} color="#6B7280" style={{ marginLeft: 2 }} />
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
                  {userRole === 'admin' && (
                    <TouchableOpacity 
                      style={styles.dropdownItem} 
                      onPress={() => { setIsProfileDropdownOpen(false); alert('Admin settings clicked'); }}
                    >
                      <Ionicons name="options-outline" size={18} color="#4B5563" />
                      <View style={styles.itemTextContainer}>
                        <Text style={styles.itemTitle}>Admin settings</Text>
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
                    onPress={() => { setIsProfileDropdownOpen(false); alert('Help Center clicked'); }}
                  >
                    <Ionicons name="help-circle-outline" size={18} color="#4B5563" />
                    <View style={styles.itemTextContainer}>
                      <Text style={styles.itemTitle}>Help Center</Text>
                      <Text style={styles.itemSubtitle}>Find answers and contact support</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.dropdownDivider} />

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
        {/* Left Sidebar - Desktop only */}
        {isDesktop && (
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeaderContainer}>
              <Image 
                source={require('../assets/images/jmc_logo.png')} 
                style={{ width: 42, height: 42, borderRadius: 21 }} 
                resizeMode="contain"
              />
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>JMCFI Postflow</Text>
                <Text style={styles.sidebarSubtitle}>Content Approval System</Text>
              </View>
            </View>
            
            <View style={styles.sidebarDivider} />

            <View style={styles.sidebarNav}>
              {sidebarNavItems.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.sidebarNavItem,
                    item.active && (userRole === 'admin' ? styles.sidebarNavItemActive : styles.sidebarNavItemActiveGold),
                  ]}
                  onPress={() => {
                    if (onTabChange) {
                      onTabChange(item.id);
                    } else {
                      alert(`${item.label} is under development.`);
                    }
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={item.active ? (userRole === 'admin' ? '#FFF' : Colors.textPrimary) : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.sidebarNavLabel,
                      item.active && (userRole === 'admin' ? styles.sidebarNavLabelActive : styles.sidebarNavLabelActiveGold),
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Bottom items in Sidebar */}
            <View style={styles.sidebarFooter}>
              <TouchableOpacity style={styles.sidebarFooterItem} onPress={() => alert('Help Center is under development.')}>
                <Ionicons name="help-circle-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.sidebarFooterLabel}>Help Center</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sidebarFooterItem} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.sidebarFooterLabel}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Content Wrapper */}
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
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.border,
  },
  logoSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRightNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginRight: Spacing.sm,
  },
  topRightNavLink: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  topRightNavLinkActive: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: 4,
  },
  navIconSpacing: {
    marginLeft: 8,
  },
  profileTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarCircleMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextMini: {
    color: Colors.textOnPrimary,
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  triggerTextContainer: {
    marginRight: 4,
  },
  triggerNameText: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  triggerSubtext: {
    fontSize: 10,
    color: Colors.textSecondary,
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
    shadowOpacity: 0.08,
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
  sidebar: {
    width: 240,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    justifyContent: 'space-between',
  },
  sidebarHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  schoolIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarHeader: {
    flex: 1,
  },
  sidebarTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  sidebarSubtitle: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sidebarNav: {
    flex: 1,
    gap: Spacing.xs,
  },
  sidebarNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderRadius: 4,
  },
  sidebarNavItemActive: {
    backgroundColor: Colors.primary,
  },
  sidebarNavItemActiveGold: {
    backgroundColor: '#FED65B', // Premium JMCFI Gold background matching screenshot
  },
  sidebarNavLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  sidebarNavLabelActive: {
    color: Colors.textOnPrimary,
    fontWeight: FontWeight.semiBold,
  },
  sidebarNavLabelActiveGold: {
    color: Colors.primary, // Dynamic primary text on gold background
    fontWeight: FontWeight.bold,
  },
  sidebarFooter: {
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sidebarFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  sidebarFooterLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
