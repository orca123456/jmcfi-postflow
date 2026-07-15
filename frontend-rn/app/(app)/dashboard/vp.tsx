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

export default function VPDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();

  // Tab State: 'dashboard' | 'approval-queue' | 'analytics' | 'policy-rules' | 'account-settings'
  const [activeTab, setActiveTab] = useState('approval-queue');

  // Preview Device State
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');

  // Selected Post for Details Preview
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);

  // Policy Search State
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // Mock VP pending requests list
  const mockPendingPosts = [
    {
      id: 'vp1',
      title: 'Institutional Founding Anniversary Campaign',
      dept: 'Dept: External Relations',
      channels: ['FACEBOOK', 'INSTAGRAM'],
      remark: 'Content aligns with the 25-year milestone theme. All branding assets are updated. Highly recommended for immediate release.',
      remarkAuthor: 'Dr. Elena Cruz (Head of PR)',
      remarkColor: '#3B82F6',
      date: 'Oct 24, 2023, 09:00 AM',
      caption: 'Celebrating 25 years of JMCFI\'s commitment to quality education! Join us as we look back at the milestones that shaped our institution and the bright future ahead. #JMCFI25 #EducationExcellence #Legacy',
      previewImage: 'FOUNDERS DAY CELEBRATION',
      timeline: [
        { title: 'Content Creator', meta: 'Submitted: Oct 20, 14:30', desc: 'Drafted based on latest brand guide.', status: 'complete' },
        { title: 'Office Head Review', meta: 'Approved: Oct 22, 10:15', desc: 'Verified assets and copy.', status: 'complete' },
        { title: 'VP Approval', meta: 'Awaiting Action', desc: '', status: 'active' },
        { title: 'Social Media Deployment', meta: 'Scheduled: Oct 24, 09:00', desc: '', status: 'pending' },
      ],
    },
    {
      id: 'vp2',
      title: 'Academic Excellence Awards 2023 Announcement',
      dept: 'Dept: Registrar Office',
      channels: ['TWITTER'],
      remark: 'Student list verified against records. Text is concise. Ready for scheduling.',
      remarkAuthor: 'Mr. Robert Tan (Registrar)',
      remarkColor: '#10B981',
      date: 'Oct 25, 2023, 10:30 AM',
      caption: 'Recognizing the hard work and dedication of our academic achievers! Congratulations to all students on the Dean\'s List for the First Semester of AY 2023-2024. Keep shining! #AcademicExcellence',
      previewImage: 'ACADEMIC EXCELLENCE',
      timeline: [
        { title: 'Content Creator', meta: 'Submitted: Oct 21, 11:20', desc: 'Compiled list from Registrar database.', status: 'complete' },
        { title: 'Office Head Review', meta: 'Approved: Oct 23, 09:40', desc: 'Validated student credentials and honors.', status: 'complete' },
        { title: 'VP Approval', meta: 'Awaiting Action', desc: '', status: 'active' },
        { title: 'Social Media Deployment', meta: 'Scheduled: Oct 25, 10:30', desc: '', status: 'pending' },
      ],
    },
    {
      id: 'vp3',
      title: 'Campus Safety Protocol - New Guidelines',
      dept: 'Dept: Admin Services',
      channels: ['LINKEDIN', 'WEBSITE'],
      remark: 'Critical update for faculty. Needs urgent clearance. I\'ve noted that we should emphasize the gate hours.',
      remarkAuthor: 'Engr. David Lim (Admin Head)',
      remarkColor: '#EF4444',
      date: 'Oct 26, 2023, 08:00 AM',
      caption: 'To ensure a safe environment for everyone on campus, please review the revised gate hours and safety protocols effective next Monday. Your cooperation is highly appreciated. #CampusSafety',
      previewImage: 'CAMPUS SAFETY GUIDELINES',
      timeline: [
        { title: 'Content Creator', meta: 'Submitted: Oct 22, 08:15', desc: 'Drafted new gate entry guidelines.', status: 'complete' },
        { title: 'Office Head Review', meta: 'Approved: Oct 23, 14:10', desc: 'Confirmed with safety committee.', status: 'complete' },
        { title: 'VP Approval', meta: 'Awaiting Action', desc: '', status: 'active' },
        { title: 'Social Media Deployment', meta: 'Scheduled: Oct 26, 08:00', desc: '', status: 'pending' },
      ],
    },
  ];

  const handleAction = (type: string, title: string) => {
    alert(`Action: "${type}" successfully triggered for request:\n"${title}"`);
  };

  const isLargeScreen = width > 1024;
  const activePost = mockPendingPosts[selectedPostIndex] || mockPendingPosts[0];

  return (
    <DashboardShell
      title="Vice President — Executive Approval Console"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ----------------- DASHBOARD TAB ----------------- */}
      {activeTab === 'dashboard' && (
        <View style={styles.dashboardContainer}>
          {/* Header row */}
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Welcome, Vice President</Text>
              <Text style={styles.welcomeSubtitle}>
                Executive overview of content approvals and quality benchmarks for Jose Maria College.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btnBatchApprove, { height: 32, paddingHorizontal: 16 }]}
              onPress={() => setActiveTab('approval-queue')}
            >
              <Ionicons name="checkbox-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnBatchApproveText}>Go to Approval Queue</Text>
            </TouchableOpacity>
          </View>

          {/* KPI Summary metrics */}
          <View style={styles.metricsRow}>
            <Card style={[styles.metricCard, { borderLeftColor: '#0B2545' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="time-outline" size={18} color="#0B2545" />
                <Text style={[styles.badgeOrangeText, { color: '#EA580C' }]}>+2 today</Text>
              </View>
              <Text style={styles.metricValue}>12</Text>
              <Text style={styles.metricLabel}>Pending VP Review</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#FFC72C' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="mail-unread-outline" size={18} color="#FFC72C" />
              </View>
              <Text style={styles.metricValue}>04</Text>
              <Text style={styles.metricLabel}>Escalated to President</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#16A34A' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="checkmark-done-outline" size={18} color="#16A34A" />
              </View>
              <Text style={styles.metricValue}>48</Text>
              <Text style={styles.metricLabel}>Approved MTD</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#2563EB' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="speedometer-outline" size={18} color="#2563EB" />
              </View>
              <Text style={styles.metricValue}>2.4h</Text>
              <Text style={styles.metricLabel}>Avg. Response Speed</Text>
            </Card>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Quick Pending Items list */}
            <Card style={[styles.tableCard, { flex: 1.5 }]}>
              <Text style={styles.tableCardTitle}>Awaiting Immediate VP Signature</Text>
              <Text style={styles.welcomeSubtitle}>Below are requests that require your sign-off to proceed.</Text>

              <View style={{ gap: 12, marginTop: 12 }}>
                {mockPendingPosts.map((post, idx) => (
                  <View key={post.id} style={[styles.analyticsPlatformCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.postTitleText}>{post.title}</Text>
                      <Text style={styles.postMetaText}>By {post.remarkAuthor.split('(')[0]} &bull; {post.date.split(',')[0]}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.btnApproveAction, { height: 28 }]}
                      onPress={() => {
                        setSelectedPostIndex(idx);
                        setActiveTab('approval-queue');
                      }}
                    >
                      <Text style={styles.btnApproveActionText}>Review Draft</Text>
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
                  <Ionicons name="book-outline" size={16} color="#0B2545" />
                  <Text style={[styles.filterBtnText, { marginLeft: 6 }]}>View Website Posting Policy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterBtn, { justifyContent: 'flex-start', height: 36, width: '100%' }]}
                  onPress={() => setActiveTab('analytics')}
                >
                  <Ionicons name="bar-chart-outline" size={16} color="#0B2545" />
                  <Text style={[styles.filterBtnText, { marginLeft: 6 }]}>Open Analytics Dashboard</Text>
                </TouchableOpacity>

                <View style={[styles.analyticsPlatformCard, { backgroundColor: '#F9FAFB', borderWidth: 0, padding: 12, width: '100%' }]}>
                  <Text style={{ fontSize: FontSize.xs, fontWeight: 'bold', color: '#0B2545' }}>EXECUTIVE BENCHMARK</Text>
                  <Text style={[styles.welcomeSubtitle, { marginTop: 4, lineHeight: 16 }]}>
                    All digital publications must be verified against academic records (for students) and brand integrity markers before final release.
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
              <Text style={styles.welcomeSubtitle}>EXECUTIVE OVERVIEW</Text>
              <Text style={styles.welcomeTitle}>Vice President Dashboard</Text>
              <Text style={styles.welcomeSubtitle}>
                Reviewing 12 pending requests approved by Office Heads.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
              <TouchableOpacity style={styles.filterBtn} onPress={() => alert('Filtering VP requests...')}>
                <Ionicons name="filter-outline" size={14} color="#4B5563" />
                <Text style={styles.filterBtnText}>Filter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnBatchApprove} onPress={() => alert('Batch approving all 12 requests...')}>
                <Ionicons name="checkbox-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnBatchApproveText}>Batch Approve</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Metric cards summary */}
          <View style={styles.metricsRow}>
            {/* Card 1 */}
            <Card style={[styles.metricCard, { borderLeftColor: '#E5E7EB' }]}>
              <View style={styles.metricHeader}>
                <View style={[styles.activityIconBg, { backgroundColor: '#EFF6FF', borderWidth: 0 }]}>
                  <Ionicons name="document-text-outline" size={16} color="#2563EB" />
                </View>
                <View style={styles.badgeOrange}>
                  <Text style={styles.badgeOrangeText}>+2 today</Text>
                </View>
              </View>
              <Text style={styles.metricValue}>12</Text>
              <Text style={styles.metricLabel}>PENDING REVIEW</Text>
            </Card>

            {/* Card 2 */}
            <Card style={[styles.metricCard, { borderLeftColor: '#E5E7EB' }]}>
              <View style={styles.metricHeader}>
                <View style={[styles.activityIconBg, { backgroundColor: '#FEF3C7', borderWidth: 0 }]}>
                  <Ionicons name="mail-unread-outline" size={16} color="#D97706" />
                </View>
              </View>
              <Text style={styles.metricValue}>4</Text>
              <Text style={styles.metricLabel}>ESCALATED TO PRESIDENT</Text>
            </Card>

            {/* Card 3 */}
            <Card style={[styles.metricCard, { borderLeftColor: '#E5E7EB' }]}>
              <View style={styles.metricHeader}>
                <View style={[styles.activityIconBg, { backgroundColor: '#ECFDF5', borderWidth: 0 }]}>
                  <Ionicons name="checkbox-outline" size={16} color="#16A34A" />
                </View>
              </View>
              <Text style={styles.metricValue}>48</Text>
              <Text style={styles.metricLabel}>FINALIZED THIS WEEK</Text>
            </Card>

            {/* Card 4 (Dark Blue) */}
            <Card style={[styles.metricCard, { backgroundColor: '#0B2545', borderLeftColor: '#0B2545', shadowColor: 'transparent' }]}>
              <View style={styles.metricHeader}>
                <View style={[styles.activityIconBg, { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0 }]}>
                  <Ionicons name="speedometer-outline" size={16} color="#FFFFFF" />
                </View>
              </View>
              <Text style={[styles.metricValue, { color: '#FFFFFF' }]}>2.4 hrs</Text>
              <Text style={[styles.metricLabel, { color: '#FFFFFF', opacity: 0.8 }]}>AVG. RESPONSE TIME</Text>
            </Card>
          </View>

          {/* Pending Approvals Table */}
          <Card style={styles.tableCard}>
            <View style={styles.tableCardHeader}>
              <Text style={styles.tableCardTitle}>Requests Awaiting VP Approval</Text>
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityBadgeText}>Priority View</Text>
              </View>
            </View>

            {/* Table layout */}
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.cellFlex2]}>REQUEST DETAILS</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex2_5]}>OFFICE HEAD REMARK</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1_2]}>MEDIA PREVIEW</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1_2]}>POST DATE</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1_5, styles.alignRight]}>ACTIONS</Text>
              </View>

              {mockPendingPosts.map((post, idx) => (
                <View key={post.id} style={[styles.tableRow, selectedPostIndex === idx && styles.tableRowSelected]}>
                  <TouchableOpacity style={[styles.cellFlex2, styles.titleCellCol]} onPress={() => setSelectedPostIndex(idx)}>
                    <Text style={styles.postTitleText}>{post.title}</Text>
                    <Text style={styles.postMetaText}>{post.dept}</Text>
                    <View style={styles.channelsBadgeRow}>
                      {post.channels.map((chan) => (
                        <View key={chan} style={styles.channelWordBadge}>
                          <Text style={styles.channelWordBadgeText}>{chan}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>

                  <View style={[styles.cellFlex2_5, styles.remarkCellCol, { borderLeftColor: post.remarkColor }]}>
                    <Text style={styles.remarkQuoteText}>"{post.remark}"</Text>
                    <Text style={styles.remarkAuthorText}>— {post.remarkAuthor}</Text>
                  </View>

                  <View style={[styles.cellFlex1_2, { alignItems: 'center' }]}>
                    <View style={styles.tableMediaBox}>
                      <Ionicons name="image-outline" size={16} color="#6B7280" />
                    </View>
                  </View>

                  <Text style={[styles.tableCellText, styles.cellFlex1_2, { fontSize: FontSize.xs }]}>{post.date.replace(/, /g, '\n')}</Text>

                  <View style={[styles.cellFlex1_5, styles.actionsRow]}>
                    {/* Approve checkmark button */}
                    <TouchableOpacity style={styles.actionBtnCheck} onPress={() => handleAction('Approve', post.title)}>
                      <Ionicons name="checkmark" size={14} color="#16A34A" />
                    </TouchableOpacity>
                    {/* Return arrow button */}
                    <TouchableOpacity style={styles.actionBtnReturn} onPress={() => handleAction('Return', post.title)}>
                      <Ionicons name="arrow-undo" size={14} color="#DC2626" />
                    </TouchableOpacity>
                    {/* Escalate button */}
                    <TouchableOpacity style={styles.actionBtnToPres} onPress={() => handleAction('Escalate to President', post.title)}>
                      <Ionicons name="arrow-forward-outline" size={12} color="#0B2545" style={{ marginRight: 2 }} />
                      <Text style={styles.actionBtnToPresText}>TO PRES</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.tableFooter}>
              <Text style={styles.tableFooterText}>Showing 3 of 12 requests</Text>
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
                  <Ionicons name="chevron-forward" size={14} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* Lower layout section split */}
          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Left detail panel */}
            <Card style={[styles.tableCard, { flex: 1.5 }]}>
              <View style={styles.previewHeaderRow}>
                <Text style={styles.tableCardTitle}>Content Review Detail</Text>
                <View style={styles.statusBadgeYellow}>
                  <Text style={styles.statusBadgeYellowText}>Awaiting Your Signature</Text>
                </View>
              </View>

              <View style={[styles.splitLayout, { flexDirection: 'row', gap: Spacing.lg, marginTop: 10 }]}>
                {/* Caption / remark input */}
                <View style={{ flex: 1, gap: 12 }}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>POST CAPTION</Text>
                    <View style={styles.captionBox}>
                      <Text style={styles.captionText}>{activePost.caption}</Text>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>ADD VP REVIEW REMARK</Text>
                    <TextInput
                      style={styles.remarkTextInput}
                      placeholder="Enter instructions or approval notes..."
                      multiline={true}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <TouchableOpacity
                      style={[styles.btnBatchApprove, { height: 38, paddingHorizontal: 16 }]}
                      onPress={() => alert(`Digitally Signed & Approved: "${activePost.title}"`)}
                    >
                      <Ionicons name="create-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.btnBatchApproveText}>Digitally Sign & Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtnReturn, { width: 38, height: 38, borderRadius: 4 }]}
                      onPress={() => alert(`Escalated draft to President: "${activePost.title}"`)}
                    >
                      <Ionicons name="arrow-forward-outline" size={18} color="#0B2545" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Visual Device Preview */}
                <View style={{ width: 180, alignItems: 'center' }}>
                  <Text style={styles.inputLabel}>VISUAL MOCKUP</Text>
                  
                  <View style={styles.phoneMockup}>
                    {/* Status Bar */}
                    <View style={styles.phoneStatusBar}>
                      <View style={styles.phoneAvatarCircle}>
                        <Ionicons name="business" size={10} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.phoneAuthorName, { fontSize: 8 }]}>JMCFI Official</Text>
                      </View>
                    </View>

                    {/* Graphic Area */}
                    <View style={[styles.phonePostMedia, { height: 110 }]}>
                      <View style={styles.mockPostGraphicBg}>
                        <Text style={[styles.mockPostGraphicText, { fontSize: 9, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4 }]}>
                          {activePost.previewImage}
                        </Text>
                      </View>
                    </View>

                    {/* Captions */}
                    <ScrollView style={styles.phoneCaptionScroll} nestedScrollEnabled={true}>
                      <Text style={[styles.phoneCaptionText, { fontSize: 8, lineHeight: 10 }]}>
                        <Text style={{ fontWeight: 'bold' }}>JMCFI Official </Text>
                        {activePost.caption}
                      </Text>
                    </ScrollView>
                  </View>
                </View>
              </View>
            </Card>

            {/* Right detail panel - Approval Path */}
            <Card style={[styles.configCard, { flex: 1 }]}>
              <Text style={styles.configCardTitle}>Approval Path</Text>
              
              <View style={styles.timelineList}>
                {activePost.timeline.map((step, idx) => (
                  <View key={idx} style={styles.timelineItem}>
                    <View style={styles.timelineLeftCol}>
                      <View style={[
                        styles.timelineDotCircle,
                        step.status === 'complete' && { backgroundColor: '#10B981' },
                        step.status === 'active' && { backgroundColor: '#0B2545' },
                        step.status === 'pending' && { backgroundColor: '#E5E7EB' },
                      ]}>
                        <Ionicons
                          name={
                            step.title === 'Content Creator' ? 'person-outline' :
                            step.title === 'Office Head Review' ? 'shield-checkmark-outline' :
                            step.title === 'VP Approval' ? 'create-outline' : 'flag-outline'
                          }
                          size={12}
                          color="#FFFFFF"
                        />
                      </View>
                      {idx < activePost.timeline.length - 1 && <View style={styles.timelineLineLink} />}
                    </View>

                    <View style={styles.timelineRightCol}>
                      <Text style={styles.timelineStepTitle}>{step.title}</Text>
                      <Text style={styles.timelineStepMeta}>{step.meta}</Text>
                      {step.desc ? (
                        <View style={styles.timelineStepDescCard}>
                          <Text style={styles.timelineStepDescText}>"{step.desc}"</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
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
                <Text style={{ fontSize: FontSize.xs, color: '#4B5563', fontWeight: 'bold', paddingHorizontal: 8 }}>
                  Last 30 Days
                </Text>
                <Ionicons name="chevron-down" size={14} color="#4B5563" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnBatchApprove, { height: 32, paddingHorizontal: 16 }]}
                onPress={() => alert('Generating VP Analytics report...')}
              >
                <Ionicons name="download-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[styles.btnBatchApproveText, { color: '#FFFFFF' }]}>Export Report</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Engagement Summary metrics */}
          <View style={styles.metricsRow}>
            <Card style={[styles.metricCard, { borderLeftColor: '#0B2545' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="eye-outline" size={18} color="#0B2545" />
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
        </View>
      )}

      {/* ----------------- POLICY & RULES TAB ----------------- */}
      {activeTab === 'policy-rules' && (() => {
        const policySections = [
          {
            id: 'sec-1',
            title: '1. Purpose',
            icon: 'book-outline' as const,
            bg: '#EFF6FF',
            color: '#0B2545',
            content: 'This policy governs all content published on the official Jose Maria College Foundation, Inc. website (jcm.edu.ph). It applies to all faculty, staff, students, and authorized contributors ("Posters"). The goal is to ensure a cohesive, safe, and professionally branded digital presence.',
          },
          {
            id: 'sec-2',
            title: '2. Scope & Limitations',
            icon: 'shield-checkmark-outline' as const,
            bg: '#F3E8FF',
            color: '#7C3AED',
            bullets: [
              { title: 'Brand Integrity', desc: 'All content must adhere to the official JMCFI Brand Guidelines (colors, logos, typography).' },
              { title: 'Platform Limitation', desc: 'This policy applies exclusively to the official school domain and subdomains.' },
              { title: 'Editorial Control', desc: 'The school reserves the right to edit, reject, or remove any content without prior notice.' },
              { title: 'Non-Compliance', desc: 'Violation results in immediate removal from the platform and potential disciplinary action.' },
            ],
          },
          {
            id: 'sec-3',
            title: '3. Acceptable Content',
            icon: 'checkmark-circle-outline' as const,
            bg: '#DCFCE7',
            color: '#16A34A',
            bullets: [
              { title: 'Academic & Professional', desc: 'Content must support the school\'s mission, be factually accurate, and maintain an inclusive tone.' },
              { title: 'Visual Standards', desc: 'Use approved templates, high-resolution media, and official school colors/logo only.' },
              { title: 'Consent (Minors Under 18)', desc: 'Written parental/guardian consent is required.' },
              { title: 'Consent (Adults 18+)', desc: 'Student\'s own signed consent is required.' },
            ],
          },
          {
            id: 'sec-4',
            title: '4. Prohibited Content',
            icon: 'alert-circle-outline' as const,
            bg: '#FEE2E2',
            color: '#DC2626',
            bullets: [
              { title: 'Academic Misconduct', desc: 'Cheating guides, answer keys, or plagiarism.' },
              { title: 'Inappropriate Material', desc: 'Bullying, hate speech, explicit content, or harassment.' },
              { title: 'Commercial/Political', desc: 'Unauthorized ads, personal fundraising, or political endorsements.' },
              { title: 'Privacy Breach', desc: 'Publishing student grades, private addresses, or administrative records.' },
            ],
          },
        ];

        const filteredSections = policySections.filter(sec => {
          const query = policySearchQuery.toLowerCase();
          if (!query) return true;
          return sec.title.toLowerCase().includes(query) || sec.content?.toLowerCase().includes(query) || sec.bullets?.some(b => b.title.toLowerCase().includes(query) || b.desc.toLowerCase().includes(query));
        });

        return (
          <View style={styles.dashboardContainer}>
            {/* Header row */}
            <View style={styles.dashboardHeaderRow}>
              <View>
                <Text style={styles.welcomeTitle}>School Website Posting Policy</Text>
                <Text style={styles.welcomeSubtitle}>
                  Effective Date: Jun 26, 2026 &bull; Last Updated: July 15, 2026
                </Text>
              </View>
              
              <View style={[styles.periodBadge, { minWidth: 260, paddingHorizontal: 0 }]}>
                <TextInput
                  style={{ flex: 1, paddingHorizontal: 12, fontSize: FontSize.sm, outlineStyle: 'none' }}
                  placeholder="Search policy guidelines..."
                  value={policySearchQuery}
                  onChangeText={setPolicySearchQuery}
                />
                <Ionicons name="search" size={16} color="#6B7280" style={{ marginRight: 12 }} />
              </View>
            </View>

            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
              {/* Left navigation menu (Index) */}
              {isLargeScreen && (
                <View style={styles.policySidebar}>
                  <Text style={styles.policySidebarTitle}>POLICY SECTIONS</Text>
                  {policySections.map((sec) => (
                    <TouchableOpacity
                      key={sec.id}
                      style={[styles.policySidebarItem, { backgroundColor: '#FFFFFF' }]}
                      onPress={() => alert(`Scrolling to ${sec.title}...`)}
                    >
                      <Ionicons name={sec.icon} size={16} color="#4B5563" />
                      <Text style={styles.policySidebarLabel} numberOfLines={1}>{sec.title.substring(3)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Main Policy Cards */}
              <View style={styles.policyDetailCol}>
                {filteredSections.map((sec) => (
                  <Card key={sec.id} style={[styles.policySectionCard, { borderLeftColor: sec.color }]}>
                    <View style={[styles.previewHeaderRow, { justifyContent: 'flex-start', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10 }]}>
                      <View style={[styles.activityIconBg, { backgroundColor: sec.bg, borderColor: sec.color }]}>
                        <Ionicons name={sec.icon} size={14} color={sec.color} />
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
                  <View style={[styles.activityIconBg, { backgroundColor: '#EFF6FF', borderColor: '#0B2545' }]}>
                    <Ionicons name="person-outline" size={14} color="#0B2545" />
                  </View>
                  <Text style={styles.tableCardTitle}>Profile Information</Text>
                </View>

                {/* Profile Picture Upload Section */}
                <View style={styles.profilePicUploadContainer}>
                  <View style={styles.profilePicLarge}>
                    <Text style={styles.profilePicLargeText}>VP</Text>
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
                    defaultValue={user?.name ?? 'VICE.PRESIDENT User'}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
                    value={user?.email ?? 'vice.president@jmcfi.edu.ph'}
                    editable={false}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>DEPARTMENT / ROLE</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
                    value="Executive Office of Vice President"
                    editable={false}
                  />
                </View>

                <TouchableOpacity style={[styles.btnBatchApprove, { height: 36 }]} onPress={() => alert('Profile settings saved successfully!')}>
                  <Text style={styles.btnBatchApproveText}>Save Details</Text>
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

                <TouchableOpacity style={[styles.btnBatchApprove, { backgroundColor: '#0B2545', height: 36, marginTop: 10 }]} onPress={() => alert('Password updated successfully!')}>
                  <Text style={styles.btnBatchApproveText}>Change Password</Text>
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
            <Ionicons name="construct-outline" size={32} color="#9CA3AF" />
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
    color: '#0B2545',
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
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    backgroundColor: '#FFFFFF',
  },
  periodBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4B5563',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#0B2545',
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

  // Table Styles
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#0B2545',
  },
  priorityBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#D97706',
    textTransform: 'uppercase',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  filterBtnText: {
    fontSize: FontSize.xs,
    color: '#4B5563',
    fontWeight: FontWeight.bold,
  },
  btnBatchApprove: {
    borderRadius: 4,
    paddingHorizontal: 14,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B2545',
  },
  btnBatchApproveText: {
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderCell: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    color: '#4B5563',
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
  cellFlex2_5: { flex: 2.5 },
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
    color: '#0B2545',
  },
  postMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  channelsBadgeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  channelWordBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  channelWordBadgeText: {
    fontSize: 8,
    color: '#1E40AF',
    fontWeight: 'bold',
  },
  remarkCellCol: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    gap: 4,
  },
  remarkQuoteText: {
    fontSize: FontSize.xs + 1,
    color: '#374151',
    fontStyle: 'italic',
    lineHeight: 15,
  },
  remarkAuthorText: {
    fontSize: FontSize.xs - 1,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  tableMediaBox: {
    width: 48,
    height: 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionBtnCheck: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
  },
  actionBtnReturn: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
  },
  actionBtnToPres: {
    borderWidth: 1,
    borderColor: '#0B2545',
    borderRadius: 4,
    paddingHorizontal: 6,
    height: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  actionBtnToPresText: {
    fontSize: 9,
    color: '#0B2545',
    fontWeight: 'bold',
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
    borderColor: '#E5E7EB',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  pageIndexBtn: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  pageIndexBtnActive: {
    backgroundColor: '#0B2545',
    borderColor: '#0B2545',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
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
    color: '#0B2545',
  },
  captionBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 10,
    backgroundColor: '#F9FAFB',
    minHeight: 80,
  },
  captionText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  remarkTextInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    height: 80,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    backgroundColor: '#FFFFFF',
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
  phoneMockup: {
    width: 140,
    height: 220,
    borderWidth: 6,
    borderColor: '#1E293B',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  phoneStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 4,
  },
  phoneAvatarCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0B2545',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneAuthorName: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#0B2545',
  },
  phonePostMedia: {
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  mockPostGraphicBg: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  mockPostGraphicText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
    borderColor: '#1E40AF',
    letterSpacing: 0.5,
  },
  phoneCaptionScroll: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  phoneCaptionText: {
    color: Colors.textPrimary,
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

  // Timeline Progress path styling
  timelineList: {
    gap: 0,
    marginTop: 6,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 52,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 24,
    marginRight: 10,
  },
  timelineDotCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineLineLink: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
    zIndex: 1,
    marginVertical: 1,
  },
  timelineRightCol: {
    flex: 1,
    paddingBottom: 10,
    gap: 2,
  },
  timelineStepTitle: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: '#0B2545',
  },
  timelineStepMeta: {
    fontSize: 9,
    color: Colors.textSecondary,
  },
  timelineStepDescCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 6,
    marginTop: 2,
  },
  timelineStepDescText: {
    fontSize: FontSize.xs - 1,
    color: '#4B5563',
    fontStyle: 'italic',
  },

  // Placeholders
  placeholderCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#0B2545',
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
    borderColor: '#E5E7EB',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
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
    color: '#9CA3AF',
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
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: '#0B2545',
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
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
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
    color: '#0B2545',
  },
  platformProgressSubtext: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  progressBarWrapper: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  btnApproveAction: {
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B2545',
  },
  btnApproveActionText: {
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },

  // Policy tab styles
  policySidebar: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: Spacing.md,
    gap: Spacing.xs,
    alignSelf: 'flex-start',
  },
  policySidebarTitle: {
    fontSize: FontSize.xs,
    fontWeight: 'bold',
    color: '#0B2545',
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
    color: '#4B5563',
    fontWeight: FontWeight.medium,
  },
  policyDetailCol: {
    flex: 1,
    gap: Spacing.lg,
  },
  policySectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#0B2545',
  },
  policyBulletDesc: {
    fontSize: FontSize.sm,
    color: '#4B5563',
    lineHeight: 18,
    marginTop: 2,
  },
  policyCardBodyText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
    whiteSpace: 'pre-wrap',
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
    backgroundColor: '#0B2545',
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
    color: '#0B2545',
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
    color: '#0B2545',
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
    borderColor: '#E5E7EB',
    borderRadius: 4,
    height: 36,
    paddingHorizontal: 12,
    fontSize: FontSize.sm,
    backgroundColor: '#FFFFFF',
    color: Colors.textPrimary,
  },
  activityIconBg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
});
