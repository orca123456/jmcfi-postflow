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

export default function ImcQaDashboard() {
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

  // Selected Post index in the table
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);

  // Search Filter Query (Approval Queue)
  const [qaSearchQuery, setQaSearchQuery] = useState('');

  // Policy Rules Search Query
  const [policySearchQuery, setPolicySearchQuery] = useState('');


  // Checklist state for items
  const [checklist, setChecklist] = useState({
    logo: true,
    colors: true,
    caption: false,
    media: true,
    details: true,
    tone: true,
  });

  // Mock Pending posts list matching System Users layout style
  const mockPendingPosts = [
    {
      id: 'q1',
      title: '2024 Alumni Homecoming Gala - Early Bird Announcement',
      dept: 'MARKETING',
      deptColor: '#EFF6FF',
      deptTextColor: '#1E40AF',
      date: 'Oct 24, 2023',
      postId: '0842-Q',
      submitted: 'Created 2 hours ago by Marketing Dept.',
      caption: 'Rekindle the spirit! Join us for the 2024 Alumni Homecoming Gala. Early bird registration is now open. #JMCFI #AlumniHomecoming',
      mockupTitle: 'ALUMNI HOMECOMING 2024',
      mockupSubtitle: 'CELEBRATE & RECONNECT',
      mockupDate: 'SATURDAY, NOVEMBER 9, 2024',
      mockupVenue: 'THE GRAND BALLROOM • 6:00 PM - 10:00 PM',
      mockupHost: 'UNIVERSITY OF CALIFORNIA, BERKELEY',
      likes: '1,240 likes',
    },
    {
      id: 'q2',
      title: 'Founders Week Sports Festival Graphic Banner',
      dept: 'ATHLETICS',
      deptColor: '#FFF7ED',
      deptTextColor: '#EA580C',
      date: 'Oct 25, 2023',
      postId: '0843-Q',
      submitted: 'Created 5 hours ago by Sports Committee',
      caption: 'Gear up for the most thrilling week of the semester! Registration for individual and team sports events starts this Monday. See you on the field! #FoundersWeek #SportsFest',
      mockupTitle: 'SPORTS FESTIVAL 2024',
      mockupSubtitle: 'UNLEASH THE CHAMPION WITHIN',
      mockupDate: 'OCTOBER 28 - NOVEMBER 2, 2024',
      mockupVenue: 'JMC CAMPUS SPORTS COMPLEX',
      mockupHost: 'OFFICE OF STUDENT AFFAIRS',
      likes: '850 likes',
    },
    {
      id: 'q3',
      title: 'Midterm Exams Schedule & Room Assignments',
      dept: 'REGISTRAR',
      deptColor: '#ECFDF5',
      deptTextColor: '#065F46',
      date: 'Oct 26, 2023',
      postId: '0844-Q',
      submitted: 'Created Yesterday by Registrar Office',
      caption: 'Please be guided by the official examination schedule and room assignments for the first semester midterms. Ensure all permit clearances are settled prior. Good luck! #Midterms2023',
      mockupTitle: 'MIDTERM EXAMINATIONS',
      mockupSubtitle: 'OFFICIAL SCHEDULE & ASSIGNMENTS',
      mockupDate: 'NOVEMBER 6 - 10, 2023',
      mockupVenue: 'MAIN BUILDING AUDITORIUM',
      mockupHost: 'OFFICE OF THE REGISTRAR',
      likes: '310 likes',
    },
  ];

  const filteredPosts = mockPendingPosts.filter(p => {
    const q = qaSearchQuery.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.dept.toLowerCase().includes(q);
  });

  const activePost = filteredPosts[selectedPostIndex] || mockPendingPosts[0];

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isLargeScreen = width > 1024;

  return (
    <DashboardShell
      title="IMC/QA — Institutional Quality Review"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ----------------- DASHBOARD TAB ----------------- */}
      {activeTab === 'dashboard' && (
        <View style={styles.dashboardContainer}>
          {/* Header row */}
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Welcome, Quality Lead</Text>
              <Text style={styles.welcomeSubtitle}>
                Institutional compliance status, brand checker boards, and active queues.
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
            <Card style={[styles.metricCard, { borderLeftColor: '#7C3AED' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#7C3AED" />
                <Text style={styles.badgeOrangeText}>+2 today</Text>
              </View>
              <Text style={styles.metricValue}>08</Text>
              <Text style={styles.metricLabel}>Pending QA Check</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#16A34A' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
              </View>
              <Text style={styles.metricValue}>124</Text>
              <Text style={styles.metricLabel}>Cleared Today</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: Colors.primary }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="flash-outline" size={18} color={Colors.textPrimary} />
              </View>
              <Text style={styles.metricValue}>1.5 Days</Text>
              <Text style={styles.metricLabel}>Avg. QA Action Time</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#2563EB' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="thumbs-up-outline" size={18} color="#2563EB" />
              </View>
              <Text style={styles.metricValue}>99.2%</Text>
              <Text style={styles.metricLabel}>Brand Compliance Score</Text>
            </Card>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Quick Pending Items list */}
            <Card style={[styles.tableCard, { flex: 1.5 }]}>
              <Text style={styles.tableCardTitle}>Awaiting Branding Clearance</Text>
              <Text style={styles.welcomeSubtitle}>Below are requests that require your QA validation to proceed.</Text>

              <View style={{ gap: 12, marginTop: 12 }}>
                {mockPendingPosts.map((post) => (
                  <View key={post.id} style={[styles.analyticsPlatformCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.postTitleText}>{post.title}</Text>
                      <Text style={styles.postMetaText}>By {post.dept} &bull; {post.date}</Text>
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
            <View style={{ gap: 4 }}>
              <View style={styles.postIdBadge}>
                <Text style={styles.postIdBadgeText}>
                  POST ID: {activePost.postId} &bull; {activePost.submitted}
                </Text>
              </View>
              <Text style={styles.welcomeTitle}>Institutional Quality Review</Text>
              <Text style={styles.welcomeSubtitle}>
                Reviewing: "{activePost.title}"
              </Text>
            </View>
            <TouchableOpacity style={styles.filterBtn} onPress={() => alert('Viewing revisions...')}>
              <Ionicons name="time-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.filterBtnText}>Revision History</Text>
            </TouchableOpacity>
          </View>

          {/* New List For Approving - matches System Users visual style */}
          <Card style={styles.tableCard}>
            <View style={[styles.previewHeaderRow, { marginBottom: 4 }]}>
              <Text style={styles.tableCardTitle}>Requests Pending QA Review</Text>
              <View style={[styles.periodBadge, { minWidth: 260, paddingHorizontal: 0, height: 28 }]}>
                <TextInput
                  style={{ flex: 1, paddingHorizontal: 12, fontSize: FontSize.xs, outlineStyle: 'none' }}
                  placeholder="Filter requests..."
                  value={qaSearchQuery}
                  onChangeText={setQaSearchQuery}
                />
                <Ionicons name="search" size={14} color={Colors.textSecondary} style={{ marginRight: 10 }} />
              </View>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.cellFlex2_5]}>Request Title</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1_2]}>Department</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1_2]}>Submitted Date</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1, styles.alignRight]}>Actions</Text>
              </View>

              {filteredPosts.map((post, idx) => (
                <View key={post.id} style={[styles.tableRow, activePost.id === post.id && styles.tableRowSelected]}>
                  <Text style={[styles.postTitleText, styles.cellFlex2_5]} numberOfLines={1}>
                    {post.title}
                  </Text>
                  
                  <View style={[styles.cellFlex1_2, { flexDirection: 'row' }]}>
                    <View style={[styles.departmentBadge, { backgroundColor: post.deptColor }]}>
                      <Text style={[styles.departmentBadgeText, { color: post.deptTextColor }]}>{post.dept}</Text>
                    </View>
                  </View>

                  <Text style={[styles.tableCellText, styles.cellFlex1_2]}>{post.date}</Text>

                  <View style={[styles.cellFlex1, styles.actionsRow]}>
                    <TouchableOpacity onPress={() => setSelectedPostIndex(idx)}>
                      <Text style={{ fontSize: FontSize.xs, color: '#2563EB', fontWeight: 'bold' }}>Review</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {filteredPosts.length === 0 && (
                <View style={{ padding: 12, alignItems: 'center' }}>
                  <Text style={styles.welcomeSubtitle}>No requests match the filter.</Text>
                </View>
              )}
            </View>
          </Card>

          {/* Split Media Preview & Brand Quality Checklist */}
          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Left Column: Media Preview */}
            <Card style={[styles.tableCard, { flex: 1.2, alignItems: 'center', backgroundColor: Colors.surfaceSecondary }]}>
              <View style={[styles.previewHeaderRow, { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 8, marginBottom: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="eye-outline" size={18} color={Colors.textPrimary} />
                  <Text style={styles.tableCardTitle}>Media Preview</Text>
                </View>
                <View style={styles.previewToggles}>
                  <TouchableOpacity
                    style={[styles.previewIconBtn, previewDevice === 'mobile' && styles.previewIconBtnActive]}
                    onPress={() => setPreviewDevice('mobile')}
                  >
                    <Ionicons name="phone-portrait-outline" size={14} color={previewDevice === 'mobile' ? Colors.textPrimary : '#6B7280'} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: previewDevice === 'mobile' ? Colors.textPrimary : '#6B7280' }}>Mobile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.previewIconBtn, previewDevice === 'desktop' && styles.previewIconBtnActive]}
                    onPress={() => setPreviewDevice('desktop')}
                  >
                    <Ionicons name="desktop-outline" size={14} color={previewDevice === 'desktop' ? Colors.textPrimary : '#6B7280'} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: previewDevice === 'desktop' ? Colors.textPrimary : '#6B7280' }}>Desktop</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Mobile Phone Mockup */}
              <View style={styles.phoneMockup}>
                {/* Status Bar */}
                <View style={styles.phoneStatusBar}>
                  <View style={styles.phoneAvatarCircle}>
                    <Ionicons name="business" size={10} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.phoneAuthorName}>JMCFI Official</Text>
                    <Text style={styles.phoneMetaSubtext}>Sponsored &bull; Davao City</Text>
                  </View>
                  <Ionicons name="ellipsis-horizontal" size={14} color={Colors.textSecondary} />
                </View>

                {/* Graphic Canvas */}
                <View style={styles.phonePostMedia}>
                  <View style={[styles.mockPostGraphicBg, activePost.dept === 'ATHLETICS' && { backgroundColor: '#EA580C' }, activePost.dept === 'REGISTRAR' && { backgroundColor: Colors.primary }]}>
                    <Text style={[styles.mockPostGraphicTitle, activePost.dept === 'ATHLETICS' && { color: '#FFFFFF' }]}>{activePost.mockupTitle}</Text>
                    <Text style={styles.mockPostGraphicSubtitle}>{activePost.mockupSubtitle}</Text>
                    <View style={[styles.mockPostGraphicDetails, activePost.dept === 'ATHLETICS' && { borderColor: '#FFFFFF' }]}>
                      <Text style={styles.mockPostDetailText}>SAVE THE DATE</Text>
                      <Text style={[styles.mockPostDetailText, { fontWeight: 'bold', fontSize: 10 }]}>{activePost.mockupDate}</Text>
                      <Text style={[styles.mockPostDetailText, { fontSize: 7, marginTop: 4 }]}>{activePost.mockupVenue}</Text>
                      <Text style={[styles.mockPostDetailText, { fontSize: 6, color: '#FFC72C', marginTop: 4 }]}>{activePost.mockupHost}</Text>
                    </View>
                  </View>
                </View>

                {/* Engagement row */}
                <View style={styles.phoneActionsRow}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Ionicons name="heart-outline" size={16} color={Colors.textSecondary} />
                    <Ionicons name="chatbubble-outline" size={15} color={Colors.textSecondary} />
                    <Ionicons name="share-social-outline" size={16} color={Colors.textSecondary} />
                  </View>
                  <Ionicons name="bookmark-outline" size={16} color={Colors.textSecondary} />
                </View>

                {/* Caption Details */}
                <ScrollView style={styles.phoneCaptionScroll} nestedScrollEnabled={true}>
                  <Text style={styles.likesCountText}>{activePost.likes}</Text>
                  <Text style={styles.phoneCaptionText}>
                    <Text style={{ fontWeight: 'bold' }}>jmcfi_official </Text>
                    {activePost.caption}
                  </Text>
                  <Text style={styles.commentsLinkText}>View all 42 comments</Text>
                </ScrollView>
              </View>
            </Card>

            {/* Right Column: Branding Quality Checklist */}
            <Card style={[styles.configCard, { flex: 1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 8 }}>
                <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textPrimary} />
                <Text style={styles.configCardTitle}>Branding Quality Checklist</Text>
              </View>

              <View style={styles.goldRemarkBlock}>
                <Text style={styles.goldRemarkText}>
                  "Every post must reflect the integrity and heritage of the JMC Foundation Institutions."
                </Text>
              </View>

              {/* Checklist Cards */}
              <View style={{ gap: 10, marginTop: 6 }}>
                {/* 1. Proper logo use */}
                <TouchableOpacity style={styles.checklistCard} onPress={() => toggleCheck('logo')}>
                  <View style={[styles.checkboxContainer, checklist.logo && styles.checkboxActive]}>
                    {checklist.logo && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkCardTitle}>Proper logo use</Text>
                    <Text style={styles.checkCardSubtitle}>Check spacing, version, and clear space rules.</Text>
                  </View>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.textPrimary} style={{ opacity: 0.6 }} />
                </TouchableOpacity>

                {/* 2. Correct colors */}
                <TouchableOpacity style={styles.checklistCard} onPress={() => toggleCheck('colors')}>
                  <View style={[styles.checkboxContainer, checklist.colors && styles.checkboxActive]}>
                    {checklist.colors && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkCardTitle}>Correct colors</Text>
                    <Text style={styles.checkCardSubtitle}>HEX #001E40 (Primary) and #FED65B (Secondary).</Text>
                  </View>
                  <Ionicons name="color-palette" size={16} color={Colors.textPrimary} style={{ opacity: 0.6 }} />
                </TouchableOpacity>

                {/* 3. Professional caption */}
                <TouchableOpacity style={styles.checklistCard} onPress={() => toggleCheck('caption')}>
                  <View style={[styles.checkboxContainer, checklist.caption && styles.checkboxActive]}>
                    {checklist.caption && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkCardTitle}>Professional caption</Text>
                    <Text style={styles.checkCardSubtitle}>Error free, grammatically sound, and properly tagged.</Text>
                  </View>
                  <Ionicons name="text" size={16} color={Colors.textPrimary} style={{ opacity: 0.6 }} />
                </TouchableOpacity>

                {/* 4. High-quality media */}
                <TouchableOpacity style={styles.checklistCard} onPress={() => toggleCheck('media')}>
                  <View style={[styles.checkboxContainer, checklist.media && styles.checkboxActive]}>
                    {checklist.media && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkCardTitle}>High-quality media</Text>
                    <Text style={styles.checkCardSubtitle}>Minimum 1080p, no pixelation, proper aspect ratio.</Text>
                  </View>
                  <Ionicons name="image" size={16} color={Colors.textPrimary} style={{ opacity: 0.6 }} />
                </TouchableOpacity>

                {/* 5. Event details */}
                <TouchableOpacity style={styles.checklistCard} onPress={() => toggleCheck('details')}>
                  <View style={[styles.checkboxContainer, checklist.details && styles.checkboxActive]}>
                    {checklist.details && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkCardTitle}>Event details</Text>
                    <Text style={styles.checkCardSubtitle}>Accuracy of dates, venues, and contact information.</Text>
                  </View>
                  <Ionicons name="calendar" size={16} color={Colors.textPrimary} style={{ opacity: 0.6 }} />
                </TouchableOpacity>

                {/* 6. Tone */}
                <TouchableOpacity style={styles.checklistCard} onPress={() => toggleCheck('tone')}>
                  <View style={[styles.checkboxContainer, checklist.tone && styles.checkboxActive]}>
                    {checklist.tone && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkCardTitle}>Tone</Text>
                    <Text style={styles.checkCardSubtitle}>Institutional yet engaging; appropriate for alumni.</Text>
                  </View>
                  <Ionicons name="megaphone" size={16} color={Colors.textPrimary} style={{ opacity: 0.6 }} />
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.btnReturnRemarks, { flex: 1 }]}
                  onPress={() => alert(`Flagged for revision. Feedback sent for: "${activePost.title}"`)}
                >
                  <Text style={styles.btnReturnRemarksText}>Flag for Revision</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnApprove, { flex: 1, height: 32 }]}
                  onPress={() => alert(`Compliance checks passed! Forwarding "${activePost.title}" to Vice President.`)}
                >
                  <Text style={styles.btnApproveText}>Approve & Forward</Text>
                </TouchableOpacity>
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
                <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: 'bold', paddingHorizontal: 8 }}>
                  Last 30 Days
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnApprove, { height: 32, paddingHorizontal: 16 }]}
                onPress={() => alert('Generating QA report...')}
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
                    <Text style={styles.profilePicLargeText}>ER</Text>
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
                    defaultValue={user?.name ?? 'Dr. Elena Rossi'}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]}
                    value={user?.email ?? 'elena.rossi@jmcfi.edu.ph'}
                    editable={false}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>DEPARTMENT / ROLE</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]}
                    value="Institutional Marketing Communications - QA"
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

  // Preview styling
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
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

  // IMC QA Checker Specific Custom Styling
  postIdBadge: {
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  postIdBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  previewToggles: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  previewIconBtn: {
    paddingHorizontal: 10,
    height: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  previewIconBtnActive: {
    backgroundColor: '#EEF4F8',
  },
  phoneMockup: {
    width: '100%',
    maxWidth: 245,
    height: 400,
    borderWidth: 8,
    borderColor: '#1E293B',
    borderRadius: 24,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    marginTop: 6,
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
    backgroundColor: '#001E40',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 4,
  },
  mockPostGraphicTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FED65B',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  mockPostGraphicSubtitle: {
    fontSize: 7,
    fontWeight: 'medium',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  mockPostGraphicDetails: {
    borderWidth: 0.5,
    borderColor: '#FED65B',
    padding: 6,
    borderRadius: 2,
    alignItems: 'center',
    marginTop: 4,
  },
  mockPostDetailText: {
    fontSize: 6,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  phoneActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  phoneCaptionScroll: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
  },
  likesCountText: {
    fontSize: FontSize.xs - 2,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  phoneCaptionText: {
    fontSize: FontSize.xs - 2,
    color: Colors.textPrimary,
    lineHeight: 12,
  },
  commentsLinkText: {
    fontSize: FontSize.xs - 2,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  goldRemarkBlock: {
    borderLeftWidth: 3,
    borderLeftColor: '#FFC72C',
    paddingLeft: 8,
    paddingVertical: 4,
    marginVertical: 4,
  },
  goldRemarkText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  checklistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 10,
    backgroundColor: Colors.surface,
  },
  checkboxContainer: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkCardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  checkCardSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  btnReturnRemarks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 4,
    height: 32,
    backgroundColor: Colors.surface,
  },
  btnReturnRemarksText: {
    fontSize: FontSize.xs,
    color: '#DC2626',
    fontWeight: FontWeight.bold,
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

  // Table User List Custom Layout Styles
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
  cellFlex2_5: { flex: 2.5 },
  cellFlex1_2: { flex: 1.2 },
  cellFlex1: { flex: 1 },
  alignRight: { textAlign: 'right' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  departmentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 0,
  },
  departmentBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
});
