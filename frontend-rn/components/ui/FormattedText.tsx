import React from 'react';
import { View, useWindowDimensions, TextStyle } from 'react-native';
import RenderHtml from 'react-native-render-html';

interface FormattedTextProps {
  children?: React.ReactNode;
  style?: TextStyle | TextStyle[] | any;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ children, style }) => {
  const { width } = useWindowDimensions();
  if (!children) return null;

  // Coerce children to a string (handles string arrays, numbers, etc.)
  const content = Array.isArray(children)
    ? children.map((c) => (c == null ? '' : String(c))).join('')
    : String(children);

  const formattedHtml = content.includes('<br') || content.includes('<p>')
    ? content
    : content.replace(/\n/g, '<br />');

  return (
    <View style={style}>
      <RenderHtml
        contentWidth={width}
        source={{ html: formattedHtml }}
        tagsStyles={{
          body: {
            color: style?.color || '#374151',
            fontSize: style?.fontSize || 14,
            lineHeight: style?.lineHeight || 20,
            margin: 0,
            padding: 0,
            fontFamily: style?.fontFamily || 'sans-serif'
          }
        }}
      />
    </View>
  );
};
