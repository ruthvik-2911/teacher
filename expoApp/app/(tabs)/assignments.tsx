import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Alert, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { getStudentAssignments, Assignment as StudentAssignment } from '@/src/services/student';
import { getTeacherAssignments, Assignment as TeacherAssignment, cancelAssignment } from '@/src/services/teacher';
import CreateAssignmentModal from '@/components/CreateAssignmentModal';
import { usePermissions } from '@/src/hooks/usePermissions';

type Assignment = StudentAssignment | TeacherAssignment;
import { downloadFile, formatFileSize } from '@/src/utils/fileDownload';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AssignmentsScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const { hasPermission, loading: permissionsLoading } = usePermissions();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]); // Store original data
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('All Status');
  const [sortBy, setSortBy] = useState<'Due Date' | 'Subject'>('Due Date');
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);
  const [isTeacher, setIsTeacher] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; assignment: Assignment | null }>({ show: false, assignment: null });

  const checkRole = async () => {
    try {
      const role = await AsyncStorage.getItem('role');
      console.log('[ASSIGNMENTS] Checking role:', role);
      const isTeacherRole = role === 'teacher';
      setIsTeacher(isTeacherRole);
      console.log('[ASSIGNMENTS] isTeacher set to:', isTeacherRole);
    } catch (error) {
      console.error('[ASSIGNMENTS] Error checking role:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const role = await AsyncStorage.getItem('role');
      const isTeacherRole = role === 'teacher';
      
      let data: Assignment[];
      if (isTeacherRole) {
        data = await getTeacherAssignments() as Assignment[];
      } else {
        data = await getStudentAssignments() as Assignment[];
      }
      
      setAllAssignments(data);
      setAssignments(data);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    checkRole();
    fetchAssignments();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssignments();
  };

  // Filter and sort assignments whenever filters change
  useEffect(() => {
    let filtered = [...allAssignments];

    // Apply status filter
    if (selectedStatus !== 'All Status') {
      const statusMap: { [key: string]: string } = {
        'To Do': 'pending',
        'Complete': 'submitted',
        'Graded': 'graded'
      };
      const statusValue = statusMap[selectedStatus] || selectedStatus.toLowerCase();
      filtered = filtered.filter(a => a.status === statusValue);
    }

    // Apply sorting
    if (sortBy === 'Due Date') {
      filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    } else if (sortBy === 'Subject') {
      filtered.sort((a, b) => a.subject.localeCompare(b.subject));
    }

    setAssignments(filtered);
  }, [selectedStatus, sortBy, allAssignments]);

  const toggleStatusFilter = () => {
    const statuses = isTeacher 
      ? ['All Status', 'Draft', 'Published', 'Graded']
      : ['All Status', 'To Do', 'Complete', 'Graded'];
    const currentIndex = statuses.indexOf(selectedStatus);
    const nextIndex = (currentIndex + 1) % statuses.length;
    setSelectedStatus(statuses[nextIndex]);
  };

  const toggleSort = () => {
    setSortBy(prev => prev === 'Due Date' ? 'Subject' : 'Due Date');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#EF4444';
      case 'submitted':
        return '#10B981';
      case 'graded':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FEE2E2';
      case 'submitted':
        return '#D1FAE5';
      case 'graded':
        return '#EDE9FE';
      default:
        return '#F3F4F6';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'To Do';
      case 'submitted':
        return 'Complete';
      case 'graded':
        return 'Graded';
      default:
        return status;
    }
  };

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'Overdue';
    } else if (diffDays === 0) {
      return 'Due Today';
    } else if (diffDays === 1) {
      return 'Due Tomorrow';
    } else {
      return `Due in ${diffDays} days`;
    }
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isImageFile = (filename: string): boolean => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(extension);
  };

  const handleViewAttachment = async (attachment: { path: string; originalName: string }) => {
    try {
      // Check if it's an image file
      if (isImageFile(attachment.originalName)) {
        // Display image in modal
        setViewingImage({ url: attachment.path, name: attachment.originalName });
      } else {
        // For non-image files, open in browser (existing behavior)
        setViewingAttachment(attachment.originalName);
        await downloadFile(attachment.path, attachment.originalName);
      }
    } catch (error: any) {
      console.error('View error:', error);
      Alert.alert('Error', error.message || 'Could not open the file');
    } finally {
      setViewingAttachment(null);
    }
  };

  const openAssignmentDetail = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
  };

  const closeAssignmentDetail = () => {
    setSelectedAssignment(null);
  };

  const handleDeleteAssignment = async () => {
    if (!deleteConfirmation.assignment) return;
    
    try {
      console.log('[ASSIGNMENTS] User confirmed deletion');
      console.log('[ASSIGNMENTS] Calling cancelAssignment...');
      
      const success = await cancelAssignment(deleteConfirmation.assignment._id);
      
      console.log('[ASSIGNMENTS] cancelAssignment returned:', success);
      
      if (success) {
        console.log('[ASSIGNMENTS] ✅ Delete successful, refreshing list...');
        setDeleteConfirmation({ show: false, assignment: null });
        Alert.alert('Success', 'Assignment deleted successfully');
        await fetchAssignments(); // Refresh the list
        console.log('[ASSIGNMENTS] List refreshed');
      } else {
        console.log('[ASSIGNMENTS] ❌ Delete failed - returned false');
        setDeleteConfirmation({ show: false, assignment: null });
        Alert.alert('Error', 'Failed to delete assignment. Please try again.');
      }
    } catch (error: any) {
      console.error('[ASSIGNMENTS] ❌ Delete error caught:', error);
      console.error('[ASSIGNMENTS] Error type:', typeof error);
      console.error('[ASSIGNMENTS] Error message:', error.message);
      console.error('[ASSIGNMENTS] Error response:', error.response);
      
      setDeleteConfirmation({ show: false, assignment: null });
      const errorMessage = error.message || error.response?.data?.message || 'Failed to delete assignment. Please check your connection and try again.';
      Alert.alert('Delete Failed', errorMessage);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#60A5FA" />
          <Text style={[styles.filterButtonText, { marginTop: 12 }]}>Loading assignments...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60A5FA" />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Assignments</Text>
          {isTeacher && hasPermission('addAssignments') && (
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.createButtonText}>+ Create</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filtersContainer}>
          <TouchableOpacity style={styles.filterButton} onPress={toggleStatusFilter}>
            <Text style={styles.filterButtonText}>{selectedStatus}</Text>
            <Text style={styles.filterIcon}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} onPress={toggleSort}>
            <Text style={styles.filterButtonText}>Sort by {sortBy}</Text>
            <Text style={styles.filterIcon}>⇅</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          {assignments.length === 0 ? (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No assignments found</Text>
            </View>
          ) : (
            assignments.map((assignment) => (
              <TouchableOpacity 
                key={assignment._id} 
                style={styles.assignmentCard}
                onPress={() => openAssignmentDetail(assignment)}
                activeOpacity={0.7}
              >
                <View style={styles.assignmentLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: getStatusBgColor(assignment.status || 'pending') }]}>
                    <Text style={styles.iconText}>📄</Text>
                  </View>
                  <View style={styles.assignmentInfo}>
                    <Text style={styles.assignmentSubject}>{assignment.subject}</Text>
                    <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                    <Text style={styles.assignmentDue}>Due: {formatDueDate(assignment.dueDate)}</Text>
                    {assignment.attachments && assignment.attachments.length > 0 && (
                      <Text style={styles.attachmentIndicator}>
                        📎 {assignment.attachments.length} attachment{assignment.attachments.length > 1 ? 's' : ''}
                      </Text>
                    )}
                    <View style={styles.viewDetailsButton}>
                      <Text style={styles.viewDetailsText}>View Details</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.assignmentRight}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(assignment.status || 'pending') }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(assignment.status || 'pending') }]}>
                      {getStatusLabel(assignment.status || 'pending')}
                    </Text>
                  </View>
                  {assignment.status === 'pending' && <Text style={styles.urgentIndicator}>!</Text>}
                  {(() => {
                    console.log('[ASSIGNMENTS] Rendering assignment card - isTeacher:', isTeacher, 'Assignment ID:', assignment._id);
                    return null;
                  })()}
                  {isTeacher && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent opening assignment detail
                        console.log('[ASSIGNMENTS] ========== DELETE BUTTON CLICKED ==========');
                        console.log('[ASSIGNMENTS] Assignment ID:', assignment._id);
                        console.log('[ASSIGNMENTS] Assignment Title:', assignment.title);
                        console.log('[ASSIGNMENTS] Is Teacher:', isTeacher);
                        
                        // Show confirmation modal
                        setDeleteConfirmation({ show: true, assignment: assignment });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Create Assignment Modal */}
      <CreateAssignmentModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false); // Close the modal
          fetchAssignments(); // Refresh the assignments list
          Alert.alert('Success', 'Assignment created successfully!');
        }}
      />

      {/* Assignment Detail Modal */}
      <Modal
        visible={selectedAssignment !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={closeAssignmentDetail}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalContent} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assignment Details</Text>
              <TouchableOpacity onPress={closeAssignmentDetail} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedAssignment && (
              <ScrollView 
                style={styles.modalBody} 
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Subject</Text>
                  <Text style={styles.detailValue}>{selectedAssignment.subject}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Title</Text>
                  <Text style={styles.detailValue}>{selectedAssignment.title}</Text>
                </View>

                {selectedAssignment.description && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{selectedAssignment.description}</Text>
                  </View>
                )}

                {selectedAssignment.instructions && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Instructions</Text>
                    <Text style={styles.detailValue}>{selectedAssignment.instructions}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Due Date</Text>
                  <Text style={styles.detailValue}>{formatFullDate(selectedAssignment.dueDate)}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(selectedAssignment.status || 'pending') }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(selectedAssignment.status || 'pending') }]}>
                      {getStatusLabel(selectedAssignment.status || 'pending')}
                    </Text>
                  </View>
                </View>

                {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Attachments</Text>
                    {selectedAssignment.attachments.map((attachment, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.attachmentCard}
                        onPress={() => handleViewAttachment(attachment)}
                        disabled={viewingAttachment === attachment.originalName}
                      >
                        <View style={styles.attachmentInfo}>
                          <Text style={styles.attachmentIcon}>📎</Text>
                          <View style={styles.attachmentDetails}>
                            <Text style={styles.attachmentName}>{attachment.originalName}</Text>
                            {attachment.size && (
                              <Text style={styles.attachmentSize}>{formatFileSize(attachment.size)}</Text>
                            )}
                          </View>
                        </View>
                        {viewingAttachment === attachment.originalName ? (
                          <ActivityIndicator size="small" color="#60A5FA" />
                        ) : (
                          <Text style={styles.downloadIcon}>👁️</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal
        visible={viewingImage !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setViewingImage(null)}
      >
        <SafeAreaView style={styles.imageModalContainer} edges={['top', 'bottom']}>
          <View style={styles.imageModalHeader}>
            <Text style={styles.imageModalTitle} numberOfLines={1}>
              {viewingImage?.name || 'Image'}
            </Text>
            <TouchableOpacity
              style={styles.imageModalCloseButton}
              onPress={() => setViewingImage(null)}
            >
              <Text style={styles.imageModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.imageModalScrollView}
            contentContainerStyle={styles.imageModalContent}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            {viewingImage && (
              <Image
                source={{ uri: viewingImage.url }}
                style={styles.imageModalImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmation.show}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteConfirmation({ show: false, assignment: null })}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>Delete Assignment</Text>
            <Text style={styles.deleteModalMessage}>
              Are you sure you want to delete "{deleteConfirmation.assignment?.title}"? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.cancelModalButton]}
                onPress={() => {
                  console.log('[ASSIGNMENTS] Delete cancelled by user');
                  setDeleteConfirmation({ show: false, assignment: null });
                }}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.confirmDeleteButton]}
                onPress={handleDeleteAssignment}
              >
                <Text style={styles.confirmDeleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

function getStyles(isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0B0F14' : '#E0F2FE' },
    scrollView: { flex: 1 },
    header: { padding: 20, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: '700', color: isDark ? '#93C5FD' : '#1E3A8A', flex: 1, textAlign: 'center' },
    createButton: { 
      backgroundColor: isDark ? '#1E40AF' : '#3B82F6', 
      paddingHorizontal: 16, 
      paddingVertical: 8, 
      borderRadius: 8,
      marginLeft: 12
    },
    createButtonText: { 
      color: '#FFFFFF', 
      fontSize: 14, 
      fontWeight: '600' 
    },
    filtersContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 12 },
    filterButton: { flex: 1, backgroundColor: isDark ? '#0F172A' : '#DBEAFE', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 2, borderColor: isDark ? '#1F2937' : '#93C5FD' },
    filterButtonText: { fontSize: 14, fontWeight: '600', color: isDark ? '#93C5FD' : '#1E3A8A' },
    filterIcon: { fontSize: 12, color: isDark ? '#93C5FD' : '#1E3A8A' },
    section: { paddingHorizontal: 20 },
    assignmentCard: { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 2, borderColor: isDark ? '#1F2937' : '#93C5FD' },
    assignmentLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconContainer: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    iconText: { fontSize: 24 },
    assignmentInfo: { flex: 1 },
    assignmentSubject: { fontSize: 16, fontWeight: '700', color: isDark ? '#E5E7EB' : '#1F2937', marginBottom: 2 },
    assignmentTitle: { fontSize: 14, color: isDark ? '#E5E7EB' : '#1F2937', marginBottom: 4 },
    assignmentDue: { fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280' },
    assignmentRight: { alignItems: 'flex-end' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    statusText: { fontSize: 12, fontWeight: '600' },
    urgentIndicator: { fontSize: 20, color: '#EF4444', fontWeight: '700', marginTop: 4 },
    noDataContainer: { alignItems: 'center', marginTop: 40, paddingVertical: 40 },
    noDataText: { fontSize: 16, color: isDark ? '#93C5FD' : '#1E3A8A', fontWeight: '600' },
    attachmentIndicator: { fontSize: 11, color: isDark ? '#60A5FA' : '#2563EB', marginTop: 4 },
    modalContainer: { 
      flex: 1, 
      backgroundColor: 'rgba(0, 0, 0, 0.5)', 
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20
    },
    modalContent: { 
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF', 
      borderRadius: 20, 
      width: '100%',
      maxWidth: 500,
      maxHeight: '90%',
      flex: 1,
      overflow: 'hidden'
    },
    modalHeader: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: 20, 
      paddingBottom: 16,
      borderBottomWidth: 1, 
      borderBottomColor: isDark ? '#1F2937' : '#E5E7EB' 
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: isDark ? '#E5E7EB' : '#1F2937' },
    closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#1F2937' : '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
    closeButtonText: { fontSize: 18, color: isDark ? '#E5E7EB' : '#1F2937', fontWeight: '600' },
    modalBody: { flex: 1 },
    detailSection: { marginBottom: 20, paddingHorizontal: 20 },
    detailLabel: { fontSize: 12, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
    detailValue: { fontSize: 16, color: isDark ? '#E5E7EB' : '#1F2937', lineHeight: 24 },
    attachmentCard: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      backgroundColor: isDark ? '#1F2937' : '#F3F4F6', 
      padding: 12, 
      borderRadius: 12, 
      marginBottom: 8 
    },
    attachmentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    attachmentIcon: { fontSize: 20, marginRight: 12 },
    attachmentDetails: { flex: 1 },
    attachmentName: { fontSize: 14, fontWeight: '600', color: isDark ? '#E5E7EB' : '#1F2937', marginBottom: 4 },
    attachmentSize: { fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280' },
    downloadIcon: { fontSize: 20, marginLeft: 8 },
    cancelButton: { 
      width: 24, 
      height: 24, 
      borderRadius: 12, 
      backgroundColor: '#EF4444', 
      justifyContent: 'center', 
      alignItems: 'center', 
      marginTop: 8 
    },
    cancelButtonText: { 
      color: '#FFFFFF', 
      fontSize: 12, 
      fontWeight: '600' 
    },
    deleteModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20
    },
    deleteModalContent: {
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5
    },
    deleteModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#E5E7EB' : '#1F2937',
      marginBottom: 12
    },
    deleteModalMessage: {
      fontSize: 16,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 24,
      lineHeight: 24
    },
    deleteModalButtons: {
      flexDirection: 'row',
      gap: 12
    },
    deleteModalButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center'
    },
    cancelModalButton: {
      backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#D1D5DB'
    },
    cancelModalButtonText: {
      color: isDark ? '#E5E7EB' : '#1F2937',
      fontSize: 16,
      fontWeight: '600'
    },
    confirmDeleteButton: {
      backgroundColor: '#EF4444'
    },
    confirmDeleteButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600'
    },
    // Image Viewer Modal Styles
    imageModalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
    },
    imageModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    imageModalTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginRight: 12,
    },
    imageModalCloseButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageModalCloseText: {
      fontSize: 20,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    imageModalScrollView: {
      flex: 1,
    },
    imageModalContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    imageModalImage: {
      width: SCREEN_WIDTH - 40,
      height: SCREEN_HEIGHT * 0.7,
      maxWidth: '100%',
    },
    viewDetailsButton: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: isDark ? '#60A5FA' : '#2563EB',
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      alignSelf: 'flex-start',
    },
    viewDetailsText: {
      color: isDark ? '#60A5FA' : '#2563EB',
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
