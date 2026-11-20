import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/theme';

interface PaginationControlProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (perPage: number) => void;
  itemName?: string;
  pageSizeOptions?: number[];
  style?: any;
  noWrap?: boolean;
}

export const PaginationControl: React.FC<PaginationControlProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemName = 'items',
  pageSizeOptions = [5, 10, 20, 50],
  style,
  noWrap,
}) => {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <View style={[
      styles.container,
      isDarkMode && styles.containerDark,
      noWrap && { flexWrap: 'nowrap' },
      style,
    ]}>
      <Text style={[styles.infoText, isDarkMode && styles.infoTextDark, noWrap && ({ whiteSpace: 'nowrap' } as any)]}>
        Showing {startItem} to {endItem} of {totalItems} {itemName}
      </Text>
      
      <View style={[styles.controlsContainer, noWrap && { flexShrink: 0 }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          style={[styles.arrowButton, currentPage <= 1 && styles.disabled]}
          onPress={handlePrev}
          disabled={currentPage <= 1}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={currentPage <= 1 ? (isDarkMode ? '#475569' : '#d1d5db') : (isDarkMode ? '#CBD5E1' : '#6b7280')}
          />
        </TouchableOpacity>

        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return <Text key={`ellipsis-${index}`} style={[styles.ellipsis, isDarkMode && styles.ellipsisDark]}>...</Text>;
          }
          const isCurrent = page === currentPage;
          return (
            <TouchableOpacity
              key={page}
              accessibilityRole="button"
              accessibilityLabel={`Go to page ${page}`}
              accessibilityState={{ selected: isCurrent }}
              {...(Platform.OS === 'web' ? { 'aria-current': isCurrent ? 'page' as const : undefined } : {})}
              style={[styles.pageButton, isCurrent && styles.activePageButton]}
              onPress={() => onPageChange(page as number)}
            >
              <Text style={[
                styles.pageText,
                isDarkMode && styles.pageTextDark,
                isCurrent && styles.activePageText,
              ]}>{page}</Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Next page"
          style={[styles.arrowButton, (currentPage >= totalPages || totalPages === 0) && styles.disabled]}
          onPress={handleNext}
          disabled={currentPage >= totalPages || totalPages === 0}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={(currentPage >= totalPages || totalPages === 0) ? (isDarkMode ? '#475569' : '#d1d5db') : (isDarkMode ? '#CBD5E1' : '#6b7280')}
          />
        </TouchableOpacity>

        {Platform.OS === 'web' && onItemsPerPageChange && (
          <select
            aria-label="Items per page"
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            style={{
              marginLeft: 14,
              height: 32,
              fontSize: 13,
              borderRadius: 6,
              border: `1.5px solid ${isDarkMode ? '#334155' : '#4C007C'}`,
              paddingLeft: 8,
              paddingRight: 24,
              outline: 'none',
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              color: isDarkMode ? '#F8FAFC' : '#374151',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt} style={{ backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', color: isDarkMode ? '#F8FAFC' : '#374151' }}>
                {opt} / page
              </option>
            ))}
          </select>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexWrap: 'wrap',
    gap: 12,
  },
  containerDark: {
    borderTopColor: '#334155',
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoTextDark: {
    color: '#94a3b8',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrowButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  disabled: {
    opacity: 0.45,
    ...(Platform.OS === 'web' ? ({ cursor: 'default' } as any) : {}),
  },
  pageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  activePageButton: {
    backgroundColor: '#3b0764',
  },
  pageText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '500',
  },
  pageTextDark: {
    color: '#cbd5e1',
  },
  activePageText: {
    color: '#fff',
    fontWeight: '600',
  },
  ellipsis: {
    color: '#9ca3af',
    marginHorizontal: 4,
    fontSize: 13,
  },
  ellipsisDark: {
    color: '#64748b',
  },
});
