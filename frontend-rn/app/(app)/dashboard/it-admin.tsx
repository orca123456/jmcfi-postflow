/**
 * IT Admin Dashboard
 * The IT Publisher is now the acting system administrator.
 * This dashboard merges admin oversight + publishing capabilities.
 * It re-uses the full admin panel implementation with the role rebadged as "IT Admin".
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  FlatList,
  Modal,
  ScrollView,
  Image,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { DashboardShell } from '../../../components/DashboardShell';
import DashboardSkeleton from '../../../components/DashboardSkeleton';
import { PaginationControl } from '../../../components/ui/PaginationControl';
import { useAuthStore } from '../../../store/auth';
import { Card } from '../../../components/ui/Card';
import { dashboardApi, postsApi, usersApi, departmentsApi, rolesApi, auditLogsApi, publishingApi, tokenSettingsApi, authApi, emailSettingsApi, apiTokensApi } from '../../../services/api';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../constants/theme';
import { usePolicyStore } from '../../../store/policy';
import { FormattedText } from '../../../components/ui/FormattedText';
import { RichTextEditor } from '../../../components/ui/RichTextEditor';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  badgeText?: string;
  badgeColor?: string;
  badgeBgColor?: string;
  valueColor?: string;
}

const CustomStatCard: React.FC<StatCardProps> = ({
  label, value, icon, iconColor, iconBgColor,
  badgeText, badgeColor = Colors.textSecondary,
  badgeBgColor = Colors.background, valueColor = Colors.textPrimary,
}) => (
  <Card style={styles.statCard}>
    <View style={styles.statCardHeader}>
      <View style={[styles.statIconContainer, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      {badgeText && (
        <View style={[styles.statBadge, { backgroundColor: badgeBgColor }]}>
          <Text style={[styles.statBadgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>
      )}
    </View>
    <View style={styles.statCardContent}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
    </View>
  </Card>
);

// ── Role picker: 3 friendly categories shown to admins ──
// The DB stores granular roles; category + department maps to the exact role.
const ROLE_CATEGORIES = [
  { label: 'Admin', value: 'admin' },
  { label: 'Approver', value: 'approver' },
  { label: 'Requestor', value: 'requestor' },
];

// Map a granular DB role to its friendly category
const roleCategoryOf = (role: string): string => {
  if (role === 'it_publisher' || role === 'it_admin') return 'admin';
  if (role === 'office_head' || role === 'vice_president' || role === 'imc_qa_checker') return 'approver';
  return 'requestor'; // requestor, content_requestor, or unknown -> safest
};

// Map category + department -> exact granular role to assign (mirrors backend)
const granularRoleFor = (category: string, department: string): string => {
  if (category === 'admin') return 'it_publisher';
  if (category === 'requestor') return 'requestor';
  // approver -> department picks the sub-role
  if (department === 'Institutional Marketing & Communications') return 'imc_qa_checker';
  if (department === 'Office of the President' || department === 'Vice President of Academic Affairs' || department === 'Academic Affairs') return 'vice_president';
  return 'office_head';
};

// Departments are role-scoped: each department carries which roles may use it.
// This keeps each role's pool independent — adding/deleting in one role never
// touches another role's departments.
const departmentsForRole = (category: string, departments: any[]): any[] => {
  return departments.filter(d => (d.role_categories || []).includes(category));
};

// Auto-suggested position for category + department (mirrors backend)
const autoPositionFor = (category: string, department: string): string => {
  if (category === 'admin') return 'IT Administrator';
  if (category === 'approver') {
    if (department === 'Institutional Marketing & Communications') return 'QA / Branding Checker';
    if (department === 'Office of the President' || department === 'Vice President of Academic Affairs' || department === 'Academic Affairs') return 'Vice President';
    return 'Department Head';
  }
  return '';
};


export default function ITAdminDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, setUser } = useAuthStore();

  // Tab state: 'overview' | 'user-management' | 'all-posts' | 'approval-queue' | 'policy-rules' | 'account-settings'
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(params.tab || 'overview');

  useEffect(() => {
    if (params.tab && params.tab !== activeTab) {
      setActiveTab(params.tab as string);
    }
  }, [params.tab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.setParams({ tab });
  };

  const {
    policySections, effectiveDate, lastUpdatedDate,
    fetchPolicy, updatePolicy, isLoading: isPolicyLoading
  } = usePolicyStore();

  const [editableEffectiveDate, setEditableEffectiveDate] = useState('');
  const [editableLastUpdatedDate, setEditableLastUpdatedDate] = useState('');
  const [editableSections, setEditableSections] = useState<any[]>([]);
  const [policySearchQuery, setPolicySearchQuery] = useState('');
  const [emailSettingsSearchQuery, setEmailSettingsSearchQuery] = useState('');

  // ── API Tokens Logic ──
  const fetchApiTokens = async () => {
    try {
      const res = await (apiTokensApi as any).list();
      setApiTokens(res.data.data || []);
    } catch (e) {
      console.log('Failed to fetch API tokens', e);
    }
  };

  const generateApiToken = async () => {
    if (!newTokenName.trim()) {
      Alert.alert('Error', 'Please provide a name for the token.');
      return;
    }
    try {
      const res = await (apiTokensApi as any).create(newTokenName.trim());
      setGeneratedToken(res.data.data);
      setNewTokenName('');
      fetchApiTokens();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to generate token.');
    }
  };

  const requestRevokeToken = (id: number) => {
    setRevokeConfirmId(id);
  };

  const executeRevokeToken = async () => {
    if (!revokeConfirmId) return;
    const id = revokeConfirmId;
    setRevokeConfirmId(null);
    const previousTokens = [...apiTokens];
    
    try {
      // Optimistic UI update for immediate feedback
      setApiTokens(prev => prev.filter(t => t.id !== id));
      
      await (apiTokensApi as any).revoke(id);
      // Fetch again in background to ensure sync
      fetchApiTokens();
    } catch (e: any) {
      // Rollback if failed
      setApiTokens(previousTokens);
      const errorMsg = e?.response?.data?.message || e?.message || 'Failed to revoke token.';
      // We can use Alert.alert here for errors since it's just a message (1 button)
      Alert.alert('Error', errorMsg);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'developer-api') {
      fetchApiTokens();
    }
  }, [user, activeTab]);

  const [isEditingPolicyMode, setIsEditingPolicyMode] = useState(false);

  useEffect(() => { 
    const timer = setTimeout(() => fetchPolicy(), 7000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (policySections) setEditableSections(JSON.parse(JSON.stringify(policySections)));
    if (effectiveDate) setEditableEffectiveDate(effectiveDate);
    if (lastUpdatedDate) setEditableLastUpdatedDate(lastUpdatedDate);
  }, [policySections, effectiveDate, lastUpdatedDate]);

  const [apiTokens, setApiTokens] = useState<any[]>([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<{name: string, plain_text_token: string} | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<number | null>(null);
  const [showApiDocs, setShowApiDocs] = useState(false);

  // ── Loading state ──
  const { data: initDataRes, isLoading } = useQuery({ 
    queryKey: ['adminInitData'], 
    queryFn: () => dashboardApi.getInitData(), 
    refetchInterval: 30000, 
    staleTime: 30000 
  });
  const isInitialLoading = isLoading;
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const handleAction = (type: string, title: string) => {
    alert(`IT Action: "${type}" executed for post:\n"${title}"`);
  };

  // ── Animated spinner rotation ──
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isInitialLoading) return;
    const animation = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [isInitialLoading, spinAnim]);
  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Query moved up

  useEffect(() => {
    if (initDataRes?.data) {
      const data = initDataRes.data;
      if (data.posts) {
        let posts = data.posts;
        if (posts && !Array.isArray(posts) && posts.data) posts = posts.data;
        processPostsData(posts);
      }
      if (data.stats) setStats(data.stats);
      if (data.activities) setActivities(data.activities);
    }
  }, [initDataRes]);

  // ── Process posts into the three component state arrays ──
  function processPostsData(posts: any[]) {
    const mappedAll = posts.map((p: any) => ({
      id: p.id.toString(),
      title: p.title || 'Untitled',
      author: p.requestor?.first_name + ' ' + p.requestor?.last_name,
      department: p.department?.name || 'Unknown',
      timeAgo: new Date(p.created_at).toLocaleDateString(),
      status: p.status.toLowerCase(),
      statusLabel: p.status.toUpperCase().replace(/_/g, ' '),
      reviewer: p.status,
      platforms: p.platforms ? Object.keys(p.platforms).filter(k => p.platforms[k]).map(k => k.toUpperCase()) : [],
    }));
    setAllMockPosts(mappedAll);

    const mappedTable = posts.map((p: any) => ({
      id: p.id.toString(),
      title: p.title || 'Untitled',
      department: typeof p.requestor?.department === 'string' ? p.requestor.department : (p.requestor?.department?.name || p.requestor?.department?.display_name || 'Unknown'),
      requestedBy: p.requestor?.full_name || 'Unknown',
      status: p.status_label || p.status,
      rawStatus: p.status,
      platforms: Array.isArray(p.target_platforms) ? p.target_platforms.map((t: string) => typeof t === 'string' ? t.toLowerCase() : '') : [],
      requestedOn: new Date(p.created_at).toLocaleDateString(),
      requestedTime: new Date(p.created_at).toLocaleTimeString(),
      rawDate: p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : '',
      image: p.media && p.media.length > 0 ? p.media[0].url : 'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?auto=format&fit=crop&w=150&q=80',
      rawPost: p,
    }));
    setMockTablePosts(mappedTable);
  }

  // ── Lazy Loader State ──
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [overviewLoaded, setOverviewLoaded] = useState(false);

  // ── Master data loader: fetch background data ONLY when needed ──
  useEffect(() => {
    if (isInitialLoading) return;
    
    if (activeTab === 'overview' && !overviewLoaded) {
      setOverviewLoaded(true);
      dashboardApi.getAnalyticsOverview().then(res => {
        if (res.data?.data) setAnalyticsOverview(res.data.data);
      }).catch(() => {});
      
      auditLogsApi.list().then(res => {
        if (res.data?.data) setAuditLogs(res.data.data);
      }).catch(() => {});
    }

    if (activeTab === 'user-management' && !usersLoaded) {
      setUsersLoaded(true);
      
      usersApi.list().then(res => {
        const raw = res.data?.data;
        const mappedUsers = (raw || []).map((u: any) => ({
          ...u,
          role: u.roles && u.roles.length > 0 ? u.roles[0] : 'requestor',
          created_at: new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        }));
        setUsers(mappedUsers);
      }).catch(() => {});

      rolesApi.list().then(() => {
        setRolesList(ROLE_CATEGORIES);
        setNewUserRole('requestor');
      }).catch(() => {});

      departmentsApi.list().then(res => {
        const fetchedDepts = res.data?.data;
        if (fetchedDepts && fetchedDepts.length > 0) {
          setDepartmentsList(fetchedDepts.map((d: any) => ({ ...d })));
          setNewUserDepartment(fetchedDepts[0].display_name);
        }
      }).catch(() => {});
    }
  }, [isInitialLoading, activeTab, overviewLoaded, usersLoaded]);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [rolesList, setRolesList] = useState<{ label: string, value: string }[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [newUserRole, setNewUserRole] = useState('requestor');
  const [newUserDepartment, setNewUserDepartment] = useState('');
  const [newUserPosition, setNewUserPosition] = useState('');
  const [uploadingDeptId, setUploadingDeptId] = useState<number | null>(null);

  // Filtered dept list based on selected role category (Admin/Approver/Requestor)
  const filteredDepts = React.useMemo(() => {
    return departmentsForRole(newUserRole, departmentsList);
  }, [newUserRole, departmentsList]);

  // Auto-reset department when role changes, and pick appropriate default
  React.useEffect(() => {
    if (filteredDepts.length > 0) {
      setNewUserDepartment(filteredDepts[0].display_name);
    } else {
      // No departments left for this role (e.g. the last one was just deleted)
      // — clear the stale selection so the dropdown doesn't show a removed one.
      setNewUserDepartment('');
    }
    setNewUserPosition(autoPositionFor(newUserRole, newUserDepartment));
  }, [newUserRole, departmentsList]);

  // Auto-fill position when department changes
  React.useEffect(() => {
    setNewUserPosition(autoPositionFor(newUserRole, newUserDepartment));
  }, [newUserDepartment]);

  // Inline add-role/department state
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [addingDept, setAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  // Confirm delete modal state
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<any>(null);
  const [confirmDeleteUserEmail, setConfirmDeleteUserEmail] = useState('');

  const handleAddRole = () => {
    setAddingRole(true);
    setNewRoleName('');
  };

  const handleConfirmAddRole = async () => {
    const roleName = newRoleName.trim();
    if (roleName) {
      try {
        const val = roleName.toLowerCase().replace(/\s+/g, '_');
        await rolesApi.create({ name: val, display_name: roleName });
        const newOpt = { label: roleName, value: val };
        setRolesList((prev) => [...prev, newOpt]);
        setNewUserRole(val);
      } catch (e: any) {
        showToast('Failed to add role: ' + (e.response?.data?.message || e.message), 'error');
      }
    }
    setAddingRole(false);
    setNewRoleName('');
  };

  const handleDeleteRole = async () => {
    if (rolesList.length <= 1) {
      showToast('Cannot delete the last remaining role.', 'warning');
      return;
    }
    try {
      await rolesApi.delete(newUserRole);
      const updated = rolesList.filter((r) => r.value !== newUserRole);
      setRolesList(updated);
      setNewUserRole(updated[0].value);
    } catch (e: any) {
      showToast('Failed to delete role: ' + (e.response?.data?.message || e.message), 'error');
    }
  };

  const handleAddDepartment = () => {
    setAddingDept(true);
    setNewDeptName('');
  };

  const handleConfirmAddDept = async () => {
    const deptName = newDeptName.trim();
    if (deptName) {
      try {
        const val = deptName.toLowerCase().replace(/\s+/g, '_');
        // College departments are shared between requestor and approver roles.
        // Only 'admin' departments are role-exclusive (system departments).
        const categories = newUserRole === 'admin' ? ['admin'] : ['requestor', 'approver'];
        await departmentsApi.create({ name: val, display_name: deptName, role_categories: categories });
        const res = await departmentsApi.listFresh();
        setDepartmentsList(res.data?.data || []);
        setNewUserDepartment(deptName);
        showToast(`Department added to ${newUserRole}.`, 'success');
      } catch (e: any) {
        showToast('Failed to add department: ' + (e.response?.data?.message || e.message), 'error');
      }
    }
    setAddingDept(false);
    setNewDeptName('');
  };

  const handleDeleteDepartment = async () => {
    if (departmentsList.length <= 1) {
      showToast('Cannot delete the last remaining department.', 'warning');
      return;
    }
    const deptToDelete = departmentsList.find(d => d.display_name === newUserDepartment);
    if (!deptToDelete) return;

    try {
      // Role-scoped: only detach this department from the selected role. If it
      // is shared (e.g. a college used by Requestor AND Approver), the other
      // role keeps it.
      await departmentsApi.deleteFromRole(deptToDelete.id, newUserRole);
      const res = await departmentsApi.listFresh();
      const fresh = res.data?.data || [];
      setDepartmentsList(fresh);
      const visible = fresh.filter((d: any) => (d.role_categories || []).includes(newUserRole));
      if (visible.length > 0) {
        setNewUserDepartment(visible[0].display_name);
      } else {
        setNewUserDepartment('');
      }
      showToast(`Department removed from ${newUserRole}.`, 'success');
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message;
      showToast('Failed to delete department: ' + msg, 'error');
    }
  };

  const handleUploadDeptLogo = (deptId: number) => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingDeptId(deptId);
        try {
          await departmentsApi.uploadLogo(deptId, file);
          const res = await departmentsApi.listFresh();
          setDepartmentsList(res.data?.data || []);
          showToast('Department logo uploaded successfully.', 'success');
        } catch (e: any) {
          showToast('Failed to upload department logo.', 'error');
        } finally {
          setUploadingDeptId(null);
        }
      };
      input.click();
    }
  };

  const handleDeleteDepartmentFromSystem = async (deptId: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this department?')) return;
    try {
      await departmentsApi.delete(deptId);
      const res = await departmentsApi.listFresh();
      setDepartmentsList(res.data?.data || []);
      
      // Update form default if the currently selected one was deleted
      if (res.data?.data?.length > 0) {
        setNewUserDepartment(res.data.data[0].display_name);
      } else {
        setNewUserDepartment('');
      }
      
      showToast('Department deleted successfully.', 'success');
    } catch (e: any) {
      showToast('Failed to delete department.', 'error');
    }
  };

  const [showPassword, setShowPassword] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<string>('requestor');
  const [editingUserOriginalRole, setEditingUserOriginalRole] = useState<string>('requestor');
  const [editingUserDept, setEditingUserDept] = useState('');

  // ── Profile Modal State ──
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileMiddleName, setProfileMiddleName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profilePosition, setProfilePosition] = useState('');
  const [profileDepartment, setProfileDepartment] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [profileOriginalRole, setProfileOriginalRole] = useState('');
  const [profileStatus, setProfileStatus] = useState('active');
  const [profilePassword, setProfilePassword] = useState('');
  const [profilePasswordConfirmation, setProfilePasswordConfirmation] = useState('');
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [showProfilePasswordConfirm, setShowProfilePasswordConfirm] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Profile Photo State ──
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handleUploadProfilePhoto = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingPhoto(true);
        try {
          const res = await authApi.uploadPhoto(file);
          setProfilePhotoUrl(res.data.photo_url);
          showToast('Photo updated!', 'success');
        } catch (e: any) {
          showToast('Upload failed.', 'error');
        } finally {
          setUploadingPhoto(false);
        }
      };
      input.click();
    }
  };

  const handleRemoveProfilePhoto = async () => {
    setUploadingPhoto(true);
    try {
      await authApi.removePhoto();
      setProfilePhotoUrl(null);
      showToast('Photo removed.', 'success');
    } catch (e: any) {
      showToast('Remove failed.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Account Settings State ──
  const [acctFullName, setAcctFullName] = useState('');
  const [acctCurrentPw, setAcctCurrentPw] = useState('');
  const [acctNewPw, setAcctNewPw] = useState('');
  const [acctConfirmPw, setAcctConfirmPw] = useState('');
  const [savingAcctDetails, setSavingAcctDetails] = useState(false);
  const [savingAcctPw, setSavingAcctPw] = useState(false);

  useEffect(() => {
    if (user && activeTab === 'account-settings') {
      setAcctFullName(`${user.first_name || ''} ${user.last_name || ''}`.trim());
    }
  }, [user, activeTab]);

  const handleSaveAcctDetails = async () => {
    const parts = acctFullName.trim().split(' ');
    const first_name = parts[0] || '';
    const last_name = parts.slice(1).join(' ') || '';
    setSavingAcctDetails(true);
    try {
      await authApi.updateProfile({ first_name, last_name });
      if (user) {
        await setUser({
          ...user,
          first_name: first_name || last_name,
          last_name: last_name,
          name: `${first_name || last_name} ${last_name}`.trim()
        });
      }
      showToast('Profile updated!', 'success');
    } catch (e: any) {
      showToast('Failed: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setSavingAcctDetails(false);
    }
  };

  const handleChangeAcctPassword = async () => {
    if (!acctCurrentPw || !acctNewPw) { showToast('Fill all password fields.', 'warning'); return; }
    if (acctNewPw.length < 8) { showToast('Password must be at least 8 characters.', 'warning'); return; }
    if (acctNewPw !== acctConfirmPw) { showToast('Passwords do not match.', 'warning'); return; }
    setSavingAcctPw(true);
    try {
      await authApi.changePassword(acctCurrentPw, acctNewPw, acctConfirmPw);
      showToast('Password changed!', 'success');
      setAcctCurrentPw(''); setAcctNewPw(''); setAcctConfirmPw('');
    } catch (e: any) {
      showToast('Failed: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setSavingAcctPw(false);
    }
  };

  // ── Custom Toast State ── (Now uses Global Alert)
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    Alert.alert(type.charAt(0).toUpperCase() + type.slice(1), message);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Requests Table Filters
  const [requestsSearch, setRequestsSearch] = useState('');
  const [requestsStatus, setRequestsStatus] = useState('All Status');
  const [isRequestsStatusDropdownOpen, setIsRequestsStatusDropdownOpen] = useState(false);
  const [requestsDept, setRequestsDept] = useState('All Departments');
  const [isRequestsDeptDropdownOpen, setIsRequestsDeptDropdownOpen] = useState(false);
  const [requestsDate, setRequestsDate] = useState<'All Time' | 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Custom Range'>('All Time');
  const [isRequestsDateDropdownOpen, setIsRequestsDateDropdownOpen] = useState(false);
  const [requestsCustomStartDate, setRequestsCustomStartDate] = useState('');
  const [requestsCustomEndDate, setRequestsCustomEndDate] = useState('');
  const [requestsSortOrder, setRequestsSortOrder] = useState<'desc' | 'asc'>('desc');


  const [allMockPosts, setAllMockPosts] = useState<any[]>([]);
  const [mockTablePosts, setMockTablePosts] = useState<any[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsPerPage, setPostsPerPage] = useState(10);
  const [previewPost, setPreviewPost] = useState<any>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [previewImgSize, setPreviewImgSize] = useState<{ width: number; height: number } | null>(null);


  // Fetch image dimensions when preview opens (Facebook-style dynamic sizing)
  useEffect(() => {
    if (previewPost?.image) {
      setPreviewImgSize(null);
      Image.getSize(
        previewPost.image,
        (w, h) => setPreviewImgSize({ width: w, height: h }),
        () => setPreviewImgSize(null) // fallback on error
      );
    } else {
      setPreviewImgSize(null);
    }
  }, [previewPost?.image]);

  // ── Token Management State ──
  const [tokenFields, setTokenFields] = useState({
    facebook_page_id: '',
    facebook_access_token: '',
    instagram_business_account_id: '',
    instagram_access_token: '',
    wordpress_url: '',
    wordpress_username: '',
    wordpress_app_password: '',
  });
  const [tokenLastUpdated, setTokenLastUpdated] = useState('');
  const [savingTokens, setSavingTokens] = useState(false);
  const [showTokenField, setShowTokenField] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeTab === 'tokens') {
      tokenSettingsApi.get()
        .then(res => {
          const t = res.data.tokens || {};
          setTokenFields(prev => ({
            ...prev,
            facebook_page_id: t.facebook_page_id || '',
            facebook_access_token: t.facebook_access_token || '',
            instagram_business_account_id: t.instagram_business_account_id || '',
            instagram_access_token: t.instagram_access_token || '',
            wordpress_url: t.wordpress_url || '',
            wordpress_username: t.wordpress_username || '',
            wordpress_app_password: t.wordpress_app_password || '',
          }));
          setTokenLastUpdated(res.data.last_updated || 'Never');
        })
        .catch(() => { });
    }
  }, [activeTab]);

  const handleSaveTokens = async () => {
    setSavingTokens(true);
    try {
      const res = await tokenSettingsApi.update(tokenFields);
      showToast('Tokens saved successfully!', 'success');
      setTokenLastUpdated(res.data.last_updated || new Date().toLocaleString());
    } catch (e: any) {
      showToast('Failed to save tokens: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setSavingTokens(false);
    }
  };

  const handleSavePlatformTokens = async (platform: 'facebook' | 'instagram' | 'wordpress') => {
    const platformFields: Record<string, string[]> = {
      facebook: ['facebook_page_id', 'facebook_access_token'],
      instagram: ['instagram_business_account_id', 'instagram_access_token'],
      wordpress: ['wordpress_url', 'wordpress_username', 'wordpress_app_password'],
    };
    const keys = platformFields[platform];
    const payload: Record<string, string> = {};
    keys.forEach(k => { payload[k] = (tokenFields as any)[k] || ''; });

    setSavingTokens(true);
    try {
      const res = await tokenSettingsApi.update(payload);
      showToast(`${platform.charAt(0).toUpperCase() + platform.slice(1)} tokens saved!`, 'success');
      setTokenLastUpdated(res.data.last_updated || new Date().toLocaleString());
    } catch (e: any) {
      showToast('Failed to save: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setSavingTokens(false);
    }
  };

  const toggleTokenVisibility = (key: string) => {
    setShowTokenField(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Email Settings State ──
  const [emailFields, setEmailFields] = useState({
    mail_mailer: 'smtp', // Hardcoded to real SMTP
    mail_host: 'smtp.gmail.com',
    mail_port: '587',
    mail_username: '',
    mail_password: '',
    mail_encryption: 'tls',
    mail_from_address: '',
    mail_from_name: 'JMCFI PostFlow',
  });
  const [emailPasswordSet, setEmailPasswordSet] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  useEffect(() => {
    if (activeTab === 'email-settings') {
      (emailSettingsApi as any).get()
        .then((res: any) => {
          const s = res.data.settings || {};
          setEmailFields(prev => ({
            ...prev,
            mail_mailer: 'smtp', // Always smtp
            mail_host: s.mail_host || 'smtp.gmail.com',
            mail_port: s.mail_port || '587',
            mail_username: s.mail_username || '',
            mail_encryption: s.mail_encryption || 'tls',
            mail_from_address: s.mail_from_address || '',
            mail_from_name: s.mail_from_name || 'JMCFI PostFlow',
          }));
          setEmailPasswordSet(!!s.mail_password_set);
        })
        .catch(() => { });
    }
  }, [activeTab]);

  const handleSaveEmailSettings = async () => {
    setSavingEmail(true);
    try {
      await (emailSettingsApi as any).update(emailFields);
      showToast('Email settings saved successfully!', 'success');
      if (emailFields.mail_password) {
        setEmailPasswordSet(true);
        setEmailFields(prev => ({ ...prev, mail_password: '' }));
      }
    } catch (e: any) {
      showToast('Failed to save: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const res = await (emailSettingsApi as any).test();
      showToast(res.data.message || 'Test email sent!', 'success');
    } catch (e: any) {
      showToast('Test failed: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  // ── Department Logo State (used to show a dept logo next to a user's avatar) ──
  const [deptLogos, setDeptLogos] = useState<Record<number, string>>({});

  useEffect(() => {
    if (departmentsList.length > 0) {
      const logos: Record<number, string> = {};
      (departmentsList as any[]).forEach((d: any) => {
        if (d.logo_path) {
          logos[d.id] = d.logo_url || `http://localhost:8000/storage/${d.logo_path}`;
        }
      });
      setDeptLogos(logos);
    }
  }, [departmentsList]);

  // Direct lookup helper — use deptLogos first, fallback to departmentsList
  const getDeptLogo = (deptId: number) => {
    if (deptLogos[deptId]) return deptLogos[deptId];
    const d = departmentsList.find((x: any) => x.id === deptId);
    return d?.logo_url || null;
  };

  const handlePublish = async (id: string | number) => {
    try {
      await publishingApi.publish(Number(id));
      showToast('Post published successfully!', 'success');
      loadPostsData();
    } catch (error: any) {
      showToast('Failed to publish: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  const loadPostsData = async () => {
    try {
      const res = await postsApi.list({ per_page: 1000 });
      processPostsData(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const platforms = [
    { name: 'Facebook', percentage: 65, barColor: Colors.primary },
    { name: 'Instagram', percentage: 15, barColor: '#B45309' },
    { name: 'Twitter/X', percentage: 10, barColor: Colors.textSecondary },
    { name: 'Portal', percentage: 10, barColor: '#3B82F6' },
  ];

  // Audit Logs State & Mock Data
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditEventTypeFilter, setAuditEventTypeFilter] = useState('ALL');
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);

  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [analyticsOverview, setAnalyticsOverview] = useState<any>({
    totalVolume: '0',
    avgVelocity: '0 hrs',
    complianceRate: '0%',
    activeUsers: '0',
    departmentBreakdown: [],
    platformStats: [],
    contentPublished: '0',
    pendingApproval: '0',
    monthsData: [],
    platformReach: { facebook: 0, instagram: 0, other: 0 }
  });

  const handleCreateAccount = async () => {
    if (!newUserEmail || !newUserPassword || !newUserFirstName || !newUserLastName) { showToast('Please fill in all required fields.', 'warning'); return; }
    // Auto-append @jmc.edu.ph if not already a full email
    const finalEmail = newUserEmail.includes('@') ? newUserEmail : newUserEmail.trim() + '@jmc.edu.ph';

    try {
      const generatedEmpId = 'EMP-' + Math.floor(10000 + Math.random() * 90000);
      const res = await usersApi.create({
        employee_id: generatedEmpId,
        first_name: newUserFirstName,
        last_name: newUserLastName,
        email: finalEmail,
        password: newUserPassword,
        role: granularRoleFor(newUserRole, newUserDepartment),
        department: newUserDepartment,
        position: newUserPosition || undefined,
      });
      const u = res.data.data;
      const newAccount = {
        ...u,
        role: u.roles && u.roles.length > 0 ? u.roles[0] : 'requestor',
        created_at: new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      };
      setUsers([newAccount, ...users]);
      setNewUserEmail(''); setNewUserPassword(''); setNewUserFirstName(''); setNewUserLastName('');
      showToast('Institutional account created successfully!', 'success');
    } catch (e: any) {
      showToast('Failed to create account: ' + (e.response?.data?.message || e.message), 'error');
    }
  };

  const handleDeleteUser = async (id: any) => {
    setConfirmDeleteUserId(id);
    const u = users.find(u => String(u.id) === String(id));
    setConfirmDeleteUserEmail(u?.email || '');
  };

  const handleConfirmDeleteUser = async () => {
    const id = confirmDeleteUserId;
    try {
      await usersApi.delete(id);
      setUsers(users.filter(u => String(u.id) !== String(id)));
    } catch (e: any) {
      showToast('Failed to delete user: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setConfirmDeleteUserId(null);
      setConfirmDeleteUserEmail('');
    }
  };

  const handleSaveEditedRole = async (id: string) => {
    try {
      // Preserve the exact granular role unless the category actually changed
      const roleToSend = roleCategoryOf(editingUserOriginalRole) === editingUserRole
        ? editingUserOriginalRole
        : granularRoleFor(editingUserRole, editingUserDept);
      await usersApi.update(id, { role: roleToSend });
      setUsers(users.map(u => u.id === id ? { ...u, role: roleToSend } : u));
      setEditingUserId(null);
      showToast('User role updated successfully!', 'success');
    } catch (e: any) {
      showToast('Failed to update role.', 'error');
    }
  };

  // ── Profile Modal Handlers ──
  const handleOpenProfile = (u: any) => {
    setSelectedUser(u);
    setProfileFirstName(u.first_name || '');
    setProfileMiddleName(u.middle_name || '');
    setProfileLastName(u.last_name || '');
    setProfileEmail(u.email || '');
    setProfilePhone(u.phone || '');
    setProfilePosition(u.position || '');
    setProfileDepartment(u.department || '');
    setProfileRole(roleCategoryOf(u.role || 'requestor'));
    setProfileOriginalRole(u.role || 'requestor');
    setProfileStatus(u.status || 'active');
    setProfilePassword('');
    setProfilePasswordConfirmation('');
  };

  const handleCloseProfile = () => {
    setSelectedUser(null);
    setProfilePassword('');
    setProfilePasswordConfirmation('');
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    setSavingProfile(true);
    try {
      const roleToSend = roleCategoryOf(profileOriginalRole) === profileRole
        ? profileOriginalRole
        : granularRoleFor(profileRole, profileDepartment);
      const payload: any = {
        first_name: profileFirstName,
        last_name: profileLastName,
        email: profileEmail,
        department: profileDepartment,
        role: roleToSend,
        status: profileStatus,
      };
      if (profileMiddleName) payload.middle_name = profileMiddleName;
      if (profilePhone) payload.phone = profilePhone;
      if (profilePosition) payload.position = profilePosition;

      if (profilePassword) {
        if (profilePassword.length < 8) {
          showToast('Password must be at least 8 characters.', 'warning');
          setSavingProfile(false);
          return;
        }
        if (profilePassword !== profilePasswordConfirmation) {
          showToast('Password confirmation does not match.', 'warning');
          setSavingProfile(false);
          return;
        }
        payload.password = profilePassword;
        payload.password_confirmation = profilePasswordConfirmation;
      }

      const res = await usersApi.update(selectedUser.id, payload);
      const updatedUser = res.data.data;
      // Refresh user list in-place
      setUsers(users.map(u => String(u.id) === String(selectedUser.id) ? {
        ...u,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        email: updatedUser.email,
        department: updatedUser.department,
        role: updatedUser.roles && updatedUser.roles.length > 0 ? updatedUser.roles[0] : updatedUser.role,
        status: updatedUser.status,
      } : u));
      showToast('Profile updated successfully!', 'success');

      // If the edited user is the currently logged-in user, sync global state
      if (user && String(selectedUser.id) === String(user.id)) {
        await setUser({
          ...user,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          name: `${updatedUser.first_name} ${updatedUser.last_name}`.trim(),
          email: updatedUser.email,
          department: updatedUser.department,
          role: updatedUser.roles && updatedUser.roles.length > 0 ? updatedUser.roles[0] : updatedUser.role,
        });
      }

      handleCloseProfile();
    } catch (e: any) {
      showToast('Failed to update profile: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const isLargeScreen = width > 1024;
  const isTablet = width > 768;

  const getRoleBadgeDetails = (role: string) => {
    switch (role) {
      case 'admin': return { label: 'ADMINISTRATOR', color: '#1E40AF', bgColor: '#DBEAFE' };
      case 'approver': return { label: 'APPROVER', color: '#B45309', bgColor: '#FEF3C7' };
      case 'requestor': return { label: 'REQUESTOR', color: '#0F766E', bgColor: '#CCFBF1' };
      case 'content_requestor': return { label: 'CONTENT REQUESTOR', color: '#0F766E', bgColor: '#CCFBF1' };
      // legacy
      case 'it_publisher': return { label: 'IT ADMIN', color: '#1E40AF', bgColor: '#DBEAFE' };
      case 'vice_president': return { label: 'VICE PRESIDENT', color: '#B45309', bgColor: '#FEF3C7' };
      case 'office_head': return { label: 'OFFICE HEAD', color: '#92400E', bgColor: '#FEF3C7' };
      case 'imc_qa_checker': return { label: 'IMC / QA', color: '#6366F1', bgColor: '#E0E7FF' };
      default: return { label: role.toUpperCase(), color: Colors.textPrimary, bgColor: Colors.background };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_review': return { dotColor: '#D97706', textColor: '#854D0E' };
      case 'approved': return { dotColor: '#16A34A', textColor: '#15803D' };
      case 'revision_requested': return { dotColor: '#DC2626', textColor: '#B91C1C' };
      default: return { dotColor: Colors.textSecondary, textColor: Colors.textPrimary };
    }
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(userFilter.toLowerCase()));
  const postsToShow = statusFilter === 'all' ? allMockPosts : allMockPosts.filter(p => p.status === statusFilter);

  const filteredTablePosts = mockTablePosts.filter((post) => {
    const matchesSearch = requestsSearch === '' ||
      post.title.toLowerCase().includes(requestsSearch.toLowerCase()) ||
      post.requestedBy.toLowerCase().includes(requestsSearch.toLowerCase());

    let matchesStatus = true;
    if (requestsStatus !== 'All Status') {
      if (requestsStatus === 'Pending') {
        matchesStatus = ['pending_office_head', 'pending_vice_president', 'pending_imc_qa', 'draft'].includes(post.rawStatus);
      } else if (requestsStatus === 'Published') {
        matchesStatus = ['published', 'approved'].includes(post.rawStatus);
      } else if (requestsStatus === 'Rejected') {
        matchesStatus = ['rejected', 'returned_for_revision'].includes(post.rawStatus);
      } else if (requestsStatus === 'Draft') {
        matchesStatus = post.rawStatus === 'draft';
      }
    }

    const matchesDept = requestsDept === 'All Departments' || post.department === requestsDept;

    let matchesDate = true;
    if (requestsDate !== 'All Time') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const postDate = new Date(post.rawDate || Date.now());
      postDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - postDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
      
      if (requestsDate === 'Today') {
        matchesDate = diffDays === 0;
      } else if (requestsDate === 'Yesterday') {
        matchesDate = diffDays === 1;
      } else if (requestsDate === 'Last 7 Days') {
        matchesDate = diffDays >= 0 && diffDays <= 7;
      } else if (requestsDate === 'Last 30 Days') {
        matchesDate = diffDays >= 0 && diffDays <= 30;
      } else if (requestsDate === 'Custom Range') {
        const start = new Date(requestsCustomStartDate);
        const end = new Date(requestsCustomEndDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const raw = new Date(post.rawDate || Date.now());
            matchesDate = raw >= start && raw <= new Date(end.getTime() + 86400000);
        }
      }
    }

    return matchesSearch && matchesStatus && matchesDept && matchesDate;
  }).sort((a, b) => {
    const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
    const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
    return requestsSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const paginatedTablePosts = filteredTablePosts.slice((postsPage - 1) * postsPerPage, postsPage * postsPerPage);

  useEffect(() => {
    setPostsPage(1);
  }, [requestsSearch, statusFilter, activeTab]);

  const computedStats = React.useMemo(() => {
    return {
      total: mockTablePosts.length,
      published: mockTablePosts.filter((p: any) => ['published', 'approved'].includes(p.rawStatus)).length,
      pending: mockTablePosts.filter((p: any) => ['pending_office_head', 'pending_vice_president', 'pending_imc_qa'].includes(p.rawStatus)).length,
      draft: mockTablePosts.filter((p: any) => p.rawStatus === 'draft').length,
    };
  }, [mockTablePosts]);

  return (
    <DashboardShell
      title="IT Admin Panel"
      activeTab={activeTab as string}
      onTabChange={handleTabChange}
      backgroundImage={require('../../../assets/images/jmcbg2.jpeg')}
      departmentName={user?.department}
      userPhotoUrl={profilePhotoUrl}
      departmentLogo={(() => {
        const dept = departmentsList.find((d: any) =>
          d.display_name === user?.department || d.name === user?.department
        );
        return dept ? deptLogos[dept.id] : undefined;
      })()}
    >
      {/* Title block removed as requested */}

      {/* GLOBAL TOAST NOTIFICATION DELETED - NOW USING GLOBAL ALERT MODAL */}

      {/* ── LOADING SKELETON ──
        The overview only needs the react-query init fetch (isLoading), while
        the other tabs wait for their background data (isInitialLoading). */}
      {isInitialLoading && (
        <DashboardSkeleton />
      )}

      {/* ── OVERVIEW TAB ──
        Renders as soon as the essential init data arrives (isLoading), without
        waiting for the 5 background tab-requests on the single-threaded server. */}
      {activeTab === 'overview' && !isInitialLoading && (
        <>
          <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: isTablet ? 20 : 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <TouchableOpacity style={{ flex: isTablet ? 1 : undefined, minWidth: isTablet ? 220 : undefined }} onPress={() => setRequestsStatus('All Status')} activeOpacity={0.7}>
              <Card style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, height: '100%', ...(requestsStatus === 'All Status' ? { borderColor: Colors.primary, borderWidth: 2 } : {}) }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f3e8ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="document-text" size={24} color="#7e22ce" />
                </View>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' }}>Total Content</Text>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>{computedStats.total}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>All content requests</Text>
                </View>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: isTablet ? 1 : undefined, minWidth: isTablet ? 220 : undefined }} onPress={() => setRequestsStatus('Published')} activeOpacity={0.7}>
              <Card style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, height: '100%', ...(requestsStatus === 'Published' ? { borderColor: Colors.primary, borderWidth: 2 } : {}) }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-circle" size={24} color="#1877F2" />
                </View>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' }}>Approved & Published</Text>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>{computedStats.published}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>Ready or live</Text>
                </View>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: isTablet ? 1 : undefined, minWidth: isTablet ? 220 : undefined }} onPress={() => setRequestsStatus('Pending')} activeOpacity={0.7}>
              <Card style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, height: '100%', ...(requestsStatus === 'Pending' ? { borderColor: Colors.primary, borderWidth: 2 } : {}) }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#fdf2f8', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="time" size={24} color="#E1306C" />
                </View>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' }}>Pending</Text>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>{computedStats.pending}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>Awaiting approval</Text>
                </View>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: isTablet ? 1 : undefined, minWidth: isTablet ? 220 : undefined }} onPress={() => setRequestsStatus('Drafts')} activeOpacity={0.7}>
              <Card style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, height: '100%', ...(requestsStatus === 'Drafts' ? { borderColor: Colors.primary, borderWidth: 2 } : {}) }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="document" size={24} color="#16a34a" />
                </View>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' }}>Drafts</Text>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>{computedStats.draft}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>Work in progress</Text>
                </View>
              </Card>
            </TouchableOpacity>
          </View>

          {/* ── ALL CONTENT REQUESTS TABLE ── */}
          <Card style={{ padding: 0, overflow: 'visible', borderWidth: 1, borderColor: '#e5e7eb', zIndex: 10 }}>
            {/* Table Controls */}
            <View style={{ flexDirection: isTablet ? 'row' : 'column', justifyContent: 'space-between', alignItems: isTablet ? 'center' : 'stretch', padding: isTablet ? 20 : 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexWrap: 'wrap', gap: 12, zIndex: 20 }}>
              <Text style={{ fontSize: isTablet ? 18 : 16, fontWeight: '700', color: Colors.textPrimary }}>All Content Requests</Text>
              <View style={{ flexDirection: isTablet ? 'row' : 'column', alignItems: isTablet ? 'center' : 'stretch', gap: 12, flexWrap: 'wrap', zIndex: 30 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 6, paddingHorizontal: 12, height: 36, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <Ionicons name="search" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
                  <TextInput id="search-requests" placeholder="Search requests..." style={{ fontSize: 13, minWidth: 160, outlineStyle: 'none' } as any} value={requestsSearch} onChangeText={setRequestsSearch} />
                </View>
                <View style={{ position: 'relative', zIndex: 40 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                    onPress={() => setIsRequestsDeptDropdownOpen(!isRequestsDeptDropdownOpen)}
                  >
                    <Text style={{ fontSize: 13, color: Colors.textPrimary, marginRight: 8 }}>{requestsDept}</Text>
                    <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {isRequestsDeptDropdownOpen && (
                    <ScrollView style={{ position: 'absolute', top: 40, left: 0, backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#e5e7eb', minWidth: 180, maxHeight: 300, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }} nestedScrollEnabled>
                      <TouchableOpacity
                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: requestsDept === 'All Departments' ? '#f3f4f6' : 'transparent' }}
                        onPress={() => {
                          setRequestsDept('All Departments');
                          setIsRequestsDeptDropdownOpen(false);
                        }}
                      >
                        <Text style={{ fontSize: 13, color: requestsDept === 'All Departments' ? Colors.primary : Colors.textPrimary, fontWeight: requestsDept === 'All Departments' ? '600' : '400' }}>All Departments</Text>
                      </TouchableOpacity>
                      {departmentsList.filter((d: any) => !d.is_system).map((d: any) => (
                        <TouchableOpacity
                          key={d.id}
                          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: requestsDept === d.display_name ? '#f3f4f6' : 'transparent' }}
                          onPress={() => {
                            setRequestsDept(d.display_name);
                            setIsRequestsDeptDropdownOpen(false);
                          }}
                        >
                          <Text style={{ fontSize: 13, color: requestsDept === d.display_name ? Colors.primary : Colors.textPrimary, fontWeight: requestsDept === d.display_name ? '600' : '400' }}>{d.display_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                <View style={{ position: 'relative', zIndex: 40 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                    onPress={() => setIsRequestsStatusDropdownOpen(!isRequestsStatusDropdownOpen)}
                  >
                    <Text style={{ fontSize: 13, color: Colors.textPrimary, marginRight: 8 }}>{requestsStatus}</Text>
                    <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {isRequestsStatusDropdownOpen && (
                    <View style={{ position: 'absolute', top: 40, left: 0, backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#e5e7eb', minWidth: 140, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }}>
                      {['All Status', 'Pending', 'Published', 'Rejected', 'Draft'].map((opt: any) => (
                        <TouchableOpacity
                          key={opt}
                          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: requestsStatus === opt ? '#f3f4f6' : 'transparent' }}
                          onPress={() => {
                            setRequestsStatus(opt);
                            setIsRequestsStatusDropdownOpen(false);
                          }}
                        >
                          <Text style={{ fontSize: 13, color: requestsStatus === opt ? Colors.primary : Colors.textPrimary, fontWeight: requestsStatus === opt ? '600' : '400' }}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ position: 'relative', zIndex: 40 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                    onPress={() => setIsRequestsDateDropdownOpen(!isRequestsDateDropdownOpen)}
                  >
                    <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: Colors.textPrimary, marginRight: 8 }}>{requestsDate}</Text>
                    <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {isRequestsDateDropdownOpen && (
                    <View style={{ position: 'absolute', top: 40, right: 0, backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#e5e7eb', minWidth: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }}>
                      {['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom Range'].map((opt: any) => (
                        <TouchableOpacity
                          key={opt}
                          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: requestsDate === opt ? '#f3f4f6' : 'transparent' }}
                          onPress={() => {
                            setRequestsDate(opt);
                            if (opt !== 'Custom Range') setIsRequestsDateDropdownOpen(false);
                          }}
                        >
                          <Text style={{ fontSize: 13, color: requestsDate === opt ? Colors.primary : Colors.textPrimary, fontWeight: requestsDate === opt ? '600' : '400' }}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                      
                      {requestsDate === 'Custom Range' && (
                        <View style={{ padding: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>Start Date</Text>
                          <input type="date" style={{ height: 32, fontSize: 13, borderRadius: 6, border: '1px solid #e5e7eb', paddingLeft: 8, paddingRight: 8, outline: 'none', backgroundColor: '#fff', width: '100%', marginBottom: 8 }} value={requestsCustomStartDate} onChange={(e) => setRequestsCustomStartDate(e.target.value)} />
                          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>End Date</Text>
                          <input type="date" style={{ height: 32, fontSize: 13, borderRadius: 6, border: '1px solid #e5e7eb', paddingLeft: 8, paddingRight: 8, outline: 'none', backgroundColor: '#fff', width: '100%', marginBottom: 8 }} value={requestsCustomEndDate} onChange={(e) => setRequestsCustomEndDate(e.target.value)} />
                          <TouchableOpacity 
                            style={{ backgroundColor: Colors.primary, paddingVertical: 8, borderRadius: 6, alignItems: 'center', marginTop: 4 }}
                            onPress={() => setIsRequestsDateDropdownOpen(false)}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Apply</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Table Header */}
            <ScrollView horizontal={isTablet} showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ flexGrow: 1 }}>
              <View style={{ flex: 1, minWidth: isTablet ? 1000 : 'auto' }}>
                {isTablet && (
                  <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                    <Text style={{ flex: 2, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>REQUEST TITLE</Text>
                    <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>DEPARTMENT</Text>
                    <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>REQUESTED BY</Text>
                    <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>STATUS</Text>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>PLATFORMS</Text>
                    <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>REQUESTED ON</Text>
                    <Text style={{ width: 80, fontSize: 11, fontWeight: '600', color: '#6b7280', textAlign: 'center' }}>ACTIONS</Text>
                  </View>
                )}

                {/* Table Rows */}
                {paginatedTablePosts.map((post) => (
                  <TouchableOpacity key={post.id} activeOpacity={0.7} onPress={() => setPreviewPost(post)} style={[
                    { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', cursor: 'pointer' },
                    isTablet ? { flexDirection: 'row', alignItems: 'center' } : { flexDirection: 'column', gap: 12 }
                  ]}>
                    {/* TITLE */}
                    <View style={[{ flexDirection: 'row', alignItems: 'center' }, isTablet ? { flex: 2, paddingRight: 16 } : { width: '100%' }]}>
                      <Image source={{ uri: post.image }} style={{ width: 48, height: 32, borderRadius: 4, marginRight: 12 }} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 1 }} numberOfLines={2}>{post.title}</Text>
                    </View>

                    <View style={[isTablet ? { flexDirection: 'row', flex: 7 } : { flexDirection: 'column', gap: 8, paddingLeft: 60 }]}>
                      {/* DEPT & REQ BY (Combined on mobile) */}
                      {!isTablet && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{post.department}</Text>
                          <Text style={{ fontSize: 12, color: Colors.textPrimary }}>{post.requestedBy}</Text>
                        </View>
                      )}
                      
                      {isTablet && (
                        <>
                          <View style={{ flex: 1.5, paddingRight: 12 }}>
                            <Text style={{ fontSize: 12, color: Colors.textPrimary }}>{post.department}</Text>
                          </View>
                          <View style={{ flex: 1.5, paddingRight: 12 }}>
                            <Text style={{ fontSize: 13, color: Colors.textPrimary }}>{post.requestedBy}</Text>
                          </View>
                        </>
                      )}

                      {/* STATUS & PLATFORMS (Combined on mobile) */}
                      {!isTablet ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <View style={{
                            backgroundColor: post.rawStatus === 'published' || post.rawStatus === 'approved' ? '#dcfce7' : post.rawStatus === 'rejected' || post.rawStatus === 'returned_for_revision' ? '#fee2e2' : '#fef3c7',
                            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4
                          }}>
                            <Text style={{
                              fontSize: 10, fontWeight: '600', textTransform: 'uppercase',
                              color: post.rawStatus === 'published' || post.rawStatus === 'approved' ? '#16a34a' : post.rawStatus === 'rejected' || post.rawStatus === 'returned_for_revision' ? '#dc2626' : '#b45309'
                            }}>{post.status}</Text>
                          </View>
                          
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {post.platforms.includes('facebook') && <Ionicons name="logo-facebook" size={16} color="#1877F2" />}
                            {post.platforms.includes('instagram') && <Ionicons name="logo-instagram" size={16} color="#E1306C" />}
                            {post.platforms.includes('website') && <Ionicons name="globe-outline" size={16} color="#3b82f6" />}
                          </View>
                        </View>
                      ) : (
                        <>
                          {/* STATUS (Tablet) */}
                          <View style={{ flex: 1.5, paddingRight: 12 }}>
                            <View style={{
                              backgroundColor: post.rawStatus === 'published' || post.rawStatus === 'approved' ? '#dcfce7' : post.rawStatus === 'rejected' || post.rawStatus === 'returned_for_revision' ? '#fee2e2' : '#fef3c7',
                              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start'
                            }}>
                              <Text style={{
                                fontSize: 10, fontWeight: '600', textTransform: 'uppercase',
                                color: post.rawStatus === 'published' || post.rawStatus === 'approved' ? '#16a34a' : post.rawStatus === 'rejected' || post.rawStatus === 'returned_for_revision' ? '#dc2626' : '#b45309'
                              }}>{post.status}</Text>
                            </View>
                          </View>

                          {/* PLATFORMS (Tablet) */}
                          <View style={{ flex: 1, flexDirection: 'row', gap: 6, paddingRight: 12 }}>
                            {post.platforms.includes('facebook') && <Ionicons name="logo-facebook" size={16} color="#1877F2" />}
                            {post.platforms.includes('instagram') && <Ionicons name="logo-instagram" size={16} color="#E1306C" />}
                            {post.platforms.includes('website') && <Ionicons name="globe-outline" size={16} color="#3b82f6" />}
                          </View>
                        </>
                      )}

                      {/* DATE */}
                      {!isTablet ? (
                         <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <Text style={{ fontSize: 11, color: Colors.textSecondary }}>Requested on {post.requestedOn} at {post.requestedTime}</Text>
                            <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="chevron-forward" size={16} color="#6b7280" />
                            </TouchableOpacity>
                         </View>
                      ) : (
                        <>
                          {/* DATE (Tablet) */}
                          <View style={{ flex: 1.5, paddingRight: 12 }}>
                            <Text style={{ fontSize: 12, color: Colors.textPrimary }}>{post.requestedOn}</Text>
                            <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{post.requestedTime}</Text>
                          </View>

                          {/* ACTIONS (Tablet) */}
                          <View style={{ width: 80, flexDirection: 'row', justifyContent: 'center' }}>
                            <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="chevron-forward" size={16} color="#6b7280" />
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}

              </View>
            </ScrollView>

            <PaginationControl 
              currentPage={postsPage} 
              totalItems={filteredTablePosts.length} 
              itemsPerPage={postsPerPage} 
              onPageChange={setPostsPage} 
              onItemsPerPageChange={setPostsPerPage}
              itemName="requests" 
            />
          </Card>
        </>
      )}

      {/* ── USER MANAGEMENT TAB ── */}
      {activeTab === 'user-management' && !isInitialLoading && (
        <View style={styles.userTabContainer}>
          <Card style={styles.userCard}>
            <Text style={styles.sectionHeader}>Create New Institutional Account</Text>
            {/* Row 1: First Name + Last Name */}
            <View style={[styles.formRow, isTablet ? styles.formRowLayout : styles.formColumnLayout]}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>First Name</Text>
                <TextInput style={styles.formInput} placeholder="e.g. Juan" value={newUserFirstName} onChangeText={setNewUserFirstName} />
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Last Name</Text>
                <TextInput style={styles.formInput} placeholder="e.g. Dela Cruz" value={newUserLastName} onChangeText={setNewUserLastName} />
              </View>
            </View>
            {/* Row 2: Email + Password */}
            <View style={[styles.formRow, isTablet ? styles.formRowLayout : styles.formColumnLayout]}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Email Username</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 38, borderWidth: 1, borderColor: Colors.border, borderRadius: 4, backgroundColor: '#fff', overflow: 'hidden' }}>
                  <TextInput
                    style={{ flex: 1, height: 38, paddingHorizontal: 10, fontSize: 13, color: '#1A1A2E', outlineStyle: 'none' } as any}
                    placeholder="e.g. juan.delacruz"
                    value={newUserEmail}
                    onChangeText={setNewUserEmail}
                    autoCapitalize="none"
                  />
                  <View style={{ backgroundColor: Colors.background, paddingHorizontal: 8, height: '100%', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: Colors.border }}>
                    <Text style={{ fontSize: 12, color: Colors.textSecondary }}>@jmc.edu.ph</Text>
                  </View>
                </View>
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Password</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput style={styles.passwordInput} placeholder="••••••••" secureTextEntry={!showPassword} value={newUserPassword} onChangeText={setNewUserPassword} autoCapitalize="none" />
                  <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {/* Row 3: Role + Department */}
            <View style={[styles.formRow, isTablet ? styles.formRowLayout : styles.formColumnLayout]}>
              <View style={styles.formField}>
                <Text style={[styles.formLabel]} numberOfLines={1}>Role</Text>
                <select
                  value={newUserRole}
                  onChange={(e: any) => setNewUserRole(e.target.value)}
                  style={{ height: 38, fontSize: 13, borderRadius: 4, border: '1px solid #E5E7EB', backgroundColor: '#fff', color: '#1A1A2E', paddingLeft: 10, outline: 'none', cursor: 'pointer', width: '100%' }}
                >
                  {ROLE_CATEGORIES.filter(opt => opt.value !== 'admin').map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </View>
              <View style={styles.formField}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.formLabel, { marginBottom: 0, flexShrink: 1, marginRight: 8 }]} numberOfLines={1}>Department</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#EFF6FF', flexDirection: 'row', alignItems: 'center', gap: 3 }}
                      onPress={handleAddDepartment}
                    >
                      <Ionicons name="add-circle-outline" size={14} color="#1E40AF" />
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1E40AF' }}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FEF2F2', flexDirection: 'row', alignItems: 'center', gap: 3 }}
                      onPress={handleDeleteDepartment}
                    >
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#DC2626' }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <select
                  value={newUserDepartment}
                  onChange={(e: any) => setNewUserDepartment(e.target.value)}
                  style={{ height: 38, fontSize: 13, borderRadius: 4, border: '1px solid #E5E7EB', backgroundColor: '#fff', color: '#1A1A2E', paddingLeft: 10, outline: 'none', cursor: 'pointer', width: '100%' }}
                >
                  {filteredDepts.map((d: any) => <option key={d.id} value={d.display_name}>{d.display_name}</option>)}
                </select>
                {addingDept && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <TextInput
                      style={{ flex: 1, height: 34, borderWidth: 1, borderColor: '#3B82F6', borderRadius: 4, paddingHorizontal: 8, fontSize: 13, backgroundColor: '#EFF6FF' }}
                      placeholder="New department name..."
                      value={newDeptName}
                      onChangeText={setNewDeptName}
                      autoFocus
                    />
                    <TouchableOpacity
                      onPress={handleConfirmAddDept}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#1E40AF', borderRadius: 4 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setAddingDept(false)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.background, borderRadius: 4 }}
                    >
                      <Text style={{ color: Colors.textPrimary, fontSize: 12 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateAccount}>
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={styles.createBtnText}>Create Account</Text>
            </TouchableOpacity>
          </Card>

          {/* Department Logos Section */}
          <Card style={[styles.userCard, { marginBottom: Spacing.xl }]}>
            <View style={styles.userListHeader}>
              <Text style={styles.sectionHeader}>Department Logos</Text>
            </View>
            <Text style={{ color: Colors.textSecondary, marginBottom: 16 }}>Upload a logo for each department. Used across the platform.</Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              {departmentsList.filter((d: any) => !d.is_system).map((dept: any) => (
                <View key={dept.id} style={{ width: 140, height: 160, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
                  <TouchableOpacity 
                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}
                    onPress={() => handleUploadDeptLogo(dept.id)}
                    disabled={uploadingDeptId === dept.id}
                  >
                    {uploadingDeptId === dept.id ? (
                      <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>Uploading...</Text>
                    ) : dept.logo_url ? (
                      <Image source={{ uri: dept.logo_url }} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={24} color={Colors.textMuted} style={{ marginBottom: 8 }} />
                        <Text style={{ fontSize: 10, color: Colors.textMuted }}>Tap to upload</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, borderTopWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textPrimary, flex: 1 }} numberOfLines={1}>{dept.display_name}</Text>
                    <TouchableOpacity onPress={() => handleDeleteDepartmentFromSystem(dept.id)}>
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Card>

          <Card style={styles.userCard}>
            <View style={styles.userListHeader}>
              <Text style={styles.sectionHeader}>Institutional Accounts ({filteredUsers.length})</Text>
              <TextInput style={styles.searchInput} placeholder="Search by email..." value={userFilter} onChangeText={setUserFilter} />
            </View>
            {filteredUsers.map((u) => {
              const badge = getRoleBadgeDetails(u.role);
              // Find matching department logo
              const userDept = departmentsList.find((d: any) =>
                d.display_name === u.department || d.name === u.department
              );
              const deptLogoUrl = userDept ? getDeptLogo(userDept.id) : null;
              return (
                <TouchableOpacity key={u.id} style={styles.userRow} onPress={() => handleOpenProfile(u)} activeOpacity={0.7}>
                  <View style={styles.userInfo}>
                    {deptLogoUrl ? (
                      <Image source={{ uri: deptLogoUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} resizeMode="cover" />
                    ) : (
                      <View style={[styles.userAvatar, { backgroundColor: badge.bgColor }]}>
                        <Text style={[styles.userAvatarText, { color: badge.color }]}>
                          {u.first_name ? (u.first_name[0] + (u.last_name?.[0] || '')).toUpperCase() : u.email.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userEmail}>
                        {u.first_name ? `${u.first_name} ${u.last_name}` : u.email}
                      </Text>
                      <Text style={styles.userMeta}>
                        {u.department ? `${u.department} • ` : ''}{u.role ? getRoleBadgeDetails(u.role).label : ''} • {u.created_at}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.userActions}>
                    <View style={[styles.roleBadge, { backgroundColor: badge.bgColor }]}>
                      <Text style={[styles.roleBadgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                    <TouchableOpacity style={styles.editBtn} onPress={(e: any) => { e.stopPropagation?.(); handleOpenProfile(u); }}>
                      <Ionicons name="pencil-outline" size={15} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={(e: any) => { e.stopPropagation?.(); handleDeleteUser(u.id); }}>
                      <Ionicons name="trash-outline" size={15} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Card>

          {/* Delete User Confirmation Modal */}
          <Modal
            visible={confirmDeleteUserId !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setConfirmDeleteUserId(null)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: 340, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 }}>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Ionicons name="trash-outline" size={24} color="#DC2626" />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 }}>Delete Account?</Text>
                  <Text style={{ fontSize: 13, color: Colors.textSecondary, textAlign: 'center' }}>
                    <Text>Are you sure you want to delete </Text>
                    <Text style={{ fontWeight: '600', color: Colors.textPrimary }}>{confirmDeleteUserEmail}</Text>
                    <Text>? This action cannot be undone.</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setConfirmDeleteUserId(null)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.background, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirmDeleteUser}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#DC2626', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Yes, Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* ── Profile Settings Modal (Wide Layout, No Scroll) ── */}
          <Modal
            visible={selectedUser !== null}
            transparent
            animationType="fade"
            onRequestClose={handleCloseProfile}
          >
            <View style={styles.profileModalOverlay}>
              <View style={[styles.wideModalCard, { width: width > 900 ? 860 : width > 600 ? '92%' : '94%', maxHeight: width > 600 ? '88%' : '90%' }]}>
                {/* ── Header ── */}
                <View style={styles.wideModalHeader}>
                  <View style={[styles.wideModalAvatar, { backgroundColor: selectedUser ? getRoleBadgeDetails(selectedUser.role).bgColor : Colors.background }]}>
                    <Text style={[styles.wideModalAvatarText, { color: selectedUser ? getRoleBadgeDetails(selectedUser.role).color : Colors.textPrimary }]}>
                      {selectedUser
                        ? (selectedUser.first_name
                          ? (selectedUser.first_name[0] + (selectedUser.last_name?.[0] || '')).toUpperCase()
                          : selectedUser.email.substring(0, 2).toUpperCase())
                        : '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wideModalTitle}>
                      {selectedUser?.first_name ? `${selectedUser.first_name} ${selectedUser.last_name}` : selectedUser?.email}
                    </Text>
                    <Text style={styles.wideModalSubtitle}>
                      {selectedUser ? getRoleBadgeDetails(selectedUser.role).label : ''} &nbsp;•&nbsp; ID: {selectedUser?.employee_id || 'N/A'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleCloseProfile} style={styles.wideModalCloseBtn}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* ── Two-Column Body (no scroll) ── */}
                <View style={[styles.wideModalBody, width <= 600 && { flexDirection: 'column', overflow: 'scroll' } as any]}>
                  {/* ── LEFT COLUMN ── */}
                  <View style={[styles.wideModalColumn, width <= 600 && { borderRightWidth: 0 }]}>
                    {/* Personal Information */}
                    <View style={styles.wideModalSection}>
                      <Text style={styles.wideSectionTitle}>Personal Information</Text>
                      <View style={styles.wideFieldRow}>
                        <View style={styles.wideFieldHalf}>
                          <Text style={styles.wideFieldLabel}>First Name</Text>
                          <TextInput style={styles.wideFieldInput} value={profileFirstName} onChangeText={setProfileFirstName} placeholder="First name" />
                        </View>
                        <View style={styles.wideFieldHalf}>
                          <Text style={styles.wideFieldLabel}>Last Name</Text>
                          <TextInput style={styles.wideFieldInput} value={profileLastName} onChangeText={setProfileLastName} placeholder="Last name" />
                        </View>
                      </View>
                      <View style={styles.wideFieldRow}>
                        <View style={styles.wideFieldHalf}>
                          <Text style={styles.wideFieldLabel}>Middle Name</Text>
                          <TextInput style={styles.wideFieldInput} value={profileMiddleName} onChangeText={setProfileMiddleName} placeholder="(Optional)" />
                        </View>
                        <View style={styles.wideFieldHalf}>
                          <Text style={styles.wideFieldLabel}>Phone</Text>
                          <TextInput style={styles.wideFieldInput} value={profilePhone} onChangeText={setProfilePhone} placeholder="(Optional)" />
                        </View>
                      </View>
                    </View>

                    {/* Contact & Work */}
                    <View style={styles.wideModalSection}>
                      <Text style={styles.wideSectionTitle}>Contact & Work</Text>
                      <View style={styles.wideFieldRow}>
                        <View style={styles.wideFieldFull}>
                          <Text style={styles.wideFieldLabel}>Email Address</Text>
                          <TextInput style={styles.wideFieldInput} value={profileEmail} onChangeText={setProfileEmail} autoCapitalize="none" keyboardType="email-address" />
                        </View>
                      </View>
                      <View style={styles.wideFieldRow}>
                        <View style={styles.wideFieldHalf}>
                          <Text style={styles.wideFieldLabel}>Department</Text>
                          <select
                            value={profileDepartment}
                            onChange={(e: any) => setProfileDepartment(e.target.value)}
                            style={styles.wideFieldSelect}
                          >
                            {departmentsList.map((d: any) => <option key={d.id} value={d.display_name}>{d.display_name}</option>)}
                          </select>
                        </View>
                        <View style={styles.wideFieldHalf}>
                          <Text style={styles.wideFieldLabel}>Position</Text>
                          <TextInput style={styles.wideFieldInput} value={profilePosition} onChangeText={setProfilePosition} placeholder="(Optional)" />
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* ── RIGHT COLUMN ── */}
                  <View style={[styles.wideModalColumn, styles.wideModalColumnRight, width <= 600 && { borderLeftWidth: 0, paddingTop: 0 }]}>
                    {/* Account Settings */}
                    <View style={styles.wideModalSection}>
                      <Text style={styles.wideSectionTitle}>Account Settings</Text>
                      <View style={styles.wideFieldRow}>
                        <View style={styles.wideFieldFull}>
                          <Text style={styles.wideFieldLabel}>Role</Text>
                          <select
                            value={profileRole}
                            onChange={(e: any) => setProfileRole(e.target.value)}
                            style={styles.wideFieldSelect}
                          >
                            {ROLE_CATEGORIES.filter(opt => opt.value !== 'admin').map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </View>
                      </View>
                      <View style={styles.wideFieldRow}>
                        <View style={styles.wideFieldFull}>
                          <Text style={styles.wideFieldLabel}>Status</Text>
                          <View style={styles.wideStatusRow}>
                            <TouchableOpacity
                              style={[styles.wideStatusToggle, profileStatus === 'active' && styles.wideStatusActive]}
                              onPress={() => setProfileStatus('active')}
                            >
                              <View style={[styles.wideStatusDot, { backgroundColor: '#16A34A' }]} />
                              <Text style={[styles.wideStatusText, profileStatus === 'active' && { color: '#fff' }]}>Active</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.wideStatusToggle, profileStatus === 'inactive' && styles.wideStatusInactive]}
                              onPress={() => setProfileStatus('inactive')}
                            >
                              <View style={[styles.wideStatusDot, { backgroundColor: '#DC2626' }]} />
                              <Text style={[styles.wideStatusText, profileStatus === 'inactive' && { color: '#fff' }]}>Inactive</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Change Password */}
                    <View style={styles.wideModalSection}>
                      <Text style={styles.wideSectionTitle}>Change Password</Text>
                      <Text style={styles.wideFormHint}>Leave blank to keep current</Text>
                      <View style={styles.wideFieldRow}>
                        <View style={styles.wideFieldFull}>
                          <Text style={styles.wideFieldLabel}>New Password</Text>
                          <View style={styles.widePasswordWrapper}>
                            <TextInput
                              style={styles.widePasswordInput}
                              secureTextEntry={!showProfilePassword}
                              value={profilePassword}
                              onChangeText={setProfilePassword}
                              placeholder="Min. 8 characters"
                              autoCapitalize="none"
                            />
                            <TouchableOpacity style={styles.widePasswordToggle} onPress={() => setShowProfilePassword(!showProfilePassword)}>
                              <Ionicons name={showProfilePassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                      <View style={styles.wideFieldRow}>
                        <View style={styles.wideFieldFull}>
                          <Text style={styles.wideFieldLabel}>Confirm Password</Text>
                          <View style={styles.widePasswordWrapper}>
                            <TextInput
                              style={styles.widePasswordInput}
                              secureTextEntry={!showProfilePasswordConfirm}
                              value={profilePasswordConfirmation}
                              onChangeText={setProfilePasswordConfirmation}
                              placeholder="Re-enter password"
                              autoCapitalize="none"
                            />
                            <TouchableOpacity style={styles.widePasswordToggle} onPress={() => setShowProfilePasswordConfirm(!showProfilePasswordConfirm)}>
                              <Ionicons name={showProfilePasswordConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* ── Footer Actions ── */}
                <View style={styles.wideModalFooter}>
                  <TouchableOpacity style={styles.wideCancelBtn} onPress={handleCloseProfile}>
                    <Text style={styles.wideCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.wideSaveBtn, savingProfile && { opacity: 0.6 }]} onPress={handleSaveProfile} disabled={savingProfile}>
                    <Ionicons name="save-outline" size={16} color="#fff" />
                    <Text style={styles.wideSaveBtnText}>{savingProfile ? 'Saving...' : 'Save Changes'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {activeTab === 'tokens' && !isInitialLoading && (
        <View style={{ gap: 20 }}>
          <Card style={styles.userCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View>
                <Text style={styles.sectionHeader}>Platform Tokens</Text>
                <Text style={styles.policyNote}>Manage API tokens for Facebook, Instagram, and WordPress integration.</Text>
              </View>
              {(tokenLastUpdated && tokenLastUpdated !== 'Never') ? (
                <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                  <Text style={{ fontSize: 11, color: '#1e40af', fontWeight: '500' }}>
                    Last updated: {new Date(tokenLastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>
          <Card style={styles.userCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Ionicons name="logo-facebook" size={24} color="#1877F2" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>Facebook</Text>
            </View>
            <View style={{ gap: 14 }}>
              {[
                { key: 'facebook_page_id', label: 'Page ID', icon: 'id-card-outline' as const, placeholder: 'e.g. 344674548722841' },
                { key: 'facebook_access_token', label: 'Access Token', icon: 'lock-closed-outline' as const, placeholder: 'Enter your Facebook page access token', sensitive: true },
              ].map(field => (
                <View key={field.key} style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textPrimary, textTransform: 'uppercase' }}>{field.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={{
                        flex: 1,
                        backgroundColor: '#f9fafb',
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        borderRadius: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        fontSize: 14,
                        color: Colors.textPrimary,
                        outlineStyle: 'none',
                      } as any}
                      placeholder={field.placeholder}
                      placeholderTextColor="#9ca3af"
                      value={(tokenFields as any)[field.key]}
                      secureTextEntry={field.sensitive && !showTokenField[field.key]}
                      onChangeText={(v) => setTokenFields(prev => ({ ...prev, [field.key]: v }))}
                    />
                    {field.sensitive ? (
                      <TouchableOpacity onPress={() => toggleTokenVisibility(field.key)} style={{ padding: 8 }}>
                        <Ionicons name={showTokenField[field.key] ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => handleSavePlatformTokens('facebook')}
              disabled={savingTokens}
              style={{
                marginTop: 16,
                backgroundColor: '#1877F2',
                paddingVertical: 11,
                borderRadius: 8,
                alignItems: 'center',
                opacity: savingTokens ? 0.7 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                {savingTokens ? 'Saving...' : 'Save Facebook Tokens'}
              </Text>
            </TouchableOpacity>
          </Card>
          <Card style={styles.userCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Ionicons name="logo-instagram" size={24} color="#E1306C" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>Instagram</Text>
            </View>
            <View style={{ gap: 14 }}>
              {[
                { key: 'instagram_business_account_id', label: 'Business Account ID', icon: 'id-card-outline' as const, placeholder: 'e.g. 17841405822304' },
                { key: 'instagram_access_token', label: 'Access Token', icon: 'lock-closed-outline' as const, placeholder: 'Enter your Instagram access token', sensitive: true },
              ].map(field => (
                <View key={field.key} style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textPrimary, textTransform: 'uppercase' }}>{field.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={{
                        flex: 1,
                        backgroundColor: '#f9fafb',
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        borderRadius: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        fontSize: 14,
                        color: Colors.textPrimary,
                        outlineStyle: 'none',
                      } as any}
                      placeholder={field.placeholder}
                      placeholderTextColor="#9ca3af"
                      value={(tokenFields as any)[field.key]}
                      secureTextEntry={field.sensitive && !showTokenField[field.key]}
                      onChangeText={(v) => setTokenFields(prev => ({ ...prev, [field.key]: v }))}
                    />
                    {field.sensitive ? (
                      <TouchableOpacity onPress={() => toggleTokenVisibility(field.key)} style={{ padding: 8 }}>
                        <Ionicons name={showTokenField[field.key] ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => handleSavePlatformTokens('instagram')}
              disabled={savingTokens}
              style={{
                marginTop: 16,
                backgroundColor: '#E1306C',
                paddingVertical: 11,
                borderRadius: 8,
                alignItems: 'center',
                opacity: savingTokens ? 0.7 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                {savingTokens ? 'Saving...' : 'Save Instagram Tokens'}
              </Text>
            </TouchableOpacity>
          </Card>
          <Card style={styles.userCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Ionicons name="globe-outline" size={24} color="#3B82F6" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>WordPress</Text>
            </View>
            <View style={{ gap: 14 }}>
              {[
                { key: 'wordpress_url', label: 'Site URL', icon: 'link-outline' as const, placeholder: 'https://your-school.edu/wp-json/wp/v2' },
                { key: 'wordpress_username', label: 'Username', icon: 'person-outline' as const, placeholder: 'WordPress username' },
                { key: 'wordpress_app_password', label: 'Application Password', icon: 'lock-closed-outline' as const, placeholder: 'Enter WordPress app password', sensitive: true },
              ].map(field => (
                <View key={field.key} style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textPrimary, textTransform: 'uppercase' }}>{field.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={{
                        flex: 1,
                        backgroundColor: '#f9fafb',
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        borderRadius: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        fontSize: 14,
                        color: Colors.textPrimary,
                        outlineStyle: 'none',
                      } as any}
                      placeholder={field.placeholder}
                      placeholderTextColor="#9ca3af"
                      value={(tokenFields as any)[field.key]}
                      secureTextEntry={field.sensitive && !showTokenField[field.key]}
                      onChangeText={(v) => setTokenFields(prev => ({ ...prev, [field.key]: v }))}
                    />
                    {field.sensitive ? (
                      <TouchableOpacity onPress={() => toggleTokenVisibility(field.key)} style={{ padding: 8 }}>
                        <Ionicons name={showTokenField[field.key] ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => handleSavePlatformTokens('wordpress')}
              disabled={savingTokens}
              style={{
                marginTop: 16,
                backgroundColor: '#3B82F6',
                paddingVertical: 11,
                borderRadius: 8,
                alignItems: 'center',
                opacity: savingTokens ? 0.7 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                {savingTokens ? 'Saving...' : 'Save WordPress Tokens'}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>
      )}

      {/* ── EMAIL SETTINGS TAB ── */}
      {activeTab === 'developer-api' && !isInitialLoading && (
        <View style={{ gap: 20 }}>
          <Card style={styles.userCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary }}>Developer API Tokens</Text>
                <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 4 }}>Manage tokens for external system integrations.</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <TextInput
                style={[styles.searchInput, { flex: 1, backgroundColor: '#F9FAFB' }]}
                placeholder="Token Name (e.g. Main Website)"
                value={newTokenName}
                onChangeText={setNewTokenName}
              />
              <TouchableOpacity
                style={{ backgroundColor: '#0B2545', paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center' }}
                onPress={generateApiToken}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Generate Token</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: Colors.background, paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setShowApiDocs(true)}
              >
                <Ionicons name="document-text-outline" size={18} color="#4B5563" />
                <Text style={{ color: '#4B5563', fontWeight: '600' }}>API Docs</Text>
              </TouchableOpacity>
            </View>

            <Modal visible={!!generatedToken} transparent animationType="fade">
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ backgroundColor: '#fff', width: '100%', maxWidth: 450, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
                  <View style={{ backgroundColor: '#0B2545', padding: 24, alignItems: 'center' }}>
                    <Ionicons name="key-outline" size={48} color="#FFC72C" />
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 12, fontFamily: 'Kameron_700Bold' }}>Token Generated Successfully!</Text>
                  </View>
                  <View style={{ padding: 24 }}>
                    <Text style={{ color: '#4B5563', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
                      Please copy your new developer token now. For your security, <Text style={{ fontWeight: '700', color: '#EF4444' }}>it will never be shown again</Text>.
                    </Text>
                    
                    <View style={{ backgroundColor: Colors.background, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 24 }}>
                      <Text selectable style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: Colors.textPrimary, fontSize: 16, textAlign: 'center', fontWeight: '500' }}>
                        {generatedToken?.plain_text_token}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={{ backgroundColor: '#0B2545', paddingVertical: 14, borderRadius: 8, alignItems: 'center' }}
                      onPress={() => setGeneratedToken(null)}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>I've copied it</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Revoke Confirmation Modal */}
            <Modal visible={!!revokeConfirmId} transparent animationType="fade">
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ backgroundColor: '#fff', width: '100%', maxWidth: 450, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
                  <View style={{ backgroundColor: '#DC2626', padding: 24, alignItems: 'center' }}>
                    <Ionicons name="warning-outline" size={48} color="#FEF2F2" />
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 12, fontFamily: 'Kameron_700Bold' }}>Revoke API Token</Text>
                  </View>
                  <View style={{ padding: 24 }}>
                    <Text style={{ color: '#4B5563', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
                      Are you sure you want to revoke this API token? Any applications using it will <Text style={{ fontWeight: '700', color: '#DC2626' }}>lose access immediately</Text>. This action cannot be undone.
                    </Text>
                    
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: Colors.background, paddingVertical: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.border }}
                        onPress={() => setRevokeConfirmId(null)}
                      >
                        <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 15 }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: '#DC2626', paddingVertical: 14, borderRadius: 8, alignItems: 'center' }}
                        onPress={executeRevokeToken}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Yes, Revoke</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </Modal>

            {/* API Documentation Modal */}
            <Modal visible={showApiDocs} transparent animationType="fade">
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ backgroundColor: '#fff', width: '100%', maxWidth: 700, maxHeight: '90%', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0B2545', paddingHorizontal: 24, paddingVertical: 18 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="document-text" size={24} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', fontFamily: 'Kameron_700Bold' }}>API Integration Guide</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowApiDocs(false)} style={{ padding: 4 }}>
                      <Ionicons name="close" size={24} color="#CBD5E1" />
                    </TouchableOpacity>
                  </View>
                  
                  <ScrollView style={{ padding: 24 }}>
                    <Text style={{ fontSize: 15, color: Colors.textPrimary, marginBottom: 20, lineHeight: 24 }}>
                      To submit a new Post Request automatically from an external system (like a main university website), you must send an HTTP <Text style={{ fontWeight: '700' }}>POST</Text> request to the endpoint below and include a valid Developer API Token in the <Text style={{ fontWeight: '700' }}>Authorization</Text> header.
                    </Text>

                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Endpoint URL</Text>
                    <View style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <Text selectable style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#0F172A', fontSize: 14 }}>
                        POST {typeof window !== 'undefined' ? window.location.origin : 'https://jmcfi-postflow-production-f5e6.up.railway.app'}/api/external/submit-request
                      </Text>
                    </View>

                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Example: JavaScript (Fetch)</Text>
                    <View style={{ backgroundColor: '#1E293B', padding: 16, borderRadius: 8, marginBottom: 24 }}>
                      <Text selectable style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#E2E8F0', fontSize: 13, lineHeight: 20 }}>
                        {`fetch('${typeof window !== 'undefined' ? window.location.origin : 'https://jmcfi-postflow-production-f5e6.up.railway.app'}/api/external/submit-request', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  },
  body: JSON.stringify({
    title: "Emergency Campus Alert!",
    caption_narrative: "Campus is closed due to heavy rain.",
    target_platforms: ["facebook"],
    image_url: "https://jmcfi.edu.ph/images/alert.jpg",
    publish_direct: true // <--- Set to true to bypass approvers!
  })
})`}
                      </Text>
                    </View>

                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Example: PHP (cURL)</Text>
                    <View style={{ backgroundColor: '#1E293B', padding: 16, borderRadius: 8, marginBottom: 24 }}>
                      <Text selectable style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#E2E8F0', fontSize: 13, lineHeight: 20 }}>
                        {`$ch = curl_init('${typeof window !== 'undefined' ? window.location.origin : 'https://jmcfi-postflow-production-f5e6.up.railway.app'}/api/external/submit-request');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
  "title" => "New Campus Event!",
  "caption_narrative" => "Join us this Friday...",
  "target_platforms" => ["facebook"],
  "image_url" => "https://example.com/image.jpg"
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Content-Type: application/json',
  'Accept: application/json',
  'Authorization: Bearer YOUR_TOKEN_HERE'
]);
$response = curl_exec($ch);`}
                      </Text>
                    </View>

                    <View style={{ backgroundColor: '#FEF2F2', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#FECACA', marginBottom: 20 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Ionicons name="shield-checkmark" size={16} color="#DC2626" />
                        <Text style={{ fontWeight: '700', color: '#991B1B', fontSize: 13 }}>Security Note</Text>
                      </View>
                      <Text style={{ color: '#7F1D1D', fontSize: 13, lineHeight: 20 }}>
                        If a token is compromised, click "Revoke" on the dashboard. Any applications using that token will instantly lose access and be unable to submit further requests.
                      </Text>
                    </View>
                  </ScrollView>
                </View>
              </View>
            </Modal>

            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border }}>
              <View style={{ flexDirection: 'row', padding: 12, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                <Text style={{ flex: 2, fontWeight: '600', color: Colors.textPrimary, fontSize: 12 }}>NAME</Text>
                <Text style={{ flex: 1, fontWeight: '600', color: Colors.textPrimary, fontSize: 12 }}>CREATED</Text>
                <Text style={{ flex: 1, fontWeight: '600', color: Colors.textPrimary, fontSize: 12 }}>LAST USED</Text>
                <Text style={{ width: 80, fontWeight: '600', color: Colors.textPrimary, fontSize: 12, textAlign: 'right' }}>ACTION</Text>
              </View>
              
              {apiTokens.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Ionicons name="key-outline" size={32} color="#9CA3AF" style={{ marginBottom: 8 }} />
                  <Text style={{ color: Colors.textSecondary }}>No API tokens generated yet.</Text>
                </View>
              ) : (
                apiTokens.map((token: any) => (
                  <View key={token.id} style={{ flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.background, alignItems: 'center' }}>
                    <Text style={{ flex: 2, color: Colors.textPrimary, fontWeight: '500' }}>{token.name}</Text>
                    <Text style={{ flex: 1, color: Colors.textSecondary, fontSize: 13 }}>{new Date(token.created_at).toLocaleDateString()}</Text>
                    <Text style={{ flex: 1, color: Colors.textSecondary, fontSize: 13 }}>{token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : 'Never'}</Text>
                    <TouchableOpacity
                      style={{ width: 80, alignItems: 'flex-end' }}
                      onPress={() => requestRevokeToken(token.id)}
                    >
                      <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>Revoke</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </Card>
        </View>
      )}

      {activeTab === 'email-settings' && !isInitialLoading && (
        <View style={{ gap: 20 }}>
          {/* Header */}
          <Card style={styles.userCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="mail" size={22} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionHeader, { marginBottom: 2 }]}>Email Notification Settings</Text>
                <Text style={styles.policyNote}>Configure the SMTP server used to send approval, publishing, and alert emails to users and admins.</Text>
              </View>
            </View>
          </Card>

          {/* SMTP Configuration */}
          <Card style={styles.userCard}>
            <Text style={[styles.sectionHeader, { marginBottom: 4 }]}>Gmail SMTP Configuration</Text>
            <Text style={[styles.policyNote, { marginBottom: 16 }]}>
              Use your school Gmail account to send emails. You need to generate an App Password from{' '}
              <Text style={{ color: '#2563EB' }}>Google Account → Security → App Passwords</Text>.
            </Text>

            {/* Host + Port Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
              <View style={{ flex: 2 }}>
                <Text style={styles.fieldLabel}>SMTP Host</Text>
                <TextInput
                  style={styles.input}
                  value={emailFields.mail_host}
                  onChangeText={v => setEmailFields(p => ({ ...p, mail_host: v }))}
                  placeholder="smtp.gmail.com"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Port</Text>
                <TextInput
                  style={styles.input}
                  value={emailFields.mail_port}
                  onChangeText={v => setEmailFields(p => ({ ...p, mail_port: v }))}
                  placeholder="587"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Encryption */}
            <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Encryption</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {['tls', 'ssl', ''].map(enc => (
                <TouchableOpacity
                  key={enc || 'none'}
                  onPress={() => setEmailFields(p => ({ ...p, mail_encryption: enc }))}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
                    backgroundColor: emailFields.mail_encryption === enc ? '#2563EB' : '#F1F5F9',
                  }}
                >
                  <Text style={{ color: emailFields.mail_encryption === enc ? '#fff' : '#64748B', fontSize: 13, fontWeight: '600' }}>
                    {enc === '' ? 'None' : enc.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Username */}
            <Text style={styles.fieldLabel}>Gmail Username (Email Address)</Text>
            <TextInput
              style={[styles.input, { marginBottom: 14 }]}
              value={emailFields.mail_username}
              onChangeText={v => setEmailFields(p => ({ ...p, mail_username: v }))}
              placeholder="your-school-email@gmail.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Password */}
            <Text style={styles.fieldLabel}>
              Gmail App Password{' '}
              {emailPasswordSet && <Text style={{ color: '#059669', fontSize: 11 }}>✓ Password is set</Text>}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <TextInput
                style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                value={emailFields.mail_password}
                onChangeText={v => setEmailFields(p => ({ ...p, mail_password: v }))}
                placeholder={emailPasswordSet ? '••••••••••••••• (Leave blank to keep current)' : 'Enter Gmail App Password'}
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showEmailPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowEmailPassword(p => !p)}
                style={{ backgroundColor: '#F1F5F9', padding: 12, borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 0, borderTopRightRadius: 8, borderBottomRightRadius: 8 }}
              >
                <Ionicons name={showEmailPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#94A3B8', fontSize: 11, marginBottom: 14 }}>
              Not your regular Gmail password — generate an App Password from Google Account → Security.
            </Text>
          </Card>

          {/* From Address */}
          <Card style={styles.userCard}>
            <Text style={[styles.sectionHeader, { marginBottom: 4 }]}>Sender Identity</Text>
            <Text style={[styles.policyNote, { marginBottom: 14 }]}>The name and email address that recipients will see in their inbox.</Text>

            <Text style={styles.fieldLabel}>From Name</Text>
            <TextInput
              style={[styles.input, { marginBottom: 14 }]}
              value={emailFields.mail_from_name}
              onChangeText={v => setEmailFields(p => ({ ...p, mail_from_name: v }))}
              placeholder="JMCFI PostFlow"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>From Email Address</Text>
            <TextInput
              style={[styles.input, { marginBottom: 14 }]}
              value={emailFields.mail_from_address}
              onChangeText={v => setEmailFields(p => ({ ...p, mail_from_address: v }))}
              placeholder="postflow@jmc.edu.ph"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Card>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={handleTestEmail}
              disabled={testingEmail}
              style={{
                flex: 1, paddingVertical: 13, borderRadius: 10,
                backgroundColor: '#EFF6FF',
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                opacity: testingEmail ? 0.7 : 1,
              }}
            >
              <Ionicons name="send-outline" size={16} color="#2563EB" />
              <Text style={{ color: '#2563EB', fontSize: 13, fontWeight: '700' }}>
                {testingEmail ? 'Sending...' : 'Send Test Email'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveEmailSettings}
              disabled={savingEmail}
              style={{
                flex: 1, paddingVertical: 13, borderRadius: 10,
                backgroundColor: '#2563EB',
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                opacity: savingEmail ? 0.7 : 1,
              }}
            >
              <Ionicons name="save-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                {savingEmail ? 'Saving...' : 'Save Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── POLICY RULES TAB ── */}
      {activeTab === 'policy-rules' && !isInitialLoading && (
        <View style={styles.policyRulesContainer}>
          {/* Header Row */}
          <View style={styles.policyHeaderRow}>
            {isEditingPolicyMode ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 260, flexWrap: 'wrap' }}>
                <View style={styles.editingModeBadge}>
                  <Ionicons name="pencil" size={14} color="#7C3AED" />
                  <Text style={styles.editingModeBadgeText}>Editing Mode</Text>
                </View>
                <Text style={styles.editingModeSubText}>Make changes to the policy rules. Don't forget to save your changes.</Text>
              </View>
            ) : (
              <View style={{ flex: 1, minWidth: 260 }}>
                <Text style={styles.policyMainTitle}>POLICY RULES</Text>
                <Text style={styles.policySubTitle}>Guidelines for publishing official school website content.</Text>
              </View>
            )}

            <View style={styles.policyHeaderActions}>
              {isEditingPolicyMode ? (
                <>
                  <TouchableOpacity
                    style={styles.cancelEditBtn}
                    onPress={() => {
                      if (policySections) setEditableSections(JSON.parse(JSON.stringify(policySections)));
                      setIsEditingPolicyMode(false);
                    }}
                  >
                    <Ionicons name="arrow-back" size={15} color="#7C3AED" />
                    <Text style={styles.cancelEditBtnText}>CANCEL EDIT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveChangesBtn}
                    onPress={async () => {
                      const success = await updatePolicy(editableEffectiveDate, editableLastUpdatedDate, editableSections);
                      if (success) {
                        setIsEditingPolicyMode(false);
                        Alert.alert('Success', 'Policy rules saved successfully!');
                      }
                    }}
                  >
                    <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.saveChangesBtnText}>SAVE CHANGES</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.editRulesBtn}
                  onPress={() => setIsEditingPolicyMode(true)}
                >
                  <Ionicons name="create-outline" size={16} color="#7C3AED" />
                  <Text style={styles.editRulesBtnText}>EDIT RULES</Text>
                </TouchableOpacity>
              )}

              <View style={styles.policySearchBox}>
                <TextInput
                  placeholder="Search policy rules..."
                  placeholderTextColor="#9CA3AF"
                  value={policySearchQuery}
                  onChangeText={setPolicySearchQuery}
                  style={styles.policySearchInput}
                />
                <Ionicons name="search" size={16} color="#6B7280" />
              </View>
            </View>
          </View>

          {/* Render Sections matching Mockup */}
          {editableSections
            .filter((section) => {
              if (!policySearchQuery.trim()) return true;
              const query = policySearchQuery.toLowerCase();
              const titleMatch = section.title?.toLowerCase().includes(query);
              const contentMatch = section.content?.toLowerCase().includes(query);
              const bulletMatch = section.bullets?.some((b: any) =>
                b.title?.toLowerCase().includes(query) || (b.desc || b.description)?.toLowerCase().includes(query)
              );
              return titleMatch || contentMatch || bulletMatch;
            })
            .map((section, sIdx) => {
              // Parse number and clean title
              const numMatch = section.title?.match(/^(\d+)\.\s*(.*)$/);
              const secNumber = numMatch ? numMatch[1] : `${sIdx + 1}`;
              const secCleanTitle = numMatch ? numMatch[2] : section.title;

              let badgeBg = '#0B2545';
              let cardIconName: any = 'checkmark';
              let cardIconBg = '#F3E8FF';
              let cardIconColor = '#7C3AED';
              let cardAccentColor = '#7C3AED';

              if (secNumber === '2') {
                badgeBg = '#7C3AED';
                cardIconName = 'checkmark';
                cardIconBg = '#F3E8FF';
                cardIconColor = '#7C3AED';
                cardAccentColor = '#7C3AED';
              } else if (secNumber === '3') {
                badgeBg = '#16A34A';
                cardIconName = 'checkmark';
                cardIconBg = '#DCFCE7';
                cardIconColor = '#16A34A';
                cardAccentColor = '#16A34A';
              } else if (secNumber === '4') {
                badgeBg = '#DC2626';
                cardIconName = 'close';
                cardIconBg = '#FEE2E2';
                cardIconColor = '#DC2626';
                cardAccentColor = '#DC2626';
              } else if (secNumber === '5') {
                badgeBg = '#0B2545';
                cardIconName = 'copy-outline';
                cardIconBg = '#FEF3C7';
                cardIconColor = '#D97706';
                cardAccentColor = '#D97706';
              }

              return (
                <View key={section.id || sIdx} style={styles.policySectionBlock}>
                  {/* Numbered Section Header */}
                  <View style={styles.policySectionHeaderRow}>
                    <View style={[styles.policyNumberBadge, { backgroundColor: badgeBg }]}>
                      <Text style={styles.policyNumberBadgeText}>{secNumber}</Text>
                    </View>
                    <Text style={styles.policySectionTitleText}>{secCleanTitle}</Text>
                  </View>

                  {/* Section Content Rendering */}
                  {secNumber === '1' ? (
                    <Card style={styles.policyStatementCard}>
                      <View style={[styles.policyCardIconSquare, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="book-outline" size={18} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12, marginBottom: 4 }}>
                          <Text style={styles.policyStatementTitle}>Policy statement</Text>
                        </View>
                        {isEditingPolicyMode ? (
                          <RichTextEditor
                            value={section.content || ''}
                            onChange={(val) => {
                              const updated = [...editableSections];
                              updated[sIdx] = { ...updated[sIdx], content: val };
                              setEditableSections(updated);
                            }}
                          />
                        ) : (
                          <FormattedText style={styles.policyStatementBody}>
                            {section.content || 'This policy governs all content published on the official Jose Maria College Foundation, Inc. website (jcm.edu.ph). It applies to all faculty, staff, students, and authorized contributors (“Posters”). The goal is to ensure a cohesive, safe, and professionally branded digital presence.'}
                          </FormattedText>
                        )}
                      </View>
                    </Card>
                  ) : (section.bullets && section.bullets.length > 0) || (section.steps && section.steps.length > 0) ? (
                    <View style={styles.policyGridRow}>
                      {(section.bullets || section.steps || [])
                        .filter((b: any) => {
                          if (!policySearchQuery.trim()) return true;
                          const query = policySearchQuery.toLowerCase();
                          return b.title?.toLowerCase().includes(query) || (b.desc || b.description)?.toLowerCase().includes(query);
                        })
                        .map((bullet: any, bIdx: number) => (
                          <Card key={bIdx} style={styles.policyGridCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={[styles.policyCardIconSquare, { backgroundColor: cardIconBg }]}>
                                <Ionicons name={cardIconName} size={16} color={cardIconColor} />
                              </View>
                              {isEditingPolicyMode ? (
                                <View style={{ width: '100%', flex: 1 }}>
                                  <RichTextEditor
                                    value={bullet.title || ''}
                                    minHeight={100}
                                    onChange={(val) => {
                                      const updated = [...editableSections];
                                      updated[sIdx] = { ...updated[sIdx] };
                                      if (updated[sIdx].bullets) {
                                        updated[sIdx].bullets = [...updated[sIdx].bullets!];
                                        updated[sIdx].bullets[bIdx] = { ...updated[sIdx].bullets![bIdx], title: val };
                                      } else if (updated[sIdx].steps) {
                                        updated[sIdx].steps = [...updated[sIdx].steps!];
                                        updated[sIdx].steps[bIdx] = { ...updated[sIdx].steps![bIdx], title: val };
                                      }
                                      setEditableSections(updated);
                                    }}
                                  />
                                </View>
                              ) : (
                                <FormattedText style={styles.policyCardTitle}>{bullet.title}</FormattedText>
                              )}
                            </View>
                            {!isEditingPolicyMode && <View style={[styles.policyCardAccentBar, { backgroundColor: cardAccentColor }]} />}

                            {isEditingPolicyMode ? (
                              <View style={{ gap: 6, marginTop: 4 }}>
                                <RichTextEditor
                                  value={bullet.desc || bullet.description || ''}
                                  onChange={(val) => {
                                    const updated = [...editableSections];
                                    updated[sIdx] = { ...updated[sIdx] };
                                    if (updated[sIdx].bullets) {
                                      updated[sIdx].bullets = [...updated[sIdx].bullets!];
                                      updated[sIdx].bullets[bIdx] = { ...updated[sIdx].bullets![bIdx] };
                                      if (updated[sIdx].bullets[bIdx].desc !== undefined) {
                                        updated[sIdx].bullets[bIdx].desc = val;
                                      } else {
                                        updated[sIdx].bullets[bIdx].description = val;
                                      }
                                    } else if (updated[sIdx].steps) {
                                      updated[sIdx].steps = [...updated[sIdx].steps!];
                                      updated[sIdx].steps[bIdx] = { ...updated[sIdx].steps![bIdx], desc: val };
                                    }
                                    setEditableSections(updated);
                                  }}
                                />
                              </View>
                            ) : (
                              <FormattedText style={styles.policyCardDesc}>{bullet.desc || bullet.description}</FormattedText>
                            )}
                          </Card>
                        ))}
                    </View>
                  ) : (
                    <View style={styles.policySimpleContentBox}>
                      {isEditingPolicyMode ? (
                        <View style={{ gap: 6 }}>
                          <RichTextEditor
                            value={section.content || ''}
                            onChange={(val) => {
                              const updated = [...editableSections];
                              updated[sIdx] = { ...updated[sIdx], content: val };
                              setEditableSections(updated);
                            }}
                          />
                        </View>
                      ) : (
                        <FormattedText style={styles.policySimpleContentText}>
                          {section.content || 'Respect copyright laws. Use licensed or original content only and give proper attribution.'}
                        </FormattedText>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
        </View>
      )}

      {/* ── ACCOUNT SETTINGS TAB ── */}
      {activeTab === 'account-settings' && !isInitialLoading && (
        <View style={styles.settingsContainer}>
          <View style={styles.settingsHeaderContainer}>
            <Text style={styles.settingsBreadcrumb}>SETTINGS &gt; ACCOUNT SETTINGS</Text>
            <Text style={styles.settingsMainTitle}>Account Settings</Text>
            <Text style={styles.settingsSubtitle}>Manage your institutional profile picture, credentials, and settings.</Text>
          </View>

          <View style={styles.settingsLayout}>
            {/* Left Column: Profile Information */}
            <Card style={styles.settingsColumnLeft}>
              <View style={styles.settingsCardHeader}>
                <Ionicons name="person" size={18} color={Colors.textPrimary} />
                <Text style={styles.settingsCardTitle}>Profile Information</Text>
              </View>
              <View style={styles.settingsDivider} />

              <View style={styles.profilePictureRow}>
                <View style={styles.profileAvatarLarge}>
                  {profilePhotoUrl ? (
                    <Image source={{ uri: profilePhotoUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} resizeMode="cover" />
                  ) : (
                    <Text style={styles.profileAvatarTextLarge}>{user?.first_name ? (user.first_name[0] + (user.last_name?.[0] || '')).toUpperCase() : 'IT'}</Text>
                  )}
                </View>
                <View style={styles.profilePictureInfo}>
                  <Text style={styles.profilePictureTitle}>Profile Picture</Text>
                  <Text style={styles.profilePictureDesc}>PNG or JPG formats supported. Max 2MB file size.</Text>
                  <View style={styles.profilePictureActions}>
                    <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadProfilePhoto} disabled={uploadingPhoto}>
                      <Text style={styles.uploadBtnText}>{uploadingPhoto ? 'Uploading...' : 'Upload New Photo'}</Text>
                    </TouchableOpacity>
                    {profilePhotoUrl && (
                      <TouchableOpacity style={styles.removeBtn} onPress={handleRemoveProfilePhoto} disabled={uploadingPhoto}>
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>FULL NAME</Text>
                <TextInput style={styles.settingsFormInput} value={acctFullName} onChangeText={setAcctFullName} />
              </View>

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>EMAIL ADDRESS</Text>
                <TextInput
                  value={user?.email || ''}
                  editable={false}
                  style={[styles.settingsFormInput, styles.settingsFormInputDisabled]}
                />
              </View>

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>DEPARTMENT</Text>
                <TextInput
                  value={user?.department || ''}
                  editable={false}
                  style={[styles.settingsFormInput, styles.settingsFormInputDisabled]}
                />
              </View>

              <TouchableOpacity style={styles.saveDetailsBtn} onPress={handleSaveAcctDetails} disabled={savingAcctDetails}>
                <Text style={styles.saveDetailsBtnText}>{savingAcctDetails ? 'Saving...' : 'Save Details'}</Text>
              </TouchableOpacity>
            </Card>

            {/* Right Column: Update Password */}
            <Card style={styles.settingsColumnRight}>
              <View style={styles.settingsCardHeader}>
                <Text style={styles.settingsCardTitle}>Update Password</Text>
              </View>
              <View style={styles.settingsDivider} />

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>CURRENT PASSWORD</Text>
                <TextInput style={styles.settingsFormInput} placeholder="Enter current password" secureTextEntry value={acctCurrentPw} onChangeText={setAcctCurrentPw} />
              </View>

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>NEW PASSWORD</Text>
                <TextInput style={styles.settingsFormInput} placeholder="Enter new password" secureTextEntry value={acctNewPw} onChangeText={setAcctNewPw} />
              </View>

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>CONFIRM PASSWORD</Text>
                <TextInput style={styles.settingsFormInput} placeholder="Confirm new password" secureTextEntry value={acctConfirmPw} onChangeText={setAcctConfirmPw} />
              </View>

              <TouchableOpacity style={styles.saveDetailsBtn} onPress={handleChangeAcctPassword} disabled={savingAcctPw}>
                <Text style={styles.saveDetailsBtnText}>{savingAcctPw ? 'Changing...' : 'Change Password'}</Text>
              </TouchableOpacity>
            </Card>
          </View>
        </View>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === 'analytics' && !isInitialLoading && (() => {
        const monthsData = analyticsOverview?.monthsData && analyticsOverview.monthsData.length > 0
          ? analyticsOverview.monthsData
          : [
            { month: 'Jan', posts: 0 }, { month: 'Feb', posts: 0 }, { month: 'Mar', posts: 0 },
            { month: 'Apr', posts: 0 }, { month: 'May', posts: 0 }, { month: 'Jun', posts: 0 },
            { month: 'Jul', posts: 0 }, { month: 'Aug', posts: 0 }, { month: 'Sep', posts: 0 },
            { month: 'Oct', posts: 0 }, { month: 'Nov', posts: 0 }, { month: 'Dec', posts: 0 }
          ];

        const maxPosts = Math.max(...monthsData.map((d: any) => d.posts), 10);

        return (
          <View style={{ gap: Spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 24, fontWeight: '800', color: Colors.textPrimary }}>System Analytics</Text>
                <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 4 }}>Content creation trends and performance metrics across the year.</Text>
              </View>
            </View>

            {/* Functional Stats Row */}
            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 16 }}>
              {[
                { title: 'Total Submissions', value: analyticsOverview?.totalVolume || '0', subTitle: 'All time volume', icon: 'document-text', color: '#3B82F6', bg: '#EFF6FF' },
                { title: 'Compliance Rate', value: analyticsOverview?.complianceRate || '0%', subTitle: 'Approved vs Rejected', icon: 'shield-checkmark', color: '#10B981', bg: '#ECFDF5' },
                { title: 'Pending Reviews', value: analyticsOverview?.pendingApproval || '0', subTitle: 'Awaiting action', icon: 'time', color: '#F59E0B', bg: '#FEF3C7' },
                { title: 'Active Requestors', value: analyticsOverview?.activeUsers || '0', subTitle: 'Users who submitted posts', icon: 'people', color: '#8B5CF6', bg: '#F5F3FF' }
              ].map(stat => (
                <Card key={stat.title} style={{ flex: 1, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: Colors.surface, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: stat.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textSecondary }}>{stat.title}</Text>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginVertical: 2 }}>{stat.value}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: Colors.textMuted }}>{stat.subTitle}</Text>
                  </View>
                </Card>
              ))}
            </View>

            {/* Main Charts Row */}
            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout, { gap: 24 }]}>

              {/* Yearly Bar Chart */}
              <Card style={[styles.userCard, { flex: 2, padding: 24, backgroundColor: Colors.surface, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, borderTopWidth: 4, borderTopColor: '#7C3AED' }] as any}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary }}>Publication Volume Overview</Text>
                    <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 4 }}>Monthly post submissions for the current year</Text>
                  </View>
                  <View style={{ backgroundColor: '#F3E8FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                    <Text style={{ color: '#7C3AED', fontWeight: 'bold', fontSize: 13 }}>Total Submissions: {analyticsOverview?.totalVolume || '0'}</Text>
                  </View>
                </View>

                {/* Modern Bar Chart Canvas */}
                <View style={{ height: 240, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 30, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', position: 'relative' }}>
                  {/* Grid lines with labels */}
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#E5E7EB', borderStyle: 'dashed' }}><Text style={{ position: 'absolute', top: -8, left: -30, fontSize: 10, color: Colors.textMuted }}>{maxPosts}</Text></View>
                  <View style={{ position: 'absolute', top: 70, left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#E5E7EB', borderStyle: 'dashed' }}><Text style={{ position: 'absolute', top: -8, left: -30, fontSize: 10, color: Colors.textMuted }}>{Math.floor(maxPosts * 0.66)}</Text></View>
                  <View style={{ position: 'absolute', top: 140, left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#E5E7EB', borderStyle: 'dashed' }}><Text style={{ position: 'absolute', top: -8, left: -30, fontSize: 10, color: Colors.textMuted }}>{Math.floor(maxPosts * 0.33)}</Text></View>
                  <Text style={{ position: 'absolute', bottom: 30, left: -20, fontSize: 10, color: Colors.textMuted }}>0</Text>

                  {monthsData.map((item: any, index: number) => {
                    const heightPercent = maxPosts > 0 ? (item.posts / maxPosts) * 100 : 0;
                    return (
                      <View key={item.month} style={{ alignItems: 'center', width: '7%', height: '100%', justifyContent: 'flex-end', zIndex: 10 }}>
                        <Text style={{ fontSize: 11, color: Colors.textSecondary, fontWeight: '700', marginBottom: 8 }}>{item.posts > 0 ? item.posts : ''}</Text>
                        <View style={{ width: '100%', height: `${Math.max(heightPercent, 2)}%`, backgroundColor: index === new Date().getMonth() ? '#7C3AED' : '#C4B5FD', borderRadius: 6, minHeight: 4 }} />
                        <Text style={{ position: 'absolute', bottom: -28, fontSize: 12, color: index === new Date().getMonth() ? '#7C3AED' : Colors.textSecondary, fontWeight: index === new Date().getMonth() ? 'bold' : '500' }}>{item.month}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>

              {/* Department Breakdown */}
              <Card style={[styles.userCard, { flex: 1, padding: 24, backgroundColor: Colors.surface, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 }] as any}>
                <View style={{ width: '100%', alignItems: 'flex-start', marginBottom: 24 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary }}>Top Departments</Text>
                  <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 4 }}>Submission share by department</Text>
                </View>

                <ScrollView style={{ width: '100%', maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                  {(analyticsOverview?.departmentBreakdown || [])
                    .filter((dept: any) => !['IT Office', 'Information Technology Office', 'Vice President for Academic Affairs', 'Institutional Marketing Communication'].includes(dept.name))
                    .sort((a:any, b:any) => b.count - a.count).map((dept: any, idx: number) => (
                    <View key={idx} style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 1 }} numberOfLines={1}>{dept.name}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textSecondary }}>{dept.percentage}%</Text>
                      </View>
                      <View style={{ width: '100%', height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                        <View style={{ width: `${dept.percentage}%`, height: '100%', backgroundColor: dept.barColor || '#3B82F6', borderRadius: 4 }} />
                      </View>
                      <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>{dept.count} Submissions</Text>
                    </View>
                  ))}
                  {(!analyticsOverview?.departmentBreakdown || analyticsOverview.departmentBreakdown.length === 0) && (
                    <Text style={{ color: Colors.textMuted, textAlign: 'center', marginTop: 20 }}>No department data available</Text>
                  )}
                </ScrollView>
              </Card>

            </View>

            {/* Platform Stats Row */}
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 }}>Platform Targets Breakdown</Text>
              <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 16 }}>
                {(analyticsOverview?.platformStats || []).map((platform: any, idx: number) => (
                  <Card key={idx} style={{ flex: 1, padding: 20, backgroundColor: Colors.surface, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: platform.bgColor || '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={platform.icon || 'globe-outline' as any} size={20} color={platform.color || Colors.primary} />
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>{platform.name}</Text>
                      </View>
                      <Text style={{ fontSize: 24, fontWeight: '800', color: Colors.textPrimary }}>{analyticsOverview?.platformReach?.[platform.name.toLowerCase()] || 0}%</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Total Posts Targeted</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: platform.color }}>{platform.posts}</Text>
                    </View>
                  </Card>
                ))}
                {(!analyticsOverview?.platformStats || analyticsOverview.platformStats.length === 0) && (
                  <Text style={{ color: Colors.textMuted, padding: 20 }}>No platform data available yet.</Text>
                )}
              </View>
            </View>
          </View>
        );
      })()}

      {/* ── AUDIT LOGS TAB ── */}
      {activeTab === 'audit-logs' && !isInitialLoading && (() => {
        const filteredLogs = auditLogs.filter((log) => {
          const matchesQuery =
            (log.userName || '').toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
            (log.description || '').toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
            (log.eventType || '').toLowerCase().includes(auditSearchQuery.toLowerCase());
          const matchesType = auditEventTypeFilter === 'ALL' || log.eventType === auditEventTypeFilter;
          return matchesQuery && matchesType;
        });

        const eventFilterOptions = [
          { label: 'All Events', value: 'ALL' },
          { label: 'Approvals', value: 'CONTENT_APPROVAL' },
          { label: 'Rejections', value: 'CONTENT_REJECT' },
          { label: 'Policy Updates', value: 'POLICY_UPDATE' },
          { label: 'User Changes', value: 'USER_MODIFIED' },
          { label: 'QA Clearance', value: 'QUALITY_CLEARANCE' },
        ];

        return (
          <View style={{ gap: Spacing.lg }}>

            {/* Main Table Card */}
            <Card style={styles.userCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <View style={{ gap: 2 }}>
                  <Text style={styles.sectionHeader}>Activity Log Records</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {/* Search input */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: 240, height: 38, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12 }}>
                    <Ionicons name="search-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={{ flex: 1, fontSize: 14, color: Colors.textPrimary, outlineStyle: 'none' } as any}
                      placeholder="Search audit logs..."
                      placeholderTextColor="#9CA3AF"
                      value={auditSearchQuery}
                      onChangeText={setAuditSearchQuery}
                    />
                  </View>

                  {/* Export Button */}
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', height: 38, paddingHorizontal: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }} onPress={() => showToast('Exporting audit log records as CSV...', 'success')}>
                    <Ionicons name="download-outline" size={16} color="#374151" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary }}>Export CSV</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick Filter Category Pills removed as requested */}

              {/* Logs Table Matching Screenshot */}
              <View style={styles.table}>
                <View style={[{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 12 }]}>
                  <Text style={{ flex: 1.8, fontSize: FontSize.xs + 1, fontWeight: 'bold', color: Colors.textPrimary }}>Timestamp</Text>
                  <Text style={{ flex: 2, fontSize: FontSize.xs + 1, fontWeight: 'bold', color: Colors.textPrimary }}>User</Text>
                  <Text style={{ flex: 1.5, fontSize: FontSize.xs + 1, fontWeight: 'bold', color: Colors.textPrimary }}>Action</Text>
                  <Text style={{ flex: 4, fontSize: FontSize.xs + 1, fontWeight: 'bold', color: Colors.textPrimary }}>Details</Text>
                </View>

                {filteredLogs.map((log) => (
                  <View key={log.id} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.background }]}>
                    {/* Timestamp */}
                    <Text style={{ flex: 1.8, fontSize: FontSize.xs + 1, color: Colors.textSecondary }}>{log.timestamp}</Text>

                    {/* User */}
                    <Text style={{ flex: 2, fontSize: FontSize.xs + 1, fontWeight: 'bold', color: Colors.textPrimary }}>{log.userName}</Text>

                    {/* Action */}
                    <View style={{ flex: 1.5 }}>
                      <View style={{ alignSelf: 'flex-start', backgroundColor: log.badgeBg || '#F3E8FF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: log.badgeColor || '#7C3AED' }}>{log.eventType}</Text>
                      </View>
                    </View>

                    {/* Details */}
                    <Text style={{ flex: 4, fontSize: FontSize.xs + 1, color: Colors.textPrimary, lineHeight: 20 }}>{log.description}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        );
      })()}

      {/* ── AUDIT LOG DETAILS MODAL ── */}
      {selectedAuditLog && (
        <Modal visible={!!selectedAuditLog} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', maxWidth: 580, backgroundColor: Colors.surface, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.background }}>
                <Text style={{ fontSize: FontSize.md + 1, fontWeight: 'bold', color: Colors.textPrimary }}>Audit Log Entry Inspection</Text>
                <TouchableOpacity onPress={() => setSelectedAuditLog(null)}>
                  <Ionicons name="close" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 20, gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ backgroundColor: selectedAuditLog.badgeBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: selectedAuditLog.badgeColor }}>{selectedAuditLog.eventType}</Text>
                  </View>
                  <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary }}>{selectedAuditLog.timestamp}</Text>
                </View>

                <View style={{ padding: 12, backgroundColor: '#F9FAFB', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, gap: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.textSecondary, textTransform: 'uppercase' }}>Actor Details</Text>
                  <Text style={{ fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.textPrimary }}>{selectedAuditLog.userName} ({selectedAuditLog.userRole})</Text>
                  <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary }}>{selectedAuditLog.userEmail}</Text>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.textSecondary, textTransform: 'uppercase' }}>Description</Text>
                  <Text style={{ fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 }}>{selectedAuditLog.description}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, padding: 10, backgroundColor: '#F8FAFC', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.textSecondary }}>IP ADDRESS</Text>
                    <Text style={{ fontSize: FontSize.xs + 1, color: Colors.textPrimary, marginTop: 2 }}>{selectedAuditLog.ipAddress}</Text>
                  </View>
                  <View style={{ flex: 1, padding: 10, backgroundColor: '#F8FAFC', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.textSecondary }}>DEVICE / BROWSER</Text>
                    <Text style={{ fontSize: FontSize.xs + 1, color: Colors.textPrimary, marginTop: 2 }}>{selectedAuditLog.device}</Text>
                  </View>
                </View>

                {selectedAuditLog.payload && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.textSecondary, textTransform: 'uppercase' }}>Event Metadata Payload</Text>
                    <View style={{ backgroundColor: '#1E293B', padding: 12, borderRadius: 8 }}>
                      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11, color: '#38BDF8' }}>
                        {selectedAuditLog.payload}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.background, backgroundColor: '#FAFAFA', alignItems: 'flex-end' }}>
                <TouchableOpacity onPress={() => setSelectedAuditLog(null)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: Colors.surface }}>
                  <Text style={{ fontSize: FontSize.xs + 1, fontWeight: 'medium', color: Colors.textPrimary }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── POST PREVIEW MODAL ── */}
      <Modal visible={!!previewPost} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 720, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary }}>Content Request Preview</Text>
              <TouchableOpacity onPress={() => setPreviewPost(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Top Area */}
              <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 24, marginBottom: 24 }}>
                <View style={{ flex: 1.5, alignItems: 'center', justifyContent: 'center' }}>
                  <TouchableOpacity onPress={() => previewPost?.image && setFullScreenImage(previewPost.image)} activeOpacity={0.8} style={{ width: '100%' }}>
                    <Image
                      source={{ uri: previewPost?.image }}
                      resizeMode="contain"
                      style={{
                        width: '100%',
                        maxHeight: 400,
                        aspectRatio: previewImgSize ? previewImgSize.width / previewImgSize.height : undefined,
                        backgroundColor: '#f3f4f6',
                        borderRadius: 8,
                      }}
                    />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1, gap: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>{previewPost?.title}</Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '500', color: Colors.primary }}>
                      Request posted on {previewPost?.requestedOn} at {previewPost?.requestedTime}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Department</Text>
                    <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textPrimary }}>{previewPost?.department}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Requested By</Text>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: Colors.textPrimary }}>{previewPost?.requestedBy}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Requested On</Text>
                    <Text style={{ fontSize: 12, color: Colors.textPrimary }}>{previewPost?.requestedOn} {previewPost?.requestedTime}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Platforms</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {previewPost?.platforms?.includes('facebook') && <Ionicons name="logo-facebook" size={16} color="#1877F2" />}
                      {previewPost?.platforms?.includes('instagram') && <Ionicons name="logo-instagram" size={16} color="#E1306C" />}
                      {previewPost?.platforms?.includes('website') && <Ionicons name="globe-outline" size={16} color="#3b82f6" />}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Status</Text>
                    <View style={{
                      backgroundColor: previewPost?.rawStatus === 'published' || previewPost?.rawStatus === 'approved' ? '#dcfce7' : previewPost?.rawStatus === 'rejected' || previewPost?.rawStatus === 'returned_for_revision' ? '#fee2e2' : '#fef3c7',
                      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: previewPost?.rawStatus === 'published' || previewPost?.rawStatus === 'approved' ? '#16a34a' : previewPost?.rawStatus === 'rejected' || previewPost?.rawStatus === 'returned_for_revision' ? '#dc2626' : '#b45309' }}>
                        {previewPost?.status}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Caption / Description / Approval Timeline */}
              <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 24 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 }}>Caption / Narrative</Text>
                  <FormattedText style={{ fontSize: 13, color: Colors.textPrimary, marginBottom: 16 }}>
                    {previewPost?.rawPost?.caption_narrative || 'No caption provided.'}
                  </FormattedText>

                  {previewPost?.rawPost?.description ? (
                    <>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 }}>Description</Text>
                      <Text style={{ fontSize: 13, color: Colors.textPrimary, marginBottom: 16 }}>{previewPost?.rawPost?.description}</Text>
                    </>
                  ) : null}

                  {previewPost?.rawPost?.rejection_reason ? (
                    <>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 }}>Rejection Reason</Text>
                      <Text style={{ fontSize: 13, color: '#dc2626' }}>{previewPost?.rawPost?.rejection_reason}</Text>
                    </>
                  ) : null}
                </View>

                <View style={{ flex: 1, gap: 16 }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 12 }}>Approval Timeline</Text>
                    {(previewPost?.rawPost?.approval_workflows && previewPost?.rawPost?.approval_workflows.length > 0) ? (
                      <View style={{ gap: 8 }}>
                        {previewPost.rawPost.approval_workflows.map((wf: any, i: number) => (
                          <View key={wf.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: wf.action === 'approved' || wf.action === 'published' ? '#dcfce7' : wf.action === 'rejected' || wf.action === 'returned' ? '#fee2e2' : '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name={wf.action === 'approved' || wf.action === 'published' ? 'checkmark' : wf.action === 'rejected' || wf.action === 'returned' ? 'close' : 'time-outline'} size={12} color={wf.action === 'approved' || wf.action === 'published' ? '#16a34a' : wf.action === 'rejected' || wf.action === 'returned' ? '#dc2626' : '#9ca3af'} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textPrimary }}>{wf.stage_label || wf.stage}</Text>
                              <Text style={{ fontSize: 10, color: '#6b7280' }}>
                                {wf.approver?.full_name || 'Unknown'} {wf.acted_at ? '• ' + new Date(wf.acted_at).toLocaleDateString() : ''}
                              </Text>
                            </View>
                            <View style={{ backgroundColor: wf.action === 'approved' || wf.action === 'published' ? '#dcfce7' : wf.action === 'rejected' || wf.action === 'returned' ? '#fee2e2' : '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '600', color: wf.action === 'approved' || wf.action === 'published' ? '#16a34a' : wf.action === 'rejected' || wf.action === 'returned' ? '#dc2626' : '#6b7280' }}>
                                {wf.action_label || wf.action?.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 12, color: '#9ca3af' }}>No approval workflow data available.</Text>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
              <TouchableOpacity onPress={() => setPreviewPost(null)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: Colors.textPrimary }}>Close</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Full Screen Image Modal */}
      {fullScreenImage && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setFullScreenImage(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 40, right: 30, zIndex: 10, padding: 10 }}
              onPress={() => setFullScreenImage(null)}
            >
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: fullScreenImage }}
              style={{ width: '90%', height: '90%' }}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  titleSection: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itAdminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  itAdminBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  mainTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold, color: Colors.textPrimary },
  subTitle: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Flow card
  flowCard: { padding: Spacing.md },
  flowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  flowStepWrapper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flowStep: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#BFDBFE' },
  flowStepFinal: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  flowStepText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, color: '#1E40AF' },
  flowStepTextFinal: { color: '#fff' },

  // Stats
  statsGrid: { gap: Spacing.md },
  statsGridRow: { flexDirection: 'column' },
  statsGridColumn: { flexDirection: 'column' },
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 180, padding: Spacing.md },
  statCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  statIconContainer: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  statCardContent: { gap: 4 },
  statLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, color: Colors.textSecondary, letterSpacing: 0.5 },
  statValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold, color: Colors.textPrimary },

  // Bottom Section
  bottomSection: { gap: Spacing.md },
  rowLayout: { flexDirection: 'row' },
  columnLayout: { flexDirection: 'column' },
  splitLayout: { gap: Spacing.md },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  activityCard: { flex: 2, padding: Spacing.md },
  distributionCard: { flex: 1, padding: Spacing.md },
  sectionHeader: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 12 },

  activityList: { gap: Spacing.sm },
  activityItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingLeft: 12, borderLeftWidth: 3, borderRadius: 4, backgroundColor: Colors.surfaceSecondary },
  activityLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  initialsCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  initialsText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  activityDetails: { flex: 1, gap: 2 },
  activityText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  activityMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  boldText: { fontWeight: FontWeight.bold },

  platformList: { gap: Spacing.md },
  platformItem: { gap: 6 },
  platformInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  platformName: { fontSize: FontSize.sm, color: Colors.textPrimary },
  platformPercentage: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  progressBarBg: { height: 8, backgroundColor: Colors.background, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4 },

  // User management
  userTabContainer: { gap: Spacing.md },
  userCard: { padding: Spacing.md },
  userListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  searchInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: FontSize.sm, width: 200 },
  formRow: { gap: Spacing.md, marginBottom: Spacing.md },
  formRowLayout: { flexDirection: 'row', flexWrap: 'wrap' },
  formColumnLayout: { flexDirection: 'column' },
  formField: { flex: 1, minWidth: 180, gap: 6, justifyContent: 'flex-end' },
  formLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textSecondary },
  formInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontSize: FontSize.sm, backgroundColor: Colors.surface },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.sm, backgroundColor: Colors.surface },
  passwordInputWrapper: { flexDirection: 'row', borderWidth: 1, borderColor: Colors.border, borderRadius: 6, backgroundColor: Colors.surface, alignItems: 'center' },
  passwordInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: FontSize.sm },
  passwordToggle: { padding: 8 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start' },
  createBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 12, fontWeight: FontWeight.bold },
  userEmail: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  userMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  userActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  editBtn: { padding: 6, borderRadius: 6, backgroundColor: Colors.background },
  deleteBtn: { padding: 6, borderRadius: 6, backgroundColor: '#FEF2F2' },
  inlineEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveBtn: { backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cancelBtn: { backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 12 },

  // All posts
  postListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusFilterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  statusFilterText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  statusDropdown: { position: 'absolute', top: 38, right: 0, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, zIndex: 100, minWidth: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  statusDropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  statusDropdownText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  postRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  postInfo: { flex: 1, gap: 4 },
  postTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  postMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  approvedMeta: { fontSize: FontSize.xs, color: Colors.success },
  platformTagRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  platformTag: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  platformTagText: { fontSize: 10, fontWeight: '600', color: '#2563EB' },
  postStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  // Publishing queue
  queueSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 16 },
  publishRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  publishInfo: { flex: 1, gap: 4 },
  publishActions: { justifyContent: 'center' },
  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#0F172A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  publishBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  publishedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  publishedBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#16A34A' },

  // Policy
  policyNote: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 16 },
  policySection: { marginBottom: 20 },
  policySectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 10 },
  policyBullet: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 6 },
  bulletTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  bulletDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Settings
  settingsContainer: { gap: Spacing.xl },
  settingsHeaderContainer: { gap: 4, marginBottom: Spacing.sm },
  settingsBreadcrumb: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
  settingsMainTitle: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  settingsSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  settingsLayout: { flexDirection: 'row', gap: Spacing.xl, flexWrap: 'wrap' },
  settingsColumnLeft: { flex: 2, minWidth: 320, padding: 0, overflow: 'hidden' },
  settingsColumnRight: { flex: 1, minWidth: 280, padding: 0, overflow: 'hidden', height: 'auto', alignSelf: 'flex-start' },
  settingsCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.lg },
  settingsCardTitle: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textPrimary },
  configCardTitle: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },

  // Publishing Queue styles
  dashboardContainer: { gap: Spacing.xl },
  dashboardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  welcomeTitle: { fontSize: 24, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  welcomeSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  periodBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  readyBadgeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0', gap: 8 },
  readyBadgeLabel: { fontSize: 11, fontWeight: FontWeight.bold, color: '#166534' },
  readyBadgeCount: { fontSize: 16, fontWeight: FontWeight.bold, color: '#16A34A' },
  tableCard: { padding: 0, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  tableHeaderCell: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  cellFlex1: { flex: 1 },
  cellFlex2: { flex: 2 },
  alignCenter: { textAlign: 'center' as const, justifyContent: 'center' as const },
  alignRight: { textAlign: 'right' as const, justifyContent: 'flex-end' as const },
  thumbnailBg: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qualityScoreBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  qualityScoreText: { fontSize: 11, fontWeight: FontWeight.bold, color: '#B45309' },
  dateInputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 6, backgroundColor: Colors.surface, flex: 1 },
  dateTextInput: { flex: 1, fontSize: 11, paddingHorizontal: 8, paddingVertical: 6 },
  queueFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: Colors.border },
  statusLegend: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  statusLegendTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  statusLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDotLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  footerActionBtnText: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.primary },
  settingsDivider: { height: 1, backgroundColor: Colors.border },
  profilePictureRow: { flexDirection: 'row', gap: Spacing.lg, padding: Spacing.lg, alignItems: 'center' },
  profileAvatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  profileAvatarTextLarge: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  profilePictureInfo: { flex: 1, gap: 4 },
  profilePictureTitle: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.textPrimary },
  profilePictureDesc: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  profilePictureActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  uploadBtn: { backgroundColor: '#FFC72C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  uploadBtnText: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  removeBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#DC2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  removeBtnText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  settingsFormGroup: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, gap: 6 },
  settingsFormLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5 },
  settingsFormInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.sm, backgroundColor: '#fff' },
  settingsFormInputDisabled: { backgroundColor: '#F9FAFB', color: Colors.textSecondary },
  saveDetailsBtn: { backgroundColor: '#0F172A', margin: Spacing.lg, paddingVertical: 12, borderRadius: 4, alignItems: 'center' },
  saveDetailsBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },

  // ── Profile Modal Styles (Wide Layout, No Scroll) ──
  profileModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  wideModalCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 32, elevation: 16, display: 'flex', flexDirection: 'column' },
  wideModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 18 },
  wideModalAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  wideModalAvatarText: { fontSize: 15, fontWeight: '800' },
  wideModalTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  wideModalSubtitle: { fontSize: 11, fontWeight: '500', color: Colors.textMuted, marginTop: 1 },
  wideModalCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  wideModalBody: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6, overflow: 'hidden' },
  wideModalColumn: { flex: 1, paddingHorizontal: 10 },
  wideModalColumnRight: { borderLeftWidth: 1, borderLeftColor: Colors.border, paddingLeft: 16 },
  wideModalSection: { marginBottom: 18 },
  wideSectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.background },
  wideFieldRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  wideFieldHalf: { flex: 1, minWidth: 0 },
  wideFieldFull: { flex: 1 },
  wideFieldLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  wideFieldInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.textPrimary, backgroundColor: '#F9FAFB', outlineStyle: 'none' } as any,
  wideFieldSelect: { height: 36, fontSize: 12, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#F9FAFB', color: Colors.textPrimary, paddingLeft: 8, width: '100%', outlineStyle: 'none' } as any,
  wideFormHint: { fontSize: 10, color: Colors.textMuted, marginBottom: 10, marginTop: -4 },
  widePasswordWrapper: { flexDirection: 'row', borderWidth: 1, borderColor: Colors.border, borderRadius: 6, backgroundColor: '#F9FAFB', alignItems: 'center' },
  widePasswordInput: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.textPrimary, outlineStyle: 'none' } as any,
  widePasswordToggle: { padding: 6 },
  wideStatusRow: { flexDirection: 'row', gap: 8 },
  wideStatusToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#F9FAFB' },
  wideStatusActive: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  wideStatusInactive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  wideStatusDot: { width: 7, height: 7, borderRadius: 3.5 },
  wideStatusText: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary },
  wideModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 24, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.background, marginTop: 4 },
  wideCancelBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: Colors.background },
  wideCancelBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  wideSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: '#0F172A' },
  wideSaveBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // ── Toast Notification Styles ──
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 340,
    maxWidth: 520,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  toastSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  toastError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  toastWarning: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  toastClose: {
    padding: 4,
    marginLeft: 12,
  },

  // Policy Rules Redesign Styles
  wideModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  policyRulesContainer: {
    gap: 24,
  },
  policyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  policyMainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  policySubTitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  policyHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  editRulesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  editRulesBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  policySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 38,
    minWidth: 220,
  },
  policySearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    outlineStyle: 'none',
  } as any,
  policySectionBlock: {
    gap: 14,
  },
  policySectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  policyNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyNumberBadgeText: {
    color: Colors.surface,
    fontSize: 13,
    fontWeight: '800',
  },
  policySectionTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  policyStatementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  policyStatementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  policyStatementBody: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  policyGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  policyGridCard: {
    flex: 1,
    minWidth: 220,
    padding: 18,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  policyCardIconSquare: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  policyCardAccentBar: {
    height: 3,
    width: 24,
    borderRadius: 1.5,
    marginTop: -4,
  },
  policyCardDesc: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  policySimpleContentBox: {
    padding: 14,
  },
  policySimpleContentText: {
    fontSize: 13,
    color: '#4B5563',
  },

  // Editing Mode Styles
  editingModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  editingModeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
  },
  editingModeSubText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cancelEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  cancelEditBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  saveChangesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
  },
  saveChangesBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.surface,
    letterSpacing: 0.5,
  },
  policyMiniToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  toolbarFormatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  toolbarFormatBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  toolbarDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  toolbarIconBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toolbarTextBtn: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  policyInlineTitleInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: '#7C3AED',
    paddingVertical: 2,
    outlineStyle: 'none',
  } as any,
  policyInlineInputGrid: {
    fontSize: 12,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 8,
    minHeight: 60,
    backgroundColor: Colors.surface,
    textAlignVertical: 'top',
    outlineStyle: 'none',
  } as any,
  policyInlineInputMultiline: {
    fontSize: 13,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 10,
    minHeight: 80,
    backgroundColor: Colors.surface,
    textAlignVertical: 'top',
    outlineStyle: 'none',
    marginTop: 8,
  } as any,
});
