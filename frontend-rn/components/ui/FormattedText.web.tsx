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

  return (
    <View style={flatStyle}>
      {/* @ts-ignore */}
      <div
        dangerouslySetInnerHTML={{ __html: content }}
        style={{
          color: flatStyle.color || '#374151',
          fontSize: flatStyle.fontSize || 14,
          fontFamily: flatStyle.fontFamily || 'sans-serif',
          lineHeight: 1.6,
          margin: 0,
          padding: 0,
        }}
      />
    </View>
  );
};
