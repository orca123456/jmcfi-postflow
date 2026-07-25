import re

file_path = r'c:\Users\Acer\jmcfi-postflow\frontend-rn\app\(app)\dashboard\requestor.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variables inside RequestorDashboard
state_anchor = "  const [policySearchQuery, setPolicySearchQuery] = useState('');"
new_state = """  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // Drafts State
  const [drafts, setDrafts] = useState([
    {
      id: 'd1',
      title: '2024 College Intramurals Opening Ceremony',
      category: 'Campus Event',
      department: 'Student Affairs',
      caption: 'Get ready for the biggest sports event of the year! The JMCFI Intramurals 2024 kicks off next Monday with live performances, parade of athletes, and exciting matches.',
      dateSaved: 'Oct 24, 2024 at 2:30 PM',
      platforms: { facebook: true, instagram: true, portal: false },
      publishDate: '28/10/2024',
    },
    {
      id: 'd2',
      title: 'Library Extended Hours During Finals Week',
      category: 'Academic Announcement',
      department: 'Registrar\'s Office',
      caption: 'Notice to all students: The Main Library will remain open until 10:00 PM starting next week to support your midterm preparations.',
      dateSaved: 'Oct 20, 2024 at 11:15 AM',
      platforms: { facebook: true, instagram: false, portal: true },
      publishDate: '25/10/2024',
    },
  ]);

  // Rejected Posts State
  const [rejectedPosts, setRejectedPosts] = useState([
    {
      id: 'r1',
      title: 'Off-Campus Beach Outing Post',
      category: 'Campus Event',
      department: 'Student Affairs',
      rejectedDate: 'Oct 23, 2024',
      rejectedBy: 'Vice President of Academic Affairs (Dr. A. Santos)',
      rejectionReason: 'Unapproved institutional activity. All off-campus student gatherings require a signed permit from the Student Affairs Office and President\'s approval prior to social media promotion.',
      caption: 'Join us for an exciting beach day at Samal Island this coming weekend! Transportation provided for all enrolled students.',
      platforms: { facebook: true, instagram: true, portal: false },
    },
    {
      id: 'r2',
      title: 'Tuition Fee Payment Reminder',
      category: 'Policy Update',
      department: 'Finance Department',
      rejectedDate: 'Oct 19, 2024',
      rejectedBy: 'IMC QA Reviewer (M. Flores)',
      rejectionReason: 'Incorrect account details in caption. Please verify official bank account number with Finance before requesting a public post.',
      caption: 'Reminder: 2nd Trimester tuition fee installment is due on Friday. Please settle payments at the cashier or bank transfer.',
      platforms: { facebook: true, instagram: false, portal: true },
    },
  ]);

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
  };"""

content = content.replace(state_anchor, new_state)

# 2. Update handleSaveDraft to add to drafts state
old_save_draft = """  const handleSaveDraft = () => {
    alert('Request saved as draft!');
  };"""

new_save_draft = """  const handleSaveDraft = () => {
    if (!postTitle.trim()) {
      alert('Please enter a Post Title before saving as a draft.');
      return;
    }
    const newDraft = {
      id: 'd_' + Date.now(),
      title: postTitle,
      category,
      department,
      caption,
      dateSaved: 'Just now',
      platforms,
      publishDate,
    };
    setDrafts(prev => [newDraft, ...prev]);
    alert(`Draft "${postTitle}" saved successfully! You can view and edit it in the Draft tab.`);
  };"""

content = content.replace(old_save_draft, new_save_draft)

# 3. Add Drafts and Rejected views before fallback
fallback_anchor = "      {/* Other Placeholder tabs */}"

new_views = """      {/* ----------------- DRAFTS TAB ----------------- */}
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
                <Card key={post.id} style={[styles.formCard, { borderColor: '#FECDD3' }]}>
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

      {/* Other Placeholder tabs */}"""

content = content.replace(fallback_anchor, new_views)

# Update fallback condition to include draft and rejected
old_fallback = "{activeTab !== 'dashboard' && activeTab !== 'request' && activeTab !== 'post-requests' && activeTab !== 'approval-queue' && activeTab !== 'account-settings' && activeTab !== 'analytics' && activeTab !== 'policy-rules' && ("
new_fallback = "{activeTab !== 'dashboard' && activeTab !== 'request' && activeTab !== 'post-requests' && activeTab !== 'approval-queue' && activeTab !== 'account-settings' && activeTab !== 'analytics' && activeTab !== 'policy-rules' && activeTab !== 'draft' && activeTab !== 'drafts' && activeTab !== 'rejected' && activeTab !== 'rejected-requests' && ("

content = content.replace(old_fallback, new_fallback)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully added Drafts and Rejected views!")
