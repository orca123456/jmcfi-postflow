import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DashboardShell } from '../../../components/DashboardShell';
import { Card } from '../../../components/ui/Card';
import { useAuthStore } from '../../../store/auth';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../constants/theme';
import { usePolicyStore } from '../../../store/policy';

export default function PresidentDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();

  const { policySections, effectiveDate, lastUpdatedDate, fetchPolicy } = usePolicyStore();

  useEffect(() => {
    fetchPolicy();
  }, []);

  // Tab State: 'dashboard' | 'approval-queue' | 'analytics' | 'policy-rules' | 'account-settings'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Policy Search State
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // Mock President critical clearances list
  const mockClearancePosts = [
    {
      id: 'pr1',
      title: 'Announcement: Inauguration of the JMCFI Research Center',
      sub: 'Draft ID: #PR-8821 • Dept: Institutional Advancement',
      status: 'PENDING PRESIDENT',
      submitted: 'Submitted 2h ago',
      body: 'We are proud to unveil our $15M commitment to the future of regional innovation. The new JMCFI Research Center is more than just a building; it is a catalyst for academic excellence and industry partnership in the heart of...',
      urgent: true,
      hasMedia: true,
      mediaLabel: 'RESEARCH CENTER BUILDING',
      reviewers: ['EC', 'MA'],
      reviewersText: 'Approved by Content Manager & Dept Head',
    },
    {
      id: 'pr2',
      title: 'Institutional Motto Social Campaign',
      sub: 'Draft ID: #SC-9012 • Dept: Marketing & Communications',
      status: 'PENDING PRESIDENT',
      submitted: 'Submitted 5h ago',
      body: 'This series highlights the core values of JMCFI across Instagram and LinkedIn. It includes 5 carousel slides focusing on Heritage, Integrity, Innovation, and Service. All assets follow the updated 2024 Brand Standards Manual.',
      urgent: false,
      hasCarousel: true,
      carouselSlides: ['Heritage', 'Integrity', 'Innovation', '+2'],
      mediaLabel: 'COMMENCEMENT KEYNOTE VISUAL\n\n"Educating the heart and the mind is the foundation of institutional legacy."',
    },
  ];

  const mockApprovedPosts = [
    {
      id: 'pr3',
      title: 'University Seal Redesign Launch',
      sub: 'Draft ID: #PR-8833 • Dept: Institutional Advancement',
      status: 'APPROVED',
      submitted: 'Approved 1d ago',
      body: 'Launch of the new JMCFI seal. All official documents will use this moving forward.',
      urgent: false,
      hasMedia: true,
      mediaLabel: 'NEW SEAL',
      reviewers: ['EC', 'MA'],
      reviewersText: 'Approved by Content Manager & Dept Head',
    }
  ];

  const mockRejectedPosts = [
    {
      id: 'pr4',
      title: 'Tuition Fee Adjustment Notice',
      sub: 'Draft ID: #PR-8844 • Dept: Finance',
      status: 'REJECTED',
      submitted: 'Rejected 2d ago',
      body: 'Notice regarding the 5% increase in tuition fees for the upcoming semester.',
      urgent: true,
      hasMedia: false,
      mediaLabel: '',
      reviewers: ['EC', 'MA'],
      reviewersText: 'Approved by Content Manager & Dept Head',
      rejectionReason: 'Please provide more details on the breakdown of the increase.',
    }
  ];

  const handleAction = (type: string, title: string) => {
    alert(`Action: "${type}" triggered successfully for presidential request:\n"${title}"`);
  };

  const isLargeScreen = width > 1024;

  return (
    <DashboardShell
      title="President — Executive Clearance Queue"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ----------------- DASHBOARD / APPROVED / REJECTED TAB ----------------- */}
      {(activeTab === 'dashboard' || activeTab === 'approved' || activeTab === 'rejected') && (() => {
        const listToRender = activeTab === 'approved' ? mockApprovedPosts : activeTab === 'rejected' ? mockRejectedPosts : mockClearancePosts;
        const titleText = activeTab === 'dashboard' ? 'Awaiting Presidential Action' : activeTab === 'approved' ? 'Approved Requests' : 'Rejected Requests';
        const subText = activeTab === 'dashboard' ? 'Below are requests that require your final approval.' : activeTab === 'approved' ? 'Requests you have approved.' : 'Requests you have rejected.';

        return (
        <View style={styles.dashboardContainer}>
          {/* Header row */}
          {activeTab === 'dashboard' && (
            <View style={styles.dashboardHeaderRow}>
              <View>
                <Text style={styles.welcomeTitle}>Welcome, President Ricardo</Text>
                <Text style={styles.welcomeSubtitle}>
                  Clearance console overview for Jose Maria College Foundation, Inc.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.btnApprove, { height: 32, paddingHorizontal: 16 }]}
                onPress={() => setActiveTab('policy-rules')}
              >
                <Ionicons name="book-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnApproveText}>Go to Policy Rules</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Quick Pending Items list */}
            <Card style={[styles.tableCard, { flex: 1.5 }]}>
              <Text style={styles.tableCardTitle}>{titleText}</Text>
              <Text style={styles.welcomeSubtitle}>{subText}</Text>

              <View style={{ gap: 12, marginTop: 12 }}>
                {listToRender.map((post) => (
                  <View key={post.id} style={[styles.analyticsPlatformCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.postTitleText}>{post.title}</Text>
                      <Text style={styles.postMetaText}>{post.sub}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.btnApprove, { height: 28, backgroundColor: Colors.primary }]}
                      onPress={() => alert('Viewing Draft')}
                    >
                      <Text style={styles.btnApproveText}>View Draft</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </Card>

            {/* Quick Links & Resources */}
            <Card style={[styles.configCard, { flex: 1 }]}>
              <Text style={styles.configCardTitle}>Resources & Policies</Text>
              <Text style={styles.welcomeSubtitle}>Quick links to institutional guidelines and posting regulations.</Text>

              <View style={{ gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.filterBtn, { justifyContent: 'flex-start', height: 36, width: '100%' }]}
                  onPress={() => setActiveTab('policy-rules')}
                >
                  <Ionicons name="book-outline" size={16} color={Colors.textPrimary} />
                  <Text style={[styles.filterBtnText, { marginLeft: 6 }]}>View Website Posting Policy</Text>
                </TouchableOpacity>

              </View>
            </Card>
          </View>
        </View>
        );
      })()}

      {/* ----------------- POLICY & RULES TAB ----------------- */}
      {activeTab === 'policy-rules' && (() => {
        const filteredSections = policySections.filter(sec => {
          const query = policySearchQuery.toLowerCase();
          if (!query) return true;
          const titleMatch = sec.title.toLowerCase().includes(query);
          const contentMatch = sec.content?.toLowerCase().includes(query);
          const bulletsMatch = sec.bullets?.some(b => b.title.toLowerCase().includes(query) || b.desc.toLowerCase().includes(query));
          const stepsMatch = sec.steps?.some(s => s.title.toLowerCase().includes(query) || s.desc.toLowerCase().includes(query));
          return titleMatch || contentMatch || bulletsMatch || stepsMatch;
        });

        return (
          <View style={styles.dashboardContainer}>
            {/* Header row */}
            <View style={styles.dashboardHeaderRow}>
              <View>
                <Text style={styles.welcomeTitle}>School Website Posting Policy</Text>
                <Text style={styles.welcomeSubtitle}>
                  Effective Date: {effectiveDate} &bull; Last Updated: {lastUpdatedDate}
                </Text>
              </View>
              
              <View style={[styles.periodBadge, { minWidth: 260, paddingHorizontal: 0 }]}>
                <TextInput
                  style={{ flex: 1, paddingHorizontal: 12, fontSize: FontSize.sm, outlineStyle: 'none' }}
                  placeholder="Search policy guidelines..."
                  value={policySearchQuery}
                  onChangeText={setPolicySearchQuery}
                />
                <Ionicons name="search" size={16} color={Colors.textSecondary} style={{ marginRight: 12 }} />
              </View>
            </View>

            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
              {/* Left quick navigation index - desktop only */}
              {isLargeScreen && (
                <View style={styles.policySidebar}>
                  <Text style={styles.policySidebarTitle}>POLICY SECTIONS</Text>
                  {filteredSections.map((sec) => (
                    <TouchableOpacity
                      key={sec.id}
                      style={[styles.policySidebarItem, { backgroundColor: Colors.surface }]}
                      onPress={() => alert(`Navigating to section: ${sec.title}`)}
                    >
                      <View style={[styles.bulletPoint, { backgroundColor: sec.color }]} />
                      <Text style={styles.policySidebarLabel} numberOfLines={1}>{sec.title.substring(3)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Main content guidelines */}
              <View style={styles.policyDetailCol}>
                {filteredSections.length > 0 ? (
                  filteredSections.map((sec) => (
                    <Card key={sec.id} style={[styles.policySectionCard, { borderLeftColor: sec.color }]}>
                      <View style={[styles.previewHeaderRow, { justifyContent: 'flex-start', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10 }]}>
                        <View style={[styles.activityIconBg, { backgroundColor: sec.bg, borderColor: sec.color }]}>
                          <Ionicons name={sec.icon as any} size={14} color={sec.color} />
                        </View>
                        <Text style={styles.tableCardTitle}>{sec.title}</Text>
                      </View>

                      {sec.content && (
                        <Text style={styles.policyCardBodyText}>{sec.content}</Text>
                      )}

                      {sec.bullets && (
                        <View style={styles.policyBulletsList}>
                          {sec.bullets.map((bullet, idx) => (
                            <View key={idx} style={styles.policyBulletItem}>
                              <Ionicons
                                name={sec.id === 'sec-4' ? 'close-circle' : 'checkmark-circle'}
                                size={18}
                                color={sec.color}
                                style={{ marginTop: 1 }}
                              />
                              <View style={styles.policyBulletTextCol}>
                                <Text style={styles.policyBulletTitle}>{bullet.title}</Text>
                                <Text style={styles.policyBulletDesc}>{bullet.desc}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {sec.steps && (
                        <View style={styles.policyBulletsList}>
                          {sec.steps.map((step, idx) => (
                            <View key={idx} style={styles.policyBulletItem}>
                              <Ionicons
                                name="arrow-forward-circle"
                                size={18}
                                color={sec.color}
                                style={{ marginTop: 1 }}
                              />
                              <View style={styles.policyBulletTextCol}>
                                <Text style={styles.policyBulletTitle}>{idx + 1}. {step.title}</Text>
                                <Text style={styles.policyBulletDesc}>{step.desc}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {sec.contact && (
                        <Text style={[styles.policyCardBodyText, { marginTop: 10, fontWeight: 'bold' }]}>
                          {sec.contact}
                        </Text>
                      )}
                    </Card>
                  ))
                ) : (
                  <View style={styles.policyEmptyState}>
                    <Ionicons name="search-outline" size={36} color={Colors.textMuted} />
                    <Text style={styles.postTitleText}>No policy guidelines found</Text>
                    <Text style={styles.welcomeSubtitle}>Try adjusting your search criteria.</Text>
                  </View>
                )}
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
              <Text style={styles.welcomeTitle}>Account Settings</Text>
              <Text style={styles.welcomeSubtitle}>
                Manage your institutional profile picture, credentials, and settings.
              </Text>
            </View>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Left settings card */}
            <View style={{ flex: 1.5 }}>
              <Card style={styles.tableCard}>
                <View style={[styles.previewHeaderRow, { justifyContent: 'flex-start', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10 }]}>
                  <View style={[styles.activityIconBg, { backgroundColor: '#EFF6FF', borderColor: Colors.primary }]}>
                    <Ionicons name="person-outline" size={14} color={Colors.textPrimary} />
                  </View>
                  <Text style={styles.tableCardTitle}>Profile Information</Text>
                </View>

                {/* Profile Picture Upload Section */}
                <View style={styles.profilePicUploadContainer}>
                  <View style={styles.profilePicLarge}>
                    <Text style={styles.profilePicLargeText}>PR</Text>
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
                    defaultValue={user?.name ?? 'Ricardo J. Magsaysay'}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]}
                    value={user?.email ?? 'president@jmcfi.edu.ph'}
                    editable={false}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>DEPARTMENT / ROLE</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]}
                    value="Executive Office of the President"
                    editable={false}
                  />
                </View>

                <TouchableOpacity style={[styles.btnApprove, { height: 36 }]} onPress={() => alert('Profile settings saved successfully!')}>
                  <Text style={styles.btnApproveText}>Save Details</Text>
                </TouchableOpacity>
              </Card>
            </View>

            {/* Right settings card */}
            <View style={{ flex: 1 }}>
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

                <TouchableOpacity style={[styles.btnApprove, { backgroundColor: Colors.primary, height: 36, marginTop: 10 }]} onPress={() => alert('Password updated successfully!')}>
                  <Text style={styles.btnApproveText}>Change Password</Text>
                </TouchableOpacity>
              </Card>
            </View>
          </View>
        </View>
      )}

      {/* Placeholders for other tabs */}
      {activeTab !== 'dashboard' && activeTab !== 'approval-queue' && activeTab !== 'analytics' && activeTab !== 'policy-rules' && activeTab !== 'account-settings' && (
        <Card style={styles.placeholderCard}>
          <View style={styles.placeholderIconContainer}>
            <Ionicons name="construct-outline" size={32} color={Colors.textMuted} />
          </View>
          <Text style={styles.placeholderTitle}>{activeTab.replace(/-/g, ' ').toUpperCase()} VIEW</Text>
          <Text style={styles.placeholderSubtitle}>
            This dashboard layout is currently under construction and will be integrated with database entities.
          </Text>
        </Card>
      )}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  // Dashboard Layout
  dashboardContainer: {
    gap: Spacing.lg,
  },
  dashboardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  welcomeTitle: {
    fontSize: FontSize.xxl - 2,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  welcomeSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    backgroundColor: Colors.surface,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderRadius: 6,
    gap: 4,
    shadowColor: 'transparent',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 24,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  badgeOrangeText: {
    color: '#EA580C',
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
  },
  badgeGreenText: {
    color: '#16A34A',
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
  },

  // Table Styles
  tableCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  tableCardTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  filterBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
  },
  btnApprove: {
    borderRadius: 4,
    paddingHorizontal: 14,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  btnApproveText: {
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },

  // Split view grid layout
  splitLayout: {
    gap: Spacing.lg,
  },
  rowLayout: {
    flexDirection: 'row',
  },
  columnLayout: {
    flexDirection: 'column',
  },
  configCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  // Timeline / Recent activities
  activitiesList: {
    gap: 16,
    marginTop: 4,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIconBg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  activityTextCol: {
    flex: 1,
    gap: 3,
  },
  activityTitleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  activityMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // Preview styling
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  postTitleText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  postMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  statusBadgeYellow: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusBadgeYellowText: {
    color: '#D97706',
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },

  // Clearance card custom styling
  clearanceCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  clearanceMediaCol: {
    width: 260,
    height: 200,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  urgentBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    zIndex: 10,
  },
  urgentBadgeText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs - 2,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  clearanceMediaCanvas: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  clearanceMediaText: {
    fontSize: FontSize.xs,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
  },
  clearanceInfoCol: {
    flex: 1,
    gap: 10,
  },
  clearanceBodyText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  reviewersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  reviewerCircleMini: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerTextMini: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  reviewersSubtext: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  carouselIndicatorsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  carouselSlideBox: {
    width: 72,
    height: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
  },
  carouselSlideText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btnViewPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    backgroundColor: Colors.surface,
  },
  btnViewPreviewText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  btnReturnRemarks: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    backgroundColor: Colors.surface,
  },
  btnReturnRemarksText: {
    fontSize: FontSize.xs,
    color: '#DC2626',
    fontWeight: FontWeight.bold,
  },

  // Chart styling
  chartContainer: {
    flexDirection: 'row',
    height: 200,
    marginTop: 10,
    paddingRight: 10,
    alignItems: 'stretch',
  },
  chartYAxis: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: 20,
    paddingBottom: 22,
    paddingRight: 6,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  chartAxisLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: FontWeight.bold,
  },
  chartPlotArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingLeft: 10,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  chartBarBackground: {
    width: 24,
    height: '100%',
    backgroundColor: Colors.background,
    borderRadius: 2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: '#94A3B8',
    borderRadius: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  chartBarTooltip: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: 'bold',
  },

  // Placeholders
  placeholderCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 300,
  },
  placeholderIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  placeholderSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 18,
  },

  // Policy tab styles
  policySidebar: {
    width: 180,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.md,
    gap: Spacing.xs,
    alignSelf: 'flex-start',
  },
  policySidebarTitle: {
    fontSize: FontSize.xs,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  policySidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    gap: 8,
  },
  policySidebarLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  policyDetailCol: {
    flex: 1,
    gap: Spacing.lg,
  },
  policySectionCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  policyBulletsList: {
    gap: 12,
    marginTop: 8,
  },
  policyBulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  policyBulletTextCol: {
    flex: 1,
  },
  policyBulletTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  policyBulletDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  policyCardBodyText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
    
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
  fieldGroup: {
    marginBottom: 16,
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    height: 36,
    paddingHorizontal: 12,
    fontSize: FontSize.sm,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  analyticsFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
  },
  analyticsPlatformCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 12,
    gap: 10,
    backgroundColor: Colors.surface,
  },
  platformLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  platformIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformNameText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  platformProgressSubtext: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  progressBarWrapper: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
