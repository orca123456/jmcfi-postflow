import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DashboardShell } from '../../../components/DashboardShell';
import { Card } from '../../../components/ui/Card';
import { useAuthStore } from '../../../store/auth';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../constants/theme';

export default function PublisherDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();

  // Tab State: 'dashboard' | 'approval-queue' | 'analytics' | 'policy-rules' | 'account-settings'
  const [activeTab, setActiveTab] = useState('approval-queue');

  // Policy Search State
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // Queue Search Filter
  const [queueSearchQuery, setQueueSearchQuery] = useState('');

  // Mock Publishing Queue Items matching screenshot high-fidelity layout
  const mockPublishQueue = [
    {
      id: 'pub1',
      title: 'JMCFI Open House 2024',
      sub: 'Announcement of the upcoming acade...',
      mediaLabel: 'OPEN HOUSE',
      bg: '#EFF6FF',
      color: '#1E40AF',
      targets: ['logo-instagram', 'camera-outline', 'globe-outline'],
      quality: '98%',
      date: '',
      status: 'ready',
    },
    {
      id: 'pub2',
      title: 'Library Expansion Update',
      sub: 'New study wings opening this semester...',
      mediaLabel: 'LIBRARY BUILD',
      bg: '#F8FAFC',
      color: '#475569',
      targets: ['globe-outline'],
      quality: '100%',
      date: '',
      status: 'ready',
    },
    {
      id: 'pub3',
      title: 'Athletics: Finals Week',
      sub: 'Highlights from the varsity championshi...',
      mediaLabel: 'FINALS GAME',
      bg: '#FFF7ED',
      color: '#EA580C',
      targets: ['logo-instagram', 'camera-outline'],
      quality: '92%',
      date: '',
      status: 'ready',
    },
    {
      id: 'pub4',
      title: 'Registration Calendar Update',
      sub: 'Critical dates for 2nd Semester enrollme...',
      mediaLabel: 'CALENDAR 2024',
      bg: '#EFF6FF',
      color: '#1E40AF',
      targets: ['globe-outline'],
      quality: '100%',
      date: '',
      status: 'ready',
    },
  ];

  const handleAction = (type: string, title: string) => {
    alert(`IT Action: "${type}" executed for post:\n"${title}"`);
  };

  const isLargeScreen = width > 1024;

  const filteredQueue = mockPublishQueue.filter(item => {
    const q = queueSearchQuery.toLowerCase();
    if (!q) return true;
    return item.title.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q);
  });

  return (
    <DashboardShell
      title="IT Publisher — Publishing Queue"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ----------------- DASHBOARD TAB ----------------- */}
      {activeTab === 'dashboard' && (
        <View style={styles.dashboardContainer}>
          {/* Header row */}
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Welcome, IT Publisher</Text>
              <Text style={styles.welcomeSubtitle}>
                Clearance console overview for Jose Maria College Foundation, Inc.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btnApprove, { height: 32, paddingHorizontal: 16 }]}
              onPress={() => setActiveTab('approval-queue')}
            >
              <Ionicons name="checkbox-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnApproveText}>Go to Publishing Queue</Text>
            </TouchableOpacity>
          </View>

          {/* KPI Summary metrics */}
          <View style={styles.metricsRow}>
            <Card style={[styles.metricCard, { borderLeftColor: '#0B2545' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="cloud-upload-outline" size={18} color="#0B2545" />
                <Text style={styles.badgeOrangeText}>READY</Text>
              </View>
              <Text style={styles.metricValue}>12</Text>
              <Text style={styles.metricLabel}>Awaiting Clearance</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#2563EB' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="calendar-outline" size={18} color="#2563EB" />
              </View>
              <Text style={styles.metricValue}>05</Text>
              <Text style={styles.metricLabel}>Scheduled Items</Text>
            </Card>

            <Card style={[styles.metricCard, { borderLeftColor: '#16A34A' }]}>
              <View style={styles.metricHeader}>
                <Ionicons name="checkmark-done-circle-outline" size={18} color="#16A34A" />
              </View>
              <Text style={styles.metricValue}>142</Text>
              <Text style={styles.metricLabel}>Successfully Published</Text>
            </Card>
          </View>

          <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
            {/* Quick Pending Items list */}
            <Card style={[styles.tableCard, { flex: 1.5 }]}>
              <Text style={styles.tableCardTitle}>Awaiting Final Dissemination</Text>
              <Text style={styles.welcomeSubtitle}>Below are requests that require your final publishing approval.</Text>

              <View style={{ gap: 12, marginTop: 12 }}>
                {mockPublishQueue.map((post) => (
                  <View key={post.id} style={[styles.analyticsPlatformCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.postTitleText}>{post.title}</Text>
                      <Text style={styles.postMetaText}>{post.sub}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.btnApprove, { height: 28 }]}
                      onPress={() => setActiveTab('approval-queue')}
                    >
                      <Text style={styles.btnApproveText}>Publish Now</Text>
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

      {/* ----------------- PUBLISHING QUEUE TAB ----------------- */}
      {activeTab === 'approval-queue' && (
        <View style={styles.dashboardContainer}>
          {/* Header section */}
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Publishing Queue</Text>
              <Text style={styles.welcomeSubtitle}>
                Content that has passed institutional quality checks and is ready for dissemination.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
              <View style={[styles.periodBadge, { minWidth: 260, paddingHorizontal: 0 }]}>
                <TextInput
                  style={{ flex: 1, paddingHorizontal: 12, fontSize: FontSize.sm, outlineStyle: 'none' }}
                  placeholder="Search queue..."
                  value={queueSearchQuery}
                  onChangeText={setQueueSearchQuery}
                />
                <Ionicons name="search" size={16} color="#6B7280" style={{ marginRight: 12 }} />
              </View>

              <View style={styles.readyBadgeCard}>
                <Text style={styles.readyBadgeLabel}>READY:</Text>
                <Text style={styles.readyBadgeCount}>12</Text>
              </View>
            </View>
          </View>

          {/* Queue List Cards */}
          <Card style={styles.tableCard}>
            {/* Headers row */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.cellFlex2]}>CONTENT PREVIEW</Text>
              <Text style={[styles.tableHeaderCell, styles.cellFlex1, styles.alignCenter]}>TARGETS</Text>
              <Text style={[styles.tableHeaderCell, styles.cellFlex1, styles.alignCenter]}>QUALITY SCORE</Text>
              <Text style={[styles.tableHeaderCell, styles.cellFlex2, styles.alignRight]}>PUBLISHING ACTIONS</Text>
            </View>

            {/* List Body */}
            <View style={{ gap: Spacing.md, marginTop: 4 }}>
              {filteredQueue.map((item) => (
                <View key={item.id} style={styles.publishItemRow}>
                  {/* Left content preview */}
                  <View style={[styles.cellFlex2, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                    <View style={[styles.thumbnailBg, { backgroundColor: item.bg }]}>
                      <Ionicons name="image-outline" size={16} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.publishItemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.publishItemSubtitle} numberOfLines={1}>{item.sub}</Text>
                    </View>
                  </View>

                  {/* Targets icons row */}
                  <View style={[styles.cellFlex1, { flexDirection: 'row', justifyContent: 'center', gap: 8 }]}>
                    {item.targets.map((tgt, tIdx) => (
                      <Ionicons key={tIdx} name={tgt as any} size={15} color="#4B5563" />
                    ))}
                  </View>

                  {/* Quality score badge */}
                  <View style={[styles.cellFlex1, { alignItems: 'center' }]}>
                    <View style={styles.qualityScoreBadge}>
                      <Ionicons name="checkmark-circle-outline" size={12} color="#D97706" style={{ marginRight: 4 }} />
                      <Text style={styles.qualityScoreText}>{item.quality}</Text>
                    </View>
                  </View>

                  {/* Actions column date input + button */}
                  <View style={[styles.cellFlex2, styles.publishingActionsCol]}>
                    {Platform.OS === 'web' ? (
                      <input
                        type="datetime-local"
                        style={{
                          border: '1px solid #E5E7EB',
                          borderRadius: '4px',
                          padding: '0 8px',
                          fontSize: '11px',
                          height: '28px',
                          width: '165px',
                          color: '#374151',
                          outline: 'none',
                          backgroundColor: '#FFFFFF',
                          fontFamily: 'inherit',
                        }}
                        defaultValue={item.date}
                      />
                    ) : (
                      <View style={styles.dateInputWrapper}>
                        <TextInput
                          style={styles.dateTextInput}
                          placeholder="dd/mm/yyyy --:--"
                          defaultValue={item.date}
                          editable={true}
                        />
                        <Ionicons name="calendar-outline" size={13} color="#6B7280" style={{ marginRight: 8 }} />
                      </View>
                    )}

                    <TouchableOpacity style={styles.btnPublishNow} onPress={() => handleAction('Publish Now', item.title)}>
                      <Text style={styles.btnPublishNowText}>Publish Now</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.btnDoubleCheck} onPress={() => handleAction('Mark as Done', item.title)}>
                      <Ionicons name="checkmark-done-outline" size={16} color="#0B2545" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {filteredQueue.length === 0 && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={styles.welcomeSubtitle}>No requests in the queue.</Text>
                </View>
              )}
            </View>

            {/* Footer row status + batch actions */}
            <View style={styles.queueFooterRow}>
              <View style={styles.statusLegend}>
                <Text style={styles.statusLegendTitle}>Status :</Text>
                <View style={styles.statusLegendItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#D97706' }]} />
                  <Text style={styles.statusDotLabel}>Ready to Ship</Text>
                </View>
                <View style={styles.statusLegendItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#2563EB' }]} />
                  <Text style={styles.statusDotLabel}>Scheduled</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity onPress={() => alert('Batch actions triggered.')}>
                  <Text style={styles.footerActionBtnText}>BATCH ACTIONS</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => alert('Export queue triggered.')}>
                  <Text style={styles.footerActionBtnText}>EXPORT QUEUE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
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
                onPress={() => alert('Generating publisher report...')}
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
              {/* Left quick navigation index - desktop only */}
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
                    <Text style={styles.profilePicLargeText}>IT</Text>
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
                    defaultValue={user?.name ?? 'IT Publisher Support'}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
                    value={user?.email ?? 'it.support@jmcfi.edu.ph'}
                    editable={false}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>DEPARTMENT / ROLE</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
                    value="IT Infrastructure and Support"
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
    color: '#0B2545',
  },
  postMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
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

  // IT Publisher Specific Styles
  readyBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 32,
    backgroundColor: '#FFFFFF',
  },
  readyBadgeLabel: {
    fontSize: FontSize.xs - 1,
    color: '#4B5563',
    fontWeight: FontWeight.medium,
  },
  readyBadgeCount: {
    fontSize: FontSize.sm,
    color: '#0B2545',
    fontWeight: FontWeight.bold,
    marginLeft: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    color: '#4B5563',
    letterSpacing: 0.5,
  },
  publishItemRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  thumbnailBg: {
    width: 38,
    height: 38,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishItemTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#0B2545',
  },
  publishItemSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  qualityScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  qualityScoreText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706',
  },
  publishingActionsCol: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    width: Platform.OS === 'web' ? 170 : 140,
    height: 28,
    backgroundColor: '#FFFFFF',
  },
  dateTextInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 10,
    color: Colors.textPrimary,
    outlineStyle: 'none',
  },
  btnPublishNow: {
    backgroundColor: '#0B2545',
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPublishNowText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
  },
  btnDoubleCheck: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  queueFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statusLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusLegendTitle: {
    fontSize: FontSize.xs,
    color: '#4B5563',
    fontWeight: FontWeight.medium,
  },
  statusLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotLabel: {
    fontSize: FontSize.xs,
    color: '#4B5563',
  },
  footerActionBtnText: {
    fontSize: FontSize.xs,
    color: '#0B2545',
    fontWeight: FontWeight.bold,
  },
  cellFlex2: { flex: 2.2 },
  cellFlex1: { flex: 1 },
  alignCenter: { textAlign: 'center' },
  alignRight: { textAlign: 'right' },

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
});
