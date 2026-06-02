import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSchoolInfo } from './student';

export interface Class {
  classId: string;
  className: string;
  sections: Section[];
}

export interface Section {
  sectionId: string;
  sectionName: string;
}

export interface Student {
  _id: string;
  userId: string;
  name: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    displayName?: string;
  };
  email?: string;
  studentDetails?: {
    admissionNumber?: string;
    currentClass?: string;
    currentSection?: string;
    academicYear?: string;
  };
  academicInfo?: {
    class?: string;
    section?: string;
  };
  attendance?: {
    presentDays?: number;
    absentDays?: number;
    attendancePercentage?: number;
  };
  averageMarks?: number;
  parentDetails?: {
    fatherName?: string;
    motherName?: string;
    guardianName?: string;
  };
  contact?: {
    primaryPhone?: string;
    secondaryPhone?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    fullAddress?: string;
    permanent?: {
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
  };
}

export interface Assignment {
  _id: string;
  title: string;
  subject: string;
  description?: string;
  instructions?: string;
  dueDate: string;
  startDate: string;
  class: string;
  section: string;
  status?: 'pending' | 'submitted' | 'graded' | 'published' | 'draft';
  maxMarks?: number;
  totalSubmissions?: number;
  gradedSubmissions?: number;
  pendingSubmissions?: number;
  attachments?: Array<{
    path: string;
    originalName: string;
    size?: number;
    mimeType?: string;
  }>;
}

export interface Message {
  _id: string;
  id?: string;
  title?: string;
  subject: string;
  message: string;
  sender?: string;
  senderRole?: string;
  class?: string;
  section?: string;
  createdAt: string;
  isRead?: boolean;
}

export interface TeacherProfile {
  _id: string;
  userId: string;
  name: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    displayName?: string;
  };
  email: string;
  schoolCode: string;
  profileImage?: string;
  contact?: {
    primaryPhone?: string;
    secondaryPhone?: string;
  };
  teacherDetails?: {
    employeeId?: string;
    subjects?: Array<{
      subjectName: string;
      classes: string[];
    }>;
    classTeacherOf?: string;
  };
  isActive?: boolean;
  lastLogin?: string;
}

export interface AttendanceRecord {
  _id: string;
  date: string;
  dateString: string;
  status: 'present' | 'absent' | 'no-class';
  sessions: {
    morning: { status: 'present' | 'absent' } | null;
    afternoon: { status: 'present' | 'absent' } | null;
  };
  studentId: string;
  class: string;
  section: string;
}

export interface ClassAttendance {
  date: string; // Format: YYYY-MM-DD
  session: 'morning' | 'afternoon';
  class: string;
  section: string;
  students: Array<{
    studentId: string;
    userId: string;
    status: 'present' | 'absent' | 'half_day';
  }>;
}

export interface StudentResult {
  _id: string;
  studentId: string;
  studentName: string;
  class: string;
  section: string;
  subject: string;
  testName: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  date: string;
}

export interface CreateAssignmentData {
  title: string;
  subject: string;
  description?: string;
  instructions?: string;
  dueDate: string;
  startDate: string;
  class: string;
  section: string;
  academicYear?: string;
  term?: string;
  attachments?: any[];
}

/**
 * Get all classes and sections for the school
 */
export async function getClasses(): Promise<Class[]> {
  try {
    const schoolCode = await AsyncStorage.getItem('schoolCode');
    if (!schoolCode) throw new Error('No school code found');

    const response = await api.get(`/schools/${schoolCode}/classes`);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return [];
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error fetching classes:', error);
    return [];
  }
}

/**
 * Get students by class and section
 */
export async function getStudentsByClassSection(className: string, section?: string): Promise<Student[]> {
  try {
    console.log('[TEACHER SERVICE] Fetching students for class:', className, 'section:', section);

    // Build query parameters - backend supports class and section filters
    const params: any = {
      class: className  // Use 'class' not 'className'
    };

    if (section && section !== 'ALL') {
      params.section = section;
    }

    console.log('[TEACHER SERVICE] API params:', params);

    // Use the users/role/student endpoint which teachers have access to
    const response = await api.get('/users/role/student', { params });

    console.log('[TEACHER SERVICE] Students API response:', {
      success: response.data?.success,
      count: response.data?.count,
      dataLength: response.data?.data?.length
    });

    // Backend returns data in 'data' field, not 'users'
    if (response.data?.success && response.data?.data) {
      const students = response.data.data.map((user: any) => ({
        userId: user.userId || user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        studentDetails: user.studentDetails,
        academicInfo: user.academicInfo,
        // Improved class/section mapping matching the JSON structure
        class: user.studentDetails?.academic?.currentClass || user.class || user.className || user.academicInfo?.class || user.studentDetails?.currentClass,
        section: user.studentDetails?.academic?.currentSection || user.section || user.sectionName || user.academicInfo?.section || user.studentDetails?.currentSection,
        rollNumber: user.studentDetails?.rollNumber || user.rollNumber || user.studentDetails?.rollNo || user.rollNo,
        status: user.status,
        // Parents mapping matching studentDetails.family structure
        parentDetails: {
          fatherName: user.studentDetails?.family?.father?.name || user.parentDetails?.fatherName,
          motherName: user.studentDetails?.family?.mother?.name || user.parentDetails?.motherName,
          guardianName: user.guardianName || user.studentDetails?.guardianName
        },
        // Contact mapping (primaryPhone is already working)
        contact: user.contact || user.studentDetails?.contact,
        // Address mapping matching address.permanent structure
        address: {
          street: user.address?.permanent?.street || user.address?.street,
          city: user.address?.permanent?.city || user.address?.city,
          state: user.address?.permanent?.state || user.address?.state,
          zipCode: user.address?.permanent?.pincode || user.address?.zipCode,
          fullAddress: user.address?.permanent ?
            `${user.address.permanent.street || ''}, ${user.address.permanent.city || ''}, ${user.address.permanent.pincode || ''}`.trim() :
            user.fullAddress
        }
      }));

      if (students.length > 0) {
        console.log('[TEACHER SERVICE] Sample student data structure:', JSON.stringify(response.data.data[0], null, 2));
      }

      console.log('[TEACHER SERVICE] Mapped', students.length, 'students');
      if (students.length > 0) {
        console.log('[TEACHER SERVICE] Sample student:', {
          userId: students[0].userId,
          name: students[0].name,
          class: students[0].class,
          section: students[0].section
        });
      }

      return students;
    }

    console.log('[TEACHER SERVICE] No students found - response structure:', Object.keys(response.data || {}));
    return [];
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error fetching students:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Get teacher's assignments (assignments created by teacher)
 */
export async function getTeacherAssignments(): Promise<Assignment[]> {
  try {
    const userData = await AsyncStorage.getItem('userData');
    if (!userData) throw new Error('No user data found');

    const user = JSON.parse(userData);

    // Get current academic year from school settings
    let academicYear: string | undefined;
    try {
      const schoolInfo = await getSchoolInfo();
      academicYear = (schoolInfo as any)?.settings?.academicYear?.currentYear;
      console.log('[TEACHER SERVICE] Current academic year:', academicYear);
    } catch (err) {
      console.log('[TEACHER SERVICE] Could not fetch academic year, will show all assignments');
    }

    const params: any = {
      teacherId: user.userId || user._id,
    };

    // Add academic year filter if available
    if (academicYear) {
      params.academicYear = academicYear;
      console.log('[TEACHER SERVICE] Filtering assignments by academic year:', academicYear);
    }

    const response = await api.get('/assignments', { params });

    const assignments = response.data.assignments || response.data.data || [];
    console.log('[TEACHER SERVICE] Fetched', assignments.length, 'assignments for current academic year');

    return assignments;
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error fetching assignments:', error);
    return [];
  }
}

/**
 * Get messages for teacher
 */
export async function getTeacherMessages(): Promise<Message[]> {
  try {
    console.log('[TEACHER SERVICE] Fetching teacher messages...');

    const response = await api.get('/teacher/messages');

    console.log('[TEACHER SERVICE] Messages response:', {
      success: response.data?.success,
      hasData: !!response.data?.data,
      hasMessages: !!response.data?.messages,
      messagesCount: (response.data?.data?.messages || response.data?.messages || response.data?.data || []).length
    });

    const messages = response.data?.data?.messages || response.data?.messages || response.data?.data || [];

    console.log('[TEACHER SERVICE] Fetched', messages.length, 'messages for teacher');

    return messages.map((msg: any) => ({
      _id: msg.id || msg._id,
      id: msg.id || msg._id,
      title: msg.title || msg.subject,
      subject: msg.subject || msg.title || 'No Subject',
      message: msg.message || msg.content || '',
      sender: msg.sender || msg.senderName || 'School Admin',
      senderRole: msg.senderRole || 'admin',
      adminId: msg.adminId,
      class: msg.class,
      section: msg.section,
      createdAt: msg.createdAt || msg.timestamp,
      isRead: msg.isRead !== undefined ? msg.isRead : true,
      messageAge: msg.messageAge,
      urgencyIndicator: msg.urgencyIndicator
    }));
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error fetching messages:', error);
    console.error('[TEACHER SERVICE] Error response:', error?.response?.data);
    console.error('[TEACHER SERVICE] Error status:', error?.response?.status);
    return [];
  }
}

/**
 * Get teacher profile
 */
export async function getTeacherProfile(): Promise<TeacherProfile | null> {
  try {
    const response = await api.get('/users/my-profile');

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return response.data || null;
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error fetching teacher profile:', error);
    return null;
  }
}

/**
 * Get class subjects for a specific class
 */
export async function getClassSubjects(className: string): Promise<any[]> {
  try {
    console.log('[TEACHER SERVICE] Fetching class subjects for:', className);
    const response = await api.get(`/class-subjects/class/${className}`);

    console.log('[TEACHER SERVICE] Class subjects response:', response.data);

    if (response.data?.success && response.data?.data?.subjects) {
      return response.data.data.subjects.filter((subject: any) => subject.isActive !== false);
    }

    return response.data?.subjects || [];
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error fetching class subjects:', error);
    return [];
  }
}

/**
 * Get subjects assigned to teacher, with fallback to class subjects
 */
export async function getTeacherSubjects(): Promise<any[]> {
  try {
    const userData = await AsyncStorage.getItem('userData');
    if (!userData) throw new Error('No user data found');

    const user = JSON.parse(userData);
    const teacherId = user._id || user.userId;

    console.log('[TEACHER SERVICE] Fetching subjects for teacher:', teacherId);

    // First try to get teacher-specific subjects
    try {
      const response = await api.get(`/subjects/teacher/${teacherId}`);
      console.log('[TEACHER SERVICE] Teacher subjects response:', response.data);

      if (response.data?.success && response.data?.data && response.data.data.length > 0) {
        console.log('[TEACHER SERVICE] Found teacher-specific subjects:', response.data.data.length);
        return response.data.data;
      }
    } catch (teacherSubjectsError: any) {
      console.log('[TEACHER SERVICE] No teacher-specific subjects found, trying class subjects');
    }

    // If no teacher-specific subjects, try to get subjects from teacher's classes
    console.log('[TEACHER SERVICE] Attempting to fetch class subjects as fallback');

    // Get teacher's classes first
    const classesResponse = await getClasses();
    console.log('[TEACHER SERVICE] Teacher classes:', classesResponse);

    if (classesResponse && classesResponse.length > 0) {
      // Get subjects from the first class as fallback
      const firstClass = classesResponse[0];
      const className = firstClass.className;

      if (className) {
        console.log('[TEACHER SERVICE] Fetching subjects for class:', className);
        const classSubjects = await getClassSubjects(className);

        if (classSubjects && classSubjects.length > 0) {
          console.log('[TEACHER SERVICE] Found class subjects as fallback:', classSubjects.length);
          // Transform class subjects to match teacher subjects format
          return classSubjects.map((subject: any) => ({
            _id: subject._id || subject.name,
            name: subject.name || subject.subjectName,
            subjectName: subject.name || subject.subjectName,
            className: className,
            isClassSubject: true // Flag to indicate this is a class subject, not teacher-assigned
          }));
        }
      }
    }

    console.log('[TEACHER SERVICE] No subjects found - neither teacher-specific nor class subjects');
    return [];

  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error fetching subjects:', error);
    return [];
  }
}

/**
 * Get class attendance for teacher
 */
export async function getClassAttendance(className: string, section: string, date?: string): Promise<AttendanceRecord[]> {
  try {
    const params: any = { className, section };
    if (date) {
      params.date = date;
    }

    const response = await api.get('/attendance', { params });

    if (response.data?.success && response.data?.data?.records) {
      return response.data.data.records;
    }

    return response.data?.records || response.data?.data || [];
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error fetching class attendance:', error);
    return [];
  }
}

/**
 * Mark session attendance for a class
 */
export async function markSessionAttendance(attendanceData: ClassAttendance): Promise<boolean> {
  try {
    const response = await api.post('/attendance/mark-session', attendanceData);
    return response.data?.success || false;
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error marking attendance:', error);
    return false;
  }
}

/**
 * Get results for teacher's classes
 */
export async function getTeacherResults(className?: string, section?: string, subject?: string): Promise<StudentResult[]> {
  try {
    const params: any = {};
    if (className) params.className = className;
    if (section) params.section = section;
    if (subject) params.subject = subject;

    const response = await api.get('/results/teacher/view', { params });

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return response.data?.results || response.data?.data || [];
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error fetching results:', error);
    return [];
  }
}

/**
 * Save/update student results
 */
export async function saveStudentResults(results: Partial<StudentResult>[]): Promise<boolean> {
  try {
    const response = await api.post('/results/save', { results });
    return response.data?.success || false;
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error saving results:', error);
    return false;
  }
}

/**
 * Create new assignment
 */
export async function createAssignment(assignmentData: CreateAssignmentData): Promise<boolean> {
  try {
    const schoolCode = await AsyncStorage.getItem('schoolCode');
    const formData = new FormData();

    // Add text fields
    Object.keys(assignmentData).forEach(key => {
      if (key !== 'attachments' && assignmentData[key as keyof CreateAssignmentData]) {
        formData.append(key, assignmentData[key as keyof CreateAssignmentData] as string);
      }
    });

    // Add school code
    if (schoolCode) {
      formData.append('schoolCode', schoolCode);
    }

    // Add attachments if any
    if (assignmentData.attachments && assignmentData.attachments.length > 0) {
      console.log('[TEACHER SERVICE] Adding', assignmentData.attachments.length, 'attachment(s)');

      for (let index = 0; index < assignmentData.attachments.length; index++) {
        const file = assignmentData.attachments[index];

        try {
          // For web platform, convert blob URI to File object
          if (file.uri.startsWith('blob:')) {
            console.log('[TEACHER SERVICE] Converting blob URI to File object for web');
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const fileObject = new File([blob], file.name, { type: file.type });
            formData.append('attachments', fileObject);
            console.log('[TEACHER SERVICE] Added file (web):', file.name, 'size:', blob.size);
          } else {
            // For native mobile, use the standard format
            const fileToUpload: any = {
              uri: file.uri,
              type: file.type || 'application/octet-stream',
              name: file.name || `attachment_${index}`
            };
            formData.append('attachments', fileToUpload);
            console.log('[TEACHER SERVICE] Added file (mobile):', file.name);
          }
        } catch (error) {
          console.error('[TEACHER SERVICE] Error processing file:', file.name, error);
        }
      }
    }

    console.log('[TEACHER SERVICE] Creating assignment with', assignmentData.attachments?.length || 0, 'attachment(s)');

    const response = await api.post('/assignments', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('[TEACHER SERVICE] Assignment created successfully');
    return response.data?.success || false;
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error creating assignment:', error);
    console.error('[TEACHER SERVICE] Error details:', error?.response?.data);
    return false;
  }
}

/**
 * Update assignment
 */
export async function updateAssignment(assignmentId: string, assignmentData: Partial<CreateAssignmentData>): Promise<boolean> {
  try {
    const formData = new FormData();

    // Add text fields
    Object.keys(assignmentData).forEach(key => {
      if (key !== 'attachments' && assignmentData[key as keyof CreateAssignmentData]) {
        formData.append(key, assignmentData[key as keyof CreateAssignmentData] as string);
      }
    });

    // Add attachments if any
    if (assignmentData.attachments && assignmentData.attachments.length > 0) {
      for (let index = 0; index < assignmentData.attachments.length; index++) {
        const file = assignmentData.attachments[index];

        try {
          // For web platform, convert blob URI to File object
          if (file.uri && file.uri.startsWith('blob:')) {
            const response = await fetch(file.uri);
            const blob = await response.blob();
            const fileObject = new File([blob], file.name, { type: file.type });
            formData.append('attachments', fileObject);
          } else if (file.uri) {
            // For native mobile
            const fileToUpload: any = {
              uri: file.uri,
              type: file.type || 'application/octet-stream',
              name: file.name || `attachment_${index}`
            };
            formData.append('attachments', fileToUpload);
          } else {
            // Already a File object
            formData.append('attachments', file);
          }
        } catch (error) {
          console.error('[TEACHER SERVICE] Error processing file for update:', file.name, error);
        }
      }
    }

    const response = await api.put(`/assignments/${assignmentId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data?.success || false;
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error updating assignment:', error);
    return false;
  }
}

/**
 * Grade submission
 */
export async function gradeSubmission(submissionId: string, grade: number, feedback?: string): Promise<boolean> {
  try {
    const response = await api.put(`/assignments/submissions/${submissionId}/grade`, {
      grade,
      feedback
    });

    return response.data?.success || false;
  } catch (error: any) {
    console.error('[TEACHER SERVICE] Error grading submission:', error);
    return false;
  }
}

/**
 * Cancel/Delete an assignment
 */
export async function cancelAssignment(assignmentId: string): Promise<boolean> {
  try {
    console.log('[TEACHER SERVICE] ========== DELETE ASSIGNMENT ==========');
    console.log('[TEACHER SERVICE] Assignment ID:', assignmentId);
    console.log('[TEACHER SERVICE] API endpoint:', `/assignments/${assignmentId}`);

    const response = await api.delete(`/assignments/${assignmentId}`);

    console.log('[TEACHER SERVICE] Response status:', response.status);
    console.log('[TEACHER SERVICE] Response data:', JSON.stringify(response.data, null, 2));

    if (response.data?.success) {
      console.log('[TEACHER SERVICE] ✅ Assignment deleted successfully');
      return true;
    } else {
      console.error('[TEACHER SERVICE] ❌ Delete failed - success flag is false');
      console.error('[TEACHER SERVICE] Message:', response.data?.message);
      return false;
    }
  } catch (error: any) {
    console.error('[TEACHER SERVICE] ❌ Error deleting assignment');
    console.error('[TEACHER SERVICE] Error message:', error.message);
    console.error('[TEACHER SERVICE] Error response status:', error.response?.status);
    console.error('[TEACHER SERVICE] Error response data:', JSON.stringify(error.response?.data, null, 2));
    console.error('[TEACHER SERVICE] Full error:', error);

    // Throw error with more details for UI
    const errorMessage = error.response?.data?.message || error.message || 'Failed to delete assignment';
    throw new Error(errorMessage);
  }
}

