import React from 'react';
import { View, TextStyle } from 'react-native';

interface FormattedTextProps {
  children?: React.ReactNode;
  style?: TextStyle | TextStyle[] | any;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ children, style }) => {
  if (!children) return null;

  // Coerce children to a string (handles arrays, numbers, etc.)
  const content = Array.isArray(children)
    ? children.map((c) => (c == null ? '' : String(c))).join('')
    : String(children);

  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style || {};

  // Convert newlines to <br /> if no HTML break/paragraph tags present
  const formattedHtml = content.includes('<br') || content.includes('<p>')
    ? content
    : content.replace(/\n/g, '<br />');

  return (
    <View style={[{ width: '100%', maxWidth: '100%' }, flatStyle]}>
      {/* @ts-ignore */}
      <div
        dangerouslySetInnerHTML={{ __html: formattedHtml }}
        style={{
          color: flatStyle.color || '#374151',
          fontSize: flatStyle.fontSize || 13,
          fontFamily: flatStyle.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontWeight: flatStyle.fontWeight || 'normal',
          lineHeight: flatStyle.lineHeight ? `${flatStyle.lineHeight}px` : '1.55',
          margin: 0,
          padding: 0,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'normal',
          maxWidth: '100%',
        }}
      />
    </View>
  );
};
