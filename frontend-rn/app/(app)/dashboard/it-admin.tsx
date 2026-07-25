/**
 * IT Admin Dashboard
 * The IT Publisher is now the acting system administrator.
 * This dashboard merges admin oversight + publishing capabilities.
 * It re-uses the full admin panel implementation with the role rebadged as "IT Admin".
 */
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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DashboardShell } from '../../../components/DashboardShell';
import { useAuthStore } from '../../../store/auth';
import { Card } from '../../../components/ui/Card';
import { dashboardApi } from '../../../services/api';
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
  label, value, icon, iconColor, iconBgColor,
  badgeText, badgeColor = Colors.textSecondary,
  badgeBgColor = '#F3F4F6', valueColor = Colors.textPrimary,
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

// Role options — no standalone admin role
const ROLE_OPTIONS = [
  { label: 'Content Requestor', value: 'requestor' },
  { label: 'Office Head', value: 'office_head' },
  { label: 'Vice President', value: 'vice_president' },
  { label: 'President', value: 'president' },
  { label: 'IMC / QA Checker', value: 'imc_qa_checker' },
  { label: 'IT Admin (Publisher)', value: 'it_publisher' },
];

const DEPARTMENT_OPTIONS = [
  'ICT',
  'Marketing',
  'Academic Affairs',
  'Administration',
  'Office of the President',
  'Institutional Marketing & Communications',
];

export default function ITAdminDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();

  // Tab state: 'overview' | 'user-management' | 'all-posts' | 'approval-queue' | 'policy-rules' | 'account-settings'
  const [activeTab, setActiveTab] = useState('overview');

  const {
    policySections, effectiveDate, lastUpdatedDate,
    fetchPolicy, updatePolicy, isLoading: isPolicyLoading
  } = usePolicyStore();

  const [editableEffectiveDate, setEditableEffectiveDate] = useState('');
  const [editableLastUpdatedDate, setEditableLastUpdatedDate] = useState('');
  const [editableSections, setEditableSections] = useState<any[]>([]);

  useEffect(() => { fetchPolicy(); }, []);
  useEffect(() => {
    if (policySections) setEditableSections(JSON.parse(JSON.stringify(policySections)));
    if (effectiveDate) setEditableEffectiveDate(effectiveDate);
    if (lastUpdatedDate) setEditableLastUpdatedDate(lastUpdatedDate);
  }, [policySections, effectiveDate, lastUpdatedDate]);

  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);

  const [users, setUsers] = useState<any[]>([
    { id: '1', email: 'it.support@jmcfi.edu.ph', role: 'it_publisher', department: 'ICT', created_at: 'Jan 20, 2024' },
    { id: '2', email: 'v.academic@jmcfi.edu.ph', role: 'vice_president', department: 'Academic Affairs', created_at: 'Nov 05, 2023' },
    { id: '3', email: 'maria.delacruz@jmcfi.edu.ph', role: 'requestor', department: 'Administration', created_at: 'Mar 10, 2024' },
    { id: '4', email: 'office.head@jmcfi.edu.ph', role: 'office_head', department: 'Marketing', created_at: 'Feb 14, 2024' },
    { id: '5', email: 'imc.qa@jmcfi.edu.ph', role: 'imc_qa_checker', department: 'Institutional Marketing & Communications', created_at: 'Apr 01, 2024' },
  ]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [rolesList, setRolesList] = useState(ROLE_OPTIONS);
  const [departmentsList, setDepartmentsList] = useState(DEPARTMENT_OPTIONS);
  const [newUserRole, setNewUserRole] = useState('requestor');
  const [newUserDepartment, setNewUserDepartment] = useState('Marketing');

  const handleAddRole = () => {
    const roleName = prompt('Enter new institutional role name:');
    if (roleName && roleName.trim()) {
      const val = roleName.trim().toLowerCase().replace(/\s+/g, '_');
      const newOpt = { label: roleName.trim(), value: val };
      setRolesList((prev) => [...prev, newOpt]);
      setNewUserRole(val);
    }
  };

  const handleDeleteRole = () => {
    if (rolesList.length <= 1) {
      alert('Cannot delete the last remaining role.');
      return;
    }
    const roleToDelete = rolesList.find((r) => r.value === newUserRole);
    if (confirm(`Are you sure you want to remove role "${roleToDelete?.label}"?`)) {
      const updated = rolesList.filter((r) => r.value !== newUserRole);
      setRolesList(updated);
      setNewUserRole(updated[0].value);
    }
  };

  const handleAddDepartment = () => {
    const deptName = prompt('Enter new department name:');
    if (deptName && deptName.trim()) {
      const trimmed = deptName.trim();
      setDepartmentsList((prev) => [...prev, trimmed]);
      setNewUserDepartment(trimmed);
    }
  };

  const handleDeleteDepartment = () => {
    if (departmentsList.length <= 1) {
      alert('Cannot delete the last remaining department.');
      return;
    }
    if (confirm(`Are you sure you want to remove department "${newUserDepartment}"?`)) {
      const updated = departmentsList.filter((d) => d !== newUserDepartment);
      setDepartmentsList(updated);
      setNewUserDepartment(updated[0]);
    }
  };
  const [showPassword, setShowPassword] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<string>('requestor');

  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Publishing queue items
  const mockPublishQueue = [
    { id: 'pub1', title: 'JMCFI Open House 2024', requestor: 'Admissions Office', department: 'Administration', status: 'ready_to_publish', platforms: ['FB', 'IG', 'WEB'], approvedBy: 'IMC/QA', approvedAt: '2h ago' },
    { id: 'pub2', title: 'Library Expansion Update', requestor: 'Library', department: 'Academic Affairs', status: 'ready_to_publish', platforms: ['FB', 'PORTAL'], approvedBy: 'IMC/QA', approvedAt: '5h ago' },
    { id: 'pub3', title: 'Scholarship Call for Applications', requestor: 'Finance', department: 'Finance', status: 'published', platforms: ['FB', 'WEB'], approvedBy: 'IMC/QA', approvedAt: '1d ago' },
    { id: 'pub4', title: 'Foundation Day Celebration', requestor: 'HR Dept', department: 'Human Resources', status: 'published', platforms: ['FB', 'IG'], approvedBy: 'IMC/QA', approvedAt: '2d ago' },
  ];

  // All Posts mock data
  const allMockPosts = [
    { id: '1', title: 'Graduation 2024 Announcement', author: "Registrar's Office", timeAgo: '2h ago', department: 'Administration', status: 'pending_review', statusLabel: 'PENDING REVIEW', reviewer: 'Office Head', platforms: ['FB', 'PORTAL'] },
    { id: '2', title: 'Athletic Meet Results', author: 'Sports Dept', timeAgo: '1d ago', department: 'Student Affairs', status: 'approved', statusLabel: 'APPROVED', reviewer: '—', platforms: ['IG'] },
  ];

  // New Redesign Mock Data
  const [previewPost, setPreviewPost] = useState<any>(null);
  const mockTablePosts = [
    { id: 'p1', title: 'Intramurals 2026 Opening Ceremony', department: 'CITE', requestedBy: 'Juan Dela Cruz', status: 'Pending', stage: 'Department Head', stageCount: '0/4', platforms: ['FB', 'IG', 'WEB'], requestedOn: 'May 19, 2026', requestedTime: '10:30 AM', image: 'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?auto=format&fit=crop&w=150&q=80' },
    { id: 'p2', title: 'Scholarship Program 2026', department: 'COBE', requestedBy: 'Maria Santos', status: 'Pending', stage: 'Vice President', stageCount: '1/4', platforms: ['FB', 'WEB'], requestedOn: 'May 19, 2026', requestedTime: '09:15 AM', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=150&q=80' },
    { id: 'p3', title: 'Community Outreach Activity', department: 'CAS', requestedBy: 'Ana Reyes', status: 'Draft', stage: 'Draft', stageCount: '0/4', platforms: ['IG', 'WEB'], requestedOn: 'May 18, 2026', requestedTime: '04:45 PM', image: 'https://images.unsplash.com/photo-1593113511110-3882f059e6c1?auto=format&fit=crop&w=150&q=80' },
    { id: 'p4', title: 'Career Fair 2026', department: 'CAS', requestedBy: 'Mark Lim', status: 'Pending', stage: 'IMC / Branding', stageCount: '3/4', platforms: ['FB', 'WEB'], requestedOn: 'May 18, 2026', requestedTime: '11:05 AM', image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=150&q=80' },
    { id: 'p5', title: 'CITE Week 2026 Teaser', department: 'CITE', requestedBy: 'Sarah Lee', status: 'Published', stage: 'Published', stageCount: '4/4', platforms: ['FB', 'IG', 'WEB'], requestedOn: 'May 17, 2026', requestedTime: '02:15 PM', image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=150&q=80' },
    { id: 'p6', title: 'Enrollment Announcement', department: 'REG', requestedBy: 'Lina Cruz', status: 'Published', stage: 'Published', stageCount: '4/4', platforms: ['FB', 'WEB'], requestedOn: 'May 17, 2026', requestedTime: '09:30 AM', image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=150&q=80' },
  ];

  const platforms = [
    { name: 'Facebook', percentage: 65, barColor: Colors.primary },
    { name: 'Instagram', percentage: 15, barColor: '#B45309' },
    { name: 'Twitter/X', percentage: 10, barColor: '#6B7280' },
    { name: 'Portal', percentage: 10, barColor: '#3B82F6' },
  ];

  // Audit Logs State & Mock Data
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditEventTypeFilter, setAuditEventTypeFilter] = useState('ALL');
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);

  const mockAuditLogs = [
    {
      id: 'log-1',
      timestamp: 'May 20, 2026 • 10:45:12 AM',
      userName: 'IT Admin Support',
      userEmail: 'it.support@jmcfi.edu.ph',
      userRole: 'IT Admin',
      initials: 'IT',
      avatarBg: '#0B2545',
      eventType: 'POLICY_UPDATE',
      badgeBg: '#F3E8FF',
      badgeColor: '#7C3AED',
      description: 'Updated institutional posting policy rules to version v2.4.',
      ipAddress: '192.168.1.104',
      device: 'Chrome 124 / Win11',
      severity: 'INFO',
      severityBg: '#EFF6FF',
      severityColor: '#1E40AF',
      payload: '{\n  "version": "v2.4",\n  "updatedBy": "it.support@jmcfi.edu.ph",\n  "sectionsModified": ["Section 3: Branding Rules"]\n}',
    },
    {
      id: 'log-2',
      timestamp: 'May 20, 2026 • 09:30:00 AM',
      userName: 'Dr. Ricardo Magsaysay',
      userEmail: 'v.academic@jmcfi.edu.ph',
      userRole: 'Vice President',
      initials: 'RM',
      avatarBg: '#DC2626',
      eventType: 'CONTENT_APPROVAL',
      badgeBg: '#ECFDF5',
      badgeColor: '#047857',
      description: 'Approved publication request "Intramurals 2026 Opening Ceremony"',
      ipAddress: '192.168.1.112',
      device: 'Safari 17 / macOS',
      severity: 'INFO',
      severityBg: '#EFF6FF',
      severityColor: '#1E40AF',
      payload: '{\n  "postId": "req1",\n  "action": "APPROVED",\n  "targetChannels": ["Facebook", "Instagram", "Website"]\n}',
    },
    {
      id: 'log-3',
      timestamp: 'May 19, 2026 • 04:15:45 PM',
      userName: 'Prof. Mary Ann',
      userEmail: 'office.head@jmcfi.edu.ph',
      userRole: 'Office Head',
      initials: 'MA',
      avatarBg: '#D97706',
      eventType: 'CONTENT_REJECT',
      badgeBg: '#FEF2F2',
      badgeColor: '#B91C1C',
      description: 'Rejected request "Holiday Poster Design Draft" (Reason: Logo alignment)',
      ipAddress: '192.168.1.118',
      device: 'Edge 122 / Win11',
      severity: 'WARNING',
      severityBg: '#FEF3C7',
      severityColor: '#D97706',
      payload: '{\n  "postId": "req7",\n  "action": "REJECTED",\n  "comment": "Incorrect logo format used in footer."\n}',
    },
    {
      id: 'log-4',
      timestamp: 'May 19, 2026 • 02:00:22 PM',
      userName: 'IT Admin Support',
      userEmail: 'it.support@jmcfi.edu.ph',
      userRole: 'IT Admin',
      initials: 'IT',
      avatarBg: '#0B2545',
      eventType: 'USER_MODIFIED',
      badgeBg: '#FEF3C7',
      badgeColor: '#D97706',
      description: 'Updated user role for "maria.delacruz@jmcfi.edu.ph" to Content Requestor',
      ipAddress: '192.168.1.104',
      device: 'Chrome 124 / Win11',
      severity: 'INFO',
      severityBg: '#EFF6FF',
      severityColor: '#1E40AF',
      payload: '{\n  "userId": "usr_3",\n  "previousRole": "guest",\n  "newRole": "requestor"\n}',
    },
    {
      id: 'log-5',
      timestamp: 'May 18, 2026 • 08:10:05 AM',
      userName: 'Sarah Jenkins',
      userEmail: 'imc.qa@jmcfi.edu.ph',
      userRole: 'IMC QA',
      initials: 'SJ',
      avatarBg: '#7C3AED',
      eventType: 'QUALITY_CLEARANCE',
      badgeBg: '#F0FDFA',
      badgeColor: '#0D9488',
      description: 'Passed quality clearance check for "2024 Alumni Homecoming Gala"',
      ipAddress: '192.168.1.125',
      device: 'Chrome 123 / macOS',
      severity: 'INFO',
      severityBg: '#EFF6FF',
      severityColor: '#1E40AF',
      payload: '{\n  "postId": "q1",\n  "qualityChecklist": {\n    "logo": true,\n    "colors": true,\n    "caption": true\n  }\n}',
    },
  ];

  // Analytics Mock Data
  const analyticsOverview = {
    totalVolume: '1,284',
    avgVelocity: '4.2 hrs',
    complianceRate: '98.4%',
    activeUsers: '142',
    departmentBreakdown: [
      { name: 'CITE', count: 488, percentage: 38, barColor: '#1E40AF' },
      { name: 'COBE', count: 321, percentage: 25, barColor: '#047857' },
      { name: 'CAS', count: 231, percentage: 18, barColor: '#D97706' },
      { name: 'CED', count: 154, percentage: 12, barColor: '#7C3AED' },
      { name: 'Others', count: 90, percentage: 7, barColor: '#6B7280' },
    ],
    platformStats: [
      { name: 'Facebook', posts: '840 posts', reach: '45.2K Reach', icon: 'logo-facebook' as const, color: '#1877F2', bgColor: '#EFF6FF' },
      { name: 'Instagram', posts: '620 posts', reach: '28.9K Reach', icon: 'logo-instagram' as const, color: '#E1306C', bgColor: '#FDF2F8' },
      { name: 'Website', posts: '450 posts', reach: '18.4K Reach', icon: 'globe-outline' as const, color: '#059669', bgColor: '#ECFDF5' },
    ],
  };

  useEffect(() => {
    dashboardApi.getStats()
      .then(r => setStats(r.data))
      .catch(() => setStats({
        total_users: '1,284', total_submissions: '4,592',
        pending_review: '156', approved_posts: '3,902',
        returned_revision: '421', published_posts: '3,745',
      }));
    dashboardApi.getRecentActivity()
      .then(r => setActivities(r.data ?? []))
      .catch(() => setActivities([
        { id: 1, userInitials: 'JD', userName: 'John Doe', action: 'approved a submission for', target: 'Arts & Sciences', time: '2 minutes ago', platform: 'Institutional Facebook Page', color: '#1E40AF', bgColor: '#DBEAFE' },
        { id: 2, userInitials: 'MS', userName: 'Mary Smith', action: 'requested revision for', target: 'Enrollment Update', time: '15 minutes ago', platform: 'JMCFI Official Portal', color: '#B45309', bgColor: '#FEF3C7' },
        { id: 3, userInitials: 'RG', userName: 'Rey Garcia', action: 'submitted a post for', target: 'Foundation Day', time: '1 hour ago', platform: 'Instagram', color: '#7C3AED', bgColor: '#EDE9FE' },
      ]));
  }, []);

  const handleCreateAccount = () => {
    if (!newUserEmail || !newUserPassword) { alert('Please fill in both email and password.'); return; }
    if (!newUserEmail.includes('@')) { alert('Please enter a valid email.'); return; }
    const newAccount = {
      id: Date.now().toString(),
      email: newUserEmail, role: newUserRole,
      department: newUserDepartment,
      created_at: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    };
    setUsers([newAccount, ...users]);
    setNewUserEmail(''); setNewUserPassword('');
    alert('Institutional account created successfully!');
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Are you sure you want to delete this user account?')) setUsers(users.filter(u => u.id !== id));
  };

  const handleSaveEditedRole = (id: string) => {
    setUsers(users.map(u => u.id === id ? { ...u, role: editingUserRole } : u));
    setEditingUserId(null);
    alert('User role updated successfully!');
  };

  const isLargeScreen = width > 1024;
  const isTablet = width > 768;

  const getRoleBadgeDetails = (role: string) => {
    switch (role) {
      case 'it_publisher': return { label: 'IT ADMIN', color: '#1E40AF', bgColor: '#DBEAFE' };
      case 'vice_president': return { label: 'VICE PRESIDENT', color: '#B45309', bgColor: '#FEF3C7' };
      case 'requestor': return { label: 'REQUESTOR', color: '#0F766E', bgColor: '#CCFBF1' };
      case 'office_head': return { label: 'OFFICE HEAD', color: '#92400E', bgColor: '#FEF3C7' };
      case 'president': return { label: 'PRESIDENT', color: '#701A75', bgColor: '#FDF4FF' };
      case 'imc_qa_checker': return { label: 'IMC / QA', color: '#6366F1', bgColor: '#E0E7FF' };
      default: return { label: role.toUpperCase(), color: Colors.textPrimary, bgColor: '#F3F4F6' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_review': return { dotColor: '#D97706', textColor: '#854D0E' };
      case 'approved': return { dotColor: '#16A34A', textColor: '#15803D' };
      case 'revision_requested': return { dotColor: '#DC2626', textColor: '#B91C1C' };
      default: return { dotColor: '#6B7280', textColor: '#374151' };
    }
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(userFilter.toLowerCase()));
  const postsToShow = statusFilter === 'all' ? allMockPosts : allMockPosts.filter(p => p.status === statusFilter);
  const publishQueueToShow = mockPublishQueue;

  return (
    <DashboardShell title="IT Admin Panel" activeTab={activeTab} onTabChange={setActiveTab}>
      {/* Title block removed as requested */}

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <>
          <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 16, marginBottom: 24 }}>
            <Card style={{ flex: 1, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f3e8ff', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="document-text" size={24} color="#7e22ce" />
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' }}>Total Content</Text>
                <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>53</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>All content requests</Text>
              </View>
            </Card>

            <Card style={{ flex: 1, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="logo-facebook" size={24} color="#1877F2" />
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' }}>Facebook Posts</Text>
                <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>28</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>Published</Text>
              </View>
            </Card>

            <Card style={{ flex: 1, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#fdf2f8', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="logo-instagram" size={24} color="#E1306C" />
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' }}>Instagram Posts</Text>
                <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>21</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>Published</Text>
              </View>
            </Card>

            <Card style={{ flex: 1, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="globe-outline" size={24} color="#16a34a" />
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' }}>Website Posts</Text>
                <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>17</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>Published</Text>
              </View>
            </Card>
          </View>

          {/* ── ALL CONTENT REQUESTS TABLE ── */}
          <Card style={{ padding: 0, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
            {/* Table Controls */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexWrap: 'wrap', gap: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary }}>All Content Requests</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 6, paddingHorizontal: 12, height: 36, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <Ionicons name="search" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
                  <TextInput placeholder="Search requests..." style={{ fontSize: 13, minWidth: 160 }} />
                </View>
                <select style={{ height: 36, fontSize: 13, borderRadius: 6, border: '1px solid #e5e7eb', paddingLeft: 12, paddingRight: 24, outline: 'none', backgroundColor: '#fff', color: '#374151' }}>
                  <option>All Status</option>
                  <option>Pending</option>
                  <option>Published</option>
                </select>
                <select style={{ height: 36, fontSize: 13, borderRadius: 6, border: '1px solid #e5e7eb', paddingLeft: 12, paddingRight: 24, outline: 'none', backgroundColor: '#fff', color: '#374151' }}>
                  <option>All Departments</option>
                  <option>CITE</option>
                  <option>CAS</option>
                </select>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 36, borderRadius: 6, border: '1px solid #e5e7eb', paddingHorizontal: 12, backgroundColor: '#fff' }}>
                  <Text style={{ fontSize: 13, color: '#374151', marginRight: 8 }}>May 12 - May 19, 2026</Text>
                  <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                </View>
                <TouchableOpacity style={{ height: 36, width: 36, borderRadius: 6, border: '1px solid #e5e7eb', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                  <Ionicons name="options-outline" size={16} color="#374151" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Table Header */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ flexGrow: 1 }}>
              <View style={{ flex: 1, minWidth: 1000 }}>
                <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                  <Text style={{ flex: 2, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>REQUEST TITLE</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>DEPARTMENT</Text>
                  <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>REQUESTED BY</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>STATUS</Text>
                  <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>CURRENT STAGE</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>PLATFORMS</Text>
                  <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '600', color: '#6b7280' }}>REQUESTED ON</Text>
                  <Text style={{ width: 120, fontSize: 11, fontWeight: '600', color: '#6b7280', textAlign: 'center' }}>ACTIONS</Text>
                </View>

                {/* Table Rows */}
                {mockTablePosts.map((post) => (
                  <View key={post.id} style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', alignItems: 'center' }}>
                    {/* TITLE */}
                    <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', paddingRight: 16 }}>
                      <Image source={{ uri: post.image }} style={{ width: 48, height: 32, borderRadius: 4, marginRight: 12 }} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }} numberOfLines={2}>{post.title}</Text>
                    </View>

                    {/* DEPT */}
                    <View style={{ flex: 1 }}>
                      <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' }}>
                        <Text style={{ fontSize: 11, fontWeight: '500', color: '#374151' }}>{post.department}</Text>
                      </View>
                    </View>

                    {/* REQ BY */}
                    <View style={{ flex: 1.5 }}>
                      <Text style={{ fontSize: 13, color: '#374151' }}>{post.requestedBy}</Text>
                    </View>

                    {/* STATUS */}
                    <View style={{ flex: 1 }}>
                      <View style={{
                        backgroundColor: post.status === 'Pending' ? '#fef3c7' : post.status === 'Published' ? '#dcfce7' : '#f3f4f6',
                        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start'
                      }}>
                        <Text style={{
                          fontSize: 11, fontWeight: '500',
                          color: post.status === 'Pending' ? '#b45309' : post.status === 'Published' ? '#16a34a' : '#4b5563'
                        }}>{post.status}</Text>
                      </View>
                    </View>

                    {/* STAGE */}
                    <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
                      <Text style={{ fontSize: 13, color: '#374151' }}>{post.stage}</Text>
                      <Text style={{ fontSize: 12, color: '#9ca3af' }}>{post.stageCount}</Text>
                    </View>

                    {/* PLATFORMS */}
                    <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                      {post.platforms.includes('FB') && <Ionicons name="logo-facebook" size={16} color="#1877F2" />}
                      {post.platforms.includes('IG') && <Ionicons name="logo-instagram" size={16} color="#E1306C" />}
                      {post.platforms.includes('WEB') && <Ionicons name="globe-outline" size={16} color="#3b82f6" />}
                    </View>

                    {/* DATE */}
                    <View style={{ flex: 1.5 }}>
                      <Text style={{ fontSize: 12, color: '#374151' }}>{post.requestedOn}</Text>
                      <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{post.requestedTime}</Text>
                    </View>

                    {/* ACTIONS */}
                    <View style={{ width: 120, flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                      <TouchableOpacity onPress={() => setPreviewPost(post)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3e8ff', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="eye-outline" size={14} color="#7e22ce" />
                      </TouchableOpacity>
                      <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#3b0764', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="paper-plane-outline" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

              </View>
            </ScrollView>

            {/* Pagination Footer */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', flexWrap: 'wrap', gap: 12 }}>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>Showing 1 to 6 of 53 requests</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TouchableOpacity style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={16} color="#9ca3af" /></TouchableOpacity>
                <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#3b0764', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>1</Text></TouchableOpacity>
                <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#4b5563', fontSize: 13 }}>2</Text></TouchableOpacity>
                <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#4b5563', fontSize: 13 }}>3</Text></TouchableOpacity>
                <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#4b5563', fontSize: 13 }}>4</Text></TouchableOpacity>
                <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#4b5563', fontSize: 13 }}>5</Text></TouchableOpacity>
                <Text style={{ color: '#9ca3af', marginHorizontal: 4 }}>...</Text>
                <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#4b5563', fontSize: 13 }}>9</Text></TouchableOpacity>
                <TouchableOpacity style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-forward" size={16} color="#9ca3af" /></TouchableOpacity>

                <select style={{ marginLeft: 16, height: 32, fontSize: 13, borderRadius: 6, border: '1px solid #e5e7eb', paddingLeft: 8, paddingRight: 24, outline: 'none', backgroundColor: '#fff', color: '#374151' }}>
                  <option>10 / page</option>
                  <option>20 / page</option>
                </select>
              </View>
            </View>
          </Card>
        </>
      )}

      {/* ── USER MANAGEMENT TAB ── */}
      {activeTab === 'user-management' && (
        <View style={styles.userTabContainer}>
          <Card style={styles.userCard}>
            <Text style={styles.sectionHeader}>Create New Institutional Account</Text>
            <View style={[styles.formRow, isTablet ? styles.formRowLayout : styles.formColumnLayout]}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Email Address</Text>
                <TextInput style={styles.formInput} placeholder="user@jmcfi.edu.ph" value={newUserEmail} onChangeText={setNewUserEmail} autoCapitalize="none" />
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
              <View style={styles.formField}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.formLabel, { flexShrink: 1, marginRight: 8 }]} numberOfLines={1}>Role</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      title="Add New Role"
                      style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#EFF6FF', flexDirection: 'row', alignItems: 'center', gap: 3 }}
                      onPress={handleAddRole}
                    >
                      <Ionicons name="add-circle-outline" size={14} color="#1E40AF" />
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1E40AF' }}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      title="Delete Selected Role"
                      style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FEF2F2', flexDirection: 'row', alignItems: 'center', gap: 3 }}
                      onPress={handleDeleteRole}
                    >
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#DC2626' }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <select
                  value={newUserRole}
                  onChange={(e: any) => setNewUserRole(e.target.value)}
                  style={{ height: 38, fontSize: 13, borderRadius: 4, border: '1px solid #E5E7EB', backgroundColor: '#fff', color: '#1A1A2E', paddingLeft: 10, outline: 'none', cursor: 'pointer', width: '100%' }}
                >
                  {rolesList.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </View>

              <View style={styles.formField}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.formLabel, { flexShrink: 1, marginRight: 8 }]} numberOfLines={1}>Department</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      title="Add New Department"
                      style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#EFF6FF', flexDirection: 'row', alignItems: 'center', gap: 3 }}
                      onPress={handleAddDepartment}
                    >
                      <Ionicons name="add-circle-outline" size={14} color="#1E40AF" />
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1E40AF' }}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      title="Delete Selected Department"
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
                  {departmentsList.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </View>
            </View>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateAccount}>
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={styles.createBtnText}>Create Account</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.userCard}>
            <View style={styles.userListHeader}>
              <Text style={styles.sectionHeader}>Institutional Accounts ({filteredUsers.length})</Text>
              <TextInput style={styles.searchInput} placeholder="Search by email..." value={userFilter} onChangeText={setUserFilter} />
            </View>
            {filteredUsers.map((u) => {
              const badge = getRoleBadgeDetails(u.role);
              return (
                <View key={u.id} style={styles.userRow}>
                  <View style={styles.userInfo}>
                    <View style={[styles.userAvatar, { backgroundColor: badge.bgColor }]}>
                      <Text style={[styles.userAvatarText, { color: badge.color }]}>{u.email.substring(0, 2).toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={styles.userEmail}>{u.email}</Text>
                      <Text style={styles.userMeta}>{u.department} • {u.created_at}</Text>
                    </View>
                  </View>
                  <View style={styles.userActions}>
                    {editingUserId === u.id ? (
                      <View style={styles.inlineEditRow}>
                        <select value={editingUserRole} onChange={(e: any) => setEditingUserRole(e.target.value)} style={{ height: 32, fontSize: 12, borderRadius: 4, border: '1px solid #E5E7EB', backgroundColor: '#fff', paddingLeft: 6, outline: 'none', cursor: 'pointer' }}>
                          {ROLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveEditedRole(u.id)}>
                          <Text style={styles.saveBtnText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingUserId(null)}>
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <View style={[styles.roleBadge, { backgroundColor: badge.bgColor }]}>
                          <Text style={[styles.roleBadgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                        <TouchableOpacity style={styles.editBtn} onPress={() => { setEditingUserId(u.id); setEditingUserRole(u.role); }}>
                          <Ionicons name="pencil-outline" size={15} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteUser(u.id)}>
                          <Ionicons name="trash-outline" size={15} color="#DC2626" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      )}


      {/* ── POLICY RULES TAB ── */}
      {activeTab === 'policy-rules' && (
        <Card style={styles.userCard}>
          <Text style={styles.sectionHeader}>Policy Rules</Text>
          <Text style={styles.policyNote}>Manage and update institutional posting policy rules.</Text>
          {editableSections.map((section, sIdx) => (
            <View key={sIdx} style={styles.policySection}>
              <Text style={styles.policySectionTitle}>{section.title}</Text>
              {section.bullets?.map((bullet: any, bIdx: number) => (
                <View key={bIdx} style={styles.policyBullet}>
                  <View style={styles.bulletDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bulletTitle}>{bullet.title}</Text>
                    {bullet.description && <Text style={styles.bulletDesc}>{bullet.description}</Text>}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </Card>
      )}

      {/* ── ACCOUNT SETTINGS TAB ── */}
      {activeTab === 'account-settings' && (
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
                  <Text style={styles.profileAvatarTextLarge}>{user?.name?.substring(0, 2).toUpperCase() || 'IT'}</Text>
                </View>
                <View style={styles.profilePictureInfo}>
                  <Text style={styles.profilePictureTitle}>Profile Picture</Text>
                  <Text style={styles.profilePictureDesc}>PNG or JPG formats supported. Max 2MB file size.</Text>
                  <View style={styles.profilePictureActions}>
                    <TouchableOpacity style={styles.uploadBtn}>
                      <Text style={styles.uploadBtnText}>Upload New Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>FULL NAME</Text>
                <TextInput style={styles.settingsFormInput} defaultValue={user?.name || ''} />
              </View>

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>EMAIL ADDRESS</Text>
                <TextInput
                  defaultValue={user?.email || ''}
                  editable={false}
                  style={[styles.settingsFormInput, styles.settingsFormInputDisabled]}
                />
              </View>

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>DEPARTMENT</Text>
                <TextInput
                  defaultValue="College of Computing Studies"
                  editable={false}
                  style={[styles.settingsFormInput, styles.settingsFormInputDisabled]}
                />
              </View>

              <TouchableOpacity style={styles.saveDetailsBtn}>
                <Text style={styles.saveDetailsBtnText}>Save Details</Text>
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
                <TextInput style={styles.settingsFormInput} placeholder="Enter current password" secureTextEntry />
              </View>

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>NEW PASSWORD</Text>
                <TextInput style={styles.settingsFormInput} placeholder="Enter new password" secureTextEntry />
              </View>

              <View style={styles.settingsFormGroup}>
                <Text style={styles.settingsFormLabel}>CONFIRM PASSWORD</Text>
                <TextInput style={styles.settingsFormInput} placeholder="Confirm new password" secureTextEntry />
              </View>

              <TouchableOpacity style={styles.saveDetailsBtn}>
                <Text style={styles.saveDetailsBtnText}>Change Password</Text>
              </TouchableOpacity>
            </Card>
          </View>
        </View>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === 'analytics' && (() => {
        const monthsData = [
          { month: 'Jan', posts: 120 }, { month: 'Feb', posts: 150 }, { month: 'Mar', posts: 180 },
          { month: 'Apr', posts: 210 }, { month: 'May', posts: 170 }, { month: 'Jun', posts: 240 },
          { month: 'Jul', posts: 290 }, { month: 'Aug', posts: 320 }, { month: 'Sep', posts: 380 },
          { month: 'Oct', posts: 350 }, { month: 'Nov', posts: 410 }, { month: 'Dec', posts: 450 }
        ];
        const maxPosts = 450;
        
        return (
          <View style={{ gap: Spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827' }}>System Analytics</Text>
                <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Content creation trends and performance metrics across the year.</Text>
              </View>
            </View>

            {/* NEW: Mini Stat Cards Row */}
            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 16 }}>
              {[
                { title: 'Total Reach', value: '1.2M', trend: '+12%', icon: 'people', color: '#1877F2', bg: '#EBF4FF' },
                { title: 'Avg. Engagement', value: '4.8%', trend: '+0.5%', icon: 'heart', color: '#E4405F', bg: '#FCEBF0' },
                { title: 'Content Published', value: '3,270', trend: '+24%', icon: 'document-text', color: '#7C3AED', bg: '#F3E8FF' },
                { title: 'Pending Approval', value: '18', trend: '-2', icon: 'time', color: '#F59E0B', bg: '#FEF3C7', isNegative: true }
              ].map(stat => (
                <Card key={stat.title} style={{ flex: 1, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#FFFFFF', borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: stat.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280' }}>{stat.title}</Text>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginVertical: 2 }}>{stat.value}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: stat.isNegative ? '#DC2626' : '#16A34A' }}>{stat.trend} this month</Text>
                  </View>
                </Card>
              ))}
            </View>

            {/* Main Charts Row */}
            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout, { gap: 24 }]}>
              
              {/* Yearly Bar Chart */}
              <Card style={[styles.userCard, { flex: 2, padding: 24, backgroundColor: '#FFFFFF', borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Publication Volume</Text>
                    <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Monthly posts created in 2026</Text>
                  </View>
                  <View style={{ backgroundColor: '#F3E8FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                    <Text style={{ color: '#7C3AED', fontWeight: 'bold', fontSize: 12 }}>Total: 3,270</Text>
                  </View>
                </View>

                {/* Bar Chart Canvas */}
                <View style={{ height: 220, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', position: 'relative' }}>
                  {/* Grid lines */}
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#F3F4F6', borderStyle: 'dashed' }} />
                  <View style={{ position: 'absolute', top: 110, left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#F3F4F6', borderStyle: 'dashed' }} />
                  
                  {monthsData.map((item, index) => {
                    const heightPercent = (item.posts / maxPosts) * 100;
                    return (
                      <View key={item.month} style={{ alignItems: 'center', width: '7%', gap: 8 }}>
                        <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '600' }}>{item.posts}</Text>
                        <View style={{ width: '100%', height: `${heightPercent}%`, backgroundColor: '#8B5CF6', borderRadius: 6, opacity: index === 11 ? 1 : 0.7 }} />
                        <Text style={{ position: 'absolute', bottom: -24, fontSize: 11, color: '#6B7280', fontWeight: '500' }}>{item.month}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>

              {/* Round Data / Circular Distribution */}
              <Card style={[styles.userCard, { flex: 1, padding: 24, backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 }]}>
                <View style={{ width: '100%', alignItems: 'flex-start', marginBottom: 20 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Platform Reach</Text>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Audience distribution</Text>
                </View>

                {/* Simulated 4-Color Donut Chart */}
                <View style={{ 
                  width: 180, height: 180, borderRadius: 90, borderWidth: 24, 
                  borderTopColor: '#1877F2',    // Facebook
                  borderRightColor: '#E4405F',  // Instagram
                  borderBottomColor: '#1DA1F2', // Twitter
                  borderLeftColor: '#9CA3AF',   // Other/Website
                  alignItems: 'center', justifyContent: 'center', position: 'relative', marginTop: 10 
                }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#111827' }}>Total</Text>
                    <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginTop: 2 }}>PLATFORMS</Text>
                  </View>
                </View>

                {/* Legend */}
                <View style={{ width: '100%', marginTop: 32, gap: 12 }}>
                  {[
                    { name: 'Facebook', color: '#1877F2', percent: '40%' },
                    { name: 'Instagram', color: '#E4405F', percent: '25%' },
                    { name: 'Twitter', color: '#1DA1F2', percent: '20%' },
                    { name: 'Other', color: '#9CA3AF', percent: '15%' }
                  ].map(platform => (
                    <View key={platform.name} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: platform.color }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>{platform.name}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#111827' }}>{platform.percent}</Text>
                    </View>
                  ))}
                </View>
              </Card>

            </View>
          </View>
        );
      })()}

      {/* ── AUDIT LOGS TAB ── */}
      {activeTab === 'audit-logs' && (() => {
        const filteredLogs = mockAuditLogs.filter((log) => {
          const matchesQuery =
            (log.user || '').toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
            (log.details || '').toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
            (log.action || '').toLowerCase().includes(auditSearchQuery.toLowerCase());
          const matchesType = auditEventTypeFilter === 'ALL' || log.action === auditEventTypeFilter;
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: 240, height: 38, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12 }}>
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
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', height: 38, paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }} onPress={() => alert('Exporting audit log records as CSV...')}>
                    <Ionicons name="download-outline" size={16} color="#374151" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Export CSV</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick Filter Category Pills removed as requested */}

              {/* Logs Table Matching Screenshot */}
              <View style={styles.table}>
                <View style={[{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingVertical: 12 }]}>
                  <Text style={{ flex: 1.8, fontSize: FontSize.xs + 1, fontWeight: 'bold', color: '#374151' }}>Timestamp</Text>
                  <Text style={{ flex: 2, fontSize: FontSize.xs + 1, fontWeight: 'bold', color: '#374151' }}>User</Text>
                  <Text style={{ flex: 1.5, fontSize: FontSize.xs + 1, fontWeight: 'bold', color: '#374151' }}>Action</Text>
                  <Text style={{ flex: 4, fontSize: FontSize.xs + 1, fontWeight: 'bold', color: '#374151' }}>Details</Text>
                </View>

                {filteredLogs.map((log) => (
                  <View key={log.id} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }]}>
                    {/* Timestamp */}
                    <Text style={{ flex: 1.8, fontSize: FontSize.xs + 1, color: '#6B7280' }}>{log.timestamp}</Text>

                    {/* User */}
                    <Text style={{ flex: 2, fontSize: FontSize.xs + 1, fontWeight: 'bold', color: '#111827' }}>{log.user}</Text>

                    {/* Action */}
                    <View style={{ flex: 1.5 }}>
                      <View style={{ alignSelf: 'flex-start', backgroundColor: log.actionBg || '#F3E8FF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: log.actionColor || '#7C3AED' }}>{log.action}</Text>
                      </View>
                    </View>

                    {/* Details */}
                    <Text style={{ flex: 4, fontSize: FontSize.xs + 1, color: '#374151', lineHeight: 20 }}>{log.details}</Text>
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
            <View style={{ width: '100%', maxWidth: 580, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: FontSize.md + 1, fontWeight: 'bold', color: '#111827' }}>Audit Log Entry Inspection</Text>
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

                <View style={{ padding: 12, backgroundColor: '#F9FAFB', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#E5E7EB', gap: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.textSecondary, textTransform: 'uppercase' }}>Actor Details</Text>
                  <Text style={{ fontSize: FontSize.sm, fontWeight: 'bold', color: '#111827' }}>{selectedAuditLog.userName} ({selectedAuditLog.userRole})</Text>
                  <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary }}>{selectedAuditLog.userEmail}</Text>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.textSecondary, textTransform: 'uppercase' }}>Description</Text>
                  <Text style={{ fontSize: FontSize.sm, color: '#374151', lineHeight: 20 }}>{selectedAuditLog.description}</Text>
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

              <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FAFAFA', alignItems: 'flex-end' }}>
                <TouchableOpacity onPress={() => setSelectedAuditLog(null)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' }}>
                  <Text style={{ fontSize: FontSize.xs + 1, fontWeight: 'medium', color: '#374151' }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── PUBLISHED POST PREVIEW MODAL ── */}
      <Modal visible={!!previewPost} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 720, backgroundColor: '#fff', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Published Post Preview</Text>
              <TouchableOpacity onPress={() => setPreviewPost(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Top Area */}
            <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 24, marginBottom: 24 }}>
              <View style={{ flex: 1.5 }}>
                <Image source={{ uri: previewPost?.image }} style={{ width: '100%', height: 200, borderRadius: 8 }} />
              </View>
              <View style={{ flex: 1, gap: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{previewPost?.title}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Department</Text>
                  <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>{previewPost?.department}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Requested By</Text>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#111827' }}>{previewPost?.requestedBy}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Published By</Text>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#111827' }}>IMC / Branding</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Published Date</Text>
                  <Text style={{ fontSize: 12, color: '#374151' }}>{previewPost?.requestedOn} {previewPost?.requestedTime}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Platforms</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {previewPost?.platforms?.includes('FB') && <Ionicons name="logo-facebook" size={16} color="#1877F2" />}
                    {previewPost?.platforms?.includes('IG') && <Ionicons name="logo-instagram" size={16} color="#E1306C" />}
                    {previewPost?.platforms?.includes('WEB') && <Ionicons name="globe-outline" size={16} color="#3b82f6" />}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280', width: 80 }}>Status</Text>
                  <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#16a34a' }}>Published</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Timeline and AI Summary */}
            <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 24 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 }}>Caption</Text>
                <Text style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>The spirit of unity, excellence, and sportsmanship comes alive! Join us as we proudly open Intramurals 2026.</Text>

                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 }}>Description</Text>
                <Text style={{ fontSize: 13, color: '#374151' }}>This event marks the beginning of a week-long celebration of talent, teamwork, and determination. Let's cheer for our students as they compete with pride and passion!</Text>
              </View>

              <View style={{ flex: 1, gap: 16 }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 }}>Approval Timeline</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ height: 2, backgroundColor: '#7e22ce', position: 'absolute', top: 5, left: 10, right: 10 }} />
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#7e22ce' }} />
                      <Text style={{ fontSize: 10, color: '#374151', textAlign: 'center' }}>Department{'\n'}Head</Text>
                    </View>
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#7e22ce' }} />
                      <Text style={{ fontSize: 10, color: '#374151', textAlign: 'center' }}>Executive{'\n'}(VP)</Text>
                    </View>
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#7e22ce' }} />
                      <Text style={{ fontSize: 10, color: '#374151', textAlign: 'center' }}>IMC / Branding</Text>
                    </View>
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#7e22ce' }} />
                      <Text style={{ fontSize: 10, fontWeight: '600', color: '#111827', textAlign: 'center' }}>Published</Text>
                    </View>
                  </View>
                </View>


              </View>
            </View>

            {/* Footer Buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
              <TouchableOpacity onPress={() => setPreviewPost(null)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151' }}>Close</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
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
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
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
  editBtn: { padding: 6, borderRadius: 6, backgroundColor: '#F3F4F6' },
  deleteBtn: { padding: 6, borderRadius: 6, backgroundColor: '#FEF2F2' },
  inlineEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveBtn: { backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cancelBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
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
});
