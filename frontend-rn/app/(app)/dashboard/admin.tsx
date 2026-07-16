import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DashboardShell } from '../../../components/DashboardShell';
import { useAuthStore } from '../../../store/auth';
import { Card } from '../../../components/ui/Card';
import { dashboardApi, postsApi } from '../../../services/api';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../constants/theme';
import { usePolicyStore } from '../../../store/policy';

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
  label,
  value,
  icon,
  iconColor,
  iconBgColor,
  badgeText,
  badgeColor = Colors.textSecondary,
  badgeBgColor = '#F3F4F6',
  valueColor = Colors.textPrimary,
}) => {
  return (
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
};

// Available Roles for account creation
const ROLE_OPTIONS = [
  { label: 'Admin', value: 'admin' },
  { label: 'Content Requestor', value: 'requestor' },
  { label: 'Office Head', value: 'office_head' },
  { label: 'Vice President', value: 'vp' },
  { label: 'President', value: 'president' },
  { label: 'IT / Publisher', value: 'it_publisher' },
  { label: 'IMC / QA', value: 'imc_qa' },
];

const DEPARTMENT_OPTIONS = [
  'ICT',
  'Marketing',
  'Academic Affairs',
  'Administration',
  'Office of the President',
  'Institutional Marketing & Communications',
];

export default function AdminDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();
  
  // Tab state: 'overview' | 'user-management' | 'all-posts' | 'account-settings' | 'policy-rules'
  const [activeTab, setActiveTab] = useState('overview');

  // Policy rules store hooks & states
  const {
    policySections,
    effectiveDate,
    lastUpdatedDate,
    fetchPolicy,
    updatePolicy,
    isLoading: isPolicyLoading
  } = usePolicyStore();

  const [editableEffectiveDate, setEditableEffectiveDate] = useState('');
  const [editableLastUpdatedDate, setEditableLastUpdatedDate] = useState('');
  const [editableSections, setEditableSections] = useState<any[]>([]);

  const [editingBulletSecIdx, setEditingBulletSecIdx] = useState<number | null>(null);
  const [editingBulletIdx, setEditingBulletIdx] = useState<number | null>(null);
  const [editingBulletTitle, setEditingBulletTitle] = useState('');
  const [editingBulletDesc, setEditingBulletDesc] = useState('');
  const [newBulletSecIdx, setNewBulletSecIdx] = useState<number | null>(null);
  const [newBulletTitle, setNewBulletTitle] = useState('');
  const [newBulletDesc, setNewBulletDesc] = useState('');

  useEffect(() => {
    fetchPolicy();
  }, []);

  useEffect(() => {
    if (policySections) {
      setEditableSections(JSON.parse(JSON.stringify(policySections)));
    }
    if (effectiveDate) {
      setEditableEffectiveDate(effectiveDate);
    }
    if (lastUpdatedDate) {
      setEditableLastUpdatedDate(lastUpdatedDate);
    }
  }, [policySections, effectiveDate, lastUpdatedDate]);

  // Stats Dashboard state
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);

  // User Management state
  const [users, setUsers] = useState<any[]>([
    { id: '1', email: 'admin@jmcfi.edu.ph', role: 'admin', department: 'ICT', created_at: 'Oct 12, 2023' },
    { id: '2', email: 'v.academic@jmcfi.edu.ph', role: 'vp', department: 'Academic Affairs', created_at: 'Nov 05, 2023' },
    { id: '3', email: 'it.support@jmcfi.edu.ph', role: 'it_publisher', department: 'ICT', created_at: 'Jan 20, 2024' },
  ]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('admin');
  const [newUserDepartment, setNewUserDepartment] = useState('Marketing');
  const [isRolePickerOpen, setIsRolePickerOpen] = useState(false);
  const [isDeptPickerOpen, setIsDeptPickerOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<string>('admin');
  const [isInlinePickerOpen, setIsInlinePickerOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userFilter, setUserFilter] = useState('');

  // All Posts Pipeline state
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending_review' | 'approved' | 'revision_requested'
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [activePostActionDetails, setActivePostActionDetails] = useState<{ type: string; post: any } | null>(null);

  // Mock Post data pages
  const page1Posts = [
    {
      id: '1',
      title: 'Graduation 2024 Announcement',
      author: "Registrar's Office",
      timeAgo: '2h ago',
      department: 'Administration',
      status: 'pending_review',
      statusLabel: 'PENDING REVIEW',
      reviewer: 'Office Head',
      platforms: ['FB', 'PORTAL'],
    },
    {
      id: '2',
      title: 'Athletic Meet Results',
      author: 'Sports Dept',
      timeAgo: '1d ago',
      department: 'Student Affairs',
      status: 'approved',
      statusLabel: 'APPROVED',
      reviewer: '—',
      platforms: ['IG'],
    },
    {
      id: '3',
      title: 'Scholarship Call for Apps',
      author: 'Finance',
      timeAgo: '3d ago',
      department: 'Institutional Finance',
      status: 'revision_requested',
      statusLabel: 'REVISION REQUESTED',
      reviewer: 'IMC Dept',
      platforms: ['FB', 'WEB'],
    },
  ];

  const page2Posts = [
    {
      id: '4',
      title: 'Enrollment Guidelines SY 2026-2027',
      author: "Admissions Office",
      timeAgo: '4d ago',
      department: 'Administration',
      status: 'pending_review',
      statusLabel: 'PENDING REVIEW',
      reviewer: 'Vice President',
      platforms: ['FB', 'PORTAL', 'WEB'],
    },
    {
      id: '5',
      title: 'JMCFI Foundation Day Celebrations',
      author: 'HR Dept',
      timeAgo: '5d ago',
      department: 'Human Resources',
      status: 'approved',
      statusLabel: 'APPROVED',
      reviewer: '—',
      platforms: ['FB', 'IG'],
    },
  ];

  const allMockPosts = [...page1Posts, ...page2Posts];

  useEffect(() => {
    // Attempt real API fetch
    dashboardApi.getStats()
      .then(r => setStats(r.data))
      .catch(() => {
        setStats({
          total_users: '1,284',
          total_submissions: '4,592',
          pending_review: '156',
          approved_posts: '3,902',
          returned_revision: '421',
          published_posts: '3,745',
        });
      });

    dashboardApi.getRecentActivity()
      .then(r => setActivities(r.data ?? []))
      .catch(() => {
        setActivities([
          {
            id: 1,
            userInitials: 'JD',
            userName: 'John Doe',
            action: 'approved a submission for',
            target: 'Arts & Sciences',
            time: '2 minutes ago',
            platform: 'Institutional Facebook Page',
            color: '#1E40AF',
            bgColor: '#DBEAFE',
          },
          {
            id: 2,
            userInitials: 'MS',
            userName: 'Mary Smith',
            action: 'requested revision for',
            target: 'Enrollment Update',
            time: '15 minutes ago',
            platform: 'JMCFI Official Portal',
            color: '#B45309',
            bgColor: '#FEF3C7',
          },
        ]);
      });
  }, []);

  const handleCreateAccount = () => {
    if (!newUserEmail || !newUserPassword) {
      alert('Please fill in both email and password.');
      return;
    }
    if (!newUserEmail.includes('@')) {
      alert('Please enter a valid email.');
      return;
    }

    const formattedDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });

    const newAccount = {
      id: Date.now().toString(),
      email: newUserEmail,
      role: newUserRole,
      department: newUserDepartment,
      created_at: formattedDate,
    };

    setUsers([newAccount, ...users]);
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserDepartment('Marketing');
    alert('Institutional account created successfully!');
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Are you sure you want to delete this user account?')) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  const handleSaveEditedRole = (id: string) => {
    setUsers(users.map(u => {
      if (u.id === id) {
        return { ...u, role: editingUserRole };
      }
      return u;
    }));
    setEditingUserId(null);
    alert('User role updated successfully!');
  };

  const isLargeScreen = width > 1024;
  const isTablet = width > 768;

  // Platform Distribution mock data
  const platforms = [
    { name: 'Facebook', percentage: 65, barColor: Colors.primary },
    { name: 'Instagram', percentage: 15, barColor: '#B45309' },
    { name: 'Twitter/X', percentage: 10, barColor: '#6B7280' },
    { name: 'Portal', percentage: 10, barColor: '#3B82F6' },
  ];

  const getRoleBadgeDetails = (role: string) => {
    switch (role) {
      case 'admin':
        return { label: 'ADMIN', color: '#1E40AF', bgColor: '#DBEAFE' };
      case 'vp':
        return { label: 'VICE PRESIDENT', color: '#B45309', bgColor: '#FEF3C7' };
      case 'it_publisher':
        return { label: 'IT / PUBLISHER', color: Colors.textSecondary, bgColor: '#E5E7EB' };
      case 'requestor':
        return { label: 'REQUESTOR', color: '#0F766E', bgColor: '#CCFBF1' };
      case 'office_head':
        return { label: 'OFFICE HEAD', color: '#B45309', bgColor: '#FEF3C7' };
      case 'president':
        return { label: 'PRESIDENT', color: '#701A75', bgColor: '#FDF4FF' };
      case 'imc_qa':
        return { label: 'IMC / QA', color: '#6366F1', bgColor: '#E0E7FF' };
      default:
        return { label: role.toUpperCase(), color: Colors.textPrimary, bgColor: '#F3F4F6' };
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userFilter.toLowerCase())
  );

  // Filter & Paginate posts
  const getFilteredPosts = () => {
    let postsToFilter = currentPage === 1 ? page1Posts : page2Posts;
    if (statusFilter !== 'all') {
      // If filtering, we can check across all mock posts to show correct search results
      postsToFilter = allMockPosts.filter(p => p.status === statusFilter);
    }
    return postsToFilter;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_review':
        return { dotColor: '#D97706', textColor: '#854D0E' };
      case 'approved':
        return { dotColor: '#16A34A', textColor: '#15803D' };
      case 'revision_requested':
        return { dotColor: '#DC2626', textColor: '#B91C1C' };
      default:
        return { dotColor: '#6B7280', textColor: '#374151' };
    }
  };

  const getStatusLabelText = (filterValue: string) => {
    switch (filterValue) {
      case 'all':
        return 'All Statuses';
      case 'pending_review':
        return 'Pending Review';
      case 'approved':
        return 'Approved';
      case 'revision_requested':
        return 'Revision Requested';
      default:
        return 'All Statuses';
    }
  };

  const postsToShow = getFilteredPosts();

  return (
    <DashboardShell
      title="Admin Panel"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* Title Section */}
      <View style={styles.titleSection}>
        <Text style={styles.mainTitle}>Admin Panel</Text>
        <Text style={styles.subTitle}>Full system control and oversight of institutional communications.</Text>
      </View>

      {activeTab === 'overview' && (
        <>
          {/* Grid of Stat Cards */}
          <View style={[styles.statsGrid, isTablet ? styles.statsGridRow : styles.statsGridColumn]}>
            <View style={styles.statsRow}>
              <CustomStatCard
                label="TOTAL USERS"
                value={stats?.total_users ?? '—'}
                icon="people-outline"
                iconColor="#2563EB"
                iconBgColor="#EFF6FF"
                badgeText="+12% vs last month"
                badgeColor="#2563EB"
                badgeBgColor="#EFF6FF"
              />
              <CustomStatCard
                label="TOTAL SUBMISSIONS"
                value={stats?.total_submissions ?? '—'}
                icon="document-text-outline"
                iconColor="#3B82F6"
                iconBgColor="#EFF6FF"
                badgeText="+45 today"
                badgeColor="#1D4ED8"
                badgeBgColor="#EFF6FF"
              />
              <CustomStatCard
                label="PENDING REVIEW"
                value={stats?.pending_review ?? '—'}
                icon="clipboard-outline"
                iconColor="#D97706"
                iconBgColor="#FEF3C7"
                badgeText="Urgent: 8"
                badgeColor="#B45309"
                badgeBgColor="#FEF3C7"
              />
            </View>
            <View style={styles.statsRow}>
              <CustomStatCard
                label="APPROVED POSTS"
                value={stats?.approved_posts ?? '—'}
                icon="checkmark-circle-outline"
                iconColor="#D97706"
                iconBgColor="#FEF3C7"
              />
              <CustomStatCard
                label="RETURNED FOR REVISION"
                value={stats?.returned_revision ?? '—'}
                icon="alert-circle-outline"
                iconColor="#EC4899"
                iconBgColor="#FCE7F3"
                valueColor="#DC2626"
              />
              <CustomStatCard
                label="PUBLISHED POSTS"
                value={stats?.published_posts ?? '—'}
                icon="globe-outline"
                iconColor="#2563EB"
                iconBgColor="#EFF6FF"
              />
            </View>
          </View>

          {/* Lower Section (Recent Activity & Distribution) */}
          <View style={[styles.bottomSection, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Recent Activity */}
            <Card style={styles.activityCard}>
              <Text style={styles.sectionHeader}>Recent Activity</Text>
              <View style={styles.activityList}>
                {activities.map((activity) => (
                  <TouchableOpacity
                    key={activity.id}
                    style={[styles.activityItem, { borderLeftColor: activity.color }]}
                    onPress={() => alert(`Activity details for post: ${activity.target}`)}
                  >
                    <View style={styles.activityLeft}>
                      <View style={[styles.initialsCircle, { backgroundColor: activity.bgColor }]}>
                        <Text style={[styles.initialsText, { color: activity.color }]}>
                          {activity.userInitials}
                        </Text>
                      </View>
                      <View style={styles.activityDetails}>
                        <Text style={styles.activityText}>
                          <Text style={styles.boldText}>{activity.userName}</Text> {activity.action}{' '}
                          <Text style={styles.boldText}>{activity.target}</Text>.
                        </Text>
                        <Text style={styles.activityMeta}>
                          {activity.time} &bull; {activity.platform}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward-outline" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            {/* Platform Distribution */}
            <Card style={styles.distributionCard}>
              <Text style={styles.sectionHeader}>Platform Distribution</Text>
              <View style={styles.platformList}>
                {platforms.map((platform, idx) => (
                  <View key={idx} style={styles.platformItem}>
                    <View style={styles.platformInfo}>
                      <Text style={styles.platformName}>{platform.name}</Text>
                      <Text style={styles.platformPercentage}>{platform.percentage}%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${platform.percentage}%`, backgroundColor: platform.barColor },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        </>
      )}

      {activeTab === 'user-management' && (
        <View style={styles.userTabContainer}>
          {/* Create New Institutional Account Card */}
          <Card style={[styles.userCard, (isRolePickerOpen || isDeptPickerOpen) && { position: 'relative', zIndex: 10, overflow: 'visible' }]}>
            <Text style={styles.sectionHeader}>Create New Institutional Account</Text>
            <View style={[styles.formRow, isTablet ? styles.formRowLayout : styles.formColumnLayout, (isRolePickerOpen || isDeptPickerOpen) && { position: 'relative', zIndex: 20, overflow: 'visible' }]}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Email Address</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="user@jmcfi.edu.ph"
                  value={newUserEmail}
                  onChangeText={setNewUserEmail}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Password</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    value={newUserPassword}
                    onChangeText={setNewUserPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Institutional Role</Text>
                <select
                  value={newUserRole}
                  onChange={(e: any) => setNewUserRole(e.target.value)}
                  style={{
                    height: 38,
                    fontSize: 13,
                    borderRadius: 4,
                    border: '1px solid #E5E7EB',
                    backgroundColor: Colors.surface,
                    color: '#1A1A2E',
                    paddingLeft: 10,
                    paddingRight: 8,
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    fontFamily: 'inherit',
                  }}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Department</Text>
                <select
                  value={newUserDepartment}
                  onChange={(e: any) => setNewUserDepartment(e.target.value)}
                  style={{
                    height: 38,
                    fontSize: 13,
                    borderRadius: 4,
                    border: '1px solid #E5E7EB',
                    backgroundColor: Colors.surface,
                    color: '#1A1A2E',
                    paddingLeft: 10,
                    paddingRight: 8,
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    fontFamily: 'inherit',
                  }}
                >
                  {DEPARTMENT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </View>

              <View style={styles.formButtonContainer}>
                <TouchableOpacity style={styles.createAccountButton} onPress={handleCreateAccount}>
                  <Text style={styles.createAccountButtonText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* System Users List Card */}
          <Card style={[styles.userCard, editingUserId !== null && { overflow: 'visible', zIndex: 50 }]}>
            <View style={styles.tableHeaderSection}>
              <Text style={styles.sectionHeader}>System Users</Text>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Filter users..."
                  value={userFilter}
                  onChangeText={setUserFilter}
                />
              </View>
            </View>

            {/* Table Area */}
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.cellFlex2]}>Email</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Role</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1_5]}>Department</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Created Date</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1, styles.alignRight]}>Actions</Text>
              </View>

              {filteredUsers.length > 0 ? (
                filteredUsers.map((item) => {
                  const badge = getRoleBadgeDetails(item.role);
                  return (
                    <View key={item.id} style={[styles.tableRow, editingUserId === item.id && { zIndex: 100, position: 'relative', overflow: 'visible' }]}>
                      <Text style={[styles.tableCellText, styles.cellFlex2]}>{item.email}</Text>
                      <View style={[styles.cellFlex1, { flexDirection: 'row', zIndex: 100, position: 'relative', overflow: 'visible' }]}>
                        {editingUserId === item.id ? (
                            <select
                              value={editingUserRole}
                              onChange={(e: any) => setEditingUserRole(e.target.value)}
                              style={{
                                height: 24,
                                fontSize: 10,
                                borderRadius: 4,
                                border: '1px solid #E5E7EB',
                                backgroundColor: Colors.surface,
                                color: '#1A1A2E',
                                paddingLeft: 4,
                                paddingRight: 2,
                                outline: 'none',
                                cursor: 'pointer',
                                maxWidth: 110,
                                fontFamily: 'inherit',
                              }}
                            >
                              {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                        ) : (
                          <View style={[styles.roleBadge, { backgroundColor: badge.bgColor }]}>
                            <Text style={[styles.roleBadgeText, { color: badge.color }]}>{badge.label}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.tableCellText, styles.cellFlex1_5]} numberOfLines={1}>
                        {item.department ?? 'N/A'}
                      </Text>
                      <Text style={[styles.tableCellText, styles.cellFlex1]}>{item.created_at}</Text>
                      <View style={[styles.cellFlex1, styles.actionCell]}>
                        {editingUserId === item.id ? (
                          <>
                            <TouchableOpacity onPress={() => handleSaveEditedRole(item.id)}>
                              <Text style={styles.saveActionText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setEditingUserId(null)}>
                              <Text style={styles.cancelActionText}>Cancel</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity onPress={() => {
                              setEditingUserId(item.id);
                              setEditingUserRole(item.role);
                              setIsInlinePickerOpen(false);
                            }}>
                              <Text style={styles.editActionText}>Edit Role</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteUser(item.id)}>
                              <Text style={styles.deleteActionText}>Delete</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyTable}>
                  <Text style={styles.emptyTableText}>No users found matching filter.</Text>
                </View>
              )}
            </View>
          </Card>
        </View>
      )}

      {activeTab === 'all-posts' && (
        <View style={styles.userTabContainer}>
          {/* Content Approval Pipeline Card */}
          <Card style={styles.userCard}>
            <View style={styles.tableHeaderSection}>
              <Text style={styles.sectionHeader}>Content Approval Pipeline</Text>
              <View style={styles.pipelineActions}>
                {/* Status Selection Dropdown */}
                <View style={{ position: 'relative', zIndex: 50 }}>
                  <TouchableOpacity
                    style={styles.statusSelectButton}
                    onPress={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  >
                    <Text style={styles.statusSelectButtonText}>{getStatusLabelText(statusFilter)}</Text>
                    <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {isStatusDropdownOpen && (
                    <View style={styles.statusDropdownMenu}>
                      {['all', 'pending_review', 'approved', 'revision_requested'].map((statusOption) => (
                        <TouchableOpacity
                          key={statusOption}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setStatusFilter(statusOption);
                            setIsStatusDropdownOpen(false);
                            setCurrentPage(1); // Reset page on filter
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{getStatusLabelText(statusOption)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Filter Trigger Button */}
                <TouchableOpacity
                  style={styles.filterButton}
                  onPress={() => alert(`Applied filter: ${getStatusLabelText(statusFilter)}`)}
                >
                  <Ionicons name="funnel-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.filterButtonText}>Filter</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pipeline Table */}
            <View style={styles.table}>
              {/* Header row */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.cellFlex2]}>Title</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Department</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Status</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Current Reviewer</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Target Platform</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1, styles.alignRight]}>Actions</Text>
              </View>

              {/* Rows List */}
              {postsToShow.length > 0 ? (
                postsToShow.map((post) => {
                  const statusColors = getStatusColor(post.status);
                  return (
                    <View key={post.id} style={styles.tableRow}>
                      {/* Title & Metadata */}
                      <View style={[styles.cellFlex2, styles.postTitleColumn]}>
                        <Text style={styles.postTitleText}>{post.title}</Text>
                        <Text style={styles.postMetaText}>
                          by {post.author} &bull; {post.timeAgo}
                        </Text>
                      </View>

                      {/* Department */}
                      <Text style={[styles.tableCellText, styles.cellFlex1]}>{post.department}</Text>

                      {/* Status */}
                      <View style={[styles.cellFlex1, styles.statusCell]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColors.dotColor }]} />
                        <Text style={[styles.statusCellText, { color: statusColors.textColor }]}>
                          {post.statusLabel}
                        </Text>
                      </View>

                      {/* Current Reviewer */}
                      <Text style={[styles.tableCellText, styles.cellFlex1]}>{post.reviewer}</Text>

                      {/* Target Platform Badges */}
                      <View style={[styles.cellFlex1, styles.platformBadgesRow]}>
                        {post.platforms.map((plat, idx) => (
                          <View key={idx} style={styles.platformMiniBadge}>
                            <Text style={styles.platformMiniBadgeText}>{plat}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Actions */}
                      <View style={[styles.cellFlex1, styles.actionIconsRow]}>
                        <TouchableOpacity
                          style={styles.actionIconButton}
                          onPress={() => setActivePostActionDetails({ type: 'view', post })}
                        >
                          <Ionicons name="eye-outline" size={16} color={Colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionIconButton}
                          onPress={() => setActivePostActionDetails({ type: 'comment', post })}
                        >
                          <Ionicons name="chatbubble-outline" size={15} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionIconButton}
                          onPress={() => setActivePostActionDetails({ type: 'history', post })}
                        >
                          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyTable}>
                  <Text style={styles.emptyTableText}>No submissions found matching filters.</Text>
                </View>
              )}
            </View>

            {/* Pipeline Table Footer / Pagination */}
            <View style={styles.pipelineFooter}>
              <Text style={styles.footerInfoText}>
                Showing {postsToShow.length} of 4,592 posts
              </Text>
              
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage(1)}
                >
                  <Text style={styles.pageButtonText}>Previous</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pageIndexButton, currentPage === 1 && styles.pageIndexButtonActive]}
                  onPress={() => setCurrentPage(1)}
                >
                  <Text style={[styles.pageIndexButtonText, currentPage === 1 && styles.pageIndexButtonTextActive]}>
                    1
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pageIndexButton, currentPage === 2 && styles.pageIndexButtonActive]}
                  onPress={() => setCurrentPage(2)}
                >
                  <Text style={[styles.pageIndexButtonText, currentPage === 2 && styles.pageIndexButtonTextActive]}>
                    2
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pageButton, currentPage === 2 && styles.pageButtonDisabled]}
                  disabled={currentPage === 2}
                  onPress={() => setCurrentPage(2)}
                >
                  <Text style={styles.pageButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* ----------------- ACCOUNT SETTINGS TAB ----------------- */}
      {activeTab === 'account-settings' && (
        <View style={styles.formContainer}>
          <View style={styles.topActionRow}>
            <View style={styles.breadcrumbColumn}>
              <Text style={styles.breadcrumbText}>
                SETTINGS <Text style={{ color: Colors.textMuted }}>&gt;</Text> ACCOUNT SETTINGS
              </Text>
              <Text style={styles.mainPageTitle}>Account Settings</Text>
              <Text style={styles.mainPageSubtitle}>
                Manage your institutional profile picture, credentials, and settings.
              </Text>
            </View>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Left settings card */}
            <View style={styles.leftColumn}>
              <Card style={styles.formCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.headerIconWrapper}>
                    <Ionicons name="person" size={18} color={Colors.textPrimary} />
                  </View>
                  <Text style={styles.cardTitle}>Profile Information</Text>
                </View>

                {/* Profile Picture Upload Section */}
                <View style={styles.profilePicUploadContainer}>
                  <View style={styles.profilePicLarge}>
                    <Text style={styles.profilePicLargeText}>
                      {user?.name?.substring(0, 2).toUpperCase() ?? 'AD'}
                    </Text>
                  </View>
                  <View style={styles.profilePicActionCol}>
                    <Text style={styles.profilePicTitle}>Profile Picture</Text>
                    <Text style={styles.profilePicSubtitle}>
                      PNG or JPG formats supported. Max 2MB file size.
                    </Text>
                    <View style={styles.profilePicButtonsRow}>
                      <TouchableOpacity style={styles.profilePicUploadBtn} onPress={() => alert('Profile picture upload clicked.')}>
                        <Text style={styles.profilePicUploadBtnText}>Upload New Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.profilePicRemoveBtn} onPress={() => alert('Profile picture removed.')}>
                        <Text style={styles.profilePicRemoveBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>FULL NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    defaultValue={user?.name ?? 'ADMIN User'}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]}
                    value={user?.email ?? 'admin@jmcfi.edu.ph'}
                    editable={false}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>ROLE</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]}
                    value="Administrator"
                    editable={false}
                  />
                </View>

                <TouchableOpacity style={styles.submitButton} onPress={() => alert('Profile settings saved successfully!')}>
                  <Text style={styles.submitButtonText}>Save Details</Text>
                </TouchableOpacity>
              </Card>
            </View>

            {/* Right settings card */}
            <View style={styles.rightColumn}>
              <Card style={styles.configCard}>
                <Text style={styles.configCardTitle}>Update Password</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>CURRENT PASSWORD</Text>
                  <TextInput
                    style={styles.textInput}
                    secureTextEntry={true}
                    placeholder="Enter current password"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                  <TextInput
                    style={styles.textInput}
                    secureTextEntry={true}
                    placeholder="Enter new password"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                  <TextInput
                    style={styles.textInput}
                    secureTextEntry={true}
                    placeholder="Confirm new password"
                  />
                </View>

                <TouchableOpacity style={[styles.submitButton, { backgroundColor: Colors.primary, marginTop: 10 }]} onPress={() => alert('Password updated successfully!')}>
                  <Text style={styles.submitButtonText}>Change Password</Text>
                </TouchableOpacity>
              </Card>
            </View>
          </View>
        </View>
      )}

      {activeTab === 'policy-rules' && (
        <View style={styles.formContainer}>
          <View style={styles.topActionRow}>
            <View style={styles.breadcrumbColumn}>
              <Text style={styles.breadcrumbText}>
                SETTINGS <Text style={{ color: Colors.textMuted }}>&gt;</Text> POLICY RULES
              </Text>
              <Text style={styles.mainPageTitle}>School Website Posting Policy Management</Text>
              <Text style={styles.mainPageSubtitle}>
                Edit dates and update guidelines for website content compliance. Changes are updated immediately.
              </Text>
            </View>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Left Column: Dates & Purpose & Sections Editor */}
            <View style={styles.leftColumn}>
              
              {/* Card 1: Dates config */}
              <Card style={styles.formCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.headerIconWrapper}>
                    <Ionicons name="calendar-outline" size={18} color={Colors.textPrimary} />
                  </View>
                  <Text style={styles.cardTitle}>Policy Timestamps</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }}>
                  <View style={[styles.fieldGroup, { flex: 1, minWidth: 200 }]}>
                    <Text style={styles.inputLabel}>EFFECTIVE DATE</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editableEffectiveDate}
                      onChangeText={setEditableEffectiveDate}
                      placeholder="e.g. Jun 26, 2026"
                    />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1, minWidth: 200 }]}>
                    <Text style={styles.inputLabel}>LAST UPDATED DATE</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editableLastUpdatedDate}
                      onChangeText={setEditableLastUpdatedDate}
                      placeholder="e.g. July 15, 2026"
                    />
                  </View>
                </View>
              </Card>

              {/* Card 2: Section 1 Purpose editing */}
              {editableSections.map((sec, secIdx) => {
                if (sec.id === 'sec-1') {
                  return (
                    <Card key={sec.id} style={styles.formCard}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.headerIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                          <Ionicons name="book" size={18} color={Colors.textPrimary} />
                        </View>
                        <Text style={styles.cardTitle}>{sec.title}</Text>
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.inputLabel}>PURPOSE CONTENT TEXT</Text>
                        <TextInput
                          style={[styles.textInput, { height: 100, textAlignVertical: 'top', paddingTop: 8 }]}
                          multiline={true}
                          value={sec.content}
                          onChangeText={(text) => {
                            const newSecs = [...editableSections];
                            newSecs[secIdx].content = text;
                            setEditableSections(newSecs);
                          }}
                        />
                      </View>
                    </Card>
                  );
                }

                // Cards 3, 4, 5: Bullet sections editing
                return (
                  <Card key={sec.id} style={styles.formCard}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.headerIconWrapper, { backgroundColor: sec.bg }]}>
                        <Ionicons name={sec.icon} size={18} color={sec.color} />
                      </View>
                      <Text style={styles.cardTitle}>{sec.title}</Text>
                    </View>

                    {/* Bullets List */}
                    <View style={{ gap: Spacing.sm }}>
                      {sec.bullets?.map((bullet: any, bulletIdx: number) => {
                        const isEditing = editingBulletSecIdx === secIdx && editingBulletIdx === bulletIdx;
                        return (
                          <View key={bulletIdx} style={styles.policyEditItemRow}>
                            {isEditing ? (
                              <View style={{ flex: 1, gap: 8, padding: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 4, borderWidth: 1, borderColor: Colors.border }}>
                                <Text style={styles.inputLabel}>BULLET TITLE</Text>
                                <TextInput
                                  style={styles.textInput}
                                  value={editingBulletTitle}
                                  onChangeText={setEditingBulletTitle}
                                />
                                <Text style={styles.inputLabel}>BULLET DESCRIPTION</Text>
                                <TextInput
                                  style={[styles.textInput, { height: 60 }]}
                                  multiline={true}
                                  value={editingBulletDesc}
                                  onChangeText={setEditingBulletDesc}
                                />
                                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                                  <TouchableOpacity
                                    style={[styles.smallBtn, { backgroundColor: '#E5E7EB' }]}
                                    onPress={() => {
                                      setEditingBulletSecIdx(null);
                                      setEditingBulletIdx(null);
                                    }}
                                  >
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textPrimary }}>Cancel</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.smallBtn, { backgroundColor: Colors.primary }]}
                                    onPress={() => {
                                      if (!editingBulletTitle.trim() || !editingBulletDesc.trim()) {
                                        alert('Please fill out all fields.');
                                        return;
                                      }
                                      const newSecs = [...editableSections];
                                      newSecs[secIdx].bullets[bulletIdx] = {
                                        title: editingBulletTitle,
                                        desc: editingBulletDesc
                                      };
                                      setEditableSections(newSecs);
                                      setEditingBulletSecIdx(null);
                                      setEditingBulletIdx(null);
                                    }}
                                  >
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFFFFF' }}>Apply</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ) : (
                              <View style={styles.bulletDisplayRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.bulletTitleDisplay}>{bullet.title}</Text>
                                  <Text style={styles.bulletDescDisplay}>{bullet.desc}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                  <TouchableOpacity
                                    style={styles.bulletActionBtn}
                                    onPress={() => {
                                      setEditingBulletSecIdx(secIdx);
                                      setEditingBulletIdx(bulletIdx);
                                      setEditingBulletTitle(bullet.title);
                                      setEditingBulletDesc(bullet.desc);
                                    }}
                                  >
                                    <Ionicons name="create-outline" size={14} color={Colors.textPrimary} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.bulletActionBtn}
                                    onPress={() => {
                                      if (confirm('Delete this policy rule bullet?')) {
                                        const newSecs = [...editableSections];
                                        newSecs[secIdx].bullets.splice(bulletIdx, 1);
                                        setEditableSections(newSecs);
                                      }
                                    }}
                                  >
                                    <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    {/* Add Bullet Button/Form */}
                    {newBulletSecIdx === secIdx ? (
                      <View style={{ gap: 8, padding: 12, backgroundColor: Colors.background, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, marginTop: 10 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textPrimary }}>ADD NEW POLICY RULE</Text>
                        <View style={{ gap: 4 }}>
                          <Text style={styles.inputLabel}>TITLE</Text>
                          <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Content Accuracy"
                            value={newBulletTitle}
                            onChangeText={setNewBulletTitle}
                          />
                        </View>
                        <View style={{ gap: 4 }}>
                          <Text style={styles.inputLabel}>DESCRIPTION</Text>
                          <TextInput
                            style={[styles.textInput, { height: 50 }]}
                            multiline={true}
                            placeholder="e.g. All facts must be verified before publishing."
                            value={newBulletDesc}
                            onChangeText={setNewBulletDesc}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                          <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: '#E5E7EB' }]}
                            onPress={() => setNewBulletSecIdx(null)}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textPrimary }}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: '#16A34A' }]}
                            onPress={() => {
                              if (!newBulletTitle.trim() || !newBulletDesc.trim()) {
                                alert('Please fill out both title and description.');
                                return;
                              }
                              const newSecs = [...editableSections];
                              if (!newSecs[secIdx].bullets) {
                                newSecs[secIdx].bullets = [];
                              }
                              newSecs[secIdx].bullets.push({
                                title: newBulletTitle,
                                desc: newBulletDesc
                              });
                              setEditableSections(newSecs);
                              setNewBulletTitle('');
                              setNewBulletDesc('');
                              setNewBulletSecIdx(null);
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFFFFF' }}>Add Rule</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addBulletBtn}
                        onPress={() => {
                          setNewBulletSecIdx(secIdx);
                          setNewBulletTitle('');
                          setNewBulletDesc('');
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
                        <Text style={styles.addBulletBtnText}>Add Guidelines Rule</Text>
                      </TouchableOpacity>
                    )}
                  </Card>
                );
              })}

              {/* Global Save Button Card */}
              <Card style={[styles.formCard, { backgroundColor: '#F8FAFC' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>Apply Updates to Platform Policies</Text>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                      This will immediately update policy compliance guidelines for Requestors, Office Heads, IMC/QA, Publisher, and VPs.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.submitButton, { marginTop: 0, paddingHorizontal: 24, minWidth: 160 }]}
                    disabled={isPolicyLoading}
                    onPress={async () => {
                      const success = await updatePolicy(
                        editableEffectiveDate,
                        editableLastUpdatedDate,
                        editableSections
                      );
                      if (success) {
                        alert('Posting Policy Rules & dates updated successfully!');
                      } else {
                        alert('Failed to update policy settings. Please try again.');
                      }
                    }}
                  >
                    {isPolicyLoading ? (
                      <Text style={styles.submitButtonText}>Saving...</Text>
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.submitButtonText}>Save Policy Rules</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </Card>

            </View>

            {/* Right Column: Policy Preview info */}
            <View style={styles.rightColumn}>
              <Card style={styles.configCard}>
                <Text style={styles.configCardTitle}>Policy Publishing Info</Text>
                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>PREVIEW BANNER STATE</Text>
                  <View style={{ padding: 12, backgroundColor: '#EFF6FF', borderRadius: 4, borderWidth: 1, borderColor: '#DBEAFE', marginTop: 4 }}>
                    <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary }}>School Website Posting Policy</Text>
                    <Text style={{ fontSize: 11, color: '#1E40AF', marginTop: 4 }}>
                      Effective: {editableEffectiveDate} &bull; Last Updated: {editableLastUpdatedDate}
                    </Text>
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>COMPLIANCE TIPS FOR ADMIN</Text>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginTop: 4 }}>
                    - Update the <Text style={{ fontWeight: '600' }}>Effective Date</Text> when introducing major revisions.{"\n"}
                    - Use clear headings in <Text style={{ fontWeight: '600' }}>Purpose Text</Text> to summarize scope.{"\n"}
                    - Ensure AI Compliance guidelines in the backend align with these rules.
                  </Text>
                </View>
              </Card>
            </View>

          </View>
        </View>
      )}

      {/* Action Details Modals */}
      {activePostActionDetails && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setActivePostActionDetails(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {activePostActionDetails.type === 'view' && 'Submissions Review Preview'}
                  {activePostActionDetails.type === 'comment' && 'Post Discussion Comments'}
                  {activePostActionDetails.type === 'history' && 'Approval Status History Logs'}
                </Text>
                <TouchableOpacity onPress={() => setActivePostActionDetails(null)}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalPostTitle}>
                  {activePostActionDetails.post.title}
                </Text>
                <Text style={styles.modalPostMeta}>
                  Origin: {activePostActionDetails.post.department} &bull; Author: {activePostActionDetails.post.author}
                </Text>
                
                <View style={styles.modalDivider} />

                {activePostActionDetails.type === 'view' && (
                  <View style={styles.viewContainer}>
                    <Text style={styles.bodyBoldLabel}>Status Check:</Text>
                    <Text style={styles.bodyValueText}>{activePostActionDetails.post.statusLabel}</Text>
                    
                    <Text style={[styles.bodyBoldLabel, { marginTop: 12 }]}>Current Target Platforms:</Text>
                    <Text style={styles.bodyValueText}>{activePostActionDetails.post.platforms.join(', ')}</Text>
                    
                    <Text style={[styles.bodyBoldLabel, { marginTop: 12 }]}>Post Mock Content Structure:</Text>
                    <Text style={styles.bodyMockPostContent}>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam convallis lectus in tortor elementum, sed facilisis ligula congue. Cras a tristique mi. Sed rhoncus interdum finibus. Phasellus eget tortor ac orci accumsan semper eu ut lorem.
                    </Text>
                  </View>
                )}

                {activePostActionDetails.type === 'comment' && (
                  <View style={styles.commentContainer}>
                    <View style={styles.mockComment}>
                      <Text style={styles.commentUser}>IMC Officer (QA):</Text>
                      <Text style={styles.commentText}>Please double check the spelling on the dates.</Text>
                    </View>
                    <View style={styles.mockComment}>
                      <Text style={styles.commentUser}>Registrar's Office (Requestor):</Text>
                      <Text style={styles.commentText}>Date corrected and updated, ready for final head sign-off.</Text>
                    </View>
                    <View style={styles.commentInputRow}>
                      <TextInput style={styles.commentInput} placeholder="Add a comment..." />
                      <TouchableOpacity style={styles.commentSendBtn} onPress={() => alert('Comment added!')}>
                        <Text style={styles.commentSendText}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {activePostActionDetails.type === 'history' && (
                  <View style={styles.historyContainer}>
                    <View style={styles.historyRow}>
                      <View style={styles.historyDot} />
                      <Text style={styles.historyText}>
                        <Text style={{ fontWeight: 'bold' }}>Created</Text> by Requestor - Oct 10, 10:20 AM
                      </Text>
                    </View>
                    <View style={styles.historyRow}>
                      <View style={styles.historyDot} />
                      <Text style={styles.historyText}>
                        <Text style={{ fontWeight: 'bold' }}>Sent back for revision</Text> by IMC QA - Oct 11, 09:15 AM
                      </Text>
                    </View>
                    <View style={styles.historyRow}>
                      <View style={[styles.historyDot, { backgroundColor: '#16A34A' }]} />
                      <Text style={styles.historyText}>
                        <Text style={{ fontWeight: 'bold' }}>Updated</Text> by Requestor - Oct 11, 02:40 PM
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setActivePostActionDetails(null)}
                >
                  <Text style={styles.modalCloseText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  titleSection: {
    marginBottom: Spacing.sm,
    gap: 4,
  },
  mainTitle: {
    fontSize: FontSize.xxl - 2,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  subTitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  statsGrid: {
    gap: Spacing.md,
  },
  statsGridRow: {
    flexDirection: 'column',
  },
  statsGridColumn: {
    flexDirection: 'column',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 200,
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    shadowColor: 'transparent',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statBadgeText: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.semiBold,
  },
  statCardContent: {
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
  },
  bottomSection: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  rowLayout: {
    flexDirection: 'row',
  },
  columnLayout: {
    flexDirection: 'column',
  },
  activityCard: {
    flex: 1.5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
  },
  distributionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
  },
  sectionHeader: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  activityList: {
    gap: Spacing.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceSecondary,
    padding: Spacing.md,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  initialsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  activityDetails: {
    flex: 1,
    gap: 2,
  },
  activityText: {
    fontSize: FontSize.sm - 0.5,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: FontWeight.bold,
  },
  activityMeta: {
    fontSize: FontSize.xs - 1,
    color: Colors.textMuted,
  },
  platformList: {
    gap: Spacing.md,
  },
  platformItem: {
    gap: 6,
  },
  platformInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  platformName: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  platformPercentage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // User Management styles
  userTabContainer: {
    gap: Spacing.lg,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
  },
  formRow: {
    gap: Spacing.md,
    alignItems: 'flex-end',
  },
  formRowLayout: {
    flexDirection: 'row',
  },
  formColumnLayout: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  formField: {
    flex: 1,
    gap: 6,
    position: 'relative',
  },
  formLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
  },
  formInput: {
    height: 38,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: FontSize.sm,
    backgroundColor: Colors.surface,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    backgroundColor: Colors.surface,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: FontSize.sm,
    borderWidth: 0,
  },
  passwordToggle: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  dropdownTrigger: {
    height: 38,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  dropdownTriggerText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 66,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  formButtonContainer: {
    justifyContent: 'flex-end',
  },
  createAccountButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    height: 38,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAccountButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  tableHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
    gap: Spacing.sm,
    position: 'relative',
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    height: 32,
    backgroundColor: Colors.surfaceSecondary,
    width: 200,
  },
  searchInput: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
    flex: 1,
    padding: 0,
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    overflow: 'visible',
    backgroundColor: Colors.surface,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderCell: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  tableCellText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  cellFlex2: {
    flex: 2,
  },
  cellFlex1_5: {
    flex: 1.5,
  },
  cellFlex1: {
    flex: 1,
  },
  alignRight: {
    textAlign: 'right',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  actionCell: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  editActionText: {
    color: '#2563EB',
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.semiBold,
  },
  deleteActionText: {
    color: '#DC2626',
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.semiBold,
  },
  saveActionText: {
    color: '#10B981',
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.semiBold,
  },
  cancelActionText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.semiBold,
  },
  inlineDropdownTrigger: {
    height: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    width: '100%',
  },
  inlineDropdownTriggerText: {
    fontSize: 10,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
    flex: 1,
    marginRight: 4,
  },
  inlineDropdownMenu: {
    position: 'absolute',
    top: 26,
    left: 0,
    width: 140,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  inlineDropdownItem: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  inlineDropdownItemText: {
    fontSize: 10,
    color: Colors.textPrimary,
  },
  emptyTable: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTableText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },

  // All Posts Pipeline Styles
  pipelineActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  statusSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  statusSelectButtonText: {
    fontSize: FontSize.xs + 1,
    color: '#2563EB',
    fontWeight: FontWeight.medium,
  },
  statusDropdownMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    width: 160,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    height: 32,
    borderRadius: 4,
  },
  filterButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.semiBold,
  },
  postTitleColumn: {
    gap: 4,
  },
  postTitleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  postMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  statusCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusCellText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  platformBadgesRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  platformMiniBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  platformMiniBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  actionIconsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionIconButton: {
    padding: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  footerInfoText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  paginationRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  pageButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageButtonText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
  },
  pageIndexButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  pageIndexButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pageIndexButtonText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
  },
  pageIndexButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 550,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalBody: {
    maxHeight: 400,
  },
  modalPostTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  modalPostMeta: {
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.sm,
  },
  viewContainer: {
    gap: 4,
  },
  bodyBoldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  bodyValueText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  bodyMockPostContent: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceSecondary,
    padding: Spacing.md,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 6,
  },
  commentContainer: {
    gap: Spacing.sm,
  },
  mockComment: {
    backgroundColor: Colors.surfaceSecondary,
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  commentUser: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  commentText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  commentInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 38,
    fontSize: FontSize.sm,
  },
  commentSendBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSendText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  historyContainer: {
    gap: Spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D97706',
  },
  historyText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: Spacing.sm,
    alignItems: 'flex-end',
  },
  modalCloseBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    height: 36,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  formContainer: {
    gap: Spacing.md,
  },
  topActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: Spacing.md,
  },
  breadcrumbColumn: {
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  mainPageTitle: {
    fontSize: FontSize.xxl - 2,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  mainPageSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  splitLayout: {
    gap: Spacing.lg,
  },
  rowLayout: {
    flexDirection: 'row',
  },
  columnLayout: {
    flexDirection: 'column',
  },
  leftColumn: {
    flex: 1.5,
    gap: Spacing.lg,
  },
  rightColumn: {
    flex: 1,
    gap: Spacing.lg,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: Spacing.sm,
  },
  headerIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#EEF4F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  fieldGroup: {
    gap: 6,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  textInput: {
    height: 38,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: FontSize.sm,
    backgroundColor: Colors.surface,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    paddingHorizontal: 16,
    height: 38,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  profilePicUploadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 12,
  },
  profilePicLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePicLargeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: FontWeight.bold,
  },
  profilePicActionCol: {
    flex: 1,
    gap: 4,
  },
  profilePicTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  profilePicSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  profilePicButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  profilePicUploadBtn: {
    backgroundColor: '#FFC72C',
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicUploadBtnText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  profilePicRemoveBtn: {
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicRemoveBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  policyEditItemRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: Spacing.sm,
  },
  bulletDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  bulletTitleDisplay: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#1A1A2E',
  },
  bulletDescDisplay: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bulletActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBulletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    borderRadius: 4,
    height: 36,
    marginTop: 10,
  },
  addBulletBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  smallBtn: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
