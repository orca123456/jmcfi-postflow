import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PaginationControlProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (perPage: number) => void;
  itemName?: string;
}

export const PaginationControl: React.FC<PaginationControlProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemName = 'items'
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

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
    <View style={styles.container}>
      <Text style={styles.infoText}>
        Showing {startItem} to {endItem} of {totalItems} {itemName}
      </Text>
      
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.arrowButton, currentPage === 1 && styles.disabled]}
          onPress={handlePrev}
          disabled={currentPage === 1}
        >
          <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? "#d1d5db" : "#6b7280"} />
        </TouchableOpacity>

        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return <Text key={`ellipsis-${index}`} style={styles.ellipsis}>...</Text>;
          }
          const isCurrent = page === currentPage;
          return (
            <TouchableOpacity
              key={page}
              style={[styles.pageButton, isCurrent && styles.activePageButton]}
              onPress={() => onPageChange(page as number)}
            >
              <Text style={[styles.pageText, isCurrent && styles.activePageText]}>{page}</Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.arrowButton, (currentPage === totalPages || totalPages === 0) && styles.disabled]}
          onPress={handleNext}
          disabled={currentPage === totalPages || totalPages === 0}
        >
          <Ionicons name="chevron-forward" size={16} color={(currentPage === totalPages || totalPages === 0) ? "#d1d5db" : "#6b7280"} />
        </TouchableOpacity>

        {Platform.OS === 'web' && onItemsPerPageChange && (
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            style={{
              marginLeft: 16,
              height: 32,
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              paddingLeft: 8,
              paddingRight: 24,
              outline: 'none',
              backgroundColor: '#fff',
              color: '#374151'
            }}
          >
            <option value={10}>10 / page</option>
            <option value={15}>15 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
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
  infoText: {
    fontSize: 13,
    color: '#6b7280',
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
  },
  disabled: {
    opacity: 0.5,
  },
  pageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  activePageButton: {
    backgroundColor: '#3b0764',
  },
  pageText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '400',
  },
  activePageText: {
    color: '#fff',
    fontWeight: '600',
  },
  ellipsis: {
    color: '#9ca3af',
    marginHorizontal: 4,
    fontSize: 13,
  }
});