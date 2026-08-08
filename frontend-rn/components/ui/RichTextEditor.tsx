import React, { useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { actions, RichEditor, RichToolbar } from 'react-native-pell-rich-editor';

interface RichTextEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder = 'Start typing...', minHeight = 150 }) => {
  const richText = useRef<RichEditor>(null);

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
  editorScroll: {
    flex: 1,
  },
});
