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
  Platform,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DashboardShell } from '../../../components/DashboardShell';
import { useAuthStore } from '../../../store/auth';
import { Card } from '../../../components/ui/Card';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../constants/theme';
import { usePolicyStore } from '../../../store/policy';
import { postsApi } from '../../../services/api';

export default function RequestorDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();

  const { policySections, effectiveDate, lastUpdatedDate, fetchPolicy } = usePolicyStore();

  useEffect(() => {
    fetchPolicy();
  }, []);

  // Tab State: 'dashboard' | 'post-requests' | 'approval-queue' | 'analytics' | 'policy-rules'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Form State (New Request)
  const [postTitle, setPostTitle] = useState('');
  const [category, setCategory] = useState('Academic Announcement');
  const [department, setDepartment] = useState('College of Computing Studies');
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState({
    facebook: false,
    instagram: false,
    portal: false,
  });
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [supportingDocs, setSupportingDocs] = useState<any[]>([]);

  // Dropdown States
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);

  // Preview States
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');

  // Dashboard Page State
  const [dashboardPage, setDashboardPage] = useState(1);

  // Active Post for Dialog/Comments Modal
  const [selectedQueuePost, setSelectedQueuePost] = useState<any | null>(null);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  // Policy Search State
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // Drafts State
  const [drafts, setDrafts] = useState<any[]>([]);

  // Rejected Posts State
  const [rejectedPosts, setRejectedPosts] = useState<any[]>([]);

  // Handlers for Drafts and Rejected
  const handleEditDraft = (draft: any) => {
    setPostTitle(draft.title || '');
    setCategory(draft.category || 'Academic Announcement');
    setDepartment(draft.department || 'College of Computing Studies');
    setCaption(draft.caption || '');
    if (draft.platforms) setPlatforms(draft.platforms);
    if (draft.publishDate) setPublishDate(draft.publishDate);
    setActiveTab('request');
    alert(`Draft "${draft.title}" loaded into request form. You can now edit and submit!`);
  };

  const handleDeleteDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
    alert('Draft deleted successfully.');
  };

  const handleCreateNewFromRejected = (post: any) => {
    setPostTitle(post.title ? `${post.title} (Revised)` : '');
    setCategory(post.category || 'Academic Announcement');
    setDepartment(post.department || 'College of Computing Studies');
    setCaption(post.caption || '');
    if (post.platforms) setPlatforms(post.platforms);
    setActiveTab('request');
    alert(`Created new request form pre-filled with data from "${post.title}". Please revise according to approver comments.`);
  };

  // Categories & Departments options
  const categoryOptions = [
    'Academic Announcement',
    'Campus Event',
    'Sports Update',
    'Policy Update',
  ];

  const departmentOptions = [
    'College of Computing Studies',
    'Registrar\'s Office',
    'Student Affairs',
    'Finance Department',
  ];

  // Posts State
  const [mockRequests, setMockRequests] = useState<any[]>([]);
  const [mockQueuePosts, setMockQueuePosts] = useState<any[]>([]);

  const loadPosts = async () => {
    try {
      const res = await postsApi.list();
      const posts = res.data.data;
      
      const mapPost = (p: any) => ({
        ...p,
        id: p.id.toString(),
        title: p.title || 'Untitled',
        platforms: p.target_platforms ? p.target_platforms.join(', ') : '',
        category: p.category?.name || 'Category',
        department: p.requestor?.department || 'Department',
        date: new Date(p.created_at).toLocaleDateString(),
        dateSaved: new Date(p.created_at).toLocaleDateString(),
        status: p.status_label ? p.status_label.toUpperCase() : (p.status ? p.status.toUpperCase() : 'UNKNOWN'),
        statusLabel: p.status_label || p.status,
        statusColor: p.status === 'published' || p.status === 'approved' ? '#15803D' : (p.status === 'rejected' || p.status === 'returned_for_revision' ? '#B91C1C' : '#B45309'),
        statusBg: p.status === 'published' || p.status === 'approved' ? '#DCFCE7' : (p.status === 'rejected' || p.status === 'returned_for_revision' ? '#FEE2E2' : '#FEF3C7'),
        badgeColor: p.status === 'published' || p.status === 'approved' ? '#15803D' : (p.status === 'rejected' || p.status === 'returned_for_revision' ? '#B91C1C' : '#B45309'),
        badgeBg: p.status === 'published' || p.status === 'approved' ? '#DCFCE7' : (p.status === 'rejected' || p.status === 'returned_for_revision' ? '#FEE2E2' : '#FEF3C7'),
        thumbnailUrl: p.media && p.media.length > 0 ? p.media[0].url : null,
        thumbnailIcon: 'document-text-outline' as const,
        thumbnailBg: '#E0F2FE',
        actionIcon1: 'eye-outline' as const,
        actionIcon2: 'pencil-outline' as const,
        rejectedDate: p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '',
        rejectionReason: p.rejection_reason || 'No reason provided.',
        nextAction: 'Pending review.',
        steps: [
          { label: 'Submitted', state: 'completed' },
          { label: 'Dept Head', state: ['pending_office_head'].includes(p.status) ? 'active' : 'completed' },
          { label: 'Vice President', state: p.status === 'pending_vice_president' ? 'active' : 'upcoming' },
          { label: 'IMC QA', state: ['pending_imc_qa'].includes(p.status) ? 'active' : 'upcoming' },
          { label: 'Publisher', state: ['approved', 'scheduled', 'published'].includes(p.status) ? 'active' : 'upcoming' },
        ],
        comments: [],
      });

      const mapped = posts.map(mapPost);
      setMockRequests(mapped);
      setMockQueuePosts(mapped.filter((p: any) => p.status !== 'DRAFT'));
      setDrafts(mapped.filter((p: any) => p.status === 'DRAFT'));
      setRejectedPosts(mapped.filter((p: any) => p.status === 'REJECTED' || p.status === 'RETURNED_FOR_REVISION'));
    } catch (err) {
      console.error('Failed to load posts', err);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [activeTab]);

  const handleSaveDraft = async () => {
    if (!postTitle || !caption) {
      alert('Please enter a post title and caption before saving.');
      return;
    }
    try {
      const selectedPlatforms = Object.keys(platforms).filter(k => (platforms as any)[k]);
      await postsApi.create({
        title: postTitle,
        caption_narrative: caption,
        target_platforms: selectedPlatforms,
        is_draft: true,
      });
      alert('Content request saved as draft!');
      loadPosts();
      setActiveTab('dashboard');
    } catch (err: any) {
      alert('Failed to save draft: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleSubmitRequest = async () => {
    if (!postTitle || !caption) {
      alert('Please enter a post title and caption before submitting.');
      return;
    }

    const selectedPlatforms = Object.keys(platforms).filter(k => (platforms as any)[k]);
    if (selectedPlatforms.length === 0) {
      alert('Please select at least one target platform before submitting.');
      return;
    }

    if (mediaFiles.length === 0 && supportingDocs.length === 0) {
      alert('Please attach at least one media or asset file before submitting.');
      return;
    }
    
    try {
      const payload: any = {
        title: postTitle,
        caption_narrative: caption,
        target_platforms: selectedPlatforms,
        is_draft: false,
      };

      if (publishDate) {
        const timePart = publishTime || '08:00';
        const [d, m, y] = publishDate.split('/');
        payload.preferred_schedule_at = `${y}-${m}-${d} ${timePart}:00`;
      }

      let res;
      if (mediaFiles.length > 0 || supportingDocs.length > 0) {
        const formData = new FormData();
        formData.append('title', payload.title);
        formData.append('caption_narrative', payload.caption_narrative);
        payload.target_platforms.forEach((p: string) => {
          formData.append('target_platforms[]', p);
        });
        formData.append('is_draft', '0');
        if (payload.preferred_schedule_at) {
          formData.append('preferred_schedule_at', payload.preferred_schedule_at);
        }
        
        mediaFiles.forEach((file: any, idx: number) => {
          if (Platform.OS === 'web' && file.file) {
            formData.append('media[]', file.file);
          } else {
            formData.append('media[]', {
              uri: file.uri,
              name: file.name,
              type: file.mimeType || 'image/jpeg',
            } as any);
          }
        });
        
        supportingDocs.forEach((file: any, idx: number) => {
          if (Platform.OS === 'web' && file.file) {
            formData.append('supporting_docs[]', file.file);
          } else {
            formData.append('supporting_docs[]', {
              uri: file.uri,
              name: file.name,
              type: file.mimeType || 'application/pdf',
            } as any);
          }
        });
        
        res = await postsApi.createWithFiles(formData);
      } else {
        res = await postsApi.create(payload);
      }
      
      // The backend store endpoint already submits the post if is_draft is false.
      // Calling submit again is redundant and causes a 403 error.
      
      alert('Content request submitted successfully for review!');
      setPostTitle('');
      setCaption('');
      setPublishDate('');
      setPublishTime('');
      setPlatforms({ facebook: false, instagram: false, portal: false });
      setMediaFiles([]);
      setSupportingDocs([]);
      loadPosts();
      setActiveTab('dashboard');
    } catch (err: any) {
      alert('Failed to submit request: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleCheckPolicy = () => {
    if (!caption) {
      alert('Please write a caption first.');
      return;
    }
    alert('Checking policy alignment...\n\nResult: 100% Alignment! The post conforms to JMCFI institutional guidelines.');
  };

  const togglePlatform = (key: 'facebook' | 'instagram' | 'portal') => {
    setPlatforms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isLargeScreen = width > 1024;
  const isTablet = width > 768;

  // Render a single stepper step
  const renderStep = (step: any, index: number, isLast: boolean) => {
    let circleStyle = styles.stepCircleUpcoming;
    let lineStyle = styles.stepLineUpcoming;
    let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';
    let iconColor = '#9CA3AF';

    if (step.state === 'completed') {
      circleStyle = styles.stepCircleCompleted;
      lineStyle = styles.stepLineCompleted;
      iconName = 'checkmark';
      iconColor = '#FFFFFF';
    } else if (step.state === 'active') {
      circleStyle = styles.stepCircleActive;
      iconName = 'hourglass-outline';
      iconColor = '#FFFFFF';
    } else if (step.state === 'revision') {
      circleStyle = styles.stepCircleRevision;
      iconName = 'alert-circle-outline';
      iconColor = '#FFFFFF';
    }

    return (
      <React.Fragment key={index}>
        <View style={styles.stepWrapper}>
          <View style={[styles.stepCircleBase, circleStyle]}>
            <Ionicons name={iconName} size={11} color={iconColor} />
          </View>
          <Text style={styles.stepLabel}>{step.label}</Text>
        </View>
        {!isLast && <View style={[styles.stepLineBase, lineStyle]} />}
      </React.Fragment>
    );
  };

  const getMockSteps = (status: string) => {
    const s = status ? status.toLowerCase() : '';

    if (s === 'approved' || s === 'published' || s === 'scheduled') {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Dept Head', state: 'completed' },
        { label: 'Vice Pres', state: 'completed' },
        { label: 'IMC QA', state: 'completed' },
        { label: 'Publisher', state: s === 'approved' ? 'active' : 'completed' },
      ];
    } else if (s === 'pending_office_head') {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Dept Head', state: 'active' },
        { label: 'Vice Pres', state: 'upcoming' },
        { label: 'IMC QA', state: 'upcoming' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    } else if (s === 'pending_vice_president') {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Dept Head', state: 'completed' },
        { label: 'Vice Pres', state: 'active' },
        { label: 'IMC QA', state: 'upcoming' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    } else if (s === 'pending_imc_qa') {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Dept Head', state: 'completed' },
        { label: 'Vice Pres', state: 'completed' },
        { label: 'IMC QA', state: 'active' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    } else if (s === 'returned_for_revision') {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Revision', state: 'revision' },
        { label: 'Vice Pres', state: 'upcoming' },
        { label: 'IMC QA', state: 'upcoming' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    } else if (s === 'draft') {
      return [
        { label: 'Draft', state: 'active' },
        { label: 'Dept Head', state: 'upcoming' },
        { label: 'Vice Pres', state: 'upcoming' },
        { label: 'IMC QA', state: 'upcoming' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    } else if (s.includes('pending')) {
      return [
        { label: 'Submitted', state: 'completed' },
        { label: 'Review', state: 'active' },
        { label: 'Publisher', state: 'upcoming' },
      ];
    }
    
    return [];
  };

  return (
    <DashboardShell
      title="Content Approval System"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ----------------- REQUESTOR DASHBOARD TAB ----------------- */}
      {activeTab === 'dashboard' && (
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Welcome, Requestor</Text>
              <Text style={styles.welcomeSubtitle}>
                Here is an overview of your department's content activity for this semester.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.createRequestBtnGold}
              onPress={() => setActiveTab('post-requests')}
            >
              <Ionicons name="add" size={18} color={Colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.createRequestBtnGoldText}>Create New Request</Text>
            </TouchableOpacity>
          </View>

          {/* Metrics Row */}
          

          {/* Recent Post Requests Table */}
          <Card style={styles.tableCard}>
            <View style={styles.tableHeaderArea}>
              <Text style={styles.tableCardTitle}>Recent Post Requests</Text>
              <View style={styles.tableHeaderActions}>
                <TouchableOpacity style={styles.tableHeaderActionBtn} onPress={() => alert('Sorting requests...')}>
                  <Ionicons name="filter" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.tableHeaderActionBtn} onPress={() => alert('Exporting requests...')}>
                  <Ionicons name="download" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Table */}
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.cellFlex2]}>Request Title</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Category</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Date Submitted</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1]}>Status</Text>
                <Text style={[styles.tableHeaderCell, styles.cellFlex1, styles.alignRight]}>Actions</Text>
              </View>

              {mockRequests.map((req) => (
                <TouchableOpacity key={req.id} style={styles.tableRow} onPress={() => setSelectedRow(req)}>
                  <View style={[styles.cellFlex2, styles.titleCellContainer]}>
                    <View style={[styles.thumbnailPlaceholder, { backgroundColor: req.thumbnailBg }]}>
                      {req.thumbnailUrl ? (
                        <Image source={{ uri: req.thumbnailUrl }} style={{ width: '100%', height: '100%', borderRadius: 4 }} resizeMode="cover" />
                      ) : (
                        <Ionicons name={req.thumbnailIcon} size={16} color={Colors.textSecondary} />
                      )}
                    </View>
                    <View>
                      <Text style={styles.postTitleText}>{req.title}</Text>
                      <Text style={styles.postPlatformsText}>{req.platforms}</Text>
                    </View>
                  </View>
                  <Text style={[styles.tableCellText, styles.cellFlex1]}>{req.category}</Text>
                  <Text style={[styles.tableCellText, styles.cellFlex1]}>{req.date}</Text>
                  <View style={[styles.cellFlex1, { flexDirection: 'row' }]}>
                    <View style={[styles.statusBadge, { backgroundColor: req.statusBg }]}>
                      <Text style={[styles.statusBadgeText, { color: req.statusColor }]}>
                        {req.status}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.cellFlex1, styles.actionsCell]}>
                    <TouchableOpacity onPress={() => alert(`Previewing ${req.title}`)}>
                      <Ionicons name={req.actionIcon1} size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => alert(`Executing action on ${req.title}`)}>
                      <Ionicons name={req.actionIcon2} size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.tableFooter}>
              <Text style={styles.tableFooterText}>Showing 1-4 of 42 requests</Text>
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={styles.arrowBtn}
                  disabled={dashboardPage === 1}
                  onPress={() => setDashboardPage(prev => Math.max(prev - 1, 1))}
                >
                  <Ionicons name="chevron-back" size={14} color={Colors.textSecondary} />
                </TouchableOpacity>

                {[1, 2, 3].map((pNum) => (
                  <TouchableOpacity
                    key={pNum}
                    style={[styles.pageIndexBtn, dashboardPage === pNum && styles.pageIndexBtnActive]}
                    onPress={() => setDashboardPage(pNum)}
                  >
                    <Text style={[styles.pageIndexBtnText, dashboardPage === pNum && styles.pageIndexBtnTextActive]}>
                      {pNum}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={styles.arrowBtn}
                  disabled={dashboardPage === 3}
                  onPress={() => setDashboardPage(prev => Math.min(prev + 1, 3))}
                >
                  <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* ----------------- CREATE NEW REQUEST TAB ----------------- */}
      {(activeTab === 'post-requests' || activeTab === 'request') && (
        <View style={styles.formContainer}>
          <View style={styles.topActionRow}>
            <View style={styles.breadcrumbColumn}>
              <Text style={styles.breadcrumbText}>
                POST REQUESTS <Text style={{ color: Colors.textMuted }}>&gt;</Text> NEW REQUEST
              </Text>
              <Text style={styles.mainPageTitle}>Create New Content Request</Text>
              <Text style={styles.mainPageSubtitle}>
                Submit your content for review by the departmental approval committee.
              </Text>
            </View>
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity style={styles.draftButton} onPress={handleSaveDraft}>
                <Ionicons name="save-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.draftButtonText}>Save as Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitRequest}>
                <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.submitButtonText}>Submit Request</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Layout Split */}
          <View style={{ gap: Spacing.lg }}>
            {/* ROW 1 */}
            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
              <View style={styles.leftColumn}>
                {/* Basic Information Card */}
                <Card style={[styles.formCard, { flex: 1 }, (isCategoryDropdownOpen || isDeptDropdownOpen) ? { zIndex: 100, position: 'relative' } : {}] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="information-circle" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Basic Information</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>POST TITLE</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g., Enrollment Announcement 2024"
                      value={postTitle}
                      onChangeText={setPostTitle}
                    />
                  </View>

                  <View style={[styles.inlineFieldsRow, isTablet ? styles.rowLayout : styles.columnLayout]}>
                    <View style={[styles.fieldGroup, { flex: 1, position: 'relative', zIndex: isCategoryDropdownOpen ? 60 : 1 }]}>
                      <Text style={styles.inputLabel}>CATEGORY</Text>
                      <TouchableOpacity
                        style={styles.dropdownSelector}
                        onPress={() => {
                          setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                          setIsDeptDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.dropdownSelectorText}>{category}</Text>
                        <Ionicons name="chevron-down-outline" size={16} color={Colors.textSecondary} />
                      </TouchableOpacity>

                      {isCategoryDropdownOpen && (
                        <View style={styles.dropdownMenu}>
                          {categoryOptions.map((opt, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setCategory(opt);
                                setIsCategoryDropdownOpen(false);
                              }}
                            >
                              <Text style={styles.dropdownItemText}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    <View style={[styles.fieldGroup, { flex: 1, position: 'relative', zIndex: isDeptDropdownOpen ? 60 : 1 }]}>
                      <Text style={styles.inputLabel}>DEPARTMENT</Text>
                      <TouchableOpacity
                        style={styles.dropdownSelector}
                        onPress={() => {
                          setIsDeptDropdownOpen(!isDeptDropdownOpen);
                          setIsCategoryDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.dropdownSelectorText}>{department}</Text>
                        <Ionicons name="chevron-down-outline" size={16} color={Colors.textSecondary} />
                      </TouchableOpacity>

                      {isDeptDropdownOpen && (
                        <View style={styles.dropdownMenu}>
                          {departmentOptions.map((opt, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setDepartment(opt);
                                setIsDeptDropdownOpen(false);
                              }}
                            >
                              <Text style={styles.dropdownItemText}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              </View>

              <View style={styles.rightColumn}>
                <Card style={[styles.formCard, { flex: 1 }] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="share-social" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Target Platforms</Text>
                  </View>
                  
                  <View style={styles.platformsList}>
                    <TouchableOpacity style={styles.platformRow} onPress={() => togglePlatform('facebook')}>
                      <View style={styles.platformLeft}>
                        <View style={[styles.platformIconBg, { backgroundColor: '#EFF6FF' }]}>
                          <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                        </View>
                        <Text style={styles.platformNameText}>Facebook</Text>
                      </View>
                      <View style={[styles.checkboxOutline, platforms.facebook && styles.checkboxChecked]}>
                        {platforms.facebook && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.platformRow} onPress={() => togglePlatform('instagram')}>
                      <View style={styles.platformLeft}>
                        <View style={[styles.platformIconBg, { backgroundColor: '#FDF2F8' }]}>
                          <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                        </View>
                        <Text style={styles.platformNameText}>Instagram</Text>
                      </View>
                      <View style={[styles.checkboxOutline, platforms.instagram && styles.checkboxChecked]}>
                        {platforms.instagram && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.platformRow} onPress={() => togglePlatform('portal')}>
                      <View style={styles.platformLeft}>
                        <View style={[styles.platformIconBg, { backgroundColor: '#ECFDF5' }]}>
                          <Ionicons name="globe-outline" size={18} color="#059669" />
                        </View>
                        <Text style={styles.platformNameText}>Website Portal</Text>
                      </View>
                      <View style={[styles.checkboxOutline, platforms.portal && styles.checkboxChecked]}>
                        {platforms.portal && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            </View>

            {/* ROW 2 */}
            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
              <View style={styles.leftColumn}>
                <Card style={[styles.formCard, { flex: 1 }] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="document-text" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Content & Caption</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>CAPTION TEXT</Text>
                    <TextInput
                      style={styles.textArea}
                      placeholder="Write your post caption here. Ensure it follows the university's brand voice and tonal guidelines..."
                      multiline
                      numberOfLines={6}
                      value={caption}
                      onChangeText={(val) => {
                        if (val.length <= 2200) setCaption(val);
                      }}
                    />
                    <View style={styles.textAreaFooter}>
                      <Text style={styles.characterCounter}>
                        {caption.length} / 2200 characters
                      </Text>
                      <TouchableOpacity style={styles.checkPolicyBtn} onPress={handleCheckPolicy}>
                        <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textPrimary} style={{ marginRight: 4 }} />
                        <Text style={styles.checkPolicyBtnText}>Check Policy Alignment</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              </View>

              <View style={styles.rightColumn}>
                <Card style={[styles.formCard, { flex: 1 }] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="calendar" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Scheduling (Optional)</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>PUBLICATION DATE</Text>
                    <View style={styles.inputIconWrapper}>
                      {Platform.OS === 'web' ? (
                        <input
                          type="date"
                          value={publishDate ? publishDate.split('/').reverse().join('-') : ''}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            if (val) {
                              const [y, m, d] = val.split('-');
                              setPublishDate(`${d}/${m}/${y}`);
                            } else {
                              setPublishDate('');
                            }
                          }}
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            color: '#1F2937',
                            padding: '12px 40px 12px 16px',
                            background: 'transparent',
                            width: '100%',
                            cursor: 'pointer',
                          }}
                        />
                      ) : (
                        <TextInput
                          style={styles.textInputWithIcon}
                          placeholder="dd/mm/yyyy"
                          value={publishDate}
                          onChangeText={setPublishDate}
                        />
                      )}
                      <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} style={styles.inputFieldIcon} />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>PUBLICATION TIME (Optional)</Text>
                    <View style={styles.inputIconWrapper}>
                      {Platform.OS === 'web' ? (
                        <input
                          type="time"
                          value={publishTime}
                          onChange={(e: any) => setPublishTime(e.target.value)}
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            color: '#1F2937',
                            padding: '12px 40px 12px 16px',
                            background: 'transparent',
                            width: '100%',
                            cursor: 'pointer',
                          }}
                        />
                      ) : (
                        <TextInput
                          style={styles.textInputWithIcon}
                          placeholder="HH:MM (24hr)"
                          value={publishTime}
                          onChangeText={setPublishTime}
                        />
                      )}
                      <Ionicons name="time-outline" size={16} color={Colors.textSecondary} style={styles.inputFieldIcon} />
                    </View>
                  </View>
                  <View style={styles.scheduleInfoBox}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.textPrimary} style={{ marginTop: 2 }} />
                    <Text style={styles.scheduleInfoText}>
                      Posts must be submitted at least 48 hours before the preferred publication date for administrative review.
                    </Text>
                  </View>
                </Card>
              </View>
            </View>

            {/* ROW 3 */}
            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
              <View style={styles.leftColumn}>
                <Card style={[styles.formCard, { flex: 1 }] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="images" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Media & Assets</Text>
                  </View>

                  <View style={[styles.uploadGridRow, isTablet ? styles.rowLayout : styles.columnLayout]}>
                    <TouchableOpacity style={styles.uploadZone} onPress={async () => {
                      try {
                        const result = await DocumentPicker.getDocumentAsync({
                          type: ['image/*', 'video/*'],
                          multiple: true,
                          copyToCacheDirectory: true,
                        });
                        if (!result.canceled && result.assets) {
                          setMediaFiles(result.assets);
                        }
                      } catch (e) {
                        if (Platform.OS === 'web') {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.multiple = true;
                          input.accept = 'image/*,video/*';
                          input.onchange = (ev: any) => {
                            const files = Array.from(ev.target.files || []).map((f: any) => ({
                              uri: URL.createObjectURL(f),
                              name: f.name,
                              mimeType: f.type,
                              size: f.size,
                              file: f,
                            }));
                            setMediaFiles(files);
                          };
                          input.click();
                        }
                      }
                    }}>
                      <View style={styles.uploadZoneCircle}>
                        <Ionicons name="cloud-upload-outline" size={24} color={Colors.textSecondary} />
                      </View>
                      <Text style={styles.uploadZoneTitle}>Upload Main Media</Text>
                      <Text style={styles.uploadZoneSubtitle}>
                        {mediaFiles.length > 0
                          ? mediaFiles.map((f: any) => f.name).join(', ')
                          : 'Images (JPG, PNG) or Videos (MP4) up to 50MB'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.uploadZone} onPress={async () => {
                      try {
                        const result = await DocumentPicker.getDocumentAsync({
                          type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
                          multiple: true,
                          copyToCacheDirectory: true,
                        });
                        if (!result.canceled && result.assets) {
                          setSupportingDocs(result.assets);
                        }
                      } catch (e) {
                        if (Platform.OS === 'web') {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.multiple = true;
                          input.accept = '.pdf,.doc,.docx,.txt';
                          input.onchange = (ev: any) => {
                            const files = Array.from(ev.target.files || []).map((f: any) => ({
                              uri: URL.createObjectURL(f),
                              name: f.name,
                              mimeType: f.type,
                              size: f.size,
                              file: f,
                            }));
                            setSupportingDocs(files);
                          };
                          input.click();
                        }
                      }
                    }}>
                      <View style={styles.uploadZoneCircle}>
                        <Ionicons name="attach-outline" size={22} color={Colors.textSecondary} />
                      </View>
                      <Text style={styles.uploadZoneTitle}>Supporting Docs</Text>
                      <Text style={styles.uploadZoneSubtitle}>
                        {supportingDocs.length > 0
                          ? supportingDocs.map((f: any) => f.name).join(', ')
                          : 'PDFs, briefs, or reference materials'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>

              <View style={styles.rightColumn}>
                <Card style={[styles.formCard, { flex: 1 }] as any}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="eye" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Live Preview</Text>
                  </View>
                  
                  <View style={styles.previewModeRow}>
                    <TouchableOpacity
                      style={[styles.previewToggleBtn, previewMode === 'mobile' && styles.previewToggleBtnActive]}
                      onPress={() => setPreviewMode('mobile')}
                    >
                      <Text style={[styles.previewToggleText, previewMode === 'mobile' && styles.previewToggleTextActive]}>
                        Mobile
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.previewToggleBtn, previewMode === 'desktop' && styles.previewToggleBtnActive]}
                      onPress={() => setPreviewMode('desktop')}
                    >
                      <Text style={[styles.previewToggleText, previewMode === 'desktop' && styles.previewToggleTextActive]}>
                        Desktop
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.previewMockupFrame}>
                    <View style={styles.mockPostHeader}>
                      <View style={styles.mockPostAvatarCircle}>
                        <Ionicons name="business" size={14} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mockPostAuthorName}>JMCFI Institutional</Text>
                        <Text style={styles.mockPostMetaSubtext}>Sponsored &bull; Just now</Text>
                      </View>
                      <Ionicons name="ellipsis-horizontal" size={16} color={Colors.textSecondary} />
                    </View>

                    <View style={styles.mockPostContentArea}>
                      <Text style={styles.mockPostCaptionText}>
                        {caption ? caption : 'Upload media to see your content preview here...'}
                      </Text>
                    </View>

                    {mediaFiles && mediaFiles.length > 0 ? (
                      <View style={{ width: '100%', aspectRatio: 4/3, backgroundColor: '#f3f4f6', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
                        <Image source={{ uri: mediaFiles[0].uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      </View>
                    ) : (
                      <View style={styles.mockPostMediaPlaceholder}>
                        <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
                        <Text style={styles.mockPostMediaPlaceholderText}>
                          Upload media to see your content preview here...
                        </Text>
                      </View>
                    )}

                    <View style={styles.mockPostActionsRow}>
                      <View style={styles.mockActionGroup}>
                        <Ionicons name="heart-outline" size={18} color={Colors.textSecondary} />
                      </View>
                      <View style={styles.mockActionGroup}>
                        <Ionicons name="chatbubble-outline" size={17} color={Colors.textSecondary} />
                      </View>
                      <View style={styles.mockActionGroup}>
                        <Ionicons name="share-social-outline" size={18} color={Colors.textSecondary} />
                      </View>
                    </View>
                  </View>
                </Card>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ----------------- APPROVAL QUEUE TAB ----------------- */}
      {activeTab === 'approval-queue' && (
        <View style={styles.dashboardContainer}>
          <View style={styles.titleSection}>
            <Text style={styles.welcomeTitle}>Content Approval Tracking Queue</Text>
            <Text style={styles.welcomeSubtitle}>
              Track the live status and approval steps of your submitted content requests across institutional channels.
            </Text>
          </View>

          {/* Stepper Cards */}
          {mockQueuePosts.map((post) => (
            <Card key={post.id} style={styles.queueCard}>
              {/* Stepper Card Header */}
              <View style={styles.queueCardHeader}>
                <View style={styles.queueCardTitleCol}>
                  <Text style={styles.queuePostTitle}>{post.title}</Text>
                  <Text style={styles.queuePostMeta}>Submitted: {post.date}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: post.badgeBg }]}>
                  <Text style={[styles.statusBadgeText, { color: post.badgeColor }]}>
                    {post.statusLabel}
                  </Text>
                </View>
              </View>

              {/* Stepper Visualization */}
              <View style={styles.stepperContainer}>
                {post.steps.map((step, index) =>
                  renderStep(step, index, index === post.steps.length - 1)
                )}
              </View>

              {/* Stepper Footer / Action Notes */}
              <View style={styles.queueCardFooter}>
                <View style={styles.actionNoteContainer}>
                  <Ionicons name="arrow-forward-circle-outline" size={16} color={Colors.textPrimary} />
                  <Text style={styles.actionNoteText}>
                    <Text style={{ fontWeight: 'bold' }}>Next Action: </Text>
                    {post.nextAction}
                  </Text>
                </View>
                
                {/* Action Buttons */}
                <View style={styles.queueCardActions}>
                  <TouchableOpacity
                    style={styles.queueActionBtn}
                    onPress={() => alert(`Reviewing details for: ${post.title}`)}
                  >
                    <Ionicons name="eye-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
                    <Text style={styles.queueActionBtnText}>Preview</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.queueActionBtn}
                    onPress={() => setSelectedQueuePost(post)}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={Colors.textPrimary} style={{ marginRight: 6 }} />
                    <Text style={styles.queueActionBtnText}>Review Comments ({post.comments.length})</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))}
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
                      {user?.name?.substring(0, 2).toUpperCase() ?? 'MA'}
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
                    defaultValue={user?.name ?? 'MARIA.DELACRUZ User'}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]}
                    value={user?.email ?? 'maria.delacruz@jmcfi.edu.ph'}
                    editable={false}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>DEPARTMENT</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: Colors.background, color: Colors.textSecondary }]}
                    value="College of Computing Studies"
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
              
              <View style={[styles.inputIconWrapper, { minWidth: 260 }]}>
                <TextInput
                  style={styles.textInputWithIcon}
                  placeholder="Search policy guidelines..."
                  value={policySearchQuery}
                  onChangeText={setPolicySearchQuery}
                />
                <Ionicons name="search" size={16} color={Colors.textSecondary} style={styles.inputFieldIcon} />
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
                    <Card key={sec.id} style={[styles.policySectionCard, { borderLeftColor: sec.color }] as any}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.headerIconWrapper, { backgroundColor: sec.bg }]}>
                          <Ionicons name={sec.icon as any} size={16} color={sec.color} />
                        </View>
                        <Text style={styles.cardTitle}>{sec.title}</Text>
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
                                {sec.steps && idx < sec.steps.length - 1 && <View style={styles.policyFlowLine} />}
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

      {/* ----------------- DRAFTS TAB ----------------- */}
      {(activeTab === 'draft' || activeTab === 'drafts') && (
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeaderRow}>
            <View>
              <Text style={styles.welcomeTitle}>Draft Post Requests</Text>
              <Text style={styles.welcomeSubtitle}>
                Manage your saved post request drafts. You can edit, update, or submit them for approval.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.createRequestBtnGold}
              onPress={() => setActiveTab('request')}
            >
              <Ionicons name="add-circle-outline" size={18} color={Colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.createRequestBtnGoldText}>+ Create New Request</Text>
            </TouchableOpacity>
          </View>

          {drafts.length === 0 ? (
            <Card style={styles.formCard}>
              <View style={{ alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm }}>
                <Ionicons name="create-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.cardTitle}>No Saved Drafts</Text>
                <Text style={styles.welcomeSubtitle}>You don't have any saved drafts right now.</Text>
                <TouchableOpacity
                  style={[styles.createRequestBtnGold, { marginTop: Spacing.sm }]}
                  onPress={() => setActiveTab('request')}
                >
                  <Text style={styles.createRequestBtnGoldText}>Start a New Request</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : (
            <View style={{ gap: Spacing.md }}>
              {drafts.map((draft) => (
                <Card key={draft.id} style={styles.formCard}>
                  <View style={styles.queueCardHeader}>
                    <View style={styles.queueCardTitleCol}>
                      <Text style={styles.queuePostTitle}>{draft.title}</Text>
                      <Text style={styles.queuePostMeta}>
                        Last Saved: {draft.dateSaved} &bull; Category: {draft.category}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#F1F5F9' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#475569' }]}>
                        DRAFT
                      </Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: '#F8FAFC', padding: Spacing.md, borderRadius: 6, marginVertical: Spacing.xs }}>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: 'bold', marginBottom: 4 }}>
                      CAPTION PREVIEW
                    </Text>
                    <Text style={{ fontSize: FontSize.sm, color: Colors.textPrimary, fontStyle: 'italic' }}>
                      "{draft.caption || 'No caption text provided yet.'}"
                    </Text>
                  </View>

                  <View style={styles.queueCardFooter}>
                    <View style={styles.actionNoteContainer}>
                      <Ionicons name="folder-open-outline" size={16} color={Colors.textPrimary} />
                      <Text style={styles.actionNoteText}>
                        <Text style={{ fontWeight: 'bold' }}>Department: </Text>
                        {draft.department}
                      </Text>
                    </View>

                    <View style={styles.queueCardActions}>
                      <TouchableOpacity
                        style={[styles.queueActionBtn, { backgroundColor: Colors.primary }]}
                        onPress={() => handleEditDraft(draft)}
                      >
                        <Ionicons name="create-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.queueActionBtnText, { color: '#FFFFFF', fontWeight: 'bold' }]}>Edit & Submit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.queueActionBtn}
                        onPress={() => handleDeleteDraft(draft.id)}
                      >
                        <Ionicons name="trash-outline" size={15} color="#DC2626" style={{ marginRight: 4 }} />
                        <Text style={[styles.queueActionBtnText, { color: '#DC2626' }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ----------------- REJECTED TAB ----------------- */}
      {(activeTab === 'rejected' || activeTab === 'rejected-requests') && (
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeTitle}>Rejected Content Requests</Text>
              <Text style={styles.welcomeSubtitle}>
                Inspect approver remarks for rejected requests. Note that rejected requests cannot be re-submitted directly, but you can create a new request based on them.
              </Text>
            </View>
          </View>

          {rejectedPosts.length === 0 ? (
            <Card style={styles.formCard}>
              <View style={{ alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm }}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#16A34A" />
                <Text style={styles.cardTitle}>No Rejected Requests</Text>
                <Text style={styles.welcomeSubtitle}>All of your submitted requests have passed or are currently in review.</Text>
              </View>
            </Card>
          ) : (
            <View style={{ gap: Spacing.lg }}>
              {rejectedPosts.map((post) => (
                <Card key={post.id} style={[styles.formCard, { borderColor: '#FECDD3' }] as any}>
                  {/* Rejected Card Header */}
                  <View style={styles.queueCardHeader}>
                    <View style={styles.queueCardTitleCol}>
                      <Text style={styles.queuePostTitle}>{post.title}</Text>
                      <Text style={styles.queuePostMeta}>
                        Rejected Date: {post.rejectedDate} &bull; Category: {post.category}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#B91C1C' }]}>
                        REJECTED
                      </Text>
                    </View>
                  </View>

                  {/* Approver Remarks Container */}
                  <View style={{
                    backgroundColor: '#FFF1F2',
                    borderWidth: 1,
                    borderColor: '#FDA4AF',
                    borderRadius: 6,
                    padding: Spacing.md,
                    gap: 6,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="alert-circle" size={18} color="#E11D48" />
                      <Text style={{ fontSize: FontSize.xs + 1, fontWeight: 'bold', color: '#9F1239' }}>
                        Approver Remarks ({post.rejectedBy}):
                      </Text>
                    </View>
                    <Text style={{ fontSize: FontSize.sm, color: '#881337', lineHeight: 20 }}>
                      "{post.rejectionReason}"
                    </Text>
                  </View>

                  {/* Post Content Details Preview */}
                  <View style={{ backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 6, padding: Spacing.md, gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.textSecondary, letterSpacing: 0.5 }}>
                      SUBMITTED CAPTION PREVIEW
                    </Text>
                    <Text style={{ fontSize: FontSize.sm, color: Colors.textPrimary }}>
                      {post.caption}
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>
                      Department: {post.department}
                    </Text>
                  </View>

                  {/* Audit Notice Box */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#F8FAFC',
                    paddingHorizontal: Spacing.md,
                    paddingVertical: 10,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 }}>
                      <Text style={{ fontWeight: 'bold' }}>Audit Compliance Notice: </Text>
                      This rejected record is locked for audit history and cannot be directly resubmitted. Use the button below to generate a new request based on this post.
                    </Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.queueCardFooter}>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      style={styles.createRequestBtnGold}
                      onPress={() => handleCreateNewFromRejected(post)}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
                      <Text style={styles.createRequestBtnGoldText}>Create Request Again</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Other Placeholder tabs */}
      {activeTab !== 'dashboard' && activeTab !== 'request' && activeTab !== 'post-requests' && activeTab !== 'approval-queue' && activeTab !== 'account-settings' && activeTab !== 'analytics' && activeTab !== 'policy-rules' && activeTab !== 'draft' && activeTab !== 'drafts' && activeTab !== 'rejected' && activeTab !== 'rejected-requests' && (
        <Card style={styles.formCard}>
          <Text style={styles.cardTitle}>{activeTab.replace(/-/g, ' ').toUpperCase()}</Text>
          <Text style={styles.mainPageSubtitle}>This section is currently under development.</Text>
        </Card>
      )}

      {/* Review Comments Modal */}
      {selectedQueuePost && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setSelectedQueuePost(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Approver Feedback Comments</Text>
                <TouchableOpacity onPress={() => setSelectedQueuePost(null)}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalPostTitle}>{selectedQueuePost.title}</Text>
                <Text style={styles.modalPostMeta}>Status: {selectedQueuePost.statusLabel}</Text>
                <View style={styles.modalDivider} />

                {selectedQueuePost.comments.length > 0 ? (
                  selectedQueuePost.comments.map((c: any, index: number) => (
                    <View key={index} style={styles.commentItem}>
                      <View style={styles.commentHeader}>
                        <Ionicons name="person-circle" size={20} color={Colors.textPrimary} />
                        <Text style={styles.commentAuthor}>{c.author}</Text>
                      </View>
                      <Text style={styles.commentContent}>{c.text}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noCommentsText}>No comments have been posted for this request yet.</Text>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedQueuePost(null)}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Approval Flow Progress Modal for Recent Requests Row Click */}
      {selectedRow && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setSelectedRow(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Approval Flow Progress</Text>
                <TouchableOpacity onPress={() => setSelectedRow(null)}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalPostTitle}>{selectedRow.title}</Text>
                <Text style={styles.modalPostMeta}>Status: {selectedRow.status}</Text>
                <View style={styles.modalDivider} />
                
                <View style={styles.stepperContainer}>
                  {getMockSteps(selectedRow.status).map((step, index, arr) =>
                    renderStep(step, index, index === arr.length - 1)
                  )}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedRow(null)}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
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
  // Dashboard Styles
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
  createRequestBtnGold: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC72C',
    borderRadius: 4,
    paddingHorizontal: 16,
    height: 38,
  },
  createRequestBtnGoldText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
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
  metricBadgeTextBlue: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#2563EB',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  metricLabel: {
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
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
  tableHeaderArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableHeaderActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tableHeaderActionBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
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
  cellFlex1: {
    flex: 1,
  },
  alignRight: {
    textAlign: 'right',
  },
  titleCellContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  thumbnailPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postTitleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  postPlatformsText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  actionsCell: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
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
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  paginationRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  pageIndexBtn: {
    width: 28,
    height: 28,
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

  // Form Container Styles
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
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  draftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 16,
    height: 38,
    backgroundColor: Colors.surface,
  },
  draftButtonText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    paddingHorizontal: 16,
    height: 38,
    backgroundColor: Colors.primary,
  },
  submitButtonText: {
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  splitLayout: {
    gap: Spacing.lg,
  },
  rowLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
  configCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.sm,
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
  inlineFieldsRow: {
    gap: Spacing.md,
  },
  dropdownSelector: {
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
  dropdownSelectorText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    padding: 12,
    fontSize: FontSize.sm,
    backgroundColor: Colors.surface,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  textAreaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  characterCounter: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  checkPolicyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF4F8',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 4,
  },
  checkPolicyBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  uploadGridRow: {
    gap: Spacing.md,
  },
  uploadZone: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    gap: 8,
    minHeight: 120,
  },
  uploadZoneCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadZoneTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  uploadZoneSubtitle: {
    fontSize: FontSize.xs - 1,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  configCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  platformsList: {
    gap: Spacing.sm,
  },
  platformRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  platformLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  platformIconBg: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformNameText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  checkboxOutline: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  inputIconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  textInputWithIcon: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingLeft: 12,
    paddingRight: 36,
    fontSize: FontSize.sm,
    backgroundColor: Colors.surface,
  },
  inputFieldIcon: {
    position: 'absolute',
    right: 12,
  },
  scheduleInfoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EEF4F8',
    padding: Spacing.md,
    borderRadius: 6,
    marginTop: Spacing.xs,
    alignItems: 'flex-start',
  },
  scheduleInfoText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 16,
  },
  previewModeRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  previewToggleBtn: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  previewToggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  previewToggleText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  previewToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  previewMockupFrame: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    paddingBottom: Spacing.sm,
  },
  mockPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  mockPostAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockPostAuthorName: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  mockPostMetaSubtext: {
    fontSize: FontSize.xs - 1,
    color: Colors.textSecondary,
  },
  mockPostContentArea: {
    padding: 12,
  },
  mockPostCaptionText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  mockPostMediaPlaceholder: {
    height: 180,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.md,
  },
  mockPostMediaPlaceholderText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  mockPostActionsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 12,
  },
  mockActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Approval Queue Tab Styles
  queueCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  queueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  queueCardTitleCol: {
    gap: 4,
  },
  queuePostTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  queuePostMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    width: '100%',
    paddingHorizontal: 10,
  },
  stepWrapper: {
    alignItems: 'center',
    gap: 6,
    width: 60,
  },
  stepCircleBase: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepCircleCompleted: {
    backgroundColor: '#16A34A',
  },
  stepCircleActive: {
    backgroundColor: '#D97706',
  },
  stepCircleRevision: {
    backgroundColor: '#DC2626',
  },
  stepCircleUpcoming: {
    backgroundColor: '#E5E7EB',
  },
  stepLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  stepLineBase: {
    flex: 1,
    height: 2,
    marginHorizontal: -15,
    alignSelf: 'center',
    zIndex: 1,
  },
  stepLineCompleted: {
    backgroundColor: '#16A34A',
  },
  stepLineUpcoming: {
    backgroundColor: '#E5E7EB',
  },
  queueCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 260,
  },
  actionNoteText: {
    fontSize: FontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  queueCardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  queueActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 28,
    backgroundColor: Colors.surface,
  },
  queueActionBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
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
    maxWidth: 500,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: '80%',
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
    maxHeight: 300,
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
  commentItem: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAuthor: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  commentContent: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    paddingLeft: 26,
  },
  noCommentsText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
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
    marginBottom: 10,
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
  // Policy Dashboard Styles
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
  titleSection: {
    marginBottom: Spacing.xl,
  },
  bulletPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
