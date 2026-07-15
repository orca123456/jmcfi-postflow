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

export default function PresidentDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();

  // Tab State: 'dashboard' | 'approval-queue' | 'analytics' | 'policy-rules' | 'account-settings'
  const [activeTab, setActiveTab] = useState('approval-queue');

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
      {/* ----------------- DASHBOARD TAB ----------------- */}
      {activeTab === 'dashboard' && (
        <View style={styles.dashboardContainer}>
          {/* Header row */}
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Welcome, President Ricardo</Text>
              <Text style={styles.welcomeSubtitle}>
                Clearance console overview for Jose Maria College Foundation, Inc.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btnApprove, { height: 32, paddingHorizontal: 16 }]}
              onPress={() => setActiveTab('approval-queue')}
            >
              <Ionicons name="checkbox-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnApproveText}>Go to Approval Queue</Text>
            </TouchableOpacity>
          </View>

          {/* KPI Summary metrics */}
          <View style={styles.metricsRow}>
            <Card style={[styles.metricCard, { borderLeftColor: '#2563EB' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="time-outline" size={18} color="#2563EB" />
                <Text style={styles.badgeOrangeText}>2 Critical</Text>
              </View>
              <Text style={styles.metricValue}>04</Text>
              <Text style={styles.metricLabel}>Awaiting Clearance</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#D97706' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="checkmark-done-outline" size={18} color="#D97706" />
                <Text style={[styles.badgeGreenText, { color: '#16A34A' }]}>+5%</Text>
              </View>
              <Text style={styles.metricValue}>92%</Text>
              <Text style={styles.metricLabel}>Weekly Approval Rate</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#4B5563' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#4B5563" />
              </View>
              <Text style={styles.metricValue}>98.5</Text>
              <Text style={styles.metricLabel}>Compliance Score</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#0B2545' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="flash-outline" size={18} color="#0B2545" />
              </View>
              <Text style={styles.metricValue}>4.2h</Text>
              <Text style={styles.metricLabel}>Avg. Clearance Speed</Text>
            </Card>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Quick Pending Items list */}
            <Card style={[styles.tableCard, { flex: 1.5 }]}>
              <Text style={styles.tableCardTitle}>Awaiting Presidential Action</Text>
              <Text style={styles.welcomeSubtitle}>Below are requests that require your final approval.</Text>

              <View style={{ gap: 12, marginTop: 12 }}>
                {mockClearancePosts.map((post) => (
                  <View key={post.id} style={[styles.analyticsPlatformCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.postTitleText}>{post.title}</Text>
                      <Text style={styles.postMetaText}>{post.sub}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.btnApprove, { height: 28 }]}
                      onPress={() => setActiveTab('approval-queue')}
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
              <Text style={styles.welcomeSubtitle}>EXECUTIVE CLEARANCE QUEUE</Text>
              <Text style={styles.welcomeTitle}>Presidential Dashboard</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
              <TouchableOpacity style={styles.filterBtn} onPress={() => alert('Filtering requests...')}>
                <Ionicons name="filter-outline" size={14} color="#4B5563" />
                <Text style={styles.filterBtnText}>Filter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterBtn} onPress={() => alert('Sorting by priority...')}>
                <Ionicons name="swap-vertical-outline" size={14} color="#4B5563" />
                <Text style={styles.filterBtnText}>Priority</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Metric cards summary */}
          <View style={styles.metricsRow}>
            <Card style={[styles.metricCard, { borderLeftColor: '#2563EB' }]}>
              <Text style={styles.metricLabel}>AWAITING CLEARANCE</Text>
              <Text style={styles.metricValue}>04</Text>
              <Text style={[styles.welcomeSubtitle, { fontSize: 10 }]}>Critical Priority: 2</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#D97706' }]}>
              <Text style={styles.metricLabel}>WEEKLY APPROVAL RATE</Text>
              <Text style={styles.metricValue}>92%</Text>
              <Text style={[styles.welcomeSubtitle, { fontSize: 10 }]}>Avg Response: 4.2 hrs</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#9CA3AF' }]}>
              <Text style={styles.metricLabel}>COMPLIANCE SCORE</Text>
              <Text style={styles.metricValue}>98.5</Text>
              <Text style={[styles.welcomeSubtitle, { fontSize: 10 }]}>Last audited: 2 days ago</Text>
            </Card>
          </View>

          {/* Clearance List Headers */}
          <Text style={styles.sectionTitle}>Pending Critical Clearances</Text>

          {/* Clearance items stacked cards */}
          <View style={{ gap: Spacing.lg }}>
            {mockClearancePosts.map((post) => (
              <Card key={post.id} style={styles.clearanceCard}>
                <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
                  {/* Left Column Graphic preview */}
                  <View style={styles.clearanceMediaCol}>
                    {post.urgent && (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentBadgeText}>URGENT CLEARANCE</Text>
                      </View>
                    )}
                    <View style={[styles.clearanceMediaCanvas, !post.urgent && { backgroundColor: '#1E293B' }]}>
                      <Text style={[
                        styles.clearanceMediaText,
                        !post.urgent && { color: '#FFFFFF', fontSize: 10, textAlign: 'center', fontFamily: 'serif', paddingHorizontal: 12 }
                      ]}>
                        {post.mediaLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Right Column details */}
                  <View style={styles.clearanceInfoCol}>
                    <View style={styles.previewHeaderRow}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.postTitleText}>{post.title}</Text>
                        <Text style={styles.postMetaText}>{post.sub}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={styles.statusBadgeYellow}>
                          <Text style={styles.statusBadgeYellowText}>{post.status}</Text>
                        </View>
                        <Text style={{ fontSize: 9, color: '#6B7280' }}>{post.submitted}</Text>
                      </View>
                    </View>

                    <Text style={styles.clearanceBodyText}>{post.body}</Text>

                    {/* Checkers approved / Carousel indicators */}
                    {post.reviewersText && (
                      <View style={styles.reviewersRow}>
                        <View style={{ flexDirection: 'row', gap: -6 }}>
                          {post.reviewers.map((rev) => (
                            <View key={rev} style={[styles.reviewerCircleMini, { backgroundColor: '#4B5563' }]}>
                              <Text style={styles.reviewerTextMini}>{rev}</Text>
                            </View>
                          ))}
                        </View>
                        <Text style={styles.reviewersSubtext}>{post.reviewersText}</Text>
                      </View>
                    )}

                    {post.hasCarousel && (
                      <View style={styles.carouselIndicatorsRow}>
                        {post.carouselSlides.map((slide, sIdx) => (
                          <View key={sIdx} style={[styles.carouselSlideBox, slide.includes('+') && { backgroundColor: '#E5E7EB' }]}>
                            <Text style={styles.carouselSlideText}>{slide}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity style={styles.btnViewPreview} onPress={() => alert(`Opening preview window for "${post.title}"`)}>
                        <Ionicons name="eye-outline" size={14} color="#0B2545" style={{ marginRight: 6 }} />
                        <Text style={styles.btnViewPreviewText}>View Full Preview</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnReturnRemarks} onPress={() => handleAction('Return with Remarks', post.title)}>
                        <Ionicons name="arrow-undo-outline" size={14} color="#DC2626" style={{ marginRight: 6 }} />
                        <Text style={styles.btnReturnRemarksText}>Return with Remarks</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnApprove} onPress={() => handleAction('Approve', post.title)}>
                        <Ionicons name="shield-checkmark-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.btnApproveText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          {/* Lower layout section split */}
          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Left Queue Analytics bar chart */}
            <Card style={[styles.tableCard, { flex: 1.5 }]}>
              <Text style={styles.tableCardTitle}>Queue Analytics</Text>
              
              <View style={styles.chartContainer}>
                {/* Visual Y-Axis markers */}
                <View style={styles.chartYAxis}>
                  <Text style={styles.chartAxisLabel}>10</Text>
                  <Text style={styles.chartAxisLabel}>5</Text>
                  <Text style={styles.chartAxisLabel}>0</Text>
                </View>

                <View style={styles.chartPlotArea}>
                  {/* Daily volume column bars */}
                  {[
                    { day: 'MON', count: 3, height: '30%' },
                    { day: 'TUE', count: 5, height: '50%' },
                    { day: 'WED', count: 2, height: '20%' },
                    { day: 'THU', count: 8, height: '80%' },
                    { day: 'FRI', count: 1, height: '10%' },
                    { day: 'SAT', count: 9, height: '90%' },
                    { day: 'SUN', count: 7, height: '70%', active: true },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.chartBarWrapper}>
                      <View style={styles.chartBarBackground}>
                        <View style={[
                          styles.chartBarFill,
                          { height: item.height },
                          item.active && { backgroundColor: '#0B2545' }
                        ]}>
                          <Text style={styles.chartBarTooltip}>{item.count}</Text>
                        </View>
                      </View>
                      <Text style={styles.chartAxisLabel}>{item.day}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>

            {/* Right Recent Activity */}
            <Card style={[styles.configCard, { flex: 1 }]}>
              <Text style={styles.configCardTitle}>Recent Activity</Text>
              
              <View style={styles.activitiesList}>
                {[
                  {
                    id: 'act1',
                    icon: 'checkmark-circle-outline',
                    color: '#16A34A',
                    bg: '#F0FDF4',
                    title: 'You approved "Scholarship Drive"',
                    meta: '15 minutes ago',
                  },
                  {
                    id: 'act2',
                    icon: 'arrow-undo-outline',
                    color: '#DC2626',
                    bg: '#FEF2F2',
                    title: 'You returned "Athletics Update"',
                    meta: '1 hour ago',
                  },
                  {
                    id: 'act3',
                    icon: 'mail-outline',
                    color: '#2563EB',
                    bg: '#EFF6FF',
                    title: 'New Request from Dr. Elena',
                    meta: '3 hours ago',
                  },
                  {
                    id: 'act4',
                    icon: 'chatbubble-outline',
                    color: '#4B5563',
                    bg: '#F3F4F6',
                    title: 'Comment on "Campus Tour"',
                    meta: 'Yesterday',
                  },
                ].map((act) => (
                  <View key={act.id} style={styles.activityItem}>
                    <View style={[styles.activityIconBg, { borderColor: act.color, backgroundColor: act.bg }]}>
                      <Ionicons name={act.icon as any} size={13} color={act.color} />
                    </View>
                    <View style={styles.activityTextCol}>
                      <Text style={styles.activityTitleText}>{act.title}</Text>
                      <Text style={styles.activityMetaText}>{act.meta}</Text>
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
                style={[styles.btnApprove, { height: 32, paddingHorizontal: 16 }]}
                onPress={() => alert('Generating President report...')}
              >
                <Ionicons name="download-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[styles.btnApproveText, { color: '#FFFFFF' }]}>Export Report</Text>
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
              {/* Left navigation index - desktop only */}
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
                    style={[styles.textInput, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
                    value={user?.email ?? 'president@jmcfi.edu.ph'}
                    editable={false}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>DEPARTMENT / ROLE</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
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

                <TouchableOpacity style={[styles.btnApprove, { backgroundColor: '#0B2545', height: 36, marginTop: 10 }]} onPress={() => alert('Password updated successfully!')}>
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  tableCardTitle: {
    fontSize: FontSize.md + 1,
    fontWeight: FontWeight.bold,
    color: '#0B2545',
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
  btnApprove: {
    borderRadius: 4,
    paddingHorizontal: 14,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B2545',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#FFFFFF',
  },
  activityTextCol: {
    flex: 1,
    gap: 3,
  },
  activityTitleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#0B2545',
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
    color: '#0B2545',
    marginTop: 4,
  },
  postTitleText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#0B2545',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    borderColor: '#E5E7EB',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  carouselSlideText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4B5563',
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
    borderColor: '#0B2545',
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    backgroundColor: '#FFFFFF',
  },
  btnViewPreviewText: {
    fontSize: FontSize.xs,
    color: '#0B2545',
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
    backgroundColor: '#FFFFFF',
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
    width: 24,
    height: '100%',
    backgroundColor: '#F3F4F6',
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

  // Policy tab styles
  policySidebar: {
    width: 180,
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
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
