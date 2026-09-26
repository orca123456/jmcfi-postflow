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
  ImageBackground,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, getRoleLabel, getRoleColor, getRoleDashboardPath, getAvatarColors } from '../store/auth';
import { useThemeStore } from '../store/theme';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';
import { ChatBot } from './ChatBot';
import { departmentsApi, authApi, notificationsApi } from '../services/api';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface DashboardShellProps {
  title: string;
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  departmentName?: string;
  departmentLogo?: string;
  userPhotoUrl?: string | null;
  backgroundImage?: any;
}

export function DashboardShell({
  title,
  children,
  activeTab,
  onTabChange,
  departmentName,
  departmentLogo,
  userPhotoUrl,
  backgroundImage,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { width } = useWindowDimensions();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isHamburgerHovered, setIsHamburgerHovered] = React.useState(false);
  const [sidebarOpenedByHover, setSidebarOpenedByHover] = React.useState(false);
  const [photoLoadFailed, setPhotoLoadFailed] = React.useState(false);
  const { isDarkMode, toggleDarkMode } = useThemeStore();

  // Notifications State & Logic
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await notificationsApi.getNotifications();
      if (res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      // ignore
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      // ignore
    }
  };

  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
  const mobileDrawerAnim = React.useRef(new Animated.Value(-300)).current;
  const mobileBackdropAnim = React.useRef(new Animated.Value(0)).current;

  const openMobileDrawer = React.useCallback(() => {
    setIsMobileDrawerOpen(true);
    Animated.parallel([
      Animated.spring(mobileDrawerAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(mobileBackdropAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [mobileDrawerAnim, mobileBackdropAnim]);

  const closeMobileDrawer = React.useCallback(() => {
    Animated.parallel([
      Animated.spring(mobileDrawerAnim, {
        toValue: -300,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(mobileBackdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsMobileDrawerOpen(false);
    });
  }, [mobileDrawerAnim, mobileBackdropAnim]);

  // Auto-fetch department logo for the current user
  const [autoDeptLogo, setAutoDeptLogo] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    const deptName = user?.department;
    if (!deptName) return;
    const timer = setTimeout(() => {
      departmentsApi.list().then(res => {
        const depts = res.data?.data || [];
        const match = depts.find((d: any) =>
          d.display_name === deptName || d.name === deptName
        );
        if (match?.logo_url) {
          setAutoDeptLogo(match.logo_url);
        }
      }).catch(() => {});
    }, 6000); // Delay so it doesn't block dashboard init on single-threaded dev server
    return () => clearTimeout(timer);
  }, [user?.department]);

  // Auto-fetch user photo from API (in case it was uploaded after login)
  const [apiUserPhoto, setApiUserPhoto] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      authApi.getUser().then(res => {
        const userData = res.data?.user || res.data;
        if (userData?.photo_url && userData.photo_url !== '') {
          setApiUserPhoto(userData.photo_url);
        }
        if (userData?.department_logo_url) {
          setAutoDeptLogo(userData.department_logo_url);
          // Also update the global user object so it's cached in local storage for next time
          useAuthStore.getState().setUser({ ...user, ...userData });
        }
      }).catch(() => {});
    }, 6500); // Delay so it doesn't block dashboard init
    return () => clearTimeout(timer);
  }, [user?.id]);

  const finalDeptLogo = departmentLogo || (user as any)?.department_logo_url || autoDeptLogo;
  const finalDeptName = departmentName || user?.department || 'JMCFI';
  const photoFromUser = (user as any)?.photo_url;
  const finalPhotoUrl = userPhotoUrl || apiUserPhoto || (photoFromUser && photoFromUser !== '' ? photoFromUser : null);
  const shouldShowPhoto = Boolean(finalPhotoUrl && !photoLoadFailed);

  React.useEffect(() => {
    setPhotoLoadFailed(false);
  }, [finalPhotoUrl]);

  const MIN_WIDTH = 64;
  const MAX_WIDTH = 260;
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
    if (!isDesktop) {
      // On mobile, use the drawer instead
      if (isMobileDrawerOpen) {
        closeMobileDrawer();
      } else {
        openMobileDrawer();
      }
      return;
    }
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
  const avatarColors = getAvatarColors(user?.name ?? 'Esther Howard');

  const getSidebarNavItems = () => {
    if (userRole === 'requestor') {
      const active = activeTab ?? 'dashboard';
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' as const, active: active === 'dashboard' },
        { id: 'request', label: 'Create Request', icon: 'document-text-outline' as const, active: active === 'request' || active === 'post-requests' },
        { id: 'draft', label: 'Draft', icon: 'create-outline' as const, active: active === 'draft' },
        { id: 'rejected', label: 'Rejected', icon: 'close-circle-outline' as const, active: active === 'rejected' },
        { id: 'policy-rules', label: 'Policy Rules', icon: 'book-outline' as const, active: active === 'policy-rules' },
      ];
    }

    if (userRole === 'approver') {
      const active = activeTab ?? 'dashboard';
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' as const, active: active === 'dashboard' },
        { id: 'approved', label: 'Approved', icon: 'checkmark-circle-outline' as const, active: active === 'approved' },
        { id: 'rejected', label: 'Rejected', icon: 'close-circle-outline' as const, active: active === 'rejected' },
        { id: 'policy-rules', label: 'Policy Rules', icon: 'book-outline' as const, active: active === 'policy-rules' },
      ];
    }

    if (userRole === 'admin') {
      const active = activeTab ?? 'overview';
      return [
        { id: 'overview', label: 'Overview', icon: 'grid-outline' as const, active: active === 'overview' },
        { id: 'user-management', label: 'User Management', icon: 'people-outline' as const, active: active === 'user-management' },
        { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' as const, active: active === 'analytics' },
        { id: 'audit-logs', label: 'Audit Logs', icon: 'shield-checkmark-outline' as const, active: active === 'audit-logs' },
        { id: 'tokens', label: 'Tokens', icon: 'key-outline' as const, active: active === 'tokens' },
        { id: 'developer-api', label: 'Developer API', icon: 'code-slash-outline' as const, active: active === 'developer-api' },
        { id: 'email-settings', label: 'Email Settings', icon: 'mail-outline' as const, active: active === 'email-settings' },
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
          <TouchableOpacity
            onPress={() => {
              if (user?.role) {
                router.push(getRoleDashboardPath(user.role) as any);
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Image 
              source={require('../assets/images/jmc_logo.png')} 
              style={{ width: 28, height: 28, borderRadius: 14 }} 
              resizeMode="contain"
            />
            <Text style={styles.logoText} numberOfLines={1}>
              {width > 420 ? 'JMCFI PostFLow' : 'PostFLow'}
            </Text>
          </TouchableOpacity>
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

          {/* NOTIFICATION TRIGGER */}
          <TouchableOpacity 
            onPress={() => {
              setIsProfileDropdownOpen(false);
              setIsNotificationDropdownOpen(!isNotificationDropdownOpen);
            }}
            style={styles.headerIconButton}
          >
            <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* PROFILE TRIGGER */}
          <TouchableOpacity 
            style={styles.profileTrigger} 
            onPress={() => {
              setIsNotificationDropdownOpen(false);
              setIsProfileDropdownOpen(!isProfileDropdownOpen);
            }}
          >
            <View style={[styles.avatarCircleMini, !shouldShowPhoto && { backgroundColor: avatarColors.bg }]}>
              {shouldShowPhoto ? (
                <Image source={{ uri: finalPhotoUrl! }} style={{ width: 28, height: 28, borderRadius: 14 }} resizeMode="cover" onError={() => setPhotoLoadFailed(true)} />
              ) : (
                <Text style={[styles.avatarTextMini, { color: avatarColors.text }]}>
                  {user?.first_name ? (user.first_name[0] + (user.last_name?.[0] || '')).toUpperCase() : 'EH'}
                </Text>
              )}
            </View>
            {isDesktop && (
              <View style={styles.triggerTextContainer}>
                <Text style={styles.triggerNameText}>{user?.name ?? 'Esther Howard'}</Text>
              </View>
            )}
            <Ionicons name="chevron-down" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>

        {/* BACKDROP FOR DROPDOWNS */}
        {(isProfileDropdownOpen || isNotificationDropdownOpen) && (
          <TouchableWithoutFeedback
            onPress={() => {
              setIsProfileDropdownOpen(false);
              setIsNotificationDropdownOpen(false);
            }}
          >
            <View style={styles.dropdownBackdrop} />
          </TouchableWithoutFeedback>
        )}

        {/* NOTIFICATIONS DROPDOWN OVERLAY (HEADER LEVEL) */}
        {isNotificationDropdownOpen && (
          <View style={styles.notificationsDropdownContainer}>
            <View style={styles.notifHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.notifHeaderTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={{ backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>{unreadCount} new</Text>
                  </View>
                )}
              </View>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllAsRead}>
                  <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }}>Mark all as read</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: '#E5E7EB' }} />

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={true}>
              {notifications.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="notifications-off-outline" size={32} color="#9CA3AF" style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '500' }}>No notifications yet</Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 2 }}>You're all caught up!</Text>
                </View>
              ) : (
                notifications.map((n) => {
                  const isRead = n.read;
                  const title = n.data?.title || n.data?.post_title || 'Notification';
                  const message = n.data?.message || n.data?.reason || n.data?.remarks || 'Action updated';
                  const timeAgo = n.created_at || 'Just now';

                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[
                        styles.notifItem,
                        !isRead && { backgroundColor: '#F0F9FF' },
                      ]}
                      onPress={() => handleMarkAsRead(n.id)}
                    >
                      <View
                        style={[
                          styles.notifIconCircle,
                          {
                            backgroundColor: n.type?.includes('Approved')
                              ? '#DCFCE7'
                              : n.type?.includes('Rejected')
                              ? '#FEE2E2'
                              : '#EFF6FF',
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            n.type?.includes('Approved')
                              ? 'checkmark-circle'
                              : n.type?.includes('Rejected')
                              ? 'close-circle'
                              : 'information-circle'
                          }
                          size={18}
                          color={
                            n.type?.includes('Approved')
                              ? '#16A34A'
                              : n.type?.includes('Rejected')
                              ? '#DC2626'
                              : '#2563EB'
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notifTitle, !isRead && { fontWeight: '700' }]}>{title}</Text>
                        <Text style={styles.notifMessage} numberOfLines={2}>{message}</Text>
                        <Text style={styles.notifTime}>{timeAgo}</Text>
                      </View>
                      {!isRead && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        {/* PROFILE DROPDOWN OVERLAY (HEADER LEVEL) */}
        {isProfileDropdownOpen && (
          <View style={styles.dropdownContainer}>
            {/* Header Info */}
            <View style={styles.dropdownHeader}>
              <View style={[styles.avatarCircleLarge, !shouldShowPhoto && { backgroundColor: avatarColors.bg }]}>
                {shouldShowPhoto ? (
                  <Image source={{ uri: finalPhotoUrl! }} style={{ width: 48, height: 48, borderRadius: 24 }} resizeMode="cover" onError={() => setPhotoLoadFailed(true)} />
                ) : (
                  <Text style={[styles.avatarTextLarge, { color: avatarColors.text }]}>
                    {user?.first_name ? (user.first_name[0] + (user.last_name?.[0] || '')).toUpperCase() : 'EH'}
                  </Text>
                )}
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

      {/* Main Layout Container */}
      <View style={styles.mainContainer}>
        {/* ── Animated Sidebar (Desktop only — Pushes content, Google Classroom style) ── */}
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
                    source={finalDeptLogo ? { uri: finalDeptLogo } : require('../assets/images/jmc_logo.png')}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                    resizeMode="contain"
                  />
                  <Animated.View style={[styles.sidebarHeader, {
                    opacity: sidebarWidthAnim.interpolate({
                      inputRange: [MIN_WIDTH, MAX_WIDTH],
                      outputRange: [0, 1]
                    })
                  }]}>
                    <Text style={[styles.sidebarTitle, { textAlign: 'left' }]} numberOfLines={2} adjustsFontSizeToFit>{finalDeptName}</Text>
                  </Animated.View>
                </View>

                <View style={styles.sidebarDivider} />

                <View style={styles.sidebarNav}>
                  {sidebarNavItems.map((item, idx) => (
                    <AnimatedTouchable
                      key={idx}
                      style={[
                        styles.sidebarNavItem,
                        item.active && styles.sidebarNavItemActivePurple,
                        {
                          width: sidebarWidthAnim.interpolate({
                            inputRange: [MIN_WIDTH, MAX_WIDTH],
                            outputRange: [48, MAX_WIDTH - 16]
                          })
                        }
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
                    </AnimatedTouchable>
                  ))}
                </View>

                <View style={styles.sidebarDivider} />

                <View style={{ gap: 4, paddingBottom: 16 }}>
                  <AnimatedTouchable
                    style={[
                      styles.sidebarNavItem,
                      activeTab === 'account-settings' && styles.sidebarNavItemActivePurple,
                      {
                        width: sidebarWidthAnim.interpolate({
                          inputRange: [MIN_WIDTH, MAX_WIDTH],
                          outputRange: [48, MAX_WIDTH - 16]
                        })
                      }
                    ]}
                    onPress={() => {
                      if (onTabChange) onTabChange('account-settings');
                      if (sidebarOpenedByHover) closeSidebar();
                    }}
                  >
                    <View style={styles.sidebarNavIconWrapper}>
                      <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
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
                          activeTab === 'account-settings' && styles.sidebarNavLabelActivePurple,
                        ]}
                        numberOfLines={1}
                      >
                        Account Settings
                      </Text>
                    </Animated.View>
                  </AnimatedTouchable>
                  <AnimatedTouchable
                    style={[
                      styles.sidebarNavItem,
                      {
                        width: sidebarWidthAnim.interpolate({
                          inputRange: [MIN_WIDTH, MAX_WIDTH],
                          outputRange: [48, MAX_WIDTH - 16]
                        })
                      }
                    ]}
                    onPress={() => {
                      if (sidebarOpenedByHover) closeSidebar();
                      handleLogout();
                    }}
                  >
                    <View style={styles.sidebarNavIconWrapper}>
                      <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
                    </View>
                    <Animated.View style={{ 
                      opacity: sidebarWidthAnim.interpolate({
                        inputRange: [MIN_WIDTH, MAX_WIDTH],
                        outputRange: [0, 1]
                      }) 
                    }}>
                      <Text style={styles.sidebarNavLabel} numberOfLines={1}>
                        Sign Out
                      </Text>
                    </Animated.View>
                  </AnimatedTouchable>
                </View>
              </View>


            </View>
          </Animated.View>
        )}

        {/* Content Wrapper — full width always since sidebar overlays */}
        <View style={styles.contentWrapper}>
          {backgroundImage ? (
            <ImageBackground 
              source={backgroundImage} 
              style={{ flex: 1, width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.85)' }} 
              imageStyle={{ opacity: 0.15 }}
              resizeMode="cover"
            >
              <ScrollView
                style={styles.content}
                contentContainerStyle={[styles.contentContainer, !isDesktop && styles.contentContainerMobile]}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </ImageBackground>
          ) : (
            <ScrollView
              style={styles.content}
              contentContainerStyle={[styles.contentContainer, !isDesktop && styles.contentContainerMobile]}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          )}
        </View>
      </View>

      {/* ── Mobile Slide-Out Drawer ── */}
      {!isDesktop && isMobileDrawerOpen && (
        <View style={styles.mobileDrawerOverlay}>
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={closeMobileDrawer}>
            <Animated.View style={[styles.mobileDrawerBackdrop, { opacity: mobileBackdropAnim }]} />
          </TouchableWithoutFeedback>

          {/* Drawer Panel */}
          <Animated.View style={[styles.mobileDrawerPanel, { left: mobileDrawerAnim }]}>
            {/* Drawer Header */}
            <View style={styles.mobileDrawerHeader}>
              <Image
                source={finalDeptLogo ? { uri: finalDeptLogo } : require('../assets/images/jmc_logo.png')}
                style={{ width: 44, height: 44, borderRadius: 22 }}
                resizeMode="contain"
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.mobileDrawerDeptName} numberOfLines={2}>{finalDeptName}</Text>
                <Text style={styles.mobileDrawerUserName}>{user?.name ?? 'User'}</Text>
              </View>
            </View>

            <View style={styles.mobileDrawerDivider} />

            {/* Nav Items */}
            <ScrollView style={styles.mobileDrawerNavList} showsVerticalScrollIndicator={false}>
              {sidebarNavItems.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.mobileDrawerNavItem,
                    item.active && styles.mobileDrawerNavItemActive,
                  ]}
                  onPress={() => {
                    if (onTabChange) onTabChange(item.id);
                    closeMobileDrawer();
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={item.active ? '#FFC72C' : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.mobileDrawerNavLabel,
                      item.active && styles.mobileDrawerNavLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.mobileDrawerDivider} />

            {/* Footer Actions */}
            <View style={styles.mobileDrawerFooter}>
              <TouchableOpacity
                style={styles.mobileDrawerNavItem}
                onPress={() => {
                  closeMobileDrawer();
                  if (onTabChange) onTabChange('account-settings');
                }}
              >
                <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
                <Text style={styles.mobileDrawerNavLabel}>Account Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mobileDrawerNavItem}
                onPress={() => {
                  closeMobileDrawer();
                  handleLogout();
                }}
              >
                <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
                <Text style={styles.mobileDrawerNavLabel}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4C007C', // Deep purple matching screenshot
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3B0061',
    zIndex: 1000,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  logoText: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    fontFamily: 'Kameron_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.1,
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
    gap: 6,
    flexShrink: 0,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
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
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -2000,
    zIndex: 99990,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 54,
    right: 12,
    width: 270,
    maxWidth: '88vw' as any,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 99999,
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
    alignItems: 'center', // Centers vertically
    paddingHorizontal: 12, // Exactly 12px padding centers the 40px logo within the 64px collapsed sidebar
    gap: 12,
    marginBottom: Spacing.sm,
    minHeight: 56, // Ensure container has enough height
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
    flex: 1, // Fill remaining space
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  sidebarTitle: {
    fontSize: 14, // Explicitly not too big
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textAlignVertical: 'center',
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
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24, // Rounded pill shape matching screenshot
    overflow: 'hidden',
  },
  sidebarNavIconWrapper: {
    width: 48,
    height: 48,
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
  contentContainerMobile: {
    padding: 12,
    gap: 12,
    paddingBottom: 24,
  },
  // ── Mobile Drawer Styles ──
  mobileDrawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  mobileDrawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  mobileDrawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 280,
    maxWidth: '85%',
    backgroundColor: '#4C007C',
    paddingTop: Platform.OS === 'ios' ? 48 : (Platform.OS === 'android' ? 28 : 16),
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  mobileDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  mobileDrawerDeptName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  mobileDrawerUserName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  mobileDrawerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  mobileDrawerNavList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  mobileDrawerNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 4,
  },
  mobileDrawerNavItemActive: {
    backgroundColor: 'rgba(255, 199, 44, 0.15)',
  },
  mobileDrawerNavLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500' as const,
  },
  mobileDrawerNavLabelActive: {
    color: '#FFC72C',
    fontWeight: '700' as const,
  },
  mobileDrawerFooter: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  unreadBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#4C007C',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800' as const,
  },
  notificationsDropdownContainer: {
    position: 'absolute',
    top: 54,
    right: 12,
    width: 320,
    maxWidth: '88vw' as any,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    zIndex: 99999,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  notifHeaderTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  notifIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifTitle: {
    fontSize: 12,
    color: '#1F2937',
  },
  notifMessage: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2,
  },
  notifTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    alignSelf: 'center',
  },
});
