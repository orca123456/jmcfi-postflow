import re

with open(r'c:\Users\Acer\jmcfi-postflow\frontend-rn\app\(app)\dashboard\requestor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "          {/* Form Layout Split */}"
end_marker = "          </View>\n        </View>\n      )}\n\n      {/* ----------------- APPROVAL QUEUE TAB ----------------- */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers!")
    exit(1)

new_chunk = """          {/* Form Layout Split */}
          <View style={{ gap: Spacing.lg }}>
            {/* ROW 1 */}
            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
              <View style={styles.leftColumn}>
                {/* Basic Information Card */}
                <Card style={[styles.formCard, { flex: 1 }, (isCategoryDropdownOpen || isDeptDropdownOpen) && { zIndex: 100, position: 'relative' }]}>
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
                <Card style={[styles.formCard, { flex: 1 }]}>
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
                <Card style={[styles.formCard, { flex: 1 }]}>
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
                <Card style={[styles.formCard, { flex: 1 }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="calendar" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Scheduling</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>PUBLICATION DATE</Text>
                    <View style={styles.inputIconWrapper}>
                      <TextInput
                        style={styles.textInputWithIcon}
                        placeholder="dd/mm/yyyy"
                        value={publishDate}
                        onChangeText={setPublishDate}
                      />
                      <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} style={styles.inputFieldIcon} />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>PREFERRED TIME</Text>
                    <View style={styles.inputIconWrapper}>
                      <TextInput
                        style={styles.textInputWithIcon}
                        placeholder="--:-- --"
                        value={publishTime}
                        onChangeText={setPublishTime}
                      />
                      <Ionicons name="time-outline" size={16} color={Colors.textSecondary} style={styles.inputFieldIcon} />
                    </View>
                  </View>

                  <View style={styles.scheduleInfoBox}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.textPrimary} style={{ marginTop: 2 }} />
                    <Text style={styles.scheduleInfoText}>
                      Posts must be submitted at least 48 hours before the preferred publication time for administrative review.
                    </Text>
                  </View>
                </Card>
              </View>
            </View>

            {/* ROW 3 */}
            <View style={[styles.splitLayout, isLargeScreen ? styles.rowLayout : styles.columnLayout]}>
              <View style={styles.leftColumn}>
                <Card style={[styles.formCard, { flex: 1 }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.headerIconWrapper}>
                      <Ionicons name="images" size={18} color={Colors.textPrimary} />
                    </View>
                    <Text style={styles.cardTitle}>Media & Assets</Text>
                  </View>

                  <View style={[styles.uploadGridRow, isTablet ? styles.rowLayout : styles.columnLayout]}>
                    <TouchableOpacity style={styles.uploadZone} onPress={() => alert('Media uploader triggered.')}>
                      <View style={styles.uploadZoneCircle}>
                        <Ionicons name="cloud-upload-outline" size={24} color={Colors.textSecondary} />
                      </View>
                      <Text style={styles.uploadZoneTitle}>Upload Main Media</Text>
                      <Text style={styles.uploadZoneSubtitle}>
                        Images (JPG, PNG) or Videos (MP4) up to 50MB
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.uploadZone} onPress={() => alert('Documents uploader triggered.')}>
                      <View style={styles.uploadZoneCircle}>
                        <Ionicons name="attach-outline" size={22} color={Colors.textSecondary} />
                      </View>
                      <Text style={styles.uploadZoneTitle}>Supporting Docs</Text>
                      <Text style={styles.uploadZoneSubtitle}>
                        PDFs, briefs, or reference materials
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>

              <View style={styles.rightColumn}>
                <Card style={[styles.formCard, { flex: 1 }]}>
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

                    <View style={styles.mockPostMediaPlaceholder}>
                      <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
                      <Text style={styles.mockPostMediaPlaceholderText}>
                        Upload media to see your content preview here...
                      </Text>
                    </View>

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
"""

new_content = content[:start_idx] + new_chunk + content[end_idx:]

with open(r'c:\Users\Acer\jmcfi-postflow\frontend-rn\app\(app)\dashboard\requestor.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully replaced layout block!")
