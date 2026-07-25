import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DashboardShell } from '../../../components/DashboardShell';
import { Card } from '../../../components/ui/Card';
import { useAuthStore } from '../../../store/auth';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../constants/theme';
import { usePolicyStore } from '../../../store/policy';

export default function ImcQaDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();

  const { policySections, effectiveDate, lastUpdatedDate, fetchPolicy } = usePolicyStore();

  useEffect(() => {
    fetchPolicy();
  }, []);

  // Tab State: 'dashboard' | 'approved' | 'rejected' | 'policy-rules'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);

  // Policy Search State
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // Modal / Selected Request Preview State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [modalPlatformTab, setModalPlatformTab] = useState<'facebook' | 'instagram' | 'website'>('facebook');

  // Reject Modal State
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [requestToReject, setRequestToReject] = useState<any | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  // Mock IMC QA pending requests list matching VP design structure
  const [requestsList, setRequestsList] = useState([
    {
      id: 'q1',
      title: '2024 Alumni Homecoming Gala - Early Bird Announcement',
      category: 'Announcement',
      dept: 'MARKETING',
      requestedBy: 'Sarah Jenkins',
      requestedByRole: 'Marketing Manager',
      date: 'Oct 24, 2023',
      time: '09:15 AM',
      platforms: ['facebook', 'instagram', 'website'],
      caption: 'Rekindle the spirit! Join us for the 2024 Alumni Homecoming Gala. Early bird registration is now open. #JMCFI #AlumniHomecoming',
      previewBanner: 'ALUMNI HOMECOMING 2024',
      attachment: 'alumni_gala_poster.jpg',
      attachmentSize: '2.4 MB',
      status: 'PENDING',
    },
    {
      id: 'q2',
      title: 'Founders Week Sports Festival Graphic Banner',
      category: 'Graphic Banner',
      dept: 'ATHLETICS',
      requestedBy: 'Coach Marcus',
      requestedByRole: 'Sports Coord.',
      date: 'Oct 25, 2023',
      time: '11:45 AM',
      platforms: ['facebook', 'instagram'],
      caption: 'Gear up for the most thrilling week of the semester! Registration for individual and team sports events starts this Monday. See you on the field! #FoundersWeek #SportsFest',
      previewBanner: 'SPORTS FESTIVAL 2024',
      attachment: 'sports_fest_banner.png',
      attachmentSize: '3.1 MB',
      status: 'PENDING',
    },
    {
      id: 'q3',
      title: 'Midterm Exams Schedule & Room Assignments',
      category: 'Official Notice',
      dept: 'REGISTRAR',
      requestedBy: 'Dr. Aris Thorne',
      requestedByRole: 'Head Registrar',
      date: 'Oct 26, 2023',
      time: '02:30 PM',
      platforms: ['facebook', 'website'],
      caption: 'Please be guided by the official examination schedule and room assignments for the first semester midterms. Ensure all permit clearances are settled prior. Good luck! #Midterms2023',
      previewBanner: 'MIDTERM EXAMINATIONS',
      attachment: 'midterms_schedule_2023.pdf',
      attachmentSize: '1.8 MB',
      status: 'PENDING',
    },
  ]);

  const [approvedRequests, setApprovedRequests] = useState([
    {
      id: 'qa1',
      title: 'Institutional Mascot Design Release',
      category: 'Branding Asset',
      dept: 'MARKETING',
      requestedBy: 'Elena Cruz',
      requestedByRole: 'Brand Designer',
      date: 'Oct 23, 2023',
      time: '04:00 PM',
      platforms: ['facebook', 'instagram', 'website'],
      caption: 'Meet our new official university mascot! Designed with pride and heritage. #JMCFI',
      previewBanner: 'MASCOT DESIGN GUIDELINES',
      attachment: 'mascot_brandbook.pdf',
      attachmentSize: '5.2 MB',
      status: 'APPROVED',
    },
  ]);

  const [rejectedRequests, setRejectedRequests] = useState([
    {
      id: 'qr1',
      title: 'Unthemed Halloween Social Night Poster',
      category: 'Event Poster',
      dept: 'CAS',
      requestedBy: 'Leo Martinez',
      requestedByRole: 'Student Council',
      date: 'Oct 21, 2023',
      time: '05:20 PM',
      platforms: ['facebook', 'instagram'],
      caption: 'Come as you are for our un-themed Halloween party!',
      previewBanner: 'HALLOWEEN SOCIAL',
      attachment: 'halloween_draft.png',
      attachmentSize: '1.5 MB',
      status: 'REJECTED',
      rejectionReason: 'Does not adhere to institutional event branding and logo placement policy.',
    },
  ]);

  const departmentOptions = ['All Departments', 'MARKETING', 'ATHLETICS', 'REGISTRAR', 'CAS', 'CITE', 'COBE'];

  // Handlers for actions
  const handleApprove = (req: any) => {
    alert(`QA Clearance Approved: "${req.title}"`);
    setSelectedRequest(null);
  };

  const handleRejectClick = (req: any) => {
    setRequestToReject(req);
    setRejectComment('');
    setIsRejectModalVisible(true);
  };

  const confirmReject = () => {
    alert(`Request Rejected by QA: "${requestToReject?.title}"\nReason: ${rejectComment}`);
    setIsRejectModalVisible(false);
    setRequestToReject(null);
    setSelectedRequest(null);
  };

  const handleRequestRevision = (req: any) => {
    alert(`Revision Requested for: "${req.title}"`);
    setSelectedRequest(null);
  };

  const getRequestsForTab = () => {
    if (activeTab === 'approved') return approvedRequests;
    if (activeTab === 'rejected') return rejectedRequests;
    return requestsList;
  };

  const filteredRequests = getRequestsForTab().filter((req) => {
    const matchesDept =
      selectedDepartment === 'All Departments' || req.dept === selectedDepartment;
    const matchesSearch =
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.requestedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const isLargeScreen = width > 1024;

  return (
    <DashboardShell
      title="IMC/QA — Institutional Quality Review"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ----------------- DASHBOARD / APPROVED / REJECTED TAB ----------------- */}
      {(activeTab === 'dashboard' || activeTab === 'approved' || activeTab === 'rejected') && (
        <View style={styles.dashboardContainer}>
          {/* Header Row with Greeting */}
          {activeTab === 'dashboard' && (
            <View style={styles.dashboardHeaderRow}>
              <View>
                <Text style={styles.greetingTitle}>Welcome, Quality Lead! 👋</Text>
                <Text style={styles.greetingSubtitle}>
                  Institutional compliance status, brand checker boards, and active quality review queues.
                </Text>
              </View>
            </View>
          )}

          {/* Metric Summary Cards Row */}
          {activeTab === 'dashboard' && (
            <View style={styles.metricsGrid}>
              {/* Card 1: For Quality Review */}
              <Card style={styles.metricCard}>
                <View style={styles.metricCardHeader}>
                  <View style={[styles.metricIconBg, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="shield-checkmark" size={20} color="#1E40AF" />
                  </View>
                </View>
                <Text style={styles.metricLabel}>For Quality Review</Text>
                <Text style={styles.metricCount}>3</Text>
                <Text style={styles.metricSubtext}>Requests awaiting QA clearance</Text>
              </Card>

              {/* Card 2: Approved */}
              <Card style={styles.metricCard}>
                <View style={styles.metricCardHeader}>
                  <View style={[styles.metricIconBg, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#047857" />
                  </View>
                </View>
                <Text style={styles.metricLabel}>Approved</Text>
                <Text style={styles.metricCount}>15</Text>
                <Text style={styles.metricSubtext}>Requests approved by QA</Text>
              </Card>

              {/* Card 3: Rejected */}
              <Card style={styles.metricCard}>
                <View style={styles.metricCardHeader}>
                  <View style={[styles.metricIconBg, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="close-circle" size={20} color="#B91C1C" />
                  </View>
                </View>
                <Text style={styles.metricLabel}>Rejected</Text>
                <Text style={styles.metricCount}>2</Text>
                <Text style={styles.metricSubtext}>Requests flagged for revisions</Text>
              </Card>

              {/* Card 4: Published */}
              <Card style={styles.metricCard}>
                <View style={styles.metricCardHeader}>
                  <View style={[styles.metricIconBg, { backgroundColor: '#F0FDFA' }]}>
                    <Ionicons name="send" size={20} color="#0D9488" />
                  </View>
                </View>
                <Text style={styles.metricLabel}>Published</Text>
                <Text style={styles.metricCount}>12</Text>
                <Text style={styles.metricSubtext}>Cleared & published content</Text>
              </Card>
            </View>
          )}

          {/* Main Content Card: Requests List */}
          <Card style={styles.tableCard}>
            {/* Table Control Header */}
            <View style={styles.tableCardHeaderRow}>
              <Text style={styles.tableTitle}>
                {activeTab === 'dashboard'
                  ? 'Requests Awaiting QA Review'
                  : activeTab === 'approved'
                  ? 'Approved Requests'
                  : 'Rejected Requests'}
              </Text>

              <View style={styles.tableControlsRight}>
                {/* Search Bar */}
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                {/* Department Dropdown Selector */}
                <View style={{ position: 'relative', zIndex: 50 }}>
                  <TouchableOpacity
                    style={[styles.departmentDropdown, { height: 36, paddingVertical: 0 }]}
                    onPress={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                  >
                    <Text style={styles.departmentDropdownText}>{selectedDepartment}</Text>
                    <Ionicons name="chevron-down-outline" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {isDeptDropdownOpen && (
                    <View style={styles.dropdownMenu}>
                      {departmentOptions.map((deptOption) => (
                        <TouchableOpacity
                          key={deptOption}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setSelectedDepartment(deptOption);
                            setIsDeptDropdownOpen(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{deptOption}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Filter Button */}
                <TouchableOpacity style={styles.filterBtn} onPress={() => alert('Filter options')}>
                  <Ionicons name="options-outline" size={14} color={Colors.textPrimary} style={{ marginRight: 4 }} />
                  <Text style={styles.filterBtnText}>Filter</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Requests Table */}
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.flexTitle]}>REQUEST TITLE</Text>
                <Text style={[styles.tableHeaderCell, styles.flexDept]}>DEPARTMENT</Text>
                <Text style={[styles.tableHeaderCell, styles.flexUser]}>REQUESTED BY</Text>
                <Text style={[styles.tableHeaderCell, styles.flexDate]}>REQUESTED ON</Text>
                <Text style={[styles.tableHeaderCell, styles.flexPlatforms]}>PLATFORMS</Text>
                <Text style={[styles.tableHeaderCell, styles.flexActions, styles.alignRight]}>ACTIONS</Text>
              </View>

              {filteredRequests.map((req) => (
                <View key={req.id} style={styles.tableRow}>
                  {/* REQUEST TITLE + CATEGORY TAG */}
                  <View style={[styles.cellContainer, styles.flexTitle]}>
                    <View style={styles.thumbnailBox}>
                      <Ionicons name="image-outline" size={16} color={Colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitleText}>{req.title}</Text>
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>{req.category}</Text>
                      </View>
                    </View>
                  </View>

                  {/* DEPARTMENT */}
                  <View style={[styles.cellContainer, styles.flexDept]}>
                    <Text style={styles.rowDeptText}>{req.dept}</Text>
                  </View>

                  {/* REQUESTED BY */}
                  <View style={[styles.cellContainer, styles.flexUser]}>
                    <Text style={styles.rowUserName}>{req.requestedBy}</Text>
                    <Text style={styles.rowUserRole}>{req.requestedByRole}</Text>
                  </View>

                  {/* REQUESTED ON */}
                  <View style={[styles.cellContainer, styles.flexDate]}>
                    <Text style={styles.rowDateText}>{req.date}</Text>
                    <Text style={styles.rowTimeText}>{req.time}</Text>
                  </View>

                  {/* PLATFORMS */}
                  <View style={[styles.cellContainer, styles.flexPlatforms, { flexDirection: 'row', gap: 6, justifyContent: 'flex-start' }]}>
                    {req.platforms.includes('facebook') && (
                      <View style={[styles.platformIconCircle, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="logo-facebook" size={13} color="#1877F2" />
                      </View>
                    )}
                    {req.platforms.includes('instagram') && (
                      <View style={[styles.platformIconCircle, { backgroundColor: '#FDF2F8' }]}>
                        <Ionicons name="logo-instagram" size={13} color="#E1306C" />
                      </View>
                    )}
                    {req.platforms.includes('website') && (
                      <View style={[styles.platformIconCircle, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="globe-outline" size={13} color="#059669" />
                      </View>
                    )}
                  </View>

                  {/* ACTIONS */}
                  <View style={[styles.cellContainer, styles.flexActions, styles.rowActionsGroup]}>
                    <TouchableOpacity
                      style={styles.btnViewRow}
                      onPress={() => {
                        setSelectedRequest(req);
                        setModalPlatformTab('facebook');
                      }}
                    >
                      <Ionicons name="eye-outline" size={13} color={Colors.textPrimary} style={{ marginRight: 3 }} />
                      <Text style={styles.btnViewRowText}>View</Text>
                    </TouchableOpacity>

                    {activeTab === 'dashboard' && (
                      <>
                        <TouchableOpacity
                          style={styles.btnApproveRow}
                          onPress={() => handleApprove(req)}
                        >
                          <Ionicons name="checkmark" size={13} color="#16A34A" style={{ marginRight: 3 }} />
                          <Text style={styles.btnApproveRowText}>Approve</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnRejectRow}
                          onPress={() => handleRejectClick(req)}
                        >
                          <Ionicons name="close" size={13} color="#DC2626" style={{ marginRight: 3 }} />
                          <Text style={styles.btnRejectRowText}>Reject</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Table Footer & Pagination */}
            <View style={styles.tableFooter}>
              <Text style={styles.tableFooterText}>
                Showing 1 to {filteredRequests.length} of {filteredRequests.length} requests
              </Text>

              <View style={styles.paginationRow}>
                <TouchableOpacity style={styles.arrowBtn} disabled={true}>
                  <Ionicons name="chevron-back" size={14} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.pageBtn, styles.pageBtnActive]}>
                  <Text style={[styles.pageBtnText, styles.pageBtnTextActive]}>1</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.arrowBtn} disabled={true}>
                  <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
                </TouchableOpacity>

                <View style={styles.pageCountSelector}>
                  <Text style={styles.pageCountSelectorText}>10 / page</Text>
                  <Ionicons name="chevron-down" size={12} color={Colors.textSecondary} />
                </View>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* ----------------- POLICY RULES TAB ----------------- */}
      {activeTab === 'policy-rules' && (() => {
        const filteredSections = policySections.filter((sec) => {
          const query = policySearchQuery.toLowerCase();
          if (!query) return true;
          return (
            sec.title.toLowerCase().includes(query) ||
            sec.content?.toLowerCase().includes(query) ||
            sec.bullets?.some(
              (b) =>
                b.title.toLowerCase().includes(query) ||
                b.desc.toLowerCase().includes(query)
            )
          );
        });

        return (
          <View style={styles.dashboardContainer}>
            <View style={styles.dashboardHeaderRow}>
              <View>
                <Text style={styles.greetingTitle}>School Website Posting Policy</Text>
                <Text style={styles.greetingSubtitle}>
                  Effective Date: {effectiveDate} &bull; Last Updated: {lastUpdatedDate}
                </Text>
              </View>

              <View style={[styles.searchBox, { minWidth: 260 }]}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search policy guidelines..."
                  value={policySearchQuery}
                  onChangeText={setPolicySearchQuery}
                />
                <Ionicons name="search" size={16} color={Colors.textSecondary} />
              </View>
            </View>

            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
              {isLargeScreen && (
                <View style={styles.policySidebar}>
                  <Text style={styles.policySidebarTitle}>POLICY SECTIONS</Text>
                  {policySections.map((sec) => (
                    <TouchableOpacity
                      key={sec.id}
                      style={styles.policySidebarItem}
                      onPress={() => alert(`Navigating to ${sec.title}`)}
                    >
                      <Text style={styles.policySidebarItemText}>{sec.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.policyContentArea}>
                {filteredSections.map((sec) => (
                  <Card key={sec.id} style={styles.policyCard}>
                    <Text style={styles.policyCardTitle}>{sec.title}</Text>
                    {sec.content && <Text style={styles.policyContentText}>{sec.content}</Text>}
                    {sec.bullets && (
                      <View style={{ gap: 8, marginTop: 8 }}>
                        {sec.bullets.map((bullet, bIdx) => (
                          <View key={bIdx} style={styles.bulletRow}>
                            <Text style={styles.bulletTitle}>{bullet.title}: </Text>
                            <Text style={styles.bulletDesc}>{bullet.desc}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card>
                ))}
              </View>
            </View>
          </View>
        );
      })()}

      {/* ----------------- ACCOUNT SETTINGS TAB ----------------- */}
      {activeTab === 'account-settings' && (
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.greetingTitle}>Account Settings</Text>
              <Text style={styles.greetingSubtitle}>
                Manage your institutional profile picture, credentials, and settings.
              </Text>
            </View>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Left settings card */}
            <View style={{ flex: 1.5 }}>
              <Card style={styles.tableCard}>
                <View style={[styles.tableCardHeaderRow, { justifyContent: 'flex-start', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10, marginBottom: 12 }]}>
                  <Ionicons name="person-outline" size={18} color="#1E40AF" />
                  <Text style={styles.tableTitle}>Profile Information</Text>
                </View>

                {/* Profile Picture Upload Section */}
                <View style={styles.profilePicUploadContainer}>
                  <View style={styles.profilePicLarge}>
                    <Text style={styles.profilePicLargeText}>
                      {user?.name ? user.name.substring(0, 2).toUpperCase() : 'QA'}
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
                    defaultValue={user?.name ?? 'IMC Quality Lead'}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
                    value={user?.email ?? 'imc_qa@jmcfi.edu.ph'}
                    editable={false}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>DEPARTMENT / ROLE</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
                    value="Institutional Marketing & Communication QA"
                    editable={false}
                  />
                </View>

                <TouchableOpacity style={[styles.btnViewRow, { backgroundColor: '#1E40AF', paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'flex-start', borderRadius: 6 }]} onPress={() => alert('Profile settings saved successfully!')}>
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>Save Details</Text>
                </TouchableOpacity>
              </Card>
            </View>

            {/* Right settings card */}
            <View style={{ flex: 1 }}>
              <Card style={styles.tableCard}>
                <Text style={[styles.tableTitle, { marginBottom: 12 }]}>Update Password</Text>

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

                <TouchableOpacity style={[styles.btnViewRow, { backgroundColor: '#1E40AF', paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'flex-start', borderRadius: 6, marginTop: 10 }]} onPress={() => alert('Password updated successfully!')}>
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>Change Password</Text>
                </TouchableOpacity>
              </Card>
            </View>
          </View>
        </View>
      )}

      {/* ----------------- CONTENT REQUEST PREVIEW MODAL ----------------- */}
      {selectedRequest && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setSelectedRequest(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalHeaderTitle}>Content Request Quality Review</Text>
                <TouchableOpacity
                  style={styles.modalCloseIconBtn}
                  onPress={() => setSelectedRequest(null)}
                >
                  <Ionicons name="close" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Modal Body Split */}
              <ScrollView style={styles.modalBodyScroll} contentContainerStyle={styles.modalBodyContent}>
                <View style={[styles.modalSplitRow, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
                  {/* Left Side: Social Media Mockup Preview */}
                  <View style={styles.modalLeftColumn}>
                    {/* Platform Selector Tabs */}
                    <View style={styles.modalPlatformTabs}>
                      <TouchableOpacity
                        style={[
                          styles.modalPlatformTab,
                          modalPlatformTab === 'facebook' && styles.modalPlatformTabActive,
                        ]}
                        onPress={() => setModalPlatformTab('facebook')}
                      >
                        <Ionicons name="logo-facebook" size={14} color={modalPlatformTab === 'facebook' ? '#1877F2' : Colors.textSecondary} />
                        <Text style={[styles.modalPlatformTabText, modalPlatformTab === 'facebook' && styles.modalPlatformTabTextActive]}>
                          Facebook
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.modalPlatformTab,
                          modalPlatformTab === 'instagram' && styles.modalPlatformTabActive,
                        ]}
                        onPress={() => setModalPlatformTab('instagram')}
                      >
                        <Ionicons name="logo-[#E1306C]" size={14} color={modalPlatformTab === 'instagram' ? '#E1306C' : Colors.textSecondary} />
                        <Text style={[styles.modalPlatformTabText, modalPlatformTab === 'instagram' && styles.modalPlatformTabTextActive]}>
                          Instagram
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.modalPlatformTab,
                          modalPlatformTab === 'website' && styles.modalPlatformTabActive,
                        ]}
                        onPress={() => setModalPlatformTab('website')}
                      >
                        <Ionicons name="globe-outline" size={14} color={modalPlatformTab === 'website' ? '#059669' : Colors.textSecondary} />
                        <Text style={[styles.modalPlatformTabText, modalPlatformTab === 'website' && styles.modalPlatformTabTextActive]}>
                          Website
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Interactive Mockup Container */}
                    <View style={styles.socialMockupCard}>
                      <View style={styles.socialHeader}>
                        <View style={styles.socialAvatar}>
                          <Ionicons name="school" size={18} color="#FFFFFF" />
                        </View>
                        <View>
                          <Text style={styles.socialAuthorName}>Jose Maria College Foundation, Inc.</Text>
                          <Text style={styles.socialTimeText}>Sponsored &bull; Public</Text>
                        </View>
                      </View>

                      <Text style={styles.socialCaptionText}>{selectedRequest.caption}</Text>

                      <View style={styles.socialMediaBanner}>
                        <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.7)" style={{ marginBottom: 8 }} />
                        <Text style={styles.socialMediaBannerText}>{selectedRequest.previewBanner}</Text>
                      </View>

                      <View style={styles.socialFooterActions}>
                        <View style={styles.socialActionBtn}>
                          <Ionicons name="thumbs-up-outline" size={14} color={Colors.textSecondary} />
                          <Text style={styles.socialActionText}>Like</Text>
                        </View>
                        <View style={styles.socialActionBtn}>
                          <Ionicons name="chatbubble-outline" size={14} color={Colors.textSecondary} />
                          <Text style={styles.socialActionText}>Comment</Text>
                        </View>
                        <View style={styles.socialActionBtn}>
                          <Ionicons name="share-social-outline" size={14} color={Colors.textSecondary} />
                          <Text style={styles.socialActionText}>Share</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Right Side: Request Details Metadata */}
                  <View style={styles.modalRightColumn}>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Request Title</Text>
                      <Text style={styles.metaTitleVal}>{selectedRequest.title}</Text>
                    </View>

                    <View style={styles.metaRowGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Department</Text>
                        <View style={styles.deptBadge}>
                          <Text style={styles.deptBadgeText}>{selectedRequest.dept}</Text>
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Category</Text>
                        <Text style={styles.metaVal}>{selectedRequest.category}</Text>
                      </View>
                    </View>

                    <View style={styles.metaRowGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Requested By</Text>
                        <Text style={styles.metaVal}>{selectedRequest.requestedBy}</Text>
                        <Text style={styles.rowUserRole}>{selectedRequest.requestedByRole}</Text>
                      </View>
                    </View>

                    <View style={styles.metaRowGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Requested On</Text>
                        <Text style={styles.metaVal}>
                          {selectedRequest.date} {selectedRequest.time}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metaRowGrid}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Target Platforms</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                          {selectedRequest.platforms.includes('facebook') && (
                            <View style={[styles.platformIconCircle, { backgroundColor: '#EFF6FF' }]}>
                              <Ionicons name="logo-facebook" size={14} color="#1877F2" />
                            </View>
                          )}
                          {selectedRequest.platforms.includes('instagram') && (
                            <View style={[styles.platformIconCircle, { backgroundColor: '#FDF2F8' }]}>
                              <Ionicons name="logo-instagram" size={14} color="#E1306C" />
                            </View>
                          )}
                          {selectedRequest.platforms.includes('website') && (
                            <View style={[styles.platformIconCircle, { backgroundColor: '#ECFDF5' }]}>
                              <Ionicons name="globe-outline" size={14} color="#059669" />
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.metaDivider} />

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Caption / Main Text</Text>
                      <Text style={styles.metaCaptionBox}>{selectedRequest.caption}</Text>
                    </View>

                    {/* Attachments Section */}
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Attachments (1)</Text>
                      <View style={styles.attachmentCard}>
                        <View style={styles.attachmentThumb}>
                          <Ionicons name="document-attach-outline" size={18} color="#1E40AF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.attachmentName}>{selectedRequest.attachment}</Text>
                          <Text style={styles.attachmentSize}>{selectedRequest.attachmentSize}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Modal Footer Actions */}
              <View style={styles.modalFooterRow}>
                <TouchableOpacity
                  style={styles.btnModalClose}
                  onPress={() => setSelectedRequest(null)}
                >
                  <Text style={styles.btnModalCloseText}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnModalApprove}
                  onPress={() => handleApprove(selectedRequest)}
                >
                  <Text style={styles.btnModalApproveText}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnModalReject}
                  onPress={() => handleRejectClick(selectedRequest)}
                >
                  <Text style={styles.btnModalRejectText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Reject Floating Comment Window */}
      {isRejectModalVisible && (
        <Modal
          visible={isRejectModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsRejectModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { width: 400, maxWidth: '90%' }]}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalHeaderTitle}>Reject Request</Text>
                <TouchableOpacity
                  style={styles.modalCloseIconBtn}
                  onPress={() => setIsRejectModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 12 }}>
                  Please provide a reason for rejecting "{requestToReject?.title}".
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: BorderRadius.md,
                    padding: 12,
                    minHeight: 100,
                    textAlignVertical: 'top',
                    fontSize: FontSize.sm,
                    backgroundColor: '#F9FAFB',
                    outlineStyle: 'none',
                  } as any}
                  placeholder="Enter rejection reason or comment here..."
                  multiline
                  value={rejectComment}
                  onChangeText={setRejectComment}
                />
              </View>
              <View style={styles.modalFooterRow}>
                <TouchableOpacity
                  style={styles.btnModalClose}
                  onPress={() => setIsRejectModalVisible(false)}
                >
                  <Text style={styles.btnModalCloseText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnModalReject}
                  onPress={confirmReject}
                >
                  <Text style={styles.btnModalRejectText}>Confirm Reject</Text>
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
  // Outer Container
  dashboardContainer: {
    gap: Spacing.lg,
  },

  // Header & Greeting
  dashboardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  greetingTitle: {
    fontSize: FontSize.xl + 2,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  greetingSubtitle: {
    fontSize: FontSize.sm,
    color: '#6B7280',
    marginTop: 2,
  },

  // Department Dropdown
  departmentDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  departmentDropdownText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: '#374151',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 42,
    right: 0,
    width: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 100,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: FontSize.sm,
    color: '#374151',
  },

  // Metrics Grid (4 Cards)
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: 200,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  metricCardHeader: {
    marginBottom: 8,
  },
  metricIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#374151',
    textTransform: 'uppercase',
  },
  metricCount: {
    fontSize: FontSize.xxl + 4,
    fontWeight: FontWeight.bold,
    color: '#111827',
    marginVertical: 2,
  },
  metricSubtext: {
    fontSize: FontSize.xs - 1,
    color: '#9CA3AF',
  },

  // Main Table Card
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tableCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    zIndex: 100,
  },
  tableTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  tableControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 10,
    height: 36,
    width: 200,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.xs + 1,
    color: '#111827',
    outlineStyle: 'none',
  } as any,
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    height: 36,
  },
  filterBtnText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.medium,
    color: '#374151',
  },

  // Table Layout
  table: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.sm,
  },
  tableHeaderCell: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    color: '#6B7280',
    letterSpacing: 0.5,
  },

  // Column Flex Multipliers
  flexTitle: { flex: 2.2 },
  flexDept: { flex: 1 },
  flexUser: { flex: 1.5 },
  flexDate: { flex: 1.3 },
  flexPlatforms: { flex: 1.2 },
  flexActions: { flex: 2 },
  alignRight: { textAlign: 'right' },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cellContainer: {
    justifyContent: 'center',
  },
  thumbnailBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rowTitleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: FontWeight.medium,
    color: '#4B5563',
  },
  rowDeptText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#4B5563',
  },
  rowUserName: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  rowUserRole: {
    fontSize: FontSize.xs - 1,
    color: '#6B7280',
  },
  rowDateText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.medium,
    color: '#374151',
  },
  rowTimeText: {
    fontSize: FontSize.xs - 1,
    color: '#9CA3AF',
  },
  platformIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Row Action Buttons
  rowActionsGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  btnViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnViewRowText: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
    color: '#374151',
  },
  btnApproveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnApproveRowText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#15803D',
  },
  btnRejectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnRejectRowText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#B91C1C',
  },

  // Table Footer
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tableFooterText: {
    fontSize: FontSize.xs,
    color: '#6B7280',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtnActive: {
    backgroundColor: '#1E40AF',
  },
  pageBtnText: {
    fontSize: FontSize.xs,
    color: '#374151',
  },
  pageBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  pageCountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  pageCountSelectorText: {
    fontSize: FontSize.xs,
    color: '#374151',
  },

  // Modal Overlay & Container
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHeaderTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  modalCloseIconBtn: {
    padding: 4,
  },
  modalBodyScroll: {
    maxHeight: 520,
  },
  modalBodyContent: {
    padding: Spacing.lg,
  },

  // Layout Splits
  splitLayout: {
    gap: Spacing.lg,
  },
  rowLayout: {
    flexDirection: 'row',
  },
  columnLayout: {
    flexDirection: 'column',
  },

  modalSplitRow: {
    gap: Spacing.xl,
  },
  modalLeftColumn: {
    flex: 1.2,
  },
  modalRightColumn: {
    flex: 1,
    gap: 10,
  },

  // Social Media Mockup
  modalPlatformTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  modalPlatformTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F3F4F6',
  },
  modalPlatformTabActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  modalPlatformTabText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: '#6B7280',
  },
  modalPlatformTabTextActive: {
    color: '#1D4ED8',
    fontWeight: FontWeight.bold,
  },

  socialMockupCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
  },
  socialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  socialAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialAuthorName: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  socialTimeText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  socialCaptionText: {
    fontSize: FontSize.xs + 1,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 12,
  },
  socialMediaBanner: {
    height: 180,
    backgroundColor: '#1E3A8A',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: 12,
  },
  socialMediaBannerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  socialFooterActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    justifyContent: 'space-around',
  },
  socialActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialActionText: {
    fontSize: FontSize.xs,
    color: '#6B7280',
  },

  // Right Details Column
  metaRow: {
    marginBottom: 6,
  },
  metaRowGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaTitleVal: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  metaVal: {
    fontSize: FontSize.xs + 1,
    color: '#374151',
  },
  deptBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deptBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#1E40AF',
  },
  metaDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  metaCaptionBox: {
    fontSize: FontSize.xs + 1,
    color: '#374151',
    lineHeight: 18,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.md,
    padding: 10,
    marginTop: 4,
  },
  attachmentThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentName: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#1E293B',
  },
  attachmentSize: {
    fontSize: 10,
    color: '#64748B',
  },

  // Modal Footer
  modalFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  btnModalClose: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  btnModalCloseText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.medium,
    color: '#374151',
  },
  btnModalRevision: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
  },
  btnModalRevisionText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#B45309',
  },
  btnModalApprove: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#ECFDF5',
  },
  btnModalApproveText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#047857',
  },
  btnModalReject: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  btnModalRejectText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#B91C1C',
  },

  // Policy Styles
  policySidebar: {
    width: 220,
    gap: 6,
  },
  policySidebarTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  policySidebarItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F9FAFB',
  },
  policySidebarItemText: {
    fontSize: FontSize.xs + 1,
    color: '#374151',
  },
  policyContentArea: {
    flex: 1,
    gap: Spacing.md,
  },
  policyCard: {
    padding: Spacing.lg,
  },
  policyCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#111827',
    marginBottom: 8,
  },
  policyContentText: {
    fontSize: FontSize.sm,
    color: '#4B5563',
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bulletTitle: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  bulletDesc: {
    fontSize: FontSize.xs + 1,
    color: '#4B5563',
  },

  // Account Settings Styles
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
    backgroundColor: '#1E40AF',
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
    color: '#111827',
  },
  profilePicSubtitle: {
    fontSize: FontSize.xs,
    color: '#6B7280',
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
    color: '#111827',
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
  fieldGroup: {
    marginBottom: 16,
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    height: 36,
    paddingHorizontal: 12,
    fontSize: FontSize.sm,
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },
});
