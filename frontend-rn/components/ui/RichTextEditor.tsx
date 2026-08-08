import React, { useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { actions, RichEditor, RichToolbar } from 'react-native-pell-rich-editor';

interface RichTextEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder = 'Start typing...', minHeight = 150 }) => {
  const richText = useRef<RichEditor>(null);

  const applyFont = (fontName: string) => {
    richText.current?.injectJavascript(`document.execCommand('fontName', false, '${fontName}')`);
  };

  return (
    <View style={[styles.container, { minHeight }]}>
      <RichToolbar
        editor={richText}
        actions={[
          actions.setBold,
          actions.setItalic,
          actions.setUnderline,
          actions.insertBulletsList,
          actions.insertOrderedList,
          actions.insertLink,
          actions.undo,
          actions.redo,
        ]}
        iconTint="#4B5563"
        selectedIconTint="#7C3AED"
        disabledIconTint="#9CA3AF"
        style={styles.toolbar}
      />
      <View style={styles.fontToolbar}>
        <TouchableOpacity style={styles.fontBtn} onPress={() => applyFont('Montserrat')}>
          <Text style={[styles.fontBtnText, { fontFamily: 'Montserrat', fontWeight: 'bold' }]}>Sans Serif (Montserrat)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fontBtn} onPress={() => applyFont('Book Antiqua')}>
          <Text style={[styles.fontBtnText, { fontFamily: 'Book Antiqua' }]}>Serif (Book Antiqua)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fontBtn} onPress={() => applyFont('Old English Text MT')}>
          <Text style={[styles.fontBtnText, { fontFamily: 'Old English Text MT' }]}>Headers (Old English)</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.editorScroll}>
        <RichEditor
          ref={richText}
          initialContentHTML={value}
          onChange={onChange}
          placeholder={placeholder}
          useContainer={true}
          initialHeight={minHeight - 40}
          editorStyle={{
            backgroundColor: '#ffffff',
            color: '#1F2937',
            placeholderColor: '#9CA3AF',
            cssText: 'body { font-family: sans-serif; font-size: 14px; padding: 8px; }',
          }}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  toolbar: {
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  fontToolbar: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexWrap: 'wrap',
    gap: 8,
  },
  fontBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  fontBtnText: {
    fontSize: 12,
    color: '#374151',
  },
  editorScroll: {
    flex: 1,
  },
});
