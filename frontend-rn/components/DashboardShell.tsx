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
  Easing,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, getRoleLabel, getRoleColor, getRoleDashboardPath, getAvatarColors } from '../store/auth';
import { useThemeStore } from '../store/theme';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';
import { resolveImageUrl } from '../services/api';
import { ChatBot } from './ChatBot';
import { departmentsApi, authApi, notificationsApi, programHeadsApi } from '../services/api';
import { topLoadingBar } from '../store/loadingBar';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const MAX_SIDEBAR_WIDTH = 275;

interface SidebarSubItem {
  id: string;
  label: string;
  icon: any;
  active: boolean;
}

interface SidebarNavItem {
  id: string;
  label: string;
  icon: any;
  active: boolean;
  subItems?: SidebarSubItem[];
}

interface DashboardShellProps {
  title: string;
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  departmentName?: string;
  departmentLogo?: string;
  assignedProgram?: string;
  userPhotoUrl?: string | null;
  backgroundImage?: any;
  onOpenPost?: (postId: string | number) => void;
}

export function DashboardShell({
  title,
  children,
  activeTab,
  onTabChange,
  departmentName,
  departmentLogo,
  assignedProgram: propAssignedProgram,
  userPhotoUrl,
  backgroundImage,
  onOpenPost,
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
  const [deptLogoLoadFailed, setDeptLogoLoadFailed] = React.useState(false);
  const { isDarkMode, toggleDarkMode } = useThemeStore();

  // Notifications State & Logic
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);

  const fetchNotifications = React.useCallback(async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return;
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
    const interval = setInterval(() => {
      // Skip background polling while the browser tab is hidden
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return;
      fetchNotifications();
    }, 15000);
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

  const handleNotificationClick = async (n: any) => {
    try {
      if (!n.read) {
        handleMarkAsRead(n.id);
      }
    } catch (e) {
      // ignore
    }

    setIsNotificationDropdownOpen(false);

    const postId = n.data?.post_request_id || n.data?.post_id || n.data?.id;
    if (!postId) return;

    if (onOpenPost) {
      onOpenPost(postId);
      return;
    }

    const currentRole = user?.roles?.[0] || user?.role || 'requestor';
    const targetDashboard = getRoleDashboardPath(currentRole, user?.department);
    router.push({
      pathname: targetDashboard as any,
      params: { postId: String(postId) },
    });
  };

  // Expandable sidebar submenus (default closed)
  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>({});
  const [hoveredNavId, setHoveredNavId] = React.useState<string | null>(null);
  const [pressedNavId, setPressedNavId] = React.useState<string | null>(null);

  const toggleSubMenu = React.useCallback((menuId: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  }, []);

  React.useEffect(() => {
    if (
      activeTab === 'publication' ||
      activeTab === 'publication-management' ||
      activeTab === 'direct-imc' ||
      activeTab === 'in-progress-editing' ||
      activeTab === 'for-approval' ||
      activeTab === 'publishing-requests' ||
      activeTab === 'published-posts'
    ) {
      setExpandedMenus((prev) => ({ ...prev, 'publication-management': true }));
    }
  }, [activeTab]);

  const handleTabPress = React.useCallback((tabId: string) => {
    if (onTabChange) {
      topLoadingBar.start();
      onTabChange(tabId);
      setTimeout(() => topLoadingBar.finish(), 300);
    }
  }, [onTabChange]);

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
  const [autoDeptLogo, setAutoDeptLogo] = React.useState<string | undefined>(
    (user as any)?.department_logo_url || undefined
  );

  React.useEffect(() => {
    if ((user as any)?.department_logo_url) {
      setAutoDeptLogo((user as any).department_logo_url);
    }
  }, [(user as any)?.department_logo_url]);

  React.useEffect(() => {
    const deptName = user?.department;
    if (!deptName) return;

    let cancelled = false;
    const fetchLogo = () => {
      departmentsApi.listFresh().then(res => {
        if (cancelled) return;
        const depts = res.data?.data || [];
        const deptLower = (deptName || '').toLowerCase().trim();

        // 1. Direct match by display_name or name
        let match = depts.find((d: any) =>
          d.display_name === deptName || d.name === deptName ||
          (d.display_name && d.display_name.toLowerCase() === deptLower) ||
          (d.name && d.name.toLowerCase() === deptLower)
        );

        // 2. Keyword & Alias match across departments with logo
        // Prevent administrative offices (e.g. IT Office) or IT Admins from inheriting academic college logos
        const isOfficeOrAdmin = deptLower.includes('office') ||
          (user as any)?.role === 'it_admin' ||
          (user as any)?.roles?.includes?.('it_admin') ||
          (user as any)?.roles?.includes?.('it_publisher');

        if (!match && !isOfficeOrAdmin) {
          const isIT = (deptLower.includes('bsit') || deptLower.includes('information technology') || deptLower.includes('computer') || deptLower.includes('cite')) && !deptLower.includes('office');
          const isAgri = deptLower.includes('agri');
          const isEng = deptLower.includes('engineer');
          const isBsa = deptLower.includes('bsa') || deptLower.includes('accountan');
          const isPsyc = deptLower.includes('psyc');

          match = depts.find((d: any) => {
            if (!d.logo_url && !d.logo_path) return false;
            const target = `${d.name || ''} ${d.display_name || ''}`.toLowerCase();
            if (isIT && (target.includes('information technology') || target.includes('computer') || target.includes('bsit') || target.includes('cite'))) return true;
            if (isAgri && target.includes('agri')) return true;
            if (isEng && target.includes('engineer')) return true;
            if (isBsa && (target.includes('bsa') || target.includes('accountan'))) return true;
            if (isPsyc && target.includes('psyc')) return true;
            return target.includes(deptLower) || deptLower.includes((d.display_name || '').toLowerCase());
          });
        }

        if (match?.logo_url && !cancelled) {
          setAutoDeptLogo(match.logo_url);
        }
      }).catch(() => { });
    };

    const timer = setTimeout(fetchLogo, 100);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('postflow:department-updated', fetchLogo);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('postflow:department-updated', fetchLogo);
      }
    };
  }, [user?.department]);

  // Live user profile and assigned program state
  const [apiUserPhoto, setApiUserPhoto] = React.useState<string | null>(null);
  const [liveAssignedProgram, setLiveAssignedProgram] = React.useState<string | null>(() => {
    const u = user as any;
    return u?.assigned_program || u?.program_head?.program_name || null;
  });

  const refreshProfile = React.useCallback(() => {
    if (!user?.id) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return;
    authApi.getUser().then(res => {
      const userData = res.data?.user || res.data;
      if (!userData) return;
      if (userData.photo_url) {
        setApiUserPhoto(userData.photo_url);
      }
      if (userData.department_logo_url) {
        setAutoDeptLogo(userData.department_logo_url);
      }
      const prog = userData.assigned_program || userData.program_head?.program_name || null;
      setLiveAssignedProgram(prog);
      // Only update auth store if properties changed, preventing unnecessary component re-renders
      const current = useAuthStore.getState().user as any;
      if (
        current?.photo_url !== userData.photo_url ||
        current?.department_logo_url !== userData.department_logo_url ||
        current?.program_head_id !== userData.program_head_id ||
        current?.assigned_program !== userData.assigned_program ||
        current?.position !== userData.position ||
        current?.department !== userData.department ||
        current?.program_head?.program_name !== userData.program_head?.program_name
      ) {
        useAuthStore.getState().setUser({ ...current, ...userData });
      }
    }).catch(() => { });
  }, [user?.id]);

  // Sync state if user in auth store changes
  React.useEffect(() => {
    const u = user as any;
    const prog = u?.assigned_program || u?.program_head?.program_name || null;
    if (prog) {
      setLiveAssignedProgram(prog);
    }
  }, [user]);

  // Refresh user data on mount, on window focus, and on a slow interval (not on every tab click)
  React.useEffect(() => {
    refreshProfile();
    const interval = setInterval(() => {
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return;
      refreshProfile();
    }, 60000);
    let handleFocus: (() => void) | null = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      handleFocus = () => refreshProfile();
      window.addEventListener('focus', handleFocus);
    }
    return () => {
      clearInterval(interval);
      if (handleFocus && typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [refreshProfile]);

  // Check if current user is eligible for program indicator (Requestors and Department Head / Office Head Approvers with an assigned Program Head)
  const canHaveProgramIndicator = React.useMemo(() => {
    if (!user) return false;
    const roles = Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : []);
    const primaryRole = roles[0] || user.role || '';
    const dept = (user.department || '').toLowerCase();

    // Exclude Admin, Publisher, Vice President, and IMC QA
    if (
      primaryRole === 'it_admin' ||
      primaryRole === 'admin' ||
      roles.includes('admin') ||
      roles.includes('it_admin') ||
      primaryRole === 'it_publisher' ||
      roles.includes('it_publisher') ||
      primaryRole === 'vice_president' ||
      roles.includes('vice_president') ||
      dept.includes('vice president') ||
      primaryRole === 'imc_qa_checker' ||
      roles.includes('imc_qa_checker') ||
      dept.includes('integrated marketing') ||
      dept.includes('institutional marketing') ||
      dept.includes('imc')
    ) {
      return false;
    }

    // Eligible for requestors and department head / office head approvers
    return (
      primaryRole === 'requestor' ||
      primaryRole === 'content_requestor' ||
      primaryRole === 'office_head' ||
      primaryRole === 'department_head' ||
      primaryRole === 'approver' ||
      roles.includes('requestor') ||
      roles.includes('content_requestor') ||
      roles.includes('office_head') ||
      roles.includes('department_head') ||
      roles.includes('approver')
    );
  }, [user]);

  // Fallback: Query department program heads for eligible users who have a program_head_id or user_id link
  React.useEffect(() => {
    if (!canHaveProgramIndicator) {
      setLiveAssignedProgram(null);
      return;
    }
    if (propAssignedProgram || liveAssignedProgram || (user as any)?.assigned_program || (user as any)?.program_head?.program_name) {
      return;
    }
    const phId = (user as any)?.program_head_id;
    const deptName = user?.department;
    if (!deptName) return;

    let cancelled = false;
    departmentsApi.list().then(res => {
      const depts = res.data?.data || [];
      const match = depts.find((d: any) =>
        d.display_name === deptName || d.name === deptName
      );
      if (!match?.id) return;
      programHeadsApi.byDepartment(match.id).then(phRes => {
        if (cancelled) return;
        const heads = phRes.data?.data || [];
        const myHead = heads.find((h: any) =>
          (phId && Number(h.id) === Number(phId)) ||
          (h.user_id && Number(h.user_id) === Number(user?.id))
        );
        if (myHead?.program_name) {
          setLiveAssignedProgram(myHead.program_name);
        }
      }).catch(() => { });
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [canHaveProgramIndicator, user?.department, (user as any)?.program_head_id, user?.id, propAssignedProgram, liveAssignedProgram]);

  const isItAdminUser = (user as any)?.role === 'it_admin' ||
    (user as any)?.roles?.includes?.('it_admin') ||
    (user as any)?.roles?.includes?.('it_publisher') ||
    (user as any)?.department === 'Information Technology Office';

  // For IT Admin, default to the official JMCFI School Logo unless an explicit custom logo is provided
  const rawDeptLogo = isItAdminUser
    ? (departmentLogo || null)
    : (departmentLogo || (user as any)?.department_logo_url || autoDeptLogo);
  const resolvedDeptLogo = resolveImageUrl(rawDeptLogo);
  const finalDeptLogo = resolvedDeptLogo && !deptLogoLoadFailed ? resolvedDeptLogo : null;
  React.useEffect(() => {
    setDeptLogoLoadFailed(false);
  }, [resolvedDeptLogo]);
  const finalDeptName = departmentName || user?.department || 'JMCFI';
  const finalAssignedProgram = React.useMemo(() => {
    // Only show program subtitle if user is eligible and has a program indicated by admin
    if (!canHaveProgramIndicator) return null;

    if (liveAssignedProgram && liveAssignedProgram.trim()) {
      return liveAssignedProgram.trim();
    }
    if (propAssignedProgram && propAssignedProgram.trim()) {
      return propAssignedProgram.trim();
    }
    const u = user as any;
    if (!u) return null;
    if (u.assigned_program && typeof u.assigned_program === 'string' && u.assigned_program.trim()) {
      return u.assigned_program.trim();
    }
    if (u.program_head?.program_name && typeof u.program_head.program_name === 'string' && u.program_head.program_name.trim()) {
      return u.program_head.program_name.trim();
    }
    if (u.program_name && typeof u.program_name === 'string' && u.program_name.trim()) {
      return u.program_name.trim();
    }
    if (u.position && typeof u.position === 'string' && u.position.includes('Program Head')) {
      const extracted = u.position.replace(/Program Head/gi, '').trim();
      if (extracted) return extracted;
    }
    return null;
  }, [canHaveProgramIndicator, propAssignedProgram, liveAssignedProgram, user]);
  const photoFromUser = (user as any)?.photo_url;
  const rawPhoto = userPhotoUrl || apiUserPhoto || (photoFromUser && photoFromUser !== '' ? photoFromUser : null);
  const finalPhotoUrl = resolveImageUrl(rawPhoto);
  const shouldShowPhoto = Boolean(finalPhotoUrl && !photoLoadFailed);

  React.useEffect(() => {
    setPhotoLoadFailed(false);
  }, [finalPhotoUrl]);

  const MIN_WIDTH = 64;
  const MAX_WIDTH = 275;
  const sidebarWidthAnim = React.useRef(new Animated.Value(MIN_WIDTH)).current;
  const contentScrollRef = React.useRef<ScrollView>(null);
  React.useEffect(() => {
    contentScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeTab]);

  const openSidebar = React.useCallback(() => {
    setIsSidebarOpen(true);
    Animated.spring(sidebarWidthAnim, {
      toValue: MAX_WIDTH,
      useNativeDriver: false,
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
      document.head.appendChild(styleTag);
    }
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
        color-scheme: dark !important;
      }

      /* Base layout in dark mode */
      .dark-theme,
      .dark-theme body,
      .dark-theme #root,
      .dark-theme [data-testid="root"] {
        background-color: #0B1329 !important;
        color: #F8FAFC !important;
      }

      /* React Native Web Atomic Background Classes */
      .dark-theme .r-backgroundColor-14lw9ot,
      .dark-theme .r-backgroundColor-1hus931,
      .dark-theme .r-backgroundColor-6026j,
      .dark-theme .r-backgroundColor-6st0mw,
      .dark-theme .r-backgroundColor-z6hqnn,
      .dark-theme .r-backgroundColor-1ins33t,
      .dark-theme .r-backgroundColor-pgx3k3,
      .dark-theme .r-backgroundColor-1uavh4e,
      .dark-theme .r-backgroundColor-1oainxc,
      .dark-theme .r-backgroundColor-bmsz1l {
        background-color: #1C2541 !important;
      }

      .dark-theme .r-backgroundColor-o5e8d5 {
        background-color: rgba(37, 99, 235, 0.18) !important;
      }
      .dark-theme .r-backgroundColor-xfb1t7 {
        background-color: rgba(217, 119, 6, 0.2) !important;
      }

      /* Media upload dashed zones */
      .dark-theme [style*="dashed"] {
        background-color: #1E293B !important;
        border-color: #334155 !important;
      }

      /* CustomAlert modal dark mode */
      .dark-theme [data-modal="alert-box"] {
        background-color: #1E293B !important;
        border-color: #334155 !important;
      }


      /* React Native Web Atomic Text Classes */
      .dark-theme .r-color-15ijx5m,
      .dark-theme .r-color-18zdu8c,
      .dark-theme .r-color-1qar9k,
      .dark-theme .r-color-1w5meix,
      .dark-theme .r-color-cqee49 {
        color: #F8FAFC !important;
      }

      .dark-theme .r-color-dz6k1,
      .dark-theme .r-color-1ois7e2,
      .dark-theme .r-color-edjfg1 {
        color: #CBD5E1 !important;
      }

      .dark-theme .r-color-1s7ct43,
      .dark-theme .r-color-1cucpzw {
        color: #94A3B8 !important;
      }

      /* React Native Web Atomic Border Classes */
      .dark-theme .r-borderColor-1w15a45,
      .dark-theme .r-borderColor-1wr2p1e,
      .dark-theme .r-borderColor-1h911o7 {
        border-top-color: #334155 !important;
        border-right-color: #334155 !important;
        border-bottom-color: #334155 !important;
        border-left-color: #334155 !important;
      }

      /* Generic Catch-All for Hardcoded Inline Styles */
      .dark-theme [style*="background-color: rgb(255, 255, 255)"],
      .dark-theme [style*="background-color: rgb(255,255,255)"],
      .dark-theme [style*="background-color: #FFFFFF"],
      .dark-theme [style*="background-color:#FFFFFF"],
      .dark-theme [style*="background-color: #ffffff"],
      .dark-theme [style*="background-color:#ffffff"],
      .dark-theme [style*="background-color: rgb(250, 250, 250)"],
      .dark-theme [style*="background-color: rgb(248, 250, 252)"],
      .dark-theme [style*="background-color: rgb(244, 246, 249)"],
      .dark-theme [style*="background-color: rgb(241, 245, 249)"],
      .dark-theme [style*="background-color: rgb(243, 244, 246)"],
      .dark-theme [style*="background-color: rgb(249, 250, 251)"],
      .dark-theme [style*="background-color: rgba(255, 255, 255"],
      .dark-theme [style*="background-color: rgba(255,255,255"] {
        background-color: #1C2541 !important;
      }

      .dark-theme [style*="color: rgb(15, 23, 42)"],
      .dark-theme [style*="color: rgb(17, 24, 39)"],
      .dark-theme [style*="color: rgb(26, 26, 46)"],
      .dark-theme [style*="color: rgb(31, 41, 55)"],
      .dark-theme [style*="color: #0F172A"],
      .dark-theme [style*="color: #0f172a"],
      .dark-theme [style*="color: #111827"],
      .dark-theme [style*="color: #1F2937"],
      .dark-theme [style*="color: #1f2937"],
      .dark-theme [style*="color: #1A1A2E"],
      .dark-theme [style*="color: #1a1a2e"],
      .dark-theme [style*="color: #000000"],
      .dark-theme [style*="color: #000"] {
        color: #F8FAFC !important;
      }

      .dark-theme [style*="color: rgb(51, 65, 85)"],
      .dark-theme [style*="color: rgb(55, 65, 81)"],
      .dark-theme [style*="color: rgb(75, 85, 99)"],
      .dark-theme [style*="color: #334155"],
      .dark-theme [style*="color: #374151"],
      .dark-theme [style*="color: #4B5563"] {
        color: #CBD5E1 !important;
      }

      .dark-theme [style*="color: rgb(100, 116, 139)"],
      .dark-theme [style*="color: rgb(107, 114, 128)"],
      .dark-theme [style*="color: #64748B"],
      .dark-theme [style*="color: #6B7280"] {
        color: #94A3B8 !important;
      }

      .dark-theme [style*="border-color: rgb(229, 231, 235)"],
      .dark-theme [style*="border-color: rgb(226, 232, 240)"],
      .dark-theme [style*="border-color: rgb(243, 244, 246)"],
      .dark-theme [style*="border-color: #E5E7EB"],
      .dark-theme [style*="border-color: #e5e7eb"],
      .dark-theme [style*="border-color: #E2E8F0"],
      .dark-theme [style*="border-color: #e2e8f0"],
      .dark-theme [style*="border-color: #F3F4F6"],
      .dark-theme [style*="border-color: #f3f4f6"] {
        border-color: #334155 !important;
      }

      .dark-theme input,
      .dark-theme textarea,
      .dark-theme select {
        background-color: #1E293B !important;
        color: #F8FAFC !important;
        border-color: #334155 !important;
      }
      .dark-theme input::placeholder,
      .dark-theme textarea::placeholder {
        color: #64748B !important;
      }
`;

    if (isDarkMode) {
      document.documentElement.classList.add('dark-theme');
      document.body.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
      document.body.classList.remove('dark-theme');
    }
  }, [isDarkMode]);

  const handleLogout = async () => {
    try {
      setIsProfileDropdownOpen(false);
      closeMobileDrawer();
      await logout();
    } catch (_) { }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/(auth)/login';
    } else {
      router.replace('/(auth)/login');
    }
  };

  const isDesktop = width > 768;
  const roleColor = getRoleColor(user?.role ?? '');
  const userRole = user?.role ?? 'requestor';
  const avatarColors = getAvatarColors(user?.name ?? 'Esther Howard');

  // Dynamic user role label for navbar badge
  const roleBadgeLabel = React.useMemo(() => {
    if (!user) return '';
    const roles = Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : []);
    const primaryRole = roles[0] || user.role || '';
    const dept = (user.department || '').toLowerCase();

    if (primaryRole === 'it_admin' || primaryRole === 'admin' || roles.includes('admin') || roles.includes('it_admin')) {
      return 'Admin';
    }
    if (primaryRole === 'it_publisher' || roles.includes('it_publisher')) {
      return 'Publisher';
    }
    if (primaryRole === 'vice_president' || roles.includes('vice_president') || dept.includes('vice president')) {
      return 'Vice President';
    }
    if (primaryRole === 'imc_qa_checker' || roles.includes('imc_qa_checker') || dept.includes('integrated marketing') || dept.includes('institutional marketing') || dept.includes('imc')) {
      return 'Integrated Marketing Communications';
    }
    if (primaryRole === 'office_head' || roles.includes('office_head') || primaryRole === 'department_head' || roles.includes('department_head')) {
      return 'Department Head';
    }
    if (primaryRole === 'approver' || roles.includes('approver')) {
      if (dept.includes('vice president')) return 'Vice President';
      if (dept.includes('integrated marketing') || dept.includes('institutional marketing') || dept.includes('imc')) return 'Integrated Marketing Communications';
      return 'Department Head';
    }
    if (primaryRole === 'content_requestor' || primaryRole === 'requestor' || roles.includes('content_requestor') || roles.includes('requestor')) {
      return 'Requestor';
    }

    return getRoleLabel(primaryRole) || 'User';
  }, [user]);

  const getSidebarNavItems = (): SidebarNavItem[] => {
    if (userRole === 'requestor') {
      const active = activeTab ?? 'dashboard';
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' as const, active: active === 'dashboard' },
        { id: 'request', label: 'Create Request', icon: 'document-text-outline' as const, active: active === 'request' || active === 'post-requests' || active === 'modern-workspace' || active === 'direct-imc' },
        { id: 'draft', label: 'Draft', icon: 'create-outline' as const, active: active === 'draft' },
        { id: 'rejected', label: 'Rejected', icon: 'close-circle-outline' as const, active: active === 'rejected' },
        { id: 'policy-rules', label: 'Policy Rules', icon: 'book-outline' as const, active: active === 'policy-rules' },
      ];
    }

    const isImcUser =
      roleBadgeLabel === 'Integrated Marketing Communications' ||
      pathname?.includes('imc-qa') ||
      (departmentName || '').toLowerCase().includes('integrated marketing') ||
      (departmentName || '').toLowerCase().includes('imc');

    if (isImcUser) {
      const active = activeTab ?? 'dashboard';
      return [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' as const, active: active === 'dashboard' },
        {
          id: 'publication-management',
          label: 'Publication',
          icon: 'folder-outline' as const,
          active: active === 'publication-management' || active === 'direct-imc' || active === 'publishing-requests' || active === 'in-progress-editing' || active === 'for-approval' || active === 'published-posts',
          subItems: [
            {
              id: 'direct-imc',
              label: 'Direct to IMC',
              icon: 'mail-outline' as const,
              active: active === 'direct-imc' || active === 'publishing-requests' || active === 'publication-management',
            },
            {
              id: 'in-progress-editing',
              label: 'In-Progress Editing',
              icon: 'brush-outline' as const,
              active: active === 'in-progress-editing',
            },
            {
              id: 'for-approval',
              label: 'For Approval',
              icon: 'shield-checkmark-outline' as const,
              active: active === 'for-approval',
            },
            {
              id: 'published-posts',
              label: 'Published Posts',
              icon: 'paper-plane-outline' as const,
              active: active === 'published-posts',
            },
          ],
        },
        { id: 'approved', label: 'Approved', icon: 'checkmark-circle-outline' as const, active: active === 'approved' },
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
            accessibilityRole="button"
            accessibilityLabel={isDesktop ? 'Toggle navigation' : 'Open navigation'}
            accessibilityState={{ expanded: isDesktop ? isSidebarOpen : isMobileDrawerOpen }}
            {...(Platform.OS === 'web' ? { 'aria-expanded': isDesktop ? isSidebarOpen : isMobileDrawerOpen } : {})}
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
                router.push(getRoleDashboardPath(user.role, user.department) as any);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="JMCFI PostFlow dashboard"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 }}
          >
            <Image
              source={require('../assets/images/jmc_logo.png')}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
            <Text style={styles.logoText} numberOfLines={1}>
              {width > 420 ? 'JMCFI PostFlow' : 'PostFlow'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          {/* USER ROLE BADGE */}
          {Boolean(roleBadgeLabel) && width >= 600 && (
            <View style={[styles.roleBadge, width < 420 && styles.roleBadgeSmall]}>
              <Text style={[styles.roleBadgeText, width < 420 && styles.roleBadgeTextSmall]}>
                {roleBadgeLabel}
              </Text>
            </View>
          )}

          {/* NOTIFICATION TRIGGER */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            accessibilityState={{ expanded: isNotificationDropdownOpen }}
            {...(Platform.OS === 'web' ? { 'aria-expanded': isNotificationDropdownOpen } : {})}
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
            accessibilityRole="button"
            accessibilityLabel="Account menu"
            accessibilityState={{ expanded: isProfileDropdownOpen }}
            {...(Platform.OS === 'web' ? { 'aria-expanded': isProfileDropdownOpen } : {})}
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
          <View style={[styles.notificationsDropdownContainer, { width: Math.min(380, width - 24) }, isDarkMode && { backgroundColor: '#1C2541', borderColor: '#334155' }]}>
            <View style={[styles.notifHeader, isDarkMode && { backgroundColor: '#1E293B' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.notifHeaderTitle, isDarkMode && { color: '#F8FAFC' }]}>Notifications</Text>
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

            <View style={{ height: 1, backgroundColor: isDarkMode ? '#334155' : '#E5E7EB' }} />

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
                  const rawMessage = n.data?.message || n.data?.reason || n.data?.remarks || 'Action updated';
                  const message = rawMessage
                    .replace(/at stage:\s*office_head/gi, 'by Department Head')
                    .replace(/at stage:\s*vice_president/gi, 'by Vice President')
                    .replace(/at stage:\s*imc_qa/gi, 'by Integrated Marketing Communications')
                    .replace(/\boffice_head\b/gi, 'Department Head')
                    .replace(/\bOffice Head\b/gi, 'Department Head');
                  const timeAgo = n.created_at || 'Just now';

                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[
                        styles.notifItem,
                        !isRead && { backgroundColor: isDarkMode ? '#1E293B' : '#F0F9FF' },
                        Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
                      ]}
                      onPress={() => handleNotificationClick(n)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.notifIconCircle,
                          {
                            backgroundColor: (n.type?.includes('Approved') || n.data?.type === 'post_approved' || n.data?.type === 'post_published_success')
                              ? '#DCFCE7'
                              : (n.type?.includes('Rejected') || n.data?.type === 'post_rejected')
                                ? '#FEE2E2'
                                : '#EFF6FF',
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            (n.type?.includes('Approved') || n.data?.type === 'post_approved' || n.data?.type === 'post_published_success')
                              ? 'checkmark-circle'
                              : (n.type?.includes('Rejected') || n.data?.type === 'post_rejected')
                                ? 'close-circle'
                                : 'information-circle'
                          }
                          size={18}
                          color={
                            (n.type?.includes('Approved') || n.data?.type === 'post_approved' || n.data?.type === 'post_published_success')
                              ? '#16A34A'
                              : (n.type?.includes('Rejected') || n.data?.type === 'post_rejected')
                                ? '#DC2626'
                                : '#2563EB'
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notifTitle, !isRead && { fontWeight: '700' }, isDarkMode && { color: '#F8FAFC' }]}>{title}</Text>
                        <Text style={[styles.notifMessage, isDarkMode && { color: '#94A3B8' }]} numberOfLines={2}>{message}</Text>
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
          <View style={[styles.dropdownContainer, isDarkMode && { backgroundColor: '#1C2541', borderColor: '#334155' }]}>
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

            <View style={[styles.dropdownDivider, isDarkMode && { backgroundColor: '#334155' }]} />

            {/* Menu items */}
            <ScrollView style={styles.dropdownItemsList} keyboardShouldPersistTaps="handled">
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

              {/* DARK MODE TOGGLE (Available in profile dropdown, especially for mobile/iOS) */}
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={toggleDarkMode}
              >
                <Ionicons
                  name={isDarkMode ? "sunny-outline" : "moon-outline"}
                  size={18}
                  color={isDarkMode ? "#EAB308" : "#4B5563"}
                />
                <View style={styles.itemTextContainer}>
                  <Text style={styles.itemTitle}>{isDarkMode ? 'Light appearance' : 'Dark appearance'}</Text>
                  <Text style={styles.itemSubtitle}>{isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}</Text>
                </View>
                <View style={[
                  styles.themeTogglePill,
                  isDarkMode && styles.themeTogglePillActive
                ]}>
                  <View style={[
                    styles.themeToggleThumb,
                    isDarkMode && styles.themeToggleThumbActive
                  ]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setIsProfileDropdownOpen(false);
                  if (onTabChange) onTabChange('account-settings');
                }}
              >
                <Ionicons name="settings-outline" size={18} color={isDarkMode ? '#94A3B8' : '#4B5563'} />
                <View style={styles.itemTextContainer}>
                  <Text style={styles.itemTitle}>Account settings</Text>
                  <Text style={styles.itemSubtitle}>Manage defaults, privacy & more</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={18} color={isDarkMode ? '#F87171' : '#DC2626'} />
                <View style={styles.itemTextContainer}>
                  <Text style={[styles.itemTitle, { color: isDarkMode ? '#FCA5A5' : '#DC2626' }]}>Sign out</Text>
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
              <View style={{ flex: 1 }}>
                <View style={styles.sidebarHeaderContainer}>
                  <View style={styles.sidebarLogoRing}>
                    <Image
                      source={finalDeptLogo ? { uri: finalDeptLogo } : require('../assets/images/jmc_logo.png')}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                      resizeMode="contain"
                      onError={() => setDeptLogoLoadFailed(true)}
                    />
                  </View>
                  <Animated.View style={[styles.sidebarHeader, {
                    opacity: sidebarWidthAnim.interpolate({
                      inputRange: [MIN_WIDTH, MAX_WIDTH],
                      outputRange: [0, 1]
                    })
                  }]}>
                    <Text style={styles.sidebarTitle} numberOfLines={2}>{finalDeptName}</Text>
                  </Animated.View>
                </View>

                <View style={[styles.sidebarDivider, finalAssignedProgram ? { marginBottom: 8 } : null]} />

                {finalAssignedProgram ? (
                  <Animated.View
                    style={[
                      styles.sidebarProgramSubtitleContainer,
                      {
                        opacity: sidebarWidthAnim.interpolate({
                          inputRange: [MIN_WIDTH, MIN_WIDTH + 50, MAX_WIDTH],
                          outputRange: [0, 0, 1],
                        }),
                      },
                    ]}
                  >
                    <Text style={styles.sidebarProgramSubtitleText} numberOfLines={2}>
                      {finalAssignedProgram}
                    </Text>
                  </Animated.View>
                ) : null}

                <View style={styles.sidebarNav}>
                  {sidebarNavItems.map((item, idx) => {
                    const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
                    const isParentActive = hasSubItems && item.active;
                    const isExpanded = hasSubItems ? (expandedMenus[item.id] !== undefined ? expandedMenus[item.id] : isParentActive) : false;
                    return (
                      <SidebarNavGroup
                        key={item.id || idx}
                        item={item}
                        isExpanded={isExpanded}
                        onToggleSubMenu={toggleSubMenu}
                        onTabPress={handleTabPress}
                        hoveredNavId={hoveredNavId}
                        setHoveredNavId={setHoveredNavId}
                        pressedNavId={pressedNavId}
                        setPressedNavId={setPressedNavId}
                        sidebarWidthAnim={sidebarWidthAnim}
                        closeSidebar={closeSidebar}
                        sidebarOpenedByHover={sidebarOpenedByHover}
                        MIN_WIDTH={MIN_WIDTH}
                        MAX_WIDTH={MAX_WIDTH}
                      />
                    );
                  })}

                </View>
              </View>

            </View>
          </Animated.View>
        )}

        {/* Content Wrapper — full width always since sidebar overlays */}
        <View style={[styles.contentWrapper, isDarkMode && { backgroundColor: '#0B1329' }]}>
          {backgroundImage ? (
            <ImageBackground
              source={backgroundImage}
              style={{ flex: 1, width: '100%', height: '100%', backgroundColor: isDarkMode ? 'rgba(11, 19, 41, 0.94)' : 'rgba(255, 255, 255, 0.85)' }}
              imageStyle={{ opacity: isDarkMode ? 0.05 : 0.15 }}
              resizeMode="cover"
            >
              <ScrollView
                ref={contentScrollRef}
                style={[styles.content, !isDesktop && user?.role === 'requestor' && styles.requestorMobileContent]}
                contentContainerStyle={[styles.contentContainer, !isDesktop && styles.contentContainerMobile]}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </ImageBackground>
          ) : (
            <ScrollView
              ref={contentScrollRef}
              style={[styles.content, !isDesktop && user?.role === 'requestor' && styles.requestorMobileContent]}
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
              <View style={styles.sidebarLogoRing}>
                <Image
                  source={finalDeptLogo ? { uri: finalDeptLogo } : require('../assets/images/jmc_logo.png')}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                  resizeMode="contain"
                  onError={() => setDeptLogoLoadFailed(true)}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[styles.mobileDrawerDeptName, { textAlign: 'center' }]} numberOfLines={2}>{finalDeptName}</Text>
              </View>
            </View>

            <View style={[styles.mobileDrawerDivider, finalAssignedProgram ? { marginBottom: 8 } : null]} />

            {finalAssignedProgram ? (
              <View style={styles.sidebarProgramSubtitleContainer}>
                <Text style={styles.sidebarProgramSubtitleText} numberOfLines={2}>
                  {finalAssignedProgram}
                </Text>
              </View>
            ) : null}

            {/* Nav Items */}
            <ScrollView style={styles.mobileDrawerNavList} showsVerticalScrollIndicator={false}>
              {sidebarNavItems.map((item, idx) => {
                const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
                const isExpanded = hasSubItems ? (expandedMenus[item.id] ?? true) : false;

                return (
                  <View key={item.id || idx}>
                    <TouchableOpacity
                      style={[
                        styles.mobileDrawerNavItem,
                        (!hasSubItems && item.active) && styles.mobileDrawerNavItemActive,
                      ]}
                      onPress={() => {
                        if (hasSubItems) {
                          toggleSubMenu(item.id);
                        } else {
                          handleTabPress(item.id);
                          closeMobileDrawer();
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.sidebarNavIconTile,
                          item.active && styles.sidebarNavIconTileActive,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={19}
                          color={item.active ? '#3B0061' : '#FFFFFF'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.mobileDrawerNavLabel,
                          item.active && styles.mobileDrawerNavLabelActive,
                          { flex: 1 },
                        ]}
                      >
                        {item.label}
                      </Text>
                      {hasSubItems && (
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="rgba(255, 255, 255, 0.7)"
                        />
                      )}
                    </TouchableOpacity>

                    {hasSubItems && isExpanded && (
                      <View style={{ paddingLeft: 18, marginBottom: 6 }}>
                        {item.subItems!.map((sub: any) => (
                          <TouchableOpacity
                            key={sub.id}
                            style={[
                              styles.mobileDrawerNavItem,
                              { paddingVertical: 10, paddingHorizontal: 12 },
                              sub.active && { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
                            ]}
                            onPress={() => {
                              handleTabPress(sub.id);
                              closeMobileDrawer();
                            }}
                          >
                            <Ionicons
                              name={sub.icon}
                              size={18}
                              color="#FFFFFF"
                            />
                            <Text
                              style={[
                                styles.mobileDrawerNavLabel,
                                { fontSize: 14 },
                                sub.active && { fontWeight: '700', color: '#FFFFFF' },
                              ]}
                            >
                              {sub.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}

            </ScrollView>
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
    paddingHorizontal: 12,
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
    minWidth: 0,
  },
  logoText: {
    flexShrink: 1,
    minWidth: 0,
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
  roleBadge: {
    paddingHorizontal: 13,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  roleBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  roleBadgeTextSmall: {
    fontSize: 11,
  },
  themeTogglePill: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  themeTogglePillActive: {
    backgroundColor: '#7C3AED',
  },
  themeToggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  themeToggleThumbActive: {
    transform: [{ translateX: 16 }],
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

  // Sidebar — solid brand purple with tactile, physical (3D keycap) controls
  sidebar: {
    backgroundColor: '#4C007C',
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: '#3B0061',
  },
  sidebarInner: {
    flex: 1,
    paddingTop: 18,
    justifyContent: 'space-between',
  },
  sidebarHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 14,
    minHeight: 52,
  },
  sidebarLogoRing: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingRight: 14,
  },
  sidebarTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.1,
    lineHeight: 19,
    ...(Platform.OS === 'web' ? ({ textShadow: '0 1px 0 rgba(0, 0, 0, 0.35)' } as any) : {}),
  },
  sidebarProgramSubtitleContainer: {
    paddingHorizontal: 14,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarProgramSubtitleText: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 15,
    letterSpacing: 0.15,
  },
  // Engraved groove divider
  sidebarDivider: {
    height: 2,
    marginBottom: 14,
    marginHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: '#33004F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
  },
  sidebarNav: {
    flex: 1,
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  sidebarNavItem: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        userSelect: 'none',
        transform: 'translateY(0px)',
        boxShadow: '0 0 0 rgba(0,0,0,0)',
        transition: 'transform 140ms cubic-bezier(.3,.7,.4,1), box-shadow 140ms ease, background-color 160ms ease',
      } as any)
      : {}),
  },
  sidebarNavItemHovered: {
    backgroundColor: '#5A0F8F',
    ...(Platform.OS === 'web'
      ? ({
        transform: 'translateY(-1px)',
        boxShadow: '0 3px 0 #2E004B, inset 0 1px 0 rgba(255, 255, 255, 0.10)',
      } as any)
      : {}),
  },
  // Raised keycap for the current page
  sidebarNavItemActivePurple: {
    backgroundColor: '#6A1BA6',
    ...(Platform.OS === 'web'
      ? ({
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 0 #2A0046, 0 9px 16px rgba(20, 0, 35, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
      } as any)
      : { borderBottomWidth: 4, borderBottomColor: '#2A0046' }),
  },
  // Key pushed down while pressing
  sidebarNavItemPressed: {
    ...(Platform.OS === 'web'
      ? ({
        transform: 'translateY(2px)',
        boxShadow: '0 1px 0 #2A0046, inset 0 2px 4px rgba(0, 0, 0, 0.25)',
        transition: 'transform 60ms ease, box-shadow 60ms ease',
      } as any)
      : { transform: [{ translateY: 2 }], borderBottomWidth: 1 }),
  },
  sidebarNavIconWrapper: {
    width: 46,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarNavIconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5C1491',
    ...(Platform.OS === 'web'
      ? ({
        boxShadow: '0 2px 0 #2E004B, inset 0 1px 0 rgba(255, 255, 255, 0.16)',
        transition: 'transform 140ms cubic-bezier(.3,.7,.4,1), box-shadow 140ms ease, background-color 160ms ease',
      } as any)
      : { borderBottomWidth: 2, borderBottomColor: '#2E004B' }),
  },
  sidebarNavIconTileHovered: {
    backgroundColor: '#6E22A8',
    ...(Platform.OS === 'web'
      ? ({ transform: 'translateY(-1px) rotate(-4deg)', boxShadow: '0 3px 0 #2A0046, inset 0 1px 0 rgba(255, 255, 255, 0.2)' } as any)
      : {}),
  },
  sidebarNavIconTileActive: {
    backgroundColor: '#FFC72C',
    ...(Platform.OS === 'web'
      ? ({ transform: 'translateY(0px)', boxShadow: '0 3px 0 #B8860B, inset 0 1px 0 rgba(255, 255, 255, 0.65)' } as any)
      : { borderBottomWidth: 3, borderBottomColor: '#B8860B' }),
  },
  sidebarNavIconTilePressed: {
    ...(Platform.OS === 'web'
      ? ({ transform: 'translateY(1px) scale(0.96)', boxShadow: '0 1px 0 #2A0046, inset 0 1px 2px rgba(0, 0, 0, 0.2)' } as any)
      : { borderBottomWidth: 1 }),
  },
  sidebarNavLabel: {
    fontSize: 14.5,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    letterSpacing: 0.1,
    marginLeft: 4,
  },
  sidebarNavLabelActivePurple: {
    color: '#FFFFFF',
    fontWeight: '800',
    ...(Platform.OS === 'web' ? ({ textShadow: '0 1px 0 rgba(0, 0, 0, 0.3)' } as any) : {}),
  },
  sidebarSubNavItem: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingLeft: 6,
    marginVertical: 2,
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 140ms cubic-bezier(.3,.7,.4,1), box-shadow 140ms ease, background-color 160ms ease',
      } as any)
      : {}),
  },
  sidebarSubNavItemHovered: {
    backgroundColor: '#5A0F8F',
    ...(Platform.OS === 'web' ? ({ transform: 'translateX(2px)' } as any) : {}),
  },
  sidebarSubNavItemActive: {
    backgroundColor: '#6A1BA6',
    ...(Platform.OS === 'web'
      ? ({ transform: 'translateY(-1px)', boxShadow: '0 3px 0 #2A0046, inset 0 1px 0 rgba(255, 255, 255, 0.18)' } as any)
      : { borderBottomWidth: 3, borderBottomColor: '#2A0046' }),
  },
  sidebarSubNavItemUnified: {
    height: 35,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        userSelect: 'none',
        transform: 'translateY(0px)',
        transition: 'background-color 140ms ease, box-shadow 140ms ease, transform 140ms ease',
      } as any)
      : {}),
  },
  sidebarSubNavItemActiveDirect: {
    backgroundColor: '#6A1BA6',
    borderRadius: 11,
    ...(Platform.OS === 'web'
      ? ({
        transform: 'translateY(-1px)',
        boxShadow: '0 2px 0 #2A0046, 0 4px 10px rgba(20, 0, 35, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.20)',
      } as any)
      : { borderBottomWidth: 2, borderBottomColor: '#2A0046' }),
  },
  sidebarSubNavItemPressedDirect: {
    backgroundColor: '#5A1290',
    borderRadius: 11,
    ...(Platform.OS === 'web'
      ? ({
        transform: 'translateY(1px)',
        boxShadow: '0 1px 0 #2A0046, 0 2px 4px rgba(20, 0, 35, 0.22), inset 0 1px 2px rgba(0, 0, 0, 0.25)',
      } as any)
      : { borderBottomWidth: 1, borderBottomColor: '#2A0046' }),
  },
  sidebarSubNavItemHoveredDirect: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 11,
    ...(Platform.OS === 'web'
      ? ({
        transform: 'translateX(2px)',
      } as any)
      : {}),
  },
  sidebarSubNavIconWrapper: {
    width: 36,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  sidebarSubNavLabelDirect: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500' as const,
    marginLeft: 2,
    letterSpacing: 0.1,
  },
  sidebarSubNavLabelActiveDirect: {
    color: '#FFC72C',
    fontWeight: '700' as const,
  },
  sidebarMiniSubIconTile: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
        cursor: 'pointer',
        transition: 'transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease',
      } as any)
      : {}),
  },
  sidebarMiniSubIconTileInactive: {
    backgroundColor: '#521080',
    ...(Platform.OS === 'web'
      ? ({
        boxShadow: '0 2px 0 #2A0046, inset 0 1px 0 rgba(255, 255, 255, 0.14)',
      } as any)
      : { borderBottomWidth: 2, borderBottomColor: '#2A0046' }),
  },
  sidebarMiniSubIconTileHovered: {
    backgroundColor: '#681B9E',
    ...(Platform.OS === 'web'
      ? ({
        transform: 'translateY(-1px)',
        boxShadow: '0 3px 0 #24003C, inset 0 1px 0 rgba(255, 255, 255, 0.22)',
      } as any)
      : {}),
  },
  sidebarMiniSubIconTileActive: {
    backgroundColor: '#6A1BA6',
    borderWidth: 1.5,
    borderColor: '#FFC72C',
    ...(Platform.OS === 'web'
      ? ({
        boxShadow: '0 2px 0 #2A0046, 0 3px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
      } as any)
      : { borderBottomWidth: 2, borderBottomColor: '#2A0046' }),
  },
  sidebarMiniSubIconTilePressed: {
    ...(Platform.OS === 'web'
      ? ({
        transform: 'translateY(1px) scale(0.96)',
        boxShadow: '0 1px 0 #24003C',
      } as any)
      : { transform: [{ translateY: 1 }] }),
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
  requestorMobileContent: {
    // Keep the default floating assistant clear of form fields and actions.
    marginBottom: 128,
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
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 6,
    position: 'relative',
  },
  mobileDrawerNavItemActive: {
    backgroundColor: '#6A1BA6',
    ...(Platform.OS === 'web'
      ? ({ transform: 'translateY(-2px)', boxShadow: '0 4px 0 #2A0046, 0 9px 16px rgba(20, 0, 35, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.22)' } as any)
      : { borderBottomWidth: 4, borderBottomColor: '#2A0046' }),
  },
  mobileDrawerNavLabel: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500' as const,
  },
  mobileDrawerNavLabelActive: {
    color: '#FFFFFF',
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

interface SidebarNavGroupProps {
  item: SidebarNavItem;
  isExpanded: boolean;
  onToggleSubMenu: (id: string) => void;
  onTabPress: (id: string) => void;
  hoveredNavId: string | null;
  setHoveredNavId: (id: string | null) => void;
  pressedNavId: string | null;
  setPressedNavId: (id: string | null) => void;
  sidebarWidthAnim: Animated.Value;
  closeSidebar: () => void;
  sidebarOpenedByHover: boolean;
  MIN_WIDTH: number;
  MAX_WIDTH: number;
}

function SidebarNavGroup({
  item,
  isExpanded,
  onToggleSubMenu,
  onTabPress,
  hoveredNavId,
  setHoveredNavId,
  pressedNavId,
  setPressedNavId,
  sidebarWidthAnim,
  closeSidebar,
  sidebarOpenedByHover,
  MIN_WIDTH,
  MAX_WIDTH,
}: SidebarNavGroupProps) {
  const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
  const isParentActive = hasSubItems && item.active;
  const isActiveItem = !hasSubItems && item.active;
  const isHovered = hoveredNavId === item.id;
  const isPressed = pressedNavId === item.id;

  const submenuAnim = React.useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(submenuAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 220,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  return (
    <View>
      <AnimatedTouchable
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: item.active }}
        onPressIn={() => setPressedNavId(item.id)}
        onPressOut={() => setPressedNavId(null)}
        {...(Platform.OS === 'web'
          ? {
              // @ts-ignore
              onMouseEnter: () => setHoveredNavId(item.id),
              onMouseLeave: () => setHoveredNavId(null),
            }
          : {})}
        style={[
          styles.sidebarNavItem,
          isHovered && !isActiveItem && styles.sidebarNavItemHovered,
          isActiveItem && styles.sidebarNavItemActivePurple,
          isPressed && styles.sidebarNavItemPressed,
          {
            width: sidebarWidthAnim.interpolate({
              inputRange: [MIN_WIDTH, MAX_WIDTH],
              outputRange: [48, MAX_WIDTH - 24],
            }),
          },
        ]}
        onPress={() => {
          if (hasSubItems) {
            onToggleSubMenu(item.id);
            if (!isParentActive && item.subItems && item.subItems.length > 0) {
              onTabPress(item.subItems[0].id);
            }
          } else {
            onTabPress(item.id);
            if (sidebarOpenedByHover) closeSidebar();
          }
        }}
      >
        <View style={styles.sidebarNavIconWrapper}>
          <View
            style={[
              styles.sidebarNavIconTile,
              isHovered && !isActiveItem && styles.sidebarNavIconTileHovered,
              (isActiveItem || isParentActive) && styles.sidebarNavIconTileActive,
              isPressed && styles.sidebarNavIconTilePressed,
            ]}
          >
            <Ionicons
              name={item.icon}
              size={19}
              color={isActiveItem || isParentActive ? '#3B0061' : '#FFFFFF'}
            />
          </View>
        </View>
        <Animated.View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: 12,
            opacity: sidebarWidthAnim.interpolate({
              inputRange: [MIN_WIDTH, MAX_WIDTH],
              outputRange: [0, 1],
            }),
          }}
        >
          <Text
            style={[
              styles.sidebarNavLabel,
              item.active && styles.sidebarNavLabelActivePurple,
            ]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {hasSubItems ? (
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={15}
              color="rgba(255, 255, 255, 0.85)"
              style={{ marginLeft: 4 }}
            />
          ) : null}
        </Animated.View>
      </AnimatedTouchable>

      {/* Sub-items: Unified smooth animated rail & expanded list */}
      {hasSubItems && (
        <Animated.View
          style={{
            position: 'relative',
            overflow: 'hidden',
            opacity: submenuAnim,
            maxHeight: submenuAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 240],
            }),
            transform: [
              {
                translateY: submenuAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-6, 0],
                }),
              },
            ],
            marginTop: 3,
            marginBottom: 3,
            gap: 3,
          }}
        >
          {/* Vertical tree hierarchy line on the left, visible when sidebar expands */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 14,
              top: 2,
              bottom: 4,
              width: 1.5,
              backgroundColor: 'rgba(255, 255, 255, 0.22)',
              borderRadius: 1,
              opacity: sidebarWidthAnim.interpolate({
                inputRange: [MIN_WIDTH, MIN_WIDTH + 45, MAX_WIDTH],
                outputRange: [0, 0, 1],
              }),
            }}
          />

          {item.subItems!.map((sub: any) => {
            const isSubHovered = hoveredNavId === sub.id;
            const isSubPressed = pressedNavId === sub.id;
            return (
              <AnimatedTouchable
                key={sub.id}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={sub.label}
                accessibilityState={{ selected: sub.active }}
                onPressIn={() => setPressedNavId(sub.id)}
                onPressOut={() => setPressedNavId(null)}
                {...(Platform.OS === 'web'
                  ? {
                      // @ts-ignore
                      title: sub.label,
                      onMouseEnter: () => setHoveredNavId(sub.id),
                      onMouseLeave: () => setHoveredNavId(null),
                    }
                  : {})}
                onPress={() => {
                  onTabPress(sub.id);
                  if (sidebarOpenedByHover) closeSidebar();
                }}
                style={[
                  styles.sidebarSubNavItemUnified,
                  sub.active && styles.sidebarSubNavItemActiveDirect,
                  !sub.active && isSubHovered && styles.sidebarSubNavItemHoveredDirect,
                  isSubPressed && styles.sidebarSubNavItemPressedDirect,
                  {
                    marginLeft: sidebarWidthAnim.interpolate({
                      inputRange: [MIN_WIDTH, MAX_WIDTH],
                      outputRange: [0, 20],
                    }),
                    width: sidebarWidthAnim.interpolate({
                      inputRange: [MIN_WIDTH, MAX_WIDTH],
                      outputRange: [46, MAX_WIDTH - 24 - 20],
                    }),
                  },
                ]}
              >
                {/* Left: Icon Wrapper */}
                <View style={styles.sidebarSubNavIconWrapper}>
                  <Ionicons
                    name={sub.icon}
                    size={15}
                    color={sub.active ? '#FFC72C' : '#FFFFFF'}
                  />
                </View>

                {/* Right: Text Label (fades in smoothly as sidebar expands) */}
                <Animated.View
                  style={{
                    flex: 1,
                    opacity: sidebarWidthAnim.interpolate({
                      inputRange: [MIN_WIDTH, MIN_WIDTH + 45, MAX_WIDTH],
                      outputRange: [0, 0, 1],
                    }),
                    paddingRight: 10,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={[
                      styles.sidebarSubNavLabelDirect,
                      sub.active && styles.sidebarSubNavLabelActiveDirect,
                    ]}
                    numberOfLines={1}
                  >
                    {sub.label}
                  </Text>
                </Animated.View>
              </AnimatedTouchable>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}
