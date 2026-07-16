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

export default function OfficeHeadDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();

  const { policySections, effectiveDate, lastUpdatedDate, fetchPolicy } = usePolicyStore();

  useEffect(() => {
    fetchPolicy();
  }, []);

  // Tab State: 'dashboard' | 'approval-queue' | 'analytics' | 'policy-rules' | 'account-settings'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Preview Device State
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');

  // Selected Post for Preview
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);

  // Policy Search State
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // Mock Pending Approvals
  const mockPendingPosts = [
    {
      id: 'p1',
      title: 'Founders Day Celebration Campaign',
      type: 'Campaign',
      channels: 'Instagram, Facebook',
      date: 'Oct 24, 2023, 09:15 AM',
      authorName: 'Maria Santos',
      authorRole: 'Social Media Lead',
      authorInitials: 'MS',
      authorColor: '#3B82F6',
      status: 'PENDING REVIEW',
      caption: 'Join us as we celebrate our rich heritage this coming Friday! Founders Day is more than just a tradition; it\'s a testament to our enduring commitment to excellence and community. See you there!',
      previewImage: 'FOUNDERS DAY CELEBRATION',
    },
    {
      id: 'p2',
      title: 'Alumni Homecoming Announcement',
      type: 'Announcement',
      channels: 'LinkedIn, Twitter',
      date: 'Oct 24, 2023, 11:45 AM',
      authorName: 'Roberto Javier',
      authorRole: 'Dept. Secretary',
      authorInitials: 'RJ',
      authorColor: '#10B981',
      status: 'PENDING REVIEW',
      caption: 'Welcome back home, alumni! Registration for the 2024 JMCFI Alumni Homecoming is officially open. Reconnect with old classmates, network with peers, and see how our campus has grown.',
      previewImage: 'ALUMNI HOMECOMING',
    },
    {
      id: 'p3',
      title: 'Student Research Symposium Poster',
      type: 'Graphic',
      channels: 'All Channels',
      date: 'Oct 23, 2023, 02:30 PM',
      authorName: 'Elena Lopez',
      authorRole: 'Research Coordinator',
      authorInitials: 'EL',
      authorColor: '#8B5CF6',
      status: 'PENDING REVIEW',
      caption: 'Showcasing innovation and academic excellence. Come check out the breakthrough research papers and thesis projects presented by our senior graduating batch at the CCS building.',
      previewImage: 'RESEARCH SYMPOSIUM',
    },
    {
      id: 'p4',
      title: 'Quarterly Faculty Meeting Agenda',
      type: 'Internal',
      channels: 'Email, Intranet',
      date: 'Oct 23, 2023, 10:10 AM',
      authorName: 'Maria Santos',
      authorRole: 'Social Media Lead',
      authorInitials: 'MS',
      authorColor: '#3B82F6',
      status: 'PENDING REVIEW',
      caption: 'Dear colleagues, please review the attached agenda points for our upcoming quarterly coordination meeting scheduled this Wednesday. Attendance is highly appreciated.',
      previewImage: 'FACULTY MEETING AGENDA',
    },
  ];

  // Mock Recent Activities
  const recentActivities = [
    {
      id: 'a1',
      type: 'approve',
      icon: 'checkmark-circle-outline' as const,
      color: '#16A34A',
      title: 'Office Head Approved "Graduation Prep Schedule"',
      meta: '25 minutes ago &bull; Content complies with Branding Rules v2.1',
    },
    {
      id: 'a2',
      type: 'draft',
      icon: 'document-text-outline' as const,
      color: '#D97706',
      title: 'Draft Submitted: "Annual Science Fair Highlights"',
      meta: '2 hours ago &bull; By Elena Lopez (Research Coord.)',
    },
    {
      id: 'a3',
      type: 'reject',
      icon: 'close-circle-outline' as const,
      color: '#DC2626',
      title: 'Review Rejected: "Holiday Poster Design"',
      meta: 'Yesterday, 04:45 PM &bull; Reason: Incorrect institutional logo used.',
    },
  ];

  const handleApprove = (title: string) => {
    alert(`Approved successfully: "${title}"\nContent will progress to the IMC QA Check stage.`);
  };

  const isLargeScreen = width > 1024;
  const activePost = mockPendingPosts[selectedPostIndex] || mockPendingPosts[0];

  return (
    <DashboardShell
      title="Content Reviewer Console"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ----------------- DASHBOARD TAB ----------------- */}
      {activeTab === 'dashboard' && (
        <View style={styles.dashboardContainer}>
          {/* Header row */}
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Welcome, Office Head</Text>
              <Text style={styles.welcomeSubtitle}>
                Here is an overview of content approval performance and pending tasks in your department.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btnApprove, { flexDirection: 'row', alignItems: 'center', height: 32, paddingHorizontal: 16 }]}
              onPress={() => setActiveTab('approval-queue')}
            >
              <Ionicons name="checkbox-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnApproveText}>Go to Approval Queue</Text>
            </TouchableOpacity>
          </View>

          {/* KPI Summary metrics */}
          <View style={styles.metricsRow}>
            <Card style={[styles.metricCard, { borderLeftColor: '#D97706' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="time-outline" size={18} color="#D97706" />
                <Text style={[styles.badgeOrangeText, { color: '#EA580C' }]}>+2 today</Text>
              </View>
              <Text style={styles.metricValue}>12</Text>
              <Text style={styles.metricLabel}>Awaiting Review</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#16A34A' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="checkmark-done-outline" size={18} color="#16A34A" />
                <Text style={[styles.badgeGreenText, { color: '#16A34A' }]}>+14%</Text>
              </View>
              <Text style={styles.metricValue}>148</Text>
              <Text style={styles.metricLabel}>Total Approved (MTD)</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: Colors.primary }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="flash-outline" size={18} color={Colors.textPrimary} />
              </View>
              <Text style={styles.metricValue}>4.2h</Text>
              <Text style={styles.metricLabel}>Avg. Action Speed</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#2563EB' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#2563EB" />
              </View>
              <Text style={styles.metricValue}>98%</Text>
              <Text style={styles.metricLabel}>Brand Compliance</Text>
            </Card>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Quick Pending Items list */}
            <Card style={[styles.tableCard, { flex: 1.5 }]}>
              <Text style={styles.tableCardTitle}>Awaiting Immediate Action</Text>
              <Text style={styles.welcomeSubtitle}>Below are requests that require your sign-off to proceed.</Text>

              <View style={{ gap: 12, marginTop: 12 }}>
                {mockPendingPosts.slice(0, 2).map((post, idx) => (
                  <View key={post.id} style={[styles.analyticsPlatformCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.postTitleText}>{post.title}</Text>
                      <Text style={styles.postMetaText}>By {post.authorName} &bull; {post.date.split(',')[0]}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.btnApprove, { height: 28 }]}
                      onPress={() => {
                        setSelectedPostIndex(idx);
                        setActiveTab('approval-queue');
                      }}
                    >
                      <Text style={styles.btnApproveText}>Review Draft</Text>
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

                <TouchableOpacity
                  style={[styles.filterBtn, { justifyContent: 'flex-start', height: 36, width: '100%' }]}
                  onPress={() => setActiveTab('analytics')}
                >
                  <Ionicons name="bar-chart-outline" size={16} color={Colors.textPrimary} />
                  <Text style={[styles.filterBtnText, { marginLeft: 6 }]}>Open Analytics Dashboard</Text>
                </TouchableOpacity>

                <View style={[styles.analyticsPlatformCard, { backgroundColor: Colors.surfaceSecondary, borderWidth: 0, padding: 12, width: '100%' }]}>
                  <Text style={{ fontSize: FontSize.xs, fontWeight: 'bold', color: Colors.textPrimary }}>BRAND COMPLIANCE REMINDER</Text>
                  <Text style={[styles.welcomeSubtitle, { marginTop: 4, lineHeight: 16 }]}>
                    Always ensure publications feature the official Jose Maria College Foundation, Inc. logo formats, and written consent is validated for students before deployment.
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        </View>
      )}

      {/* ----------------- APPROVAL QUEUE TAB ----------------- */}
      {activeTab === 'approval-queue' && (
        <View style={styles.dashboardContainer}>
          {/* Header section */}
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Approval Queue</Text>
              <Text style={styles.welcomeSubtitle}>
                Reviewing pending content requests for the College of Computing Studies.
              </Text>
            </View>
            <View style={styles.periodBadge}>
              <Text style={styles.periodBadgeText}>PERIOD: Oct 2023 - Nov 2023</Text>
              <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
            </View>
          </View>

          {/* Metric cards summary */}
          <View style={styles.metricsRow}>
            <Card style={[styles.metricCard, { borderLeftColor: Colors.primary }]}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>TOTAL PENDING</Text>
                <View style={styles.badgeOrange}>
                  <Text style={styles.badgeOrangeText}>+3 today</Text>
                </View>
              </View>
              <Text style={styles.metricValue}>12</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#D97706' }]}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>AVG. REVIEW TIME</Text>
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>-15%</Text>
                </View>
              </View>
              <Text style={styles.metricValue}>4.2h</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#16A34A' }]}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>APPROVED (MTD)</Text>
                <Ionicons name="trending-up-outline" size={16} color="#16A34A" />
              </View>
              <Text style={styles.metricValue}>148</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#2563EB' }]}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>COMPLIANCE RATE</Text>
              </View>
              <Text style={styles.metricValue}>98%</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: '98%', backgroundColor: Colors.primary }]} />
              </View>
            </Card>
          </View>

          {/* Pending Approvals Table */}
          <Card style={styles.tableCard}>
            <View style={styles.tableCardHeader}>
              <Text style={styles.tableCardTitle}>Pending Approvals</Text>
              <View style={styles.headerBtnRow}>
                <TouchableOpacity style={styles.filterBtn} onPress={() => alert('Filtering...')}>
                  <Ionicons name="filter-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.filterBtnText}>Filter</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterBtn} onPress={() => alert('Exporting...')}>
                  <Ionicons name="download-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.filterBtnText}>Export</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Table layout */}
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.cellFlex2]}>REQUEST TITLE</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1_5]}>SUBMITTED BY</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1_2]}>DATE</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>STATUS</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1_5, styles.alignRight]}>ACTIONS</Text>
              </View>

              {mockPendingPosts.map((post, idx) => (
                <View key={post.id} style={[styles.tableRow, selectedPostIndex === idx && styles.tableRowSelected]}>
                  <View style={[styles.cellFlex2, styles.titleCellCol]}>
                    <Text style={styles.postTitleText}>{post.title}</Text>
                    <Text style={styles.postMetaText}>{post.type} &bull; {post.channels}</Text>
                  </View>

                  <View style={[styles.cellFlex1_5, styles.submittedByCol]}>
                    <View style={[styles.initialsCircle, { backgroundColor: post.authorColor }]}>
                      <Text style={styles.initialsText}>{post.authorInitials}</Text>
                    </View>
                    <View>
                      <Text style={styles.authorNameText}>{post.authorName}</Text>
                      <Text style={styles.authorRoleText}>{post.authorRole}</Text>
                    </View>
                  </View>

                  <Text style={[styles.tableCellText, styles.cellFlex1_2]}>{post.date.split(',')[0]}</Text>

                  <View style={[styles.cellFlex1, { flexDirection: 'row' }]}>
                    <View style={styles.statusBadgeYellow}>
                      <Text style={styles.statusBadgeYellowText}>{post.status}</Text>
                    </View>
                  </View>

                  <View style={[styles.cellFlex1_5, styles.actionsRow]}>
                    <TouchableOpacity style={styles.btnViewDetails} onPress={() => setSelectedPostIndex(idx)}>
                      <Text style={styles.btnViewDetailsText}>View Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnApprove} onPress={() => handleApprove(post.title)}>
                      <Text style={styles.btnApproveText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.tableFooter}>
              <Text style={styles.tableFooterText}>SHOWING 1 TO 4 OF 12 REQUESTS</Text>
              <View style={styles.paginationRow}>
                <TouchableOpacity style={styles.arrowBtn} disabled={true}>
                  <Ionicons name="chevron-back" size={14} color="#D1D5DB" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pageIndexBtn, styles.pageIndexBtnActive]}>
                  <Text style={[styles.pageIndexBtnText, styles.pageIndexBtnTextActive]}>1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pageIndexBtn}>
                  <Text style={styles.pageIndexBtnText}>2</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pageIndexBtn}>
                  <Text style={styles.pageIndexBtnText}>3</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.arrowBtn}>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* Lower layout section split */}
          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Recent departmental activity */}
            <Card style={[styles.tableCard, { flex: 1.5, gap: Spacing.md }]}>
              <Text style={styles.tableCardTitle}>Recent Departmental Activity</Text>
              <View style={styles.activitiesList}>
                {recentActivities.map((act) => (
                  <View key={act.id} style={styles.activityItem}>
                    <View style={[styles.activityIconBg, { borderColor: act.color }]}>
                      <Ionicons name={act.icon} size={14} color={act.color} />
                    </View>
                    <View style={styles.activityTextCol}>
                      <Text style={styles.activityTitleText}>{act.title}</Text>
                      <Text style={styles.activityMetaText}>
                        {act.meta.replace(/&bull;/g, '•')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            {/* Media preview phone device mock */}
            <Card style={[styles.configCard, { flex: 1, alignItems: 'center' }]}>
              <View style={styles.previewHeaderRow}>
                <Text style={styles.configCardTitle}>Media Preview</Text>
                <View style={styles.previewToggles}>
                  <TouchableOpacity
                    style={[styles.previewIconBtn, previewDevice === 'mobile' && styles.previewIconBtnActive]}
                    onPress={() => setPreviewDevice('mobile')}
                  >
                    <Ionicons name="phone-portrait-outline" size={14} color={previewDevice === 'mobile' ? Colors.textPrimary : '#6B7280'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.previewIconBtn, previewDevice === 'desktop' && styles.previewIconBtnActive]}
                    onPress={() => setPreviewDevice('desktop')}
                  >
                    <Ionicons name="desktop-outline" size={14} color={previewDevice === 'desktop' ? Colors.textPrimary : '#6B7280'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Phone Device frame */}
              <View style={styles.phoneMockup}>
                {/* Status Bar */}
                <View style={styles.phoneStatusBar}>
                  <View style={styles.phoneAvatarCircle}>
                    <Ionicons name="business" size={12} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.phoneAuthorName}>JMCFI Official</Text>
                    <Text style={styles.phoneMetaSubtext}>Sponsored &bull; Just now</Text>
                  </View>
                  <Ionicons name="ellipsis-horizontal" size={14} color={Colors.textSecondary} />
                </View>

                {/* Graphic Image Canvas */}
                <View style={styles.phonePostMedia}>
                  <View style={styles.mockPostGraphicBg}>
                    <Text style={styles.mockPostGraphicText}>{activePost.previewImage}</Text>
                  </View>
                </View>

                {/* Engagement Actions row */}
                <View style={styles.phoneActionsRow}>
                  <Ionicons name="heart-outline" size={16} color={Colors.textSecondary} />
                  <Ionicons name="chatbubble-outline" size={15} color={Colors.textSecondary} />
                  <Ionicons name="share-social-outline" size={16} color={Colors.textSecondary} />
                </View>

                {/* Caption Details */}
                <ScrollView style={styles.phoneCaptionScroll} nestedScrollEnabled={true}>
                  <Text style={styles.phoneCaptionText}>
                    <Text style={{ fontWeight: 'bold' }}>JMCFI Official </Text>
                    {activePost.caption}
                  </Text>
                </ScrollView>
              </View>

              <Text style={styles.previewIndicatorLabel}>
                VIEWING: {activePost.title.toUpperCase()}
              </Text>
            </Card>
          </View>
        </View>
      )}

      {/* ----------------- ANALYTICS TAB ----------------- */}
      {activeTab === 'analytics' && (
        <View style={styles.dashboardContainer}>
          {/* Header row */}
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Performance Analytics</Text>
              <Text style={styles.welcomeSubtitle}>
                Monitor reach, engagement levels, and publishing efficiency metrics for your department.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
              <TouchableOpacity style={styles.analyticsFilterBtn} onPress={() => alert('Filtering by time range...')}>
                <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: 'bold', paddingHorizontal: 8 }}>
                  Last 30 Days
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnApprove, { backgroundColor: Colors.primary, height: 32, paddingHorizontal: 16 }]}
                onPress={() => alert('Generating PDF reports...')}
              >
                <Ionicons name="download-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[styles.btnApproveText, { color: '#FFFFFF' }]}>Export Report</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Engagement Summary metrics */}
          <View style={styles.metricsRow}>
            <Card style={[styles.metricCard, { borderLeftColor: Colors.primary }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="eye-outline" size={18} color={Colors.textPrimary} />
                <Text style={[styles.badgeGreenText, { color: '#16A34A' }]}>+14.2%</Text>
              </View>
              <Text style={styles.metricValue}>128.4K</Text>
              <Text style={styles.metricLabel}>Total Impressions</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#FFC72C' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="heart-outline" size={18} color="#FFC72C" />
                <Text style={[styles.badgeGreenText, { color: '#16A34A' }]}>+8.5%</Text>
              </View>
              <Text style={styles.metricValue}>8.2%</Text>
              <Text style={styles.metricLabel}>Engagement Rate</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#16A34A' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="time-outline" size={18} color="#16A34A" />
                <Text style={[styles.badgeGreenText, { color: '#16A34A' }]}>-0.4d</Text>
              </View>
              <Text style={styles.metricValue}>1.8 Days</Text>
              <Text style={styles.metricLabel}>Avg. Approval Time</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#2563EB' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="checkbox-outline" size={18} color="#2563EB" />
                <Text style={[styles.badgeGreenText, { color: '#16A34A' }]}>+3.1%</Text>
              </View>
              <Text style={styles.metricValue}>92.3%</Text>
              <Text style={styles.metricLabel}>First-time Approval</Text>
            </Card>
          </View>

          {/* Charts Layout section */}
          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Monthly Posting Volume native bar chart */}
            <Card style={[styles.tableCard, { flex: 1.5 }]}>
              <Text style={styles.tableCardTitle}>Monthly Posting Activity</Text>
              <Text style={styles.welcomeSubtitle}>Active publications count per month during this academic year.</Text>
              
              <View style={styles.chartContainer}>
                {/* Visual Y-Axis markers */}
                <View style={styles.chartYAxis}>
                  <Text style={styles.chartAxisLabel}>40</Text>
                  <Text style={styles.chartAxisLabel}>30</Text>
                  <Text style={styles.chartAxisLabel}>20</Text>
                  <Text style={styles.chartAxisLabel}>10</Text>
                  <Text style={styles.chartAxisLabel}>0</Text>
                </View>

                <View style={styles.chartPlotArea}>
                  {/* Monthly column bars */}
                  {[
                    { month: 'May', count: 18, height: '45%' },
                    { month: 'Jun', count: 24, height: '60%' },
                    { month: 'Jul', count: 32, height: '80%' },
                    { month: 'Aug', count: 12, height: '30%' },
                    { month: 'Sep', count: 38, height: '95%' },
                    { month: 'Oct', count: 28, height: '70%' },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.chartBarWrapper}>
                      <View style={styles.chartBarBackground}>
                        <View style={[styles.chartBarFill, { height: item.height }]}>
                          <Text style={styles.chartBarTooltip}>{item.count}</Text>
                        </View>
                      </View>
                      <Text style={styles.chartAxisLabel}>{item.month}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>

            {/* Platform Performance breakdown */}
            <Card style={[styles.configCard, { flex: 1 }]}>
              <Text style={styles.configCardTitle}>Target Channel Breakdown</Text>
              <Text style={styles.welcomeSubtitle}>Reach volume distribution share by platform channel.</Text>

              <View style={{ marginTop: 12, gap: 10 }}>
                {/* Facebook */}
                <View style={styles.analyticsPlatformCard}>
                  <View style={styles.platformLeft}>
                    <View style={[styles.platformIconBg, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                    </View>
                    <View>
                      <Text style={styles.platformNameText}>Facebook</Text>
                      <Text style={styles.platformProgressSubtext}>82.5K reach &bull; 64% share</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarWrapper}>
                    <View style={[styles.progressBarFill, { width: '64%', backgroundColor: '#1877F2' }]} />
                  </View>
                </View>

                {/* Instagram */}
                <View style={styles.analyticsPlatformCard}>
                  <View style={styles.platformLeft}>
                    <View style={[styles.platformIconBg, { backgroundColor: '#FDF2F8' }]}>
                      <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                    </View>
                    <View>
                      <Text style={styles.platformNameText}>Instagram</Text>
                      <Text style={styles.platformProgressSubtext}>27.1K reach &bull; 21% share</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarWrapper}>
                    <View style={[styles.progressBarFill, { width: '21%', backgroundColor: '#E1306C' }]} />
                  </View>
                </View>

                {/* Website Portal */}
                <View style={styles.analyticsPlatformCard}>
                  <View style={styles.platformLeft}>
                    <View style={[styles.platformIconBg, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="globe-outline" size={18} color="#059669" />
                    </View>
                    <View>
                      <Text style={styles.platformNameText}>Website Portal</Text>
                      <Text style={styles.platformProgressSubtext}>18.8K clicks &bull; 15% share</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarWrapper}>
                    <View style={[styles.progressBarFill, { width: '15%', backgroundColor: '#059669' }]} />
                  </View>
                </View>
              </View>
            </Card>
          </View>

          {/* Top performing content leaderboard */}
          <Card style={styles.tableCard}>
            <Text style={styles.tableCardTitle}>Top Performing Content Requests</Text>
            
            <View style={[styles.table, { marginTop: 12 }]}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.cellFlex2]}>Title & Channel</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Views / Clicks</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Likes</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Engagement Rate</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1, styles.alignRight]}>First-Time Approved</Text>
              </View>

              {[
                {
                  title: 'Annual Scholars Recognition Gala',
                  platform: 'Facebook, Instagram',
                  views: '42,500',
                  likes: '4,120',
                  rate: '9.7%',
                  icon: 'ribbon-outline',
                  iconBg: '#E0F2FE',
                  approved: 'Yes',
                },
                {
                  title: 'New MBA Program Announcement',
                  platform: 'Website Portal',
                  views: '18,800',
                  likes: '840',
                  rate: '4.5%',
                  icon: 'school-outline',
                  iconBg: '#F3E8FF',
                  approved: 'Yes',
                },
                {
                  title: 'Midterm Stress Relief Workshop',
                  platform: 'Facebook',
                  views: '12,200',
                  likes: '980',
                  rate: '8.0%',
                  icon: 'happy-outline',
                  iconBg: '#FEF3C7',
                  approved: 'No',
                },
              ].map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <View style={[styles.cellFlex2, styles.submittedByCol]}>
                    <View style={[styles.activityIconBg, { backgroundColor: item.iconBg, borderWidth: 0 }]}>
                      <Ionicons name={item.icon as any} size={14} color={Colors.textSecondary} />
                    </View>
                    <View>
                      <Text style={styles.postTitleText}>{item.title}</Text>
                      <Text style={styles.authorRoleText}>{item.platform}</Text>
                    </View>
                  </View>
                  <Text style={[styles.tableCellText, styles.cellFlex1]}>{item.views}</Text>
                  <Text style={[styles.tableCellText, styles.cellFlex1]}>{item.likes}</Text>
                  <Text style={[styles.tableCellText, styles.cellFlex1, { fontWeight: 'bold', color: '#16A34A' }]}>{item.rate}</Text>
                  <Text style={[styles.tableCellText, styles.cellFlex1, styles.alignRight, { color: item.approved === 'Yes' ? '#16A34A' : '#DC2626', fontWeight: 'bold' }]}>
                    {item.approved}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}

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
                        <View style={styles.policyFlowTimeline}>
                          {sec.steps.map((step, idx) => (
                            <View key={idx} style={styles.policyFlowItem}>
                              <View style={styles.policyFlowLeft}>
                                <View style={styles.policyFlowDot}>
                                  <Text style={styles.policyFlowDotText}>{idx + 1}</Text>
                                </View>
                                {idx < sec.steps.length - 1 && <View style={styles.policyFlowLine} />}
                              </View>
                              <View style={styles.policyFlowContent}>
                                <Text style={styles.policyFlowTitle}>{step.title}</Text>
                                <Text style={styles.policyFlowDesc}>{step.desc}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {sec.contact && (
                        <Text style={styles.policyContactText}>{sec.contact}</Text>
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
                    <Text style={styles.profilePicLargeText}>OH</Text>
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
                    defaultValue={user?.name ?? 'OFFICE.HEAD User'}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]}
                    value={user?.email ?? 'office.head@jmcfi.edu.ph'}
                    editable={false}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>DEPARTMENT / ROLE</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]}
                    value="College of Computing Studies"
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
  periodBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
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
    height: 20,
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
  badgeOrange: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  badgeOrangeText: {
    color: '#EA580C',
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
  },
  badgeGreen: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  badgeGreenText: {
    color: '#16A34A',
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: Colors.background,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
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
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableCardTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 28,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  filterBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
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
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  tableRowSelected: {
    backgroundColor: '#F8FAFC',
  },
  tableCellText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  cellFlex2: { flex: 2 },
  cellFlex1_5: { flex: 1.5 },
  cellFlex1_2: { flex: 1.2 },
  cellFlex1: { flex: 1 },
  alignRight: { textAlign: 'right' },
  titleCellCol: {
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
  submittedByCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  initialsCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs - 1,
    fontWeight: 'bold',
  },
  authorNameText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  authorRoleText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
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
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  btnViewDetails: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  btnViewDetailsText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
  },
  btnApprove: {
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  btnApproveText: {
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tableFooterText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  paginationRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  arrowBtn: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  pageIndexBtn: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  pageIndexBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pageIndexBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  pageIndexBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
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

  // Department activities timeline
  activitiesList: {
    gap: 16,
    marginTop: 4,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
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
    lineHeight: 16,
  },

  // Preview styling
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  configCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  previewToggles: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  previewIconBtn: {
    width: 26,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  previewIconBtnActive: {
    backgroundColor: '#EEF4F8',
  },
  phoneMockup: {
    width: '100%',
    maxWidth: 240,
    height: 380,
    borderWidth: 8,
    borderColor: '#1E293B',
    borderRadius: 24,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  phoneStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 6,
  },
  phoneAvatarCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneAuthorName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  phoneMetaSubtext: {
    fontSize: 7,
    color: Colors.textSecondary,
  },
  phonePostMedia: {
    height: 180,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  mockPostGraphicBg: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  mockPostGraphicText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#1E40AF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    letterSpacing: 1,
  },
  phoneActionsRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  phoneCaptionScroll: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  phoneCaptionText: {
    fontSize: FontSize.xs - 1,
    color: Colors.textPrimary,
    lineHeight: 12,
  },
  previewIndicatorLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
    marginTop: 12,
    textAlign: 'center',
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

  // Analytics tab styles
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
  chartContainer: {
    flexDirection: 'row',
    height: 220,
    marginTop: 20,
    paddingRight: 10,
    alignItems: 'stretch',
  },
  chartYAxis: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: 30,
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
    width: 32,
    height: '100%',
    backgroundColor: Colors.background,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  chartBarTooltip: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
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

  // Policy tab styles
  policySidebar: {
    width: 220,
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
  policyFlowTimeline: {
    marginTop: 6,
    gap: 0,
  },
  policyFlowItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 64,
  },
  policyFlowLeft: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
  },
  policyFlowDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  policyFlowDotText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  policyFlowLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
    zIndex: 1,
    marginVertical: 2,
  },
  policyFlowContent: {
    flex: 1,
    paddingBottom: 16,
  },
  policyFlowTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  policyFlowDesc: {
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  policyContactText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semiBold,
    fontStyle: 'italic',
    marginTop: 8,
  },
  policyEmptyState: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
});
