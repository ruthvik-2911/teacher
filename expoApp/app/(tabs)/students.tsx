import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocalSearchParams } from 'expo-router';
import { getStudentsByClassSection, Student, getClasses } from '@/src/services/teacher';

export default function StudentsScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const params = useLocalSearchParams<{ className?: string; section?: string }>();

  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>(params.className || '');
  const [selectedSection, setSelectedSection] = useState<string>(params.section || 'ALL');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchData = async () => {
    try {
      console.log('[STUDENTS] Fetching data for class:', selectedClass, 'section:', selectedSection);
      
      const classesData = await getClasses();
      setClasses(classesData);
      
      // If no class is selected, try to get students from the first available class
      let classToFetch = selectedClass;
      if (!classToFetch && classesData.length > 0) {
        classToFetch = classesData[0].className;
        setSelectedClass(classToFetch);
      }
      
      if (classToFetch) {
        const studentsData = await getStudentsByClassSection(
          classToFetch, 
          selectedSection === 'ALL' ? undefined : selectedSection
        );
        console.log('[STUDENTS] Fetched', studentsData.length, 'students');
        setAllStudents(studentsData);
        setStudents(studentsData);
      } else {
        console.log('[STUDENTS] No class available to fetch students');
        setAllStudents([]);
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setAllStudents([]);
      setStudents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (params.className) {
      setSelectedClass(params.className);
    }
    if (params.section) {
      setSelectedSection(params.section);
    }
  }, [params]);

  useEffect(() => {
    fetchData();
  }, [selectedClass, selectedSection]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleClassChange = (className: string) => {
    setSelectedClass(className);
    setSelectedSection('ALL');
    setShowClassDropdown(false);
  };

  const handleSectionChange = (section: string) => {
    setSelectedSection(section);
    setShowSectionDropdown(false);
  };

  const getAvailableSections = () => {
    const classItem = classes.find(c => c.className === selectedClass);
    if (!classItem) return [];
    return ['ALL', ...classItem.sections.map((s: any) => s.sectionName)];
  };

  const getStudentDisplayName = (student: Student) => {
    return student.name?.displayName || 
           `${student.name?.firstName || ''} ${student.name?.lastName || ''}`.trim() ||
           student.userId ||
           'Unknown';
  };

  const handleStudentPress = (student: Student) => {
    console.log('[STUDENTS] Selected student detail:', JSON.stringify(student, null, 2));
    setSelectedStudent(student);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#60A5FA" />
          <Text style={[styles.headerTitle, { marginTop: 12, fontSize: 16 }]}>Loading students...</Text>
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
          <Text style={styles.headerTitle}>Students</Text>
        </View>

        {/* Dropdown Selectors */}
        <View style={styles.filtersContainer}>
          {/* Class Dropdown */}
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownLabel}>Select Class</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowClassDropdown(true)}
            >
              <Text style={styles.dropdownText}>
                {selectedClass || 'Choose a class'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Section Dropdown */}
          {selectedClass && (
            <View style={styles.dropdownContainer}>
              <Text style={styles.dropdownLabel}>Select Section</Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowSectionDropdown(true)}
              >
                <Text style={styles.dropdownText}>
                  {selectedSection === 'ALL' ? 'All Sections' : selectedSection}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Students List */}
        <View style={styles.section}>
          {!selectedClass ? (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>Please select a class to view students</Text>
            </View>
          ) : students.length === 0 ? (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No students found</Text>
            </View>
          ) : (
            <>
              <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                  {students.length} {students.length === 1 ? 'student' : 'students'} found
                </Text>
              </View>
              {students.map((student) => (
                <TouchableOpacity 
                  key={student._id || student.userId} 
                  style={styles.studentCard}
                  onPress={() => handleStudentPress(student)}
                  activeOpacity={0.7}
                >
                  <View style={styles.studentHeader}>
                    <View style={styles.studentIcon}>
                      <Text style={styles.studentIconText}>👤</Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{getStudentDisplayName(student)}</Text>
                      <Text style={styles.studentId}>ID: {student.userId}</Text>
                      {(student.class || student.studentDetails?.currentClass || student.academicInfo?.class) && (
                        <Text style={styles.studentClass}>
                          Class {student.class || student.studentDetails?.currentClass || student.academicInfo?.class}
                          {student.section || student.studentDetails?.currentSection || student.academicInfo?.section
                            ? ` - Section ${student.section || student.studentDetails?.currentSection || student.academicInfo?.section}`
                            : ''}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.viewDetailArrow}>›</Text>
                  </View>
                  {student.attendance && (
                    <View style={styles.studentStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Attendance</Text>
                        <Text style={styles.statValue}>
                          {student.attendance.attendancePercentage?.toFixed(1) || 0}%
                        </Text>
                      </View>
                      {student.averageMarks !== undefined && (
                        <View style={styles.statItem}>
                          <Text style={styles.statLabel}>Avg Marks</Text>
                          <Text style={styles.statValue}>
                            {student.averageMarks.toFixed(1)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Class Dropdown Modal */}
      <Modal
        visible={showClassDropdown}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowClassDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowClassDropdown(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Class</Text>
            <ScrollView style={styles.modalScroll}>
              {classes.map((classItem) => (
                <TouchableOpacity
                  key={classItem.classId}
                  style={[
                    styles.modalOption,
                    selectedClass === classItem.className && styles.modalOptionSelected
                  ]}
                  onPress={() => handleClassChange(classItem.className)}
                >
                  <Text style={[
                    styles.modalOptionText,
                    selectedClass === classItem.className && styles.modalOptionTextSelected
                  ]}>
                    Class {classItem.className}
                  </Text>
                  {selectedClass === classItem.className && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Section Dropdown Modal */}
      <Modal
        visible={showSectionDropdown}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSectionDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSectionDropdown(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Section</Text>
            <ScrollView style={styles.modalScroll}>
              {getAvailableSections().map((section) => (
                <TouchableOpacity
                  key={section}
                  style={[
                    styles.modalOption,
                    selectedSection === section && styles.modalOptionSelected
                  ]}
                  onPress={() => handleSectionChange(section)}
                >
                  <Text style={[
                    styles.modalOptionText,
                    selectedSection === section && styles.modalOptionTextSelected
                  ]}>
                    {section === 'ALL' ? 'All Sections' : `Section ${section}`}
                  </Text>
                  {selectedSection === section && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Student Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDetailModal(false)}
        >
          <View style={styles.detailModalContent}>
            <View style={styles.detailHeader}>
              <View style={styles.detailIconContainer}>
                <Text style={styles.detailIconLarge}>👤</Text>
              </View>
              <Text style={styles.detailStudentName}>
                {selectedStudent ? getStudentDisplayName(selectedStudent) : ''}
              </Text>
              <Text style={styles.detailStudentId}>
                ID: {selectedStudent?.userId}
              </Text>
            </View>

            <View style={styles.detailDivider} />

            <ScrollView style={styles.detailBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Parent's Name</Text>
                <Text style={styles.detailValue}>
                  {selectedStudent?.parentDetails?.fatherName || selectedStudent?.parentDetails?.motherName || selectedStudent?.parentDetails?.guardianName || 'Not Provided'}
                </Text>
                {(selectedStudent?.parentDetails?.fatherName && selectedStudent?.parentDetails?.motherName) && (
                  <Text style={styles.detailSubValue}>
                    {selectedStudent.parentDetails.fatherName} (Father) & {selectedStudent.parentDetails.motherName} (Mother)
                  </Text>
                )}
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone Number</Text>
                <Text style={styles.detailValue}>
                  {selectedStudent?.contact?.primaryPhone || 'Not Provided'}
                </Text>
                {selectedStudent?.contact?.secondaryPhone && (
                  <Text style={styles.detailSubValue}>Alt: {selectedStudent.contact.secondaryPhone}</Text>
                )}
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>
                  {selectedStudent?.address?.fullAddress || 
                   (selectedStudent?.address ? 
                     `${selectedStudent.address.street || ''} ${selectedStudent.address.city || ''} ${selectedStudent.address.state || ''}`.trim() 
                     : 'Not Provided')}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Class & Section</Text>
                <Text style={styles.detailValue}>
                  Class {selectedStudent?.class || selectedStudent?.studentDetails?.currentClass || selectedStudent?.academicInfo?.class || selectedClass || 'N/A'} - 
                  Section {selectedStudent?.section || selectedStudent?.studentDetails?.currentSection || selectedStudent?.academicInfo?.section || (selectedSection === 'ALL' ? '' : selectedSection) || 'N/A'}
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDetailModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function getStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0B0F14' : '#E0F2FE',
    },
    scrollView: {
      flex: 1,
    },
    header: {
      padding: 20,
      paddingTop: 10,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: isDark ? '#93C5FD' : '#1E3A8A',
      textAlign: 'center',
    },
    filtersContainer: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    filterGroup: {
      marginBottom: 16,
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#93C5FD' : '#1E3A8A',
      marginBottom: 8,
    },
    filterScroll: {
      flexDirection: 'row',
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isDark ? '#0F172A' : '#DBEAFE',
      marginRight: 8,
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    filterChipActive: {
      backgroundColor: isDark ? '#1E3A8A' : '#60A5FA',
      borderColor: isDark ? '#3B82F6' : '#1E3A8A',
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#93C5FD' : '#1E3A8A',
    },
    filterChipTextActive: {
      color: '#FFFFFF',
    },
    section: {
      paddingHorizontal: 20,
    },
    statsContainer: {
      marginBottom: 12,
    },
    statsText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#93C5FD' : '#1E3A8A',
    },
    studentCard: {
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    studentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    studentIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    studentIconText: {
      fontSize: 24,
    },
    studentInfo: {
      flex: 1,
    },
    studentName: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#E5E7EB' : '#1F2937',
      marginBottom: 4,
    },
    studentId: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 2,
    },
    studentClass: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
    studentStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#1F2937' : '#E5E7EB',
    },
    statItem: {
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#93C5FD' : '#1E3A8A',
    },
    noDataContainer: {
      alignItems: 'center',
      marginTop: 40,
      paddingVertical: 40,
    },
    noDataText: {
      fontSize: 16,
      color: isDark ? '#93C5FD' : '#1E3A8A',
      fontWeight: '600',
    },
    // Dropdown styles
    dropdownContainer: {
      marginBottom: 16,
    },
    dropdownLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#93C5FD' : '#1E3A8A',
      marginBottom: 8,
    },
    dropdown: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    dropdownText: {
      fontSize: 16,
      color: isDark ? '#E5E7EB' : '#1F2937',
      flex: 1,
    },
    dropdownArrow: {
      fontSize: 12,
      color: isDark ? '#93C5FD' : '#1E3A8A',
      marginLeft: 8,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 20,
      width: '100%',
      maxWidth: 400,
      maxHeight: '70%',
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#93C5FD' : '#1E3A8A',
      marginBottom: 16,
      textAlign: 'center',
    },
    modalScroll: {
      maxHeight: 400,
    },
    modalOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
    },
    modalOptionSelected: {
      backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE',
      borderWidth: 2,
      borderColor: isDark ? '#3B82F6' : '#60A5FA',
    },
    modalOptionText: {
      fontSize: 16,
      color: isDark ? '#E5E7EB' : '#1F2937',
      fontWeight: '600',
    },
    modalOptionTextSelected: {
      color: isDark ? '#93C5FD' : '#1E3A8A',
      fontWeight: '700',
    },
    checkmark: {
      fontSize: 20,
      color: isDark ? '#60A5FA' : '#1E3A8A',
      fontWeight: '700',
    },
    // Detail Modal Styles
    detailModalContent: {
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 24,
      padding: 24,
      width: '90%',
      maxWidth: 400,
      maxHeight: '80%',
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    detailHeader: {
      alignItems: 'center',
      marginBottom: 20,
    },
    detailIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      borderWidth: 3,
      borderColor: isDark ? '#3B82F6' : '#60A5FA',
    },
    detailIconLarge: {
      fontSize: 40,
    },
    detailStudentName: {
      fontSize: 22,
      fontWeight: '800',
      color: isDark ? '#E5E7EB' : '#1F2937',
      textAlign: 'center',
    },
    detailStudentId: {
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 4,
    },
    detailDivider: {
      height: 1,
      backgroundColor: isDark ? '#1F2937' : '#E5E7EB',
      marginBottom: 20,
    },
    detailBody: {
      marginBottom: 20,
    },
    detailRow: {
      marginBottom: 18,
    },
    detailLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#60A5FA' : '#3B82F6',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    detailValue: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#E5E7EB' : '#1F2937',
      lineHeight: 22,
    },
    detailSubValue: {
      fontSize: 13,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 2,
    },
    closeButton: {
      backgroundColor: isDark ? '#1E3A8A' : '#60A5FA',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    closeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    viewDetailArrow: {
      fontSize: 24,
      color: isDark ? '#374151' : '#D1D5DB',
      marginLeft: 8,
    },
  });
}

