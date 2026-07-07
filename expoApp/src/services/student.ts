import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AssignmentAttachment {
  filename?: string;
  originalName: string;
  path: string;
  cloudinaryPublicId?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
}

export interface Assignment {
  _id: string;
  title: string;
  subject: string;
  description?: string;
  dueDate: string;
  startDate: string;
  status: 'pending' | 'submitted' | 'graded';
  grade?: number;
  totalMarks?: number;
  instructions?: string;
  class: string;
  section: string;
  attachments?: AssignmentAttachment[];
}

export interface AttendanceRecord {
  _id: string;
  date: string;
  dateString?: string;
  dayOfWeek?: string;
  status: 'present' | 'absent' | 'half_day' | 'no-class';
  sessions: {
    morning: {
      status: 'present' | 'absent';
      markedAt?: string;
      sessionTime?: string;
    } | null;
    afternoon: {
      status: 'present' | 'absent';
      markedAt?: string;
      sessionTime?: string;
    } | null;
  };
}

export interface Result {
  _id: string;
  examType: string;
  subjects: Array<{
    subjectName: string;
    marksObtained: number;
    totalMarks: number;
    grade?: string;
    percentage: number;
    frozen?: boolean;
  }>;
  overallPercentage: number;
  overallGrade?: string;
  rank?: number;
  academicYear: string;
  frozen?: boolean;
  frozenAt?: string;
}

export interface Message {
  _id: string;
  id?: string;
  title?: string;
  subject: string;
  message: string;
  sender?: string;
  senderRole?: string;
  adminId?: string;
  class?: string;
  section?: string;
  createdAt: string;
  isRead?: boolean;
  messageAge?: string;
  urgencyIndicator?: string;
}

export interface SchoolInfo {
  schoolName: string;
  schoolCode: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  principalName?: string;
  establishedYear?: string;
  affiliation?: string;
  settings?: {
    academicYear?: {
      currentYear?: string;
      startDate?: string;
      endDate?: string;
    };
  };
}

export interface FeeRecord {
  _id: string;
  studentId: string;
  academicYear: string;
  totalFees: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate?: string;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  payments: Array<{
    amount: number;
    paymentDate: string;
    paymentMode: string;
    receiptNumber: string;
  }>;
}

export async function getStudentAssignments(): Promise<Assignment[]> {
  try {
    console.log('[STUDENT SERVICE] Fetching assignments...');

    // Debug: Check if token exists
    const token = await AsyncStorage.getItem('authToken');
    const schoolCode = await AsyncStorage.getItem('schoolCode');
    console.log('[STUDENT SERVICE] Token exists:', !!token);
    console.log('[STUDENT SERVICE] School code:', schoolCode);

    const userData = await AsyncStorage.getItem('userData');
    if (!userData) throw new Error('No user data found');

    const user = JSON.parse(userData);
    
    // DON'T filter by academic year on frontend - let backend handle it
    // The backend will automatically use the current academic year for students
    console.log('[STUDENT SERVICE] Backend will filter by current academic year automatically');
    
    const params: any = {
      studentId: user.userId || user._id,
    };
    
    const response = await api.get('/assignments', { params });
    console.log('[STUDENT SERVICE] Assignments response:', response.data);
    console.log('[STUDENT SERVICE] Assignments count:', response.data.assignments?.length || response.data.data?.length || 0);

    // Backend returns { assignments, totalPages, currentPage, total }
    return response.data.assignments || response.data.data || [];
  } catch (error: any) {
    console.error('[STUDENT SERVICE] Error fetching assignments:', error);
    console.error('[STUDENT SERVICE] Error response:', error?.response?.data);
    console.error('[STUDENT SERVICE] Error status:', error?.response?.status);
    return [];
  }
}

export async function getStudentAttendance(startDate?: string, endDate?: string): Promise<{
  records: AttendanceRecord[];
  stats: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    halfDays: number;
    leaveDays: number;
    attendancePercentage: number;
    totalSessions?: number;
    presentSessions?: number;
    sessionAttendanceRate?: number;
  };
}> {
  try {
    console.log('[STUDENT SERVICE] Fetching attendance...');

    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    // Use the new my-attendance endpoint which filters by student's class/section
    const response = await api.get('/attendance/my-attendance', { params });

    console.log('[STUDENT SERVICE] Attendance response:', response.data);

    if (response.data?.success && response.data?.data) {
      // Handle different response structures
      let rawRecords = [];

      if (response.data.data.records && Array.isArray(response.data.data.records)) {
        rawRecords = response.data.data.records;
      } else if (Array.isArray(response.data.data)) {
        rawRecords = response.data.data;
      } else {
        console.warn('[STUDENT SERVICE] Unexpected data structure:', response.data.data);
        rawRecords = [];
      }


      // Transform session-based records to day-based records
      const dayRecordsMap = new Map<string, AttendanceRecord>();

      // Get user data once before processing records
      const userData = JSON.parse(await AsyncStorage.getItem('userData') || '{}');
      const studentUserId = userData.userId || userData._id;

      rawRecords.forEach((sessionRecord: any) => {
        console.log('[STUDENT SERVICE] Processing raw record:', {
          _id: sessionRecord._id,
          date: sessionRecord.date,
          dateString: sessionRecord.dateString,
          status: sessionRecord.status,
          session: sessionRecord.session,
          sessions: sessionRecord.sessions,
          hasStudents: !!sessionRecord.students,
          studentsCount: sessionRecord.students?.length || 0
        });

        // Use dateString if available, otherwise extract from date
        let dateStr: string;
        if (sessionRecord.dateString) {
          dateStr = sessionRecord.dateString;
        } else if (sessionRecord.date) {
          // Use local date formatting to avoid timezone issues
          const recordDate = new Date(sessionRecord.date);
          const year = recordDate.getFullYear();
          const month = recordDate.getMonth() + 1;
          const day = recordDate.getDate();
          dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          console.log('[STUDENT SERVICE] Generated local date string:', dateStr, 'from:', sessionRecord.date);
        } else {
          console.warn('[STUDENT SERVICE] No date found in record:', sessionRecord);
          return;
        }

        // Extract session and student's status from the record
        let session: string | null = null;
        let sessionStatus: string = 'no-class';

        // Handle day-based records with sessions object (from backend)
        if (sessionRecord.sessions && typeof sessionRecord.sessions === 'object') {
          console.log('[STUDENT SERVICE] Processing day-based record with sessions:', sessionRecord.sessions);
          
          // Create or get the day record
          const dayRecord = dayRecordsMap.get(dateStr) || {
            _id: dateStr,
            date: sessionRecord.date || new Date(dateStr).toISOString(),
            dateString: dateStr,
            status: sessionRecord.status || 'no-class', // Use the backend status or default to 'no-class'
            sessions: { morning: null, afternoon: null }
          };

          // Handle morning session
          if (sessionRecord.sessions.morning && sessionRecord.sessions.morning.status) {
            const morningStatus = sessionRecord.sessions.morning.status;
            if (morningStatus === 'present' || morningStatus === 'absent') {
              dayRecord.sessions.morning = { status: morningStatus };
              console.log('[STUDENT SERVICE] Set morning session:', dayRecord.sessions.morning);
            }
          }

          // Handle afternoon session
          if (sessionRecord.sessions.afternoon && sessionRecord.sessions.afternoon.status) {
            const afternoonStatus = sessionRecord.sessions.afternoon.status;
            if (afternoonStatus === 'present' || afternoonStatus === 'absent') {
              dayRecord.sessions.afternoon = { status: afternoonStatus };
              console.log('[STUDENT SERVICE] Set afternoon session:', dayRecord.sessions.afternoon);
            }
          }

          // Update overall day status based on sessions
          const morningStatus = dayRecord.sessions.morning?.status;
          const afternoonStatus = dayRecord.sessions.afternoon?.status;
          
          if (morningStatus === 'present' || afternoonStatus === 'present') {
            dayRecord.status = 'present';
          } else if ((morningStatus === 'absent' && afternoonStatus === 'absent') || 
                     (morningStatus === 'absent' && !afternoonStatus) || 
                     (afternoonStatus === 'absent' && !morningStatus)) {
            dayRecord.status = 'absent';
          } else {
            dayRecord.status = 'no-class';
          }

          console.log('[STUDENT SERVICE] Final day record:', {
            date: dayRecord.dateString,
            status: dayRecord.status,
            sessions: dayRecord.sessions
          });

          dayRecordsMap.set(dateStr, dayRecord);
          return; // Skip the rest of processing for this record
        }
        // If no sessions object found, create a basic attendance record
        else {
          console.log('[STUDENT SERVICE] No sessions object found, creating basic record for:', sessionRecord._id);
          
          // Create a basic day record with the status from the record itself
          const basicStatus = sessionRecord.status || 'no-class';
          const dayRecord = dayRecordsMap.get(dateStr) || {
            _id: dateStr,
            date: sessionRecord.date || new Date(dateStr).toISOString(),
            dateString: dateStr,
            status: basicStatus,
            sessions: { morning: null, afternoon: null }
          };
          
          // If we have a direct status, use it
          if (sessionRecord.status && ['present', 'absent', 'half_day', 'no-class'].includes(sessionRecord.status)) {
            dayRecord.status = sessionRecord.status;
          }
          
          console.log('[STUDENT SERVICE] Created basic day record:', {
            date: dayRecord.dateString,
            status: dayRecord.status,
            originalStatus: sessionRecord.status
          });
          
          dayRecordsMap.set(dateStr, dayRecord);
        }
      });

      const transformedRecords = Array.from(dayRecordsMap.values());
      
      console.log('[STUDENT SERVICE] Final transformed records:');
      transformedRecords.forEach(record => {
        console.log(`[STUDENT SERVICE] ${record.dateString}: ${record.status} - Morning: ${record.sessions.morning?.status || 'null'}, Afternoon: ${record.sessions.afternoon?.status || 'null'}`);
      });



      // Sort records by date for proper display (most recent first)
      transformedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // STRICT filtering - only return records within the exact requested date range
      let filteredRecords: AttendanceRecord[] = [];
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Set time boundaries
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        console.log('[STUDENT SERVICE] STRICT filtering for range:', start.toDateString(), 'to', end.toDateString());

        filteredRecords = transformedRecords.filter(record => {
          const recordDate = new Date(record.date);
          recordDate.setHours(0, 0, 0, 0);

          const isInRange = recordDate >= start && recordDate <= end;

          console.log('[STUDENT SERVICE] Record:', record.dateString, 'In range:', isInRange);

          return isInRange;
        });

        console.log('[STUDENT SERVICE] FINAL filtered records:', filteredRecords.length, 'from', transformedRecords.length);
      } else {
        // If no date range specified, return all records for overall stats calculation
        console.log('[STUDENT SERVICE] No date range specified - returning all records for overall stats');
        filteredRecords = transformedRecords;
      }

      // Calculate stats from ALL transformed records (not just filtered ones)
      // This gives the overall attendance percentage for the student
      const overallStats = {
        totalDays: transformedRecords.length,
        presentDays: transformedRecords.filter(r => r.status === 'present').length,
        absentDays: transformedRecords.filter(r => r.status === 'absent').length,
        lateDays: 0,
        halfDays: 0,
        leaveDays: 0,
        attendancePercentage: 0
      };

      if (overallStats.totalDays > 0) {
        overallStats.attendancePercentage = Math.round((overallStats.presentDays / overallStats.totalDays) * 100);
      }

      console.log('[STUDENT SERVICE] Calculated overall stats:', overallStats);

      // Use backend summary if available, otherwise use our calculated stats
      const finalStats = response.data.data.summary || overallStats;
      
      // Ensure we have a valid attendance percentage
      if (!finalStats.attendancePercentage && finalStats.totalDays > 0) {
        finalStats.attendancePercentage = Math.round((finalStats.presentDays / finalStats.totalDays) * 100);
      }

      console.log('[STUDENT SERVICE] Final stats being returned:', finalStats);

      return {
        records: filteredRecords,
        stats: finalStats
      };
    }

    return { records: [], stats: { totalDays: 0, presentDays: 0, absentDays: 0, lateDays: 0, halfDays: 0, leaveDays: 0, attendancePercentage: 0 } };
  } catch (error) {
    console.error('[STUDENT SERVICE] Error fetching attendance:', error);
    return { records: [], stats: { totalDays: 0, presentDays: 0, absentDays: 0, lateDays: 0, halfDays: 0, leaveDays: 0, attendancePercentage: 0 } };
  }
}

export async function getStudentResults(): Promise<Result[]> {
  try {
    console.log('[STUDENT SERVICE] Fetching results...');

    const userData = await AsyncStorage.getItem('userData');
    if (!userData) throw new Error('No user data found');

    const user = JSON.parse(userData);
    const studentId = user.userId || user._id;
    const schoolCode = await AsyncStorage.getItem('schoolCode') || '';

    console.log('[STUDENT SERVICE] Student info:', {
      studentId,
      schoolCode: schoolCode.toUpperCase(),
      userId: user.userId,
      _id: user._id
    });

    // Use the EXACT same approach as the website - /results endpoint with params
    // This is the same endpoint that works in the website logs
    const params: any = {
      schoolCode: schoolCode.toUpperCase(),
      studentId: studentId
    };

    console.log('[STUDENT SERVICE] Calling /results API with params:', params);

    let response;
    let rawResults = [];

    try {
      // Call the same /results endpoint that the website uses
      response = await api.get('/results', { params });

      console.log('[STUDENT SERVICE] Raw API response:', {
        success: response.data?.success,
        message: response.data?.message,
        dataType: Array.isArray(response.data?.data) ? 'array' : typeof response.data?.data,
        dataLength: response.data?.data?.length
      });
      
      // The backend returns FLATTENED results - one object per subject, not nested
      // Format: [{ _id, subject, testType, obtainedMarks, ... }, ...]
      if (response.data?.success && response.data?.data) {
        const flatResults = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
        console.log('[STUDENT SERVICE] ✅ Received', flatResults.length, 'flattened result records from backend');
        
        // Log first flat result to see structure
        if (flatResults.length > 0) {
          console.log('[STUDENT SERVICE] 📋 First flat result structure:', {
            _id: flatResults[0]._id,
            studentId: flatResults[0].studentId,
            studentName: flatResults[0].studentName,
            subject: flatResults[0].subject,
            testType: flatResults[0].testType,
            obtainedMarks: flatResults[0].obtainedMarks,
            maxMarks: flatResults[0].maxMarks,
            totalMarks: flatResults[0].totalMarks,
            grade: flatResults[0].grade,
            percentage: flatResults[0].percentage
          });
        }
        
        // Group flat results back into nested structure by document _id
        const groupedByDoc = new Map<string, any>();
        
        flatResults.forEach((flatResult: any) => {
          const docId = flatResult._id?.toString() || 'unknown';
          
          if (!groupedByDoc.has(docId)) {
            groupedByDoc.set(docId, {
              _id: flatResult._id,
              studentId: flatResult.studentId,
              studentName: flatResult.studentName,
              className: flatResult.className,
              section: flatResult.section,
              academicYear: flatResult.academicYear,
              userId: flatResult.userId,
              subjects: []
            });
          }
          
          // Add this subject to the document's subjects array
          groupedByDoc.get(docId).subjects.push({
            subjectName: flatResult.subject,
            testType: flatResult.testType,
            obtainedMarks: flatResult.obtainedMarks,
            maxMarks: flatResult.maxMarks,
            totalMarks: flatResult.totalMarks,
            grade: flatResult.grade,
            percentage: flatResult.percentage
          });
        });
        
        // Convert grouped map back to array
        rawResults = Array.from(groupedByDoc.values());
        console.log('[STUDENT SERVICE] 📦 Grouped into', rawResults.length, 'result documents');
        
        // Log grouped structure
        if (rawResults.length > 0) {
          console.log('[STUDENT SERVICE] 📋 First grouped result:', {
            _id: rawResults[0]._id,
            studentName: rawResults[0].studentName,
            subjectsCount: rawResults[0].subjects?.length,
            subjects: rawResults[0].subjects?.map((s: any) => `${s.subjectName} (${s.testType})`)
          });
        }
      } else {
        console.log('[STUDENT SERVICE] ⚠️ No data in response');
        rawResults = [];
      }
    } catch (error: any) {
      console.error('[STUDENT SERVICE] ❌ API Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return [];
    }

    if (!Array.isArray(rawResults) || rawResults.length === 0) {
      return [];
    }

    // Filter out placeholder records and invalid results
    const validResults = rawResults.filter((result: any) => {
      // Skip placeholder records by flag
      if (result._placeholder === true) {
        console.log('[STUDENT SERVICE] Skipping placeholder result:', result._id);
        return false;
      }

      // Skip placeholder records by description
      if (result.note && result.note.includes('Placeholder for results collection')) {
        console.log('[STUDENT SERVICE] Skipping placeholder result by description:', result._id);
        return false;
      }

      // Skip results without proper structure
      if (!result.subjects || !Array.isArray(result.subjects) || result.subjects.length === 0) {
        console.log('[STUDENT SERVICE] Skipping result without subjects:', result._id);
        return false;
      }

      // Skip frozen placeholder results (additional check)
      if (result.frozen && result.note && result.note.includes('Placeholder')) {
        console.log('[STUDENT SERVICE] Skipping frozen placeholder result:', result._id);
        return false;
      }

      return true;
    });

    console.log('[STUDENT SERVICE] Filtered results count:', validResults.length, 'from', rawResults.length);
    
    // Log the structure of first result for debugging
    if (validResults.length > 0) {
      console.log('[STUDENT SERVICE] Sample result structure:', {
        _id: validResults[0]._id,
        studentName: validResults[0].studentName,
        subjectsCount: validResults[0].subjects?.length,
        firstSubject: validResults[0].subjects?.[0] ? {
          subjectName: validResults[0].subjects[0].subjectName,
          testType: validResults[0].subjects[0].testType,
          marks: `${validResults[0].subjects[0].obtainedMarks}/${validResults[0].subjects[0].maxMarks}`
        } : 'No subjects'
      });
    }

    // Group subjects by testType to create separate result entries for each test
    const testTypeGroups = new Map<string, any>();

    validResults.forEach((result: any) => {
      if (result.subjects && Array.isArray(result.subjects)) {
        console.log('[STUDENT SERVICE] Processing result with', result.subjects.length, 'subjects');
        console.log('[STUDENT SERVICE] All subjects in this result:', result.subjects.map((s: any) => ({
          name: s.subjectName,
          test: s.testType,
          marks: `${s.obtainedMarks}/${s.maxMarks}`
        })));
        
        result.subjects.forEach((subject: any, subjectIndex: number) => {
          // Extract test type for this subject
          const testType = subject.testType || result.examType || result.term || 'Exam';
          
          console.log(`[STUDENT SERVICE] Processing subject ${subjectIndex + 1}/${result.subjects.length}:`, subject.subjectName, '| Test:', testType, '| Marks:', subject.obtainedMarks + '/' + subject.maxMarks);
          
          // Get or create group for this test type
          if (!testTypeGroups.has(testType)) {
            console.log('[STUDENT SERVICE] ✨ Creating NEW test group:', testType);
            testTypeGroups.set(testType, {
              examType: testType,
              subjects: [],
              subjectNames: new Set(), // Track subject names to avoid duplicates
              academicYear: result.academicYear || result.classDetails?.academicYear || '2024-25',
              rank: result.rank || result.overallResult?.rank,
              _id: `${result._id}_${testType}`, // Unique ID for each test type
              // FIX: Capture overall metrics from the raw result document
              rawOverallPercentage: result.overallPercentage, 
              rawOverallGrade: result.overallGrade, 
            });
          } else {
            console.log('[STUDENT SERVICE] ♻️ Using EXISTING test group:', testType);
          }

          const group = testTypeGroups.get(testType);
          console.log(`[STUDENT SERVICE] Current group "${testType}" has ${group.subjects.length} subjects already`);
          console.log(`[STUDENT SERVICE] Subjects in "${testType}" group:`, Array.from(group.subjectNames));

          // Handle different subject structures
          let subjectName = subject.subjectName || subject.name || subject.subject || 'Unknown Subject';
          let marksObtained = 0;
          let totalMarks = 100;
          let grade = subject.grade || '';
          let percentage = 0;

          // Extract marks - try all possible field names
          // Database has: obtainedMarks, maxMarks, totalMarks
          marksObtained = subject.obtainedMarks || subject.marksObtained || 0;
          totalMarks = subject.maxMarks || subject.totalMarks || 100;
          percentage = subject.percentage || 0;
          grade = subject.grade || '';

          // Handle nested structure if exists
          if (subject.total) {
            marksObtained = subject.total.marksObtained || subject.total.obtainedMarks || marksObtained;
            totalMarks = subject.total.maxMarks || subject.total.totalMarks || totalMarks;
            percentage = subject.total.percentage || percentage;
            grade = subject.total.grade || grade;
          }

          // Calculate percentage if not provided
          if (!percentage && totalMarks > 0) {
            percentage = (marksObtained / totalMarks) * 100;
          }
          
          console.log('[STUDENT SERVICE] Extracted marks:', {
            subject: subjectName,
            obtained: marksObtained,
            total: totalMarks,
            percentage: percentage,
            grade: grade
          });

          // Check for duplicate subjects in this test
          if (!group.subjectNames.has(subjectName)) {
            group.subjectNames.add(subjectName);
            
            // Add subject to the group
            group.subjects.push({
              subjectName,
              marksObtained,
              totalMarks,
              grade,
              percentage: Math.round(percentage * 100) / 100
            });
            console.log(`[STUDENT SERVICE] ✅ ADDED "${subjectName}" to "${testType}" group. Group now has ${group.subjects.length} subjects`);
          } else {
            console.log(`[STUDENT SERVICE] ⚠️ SKIPPED duplicate subject: "${subjectName}" in test: "${testType}"`);
          }
        });
      }
    });

    // Log all test groups before transformation
    console.log('[STUDENT SERVICE] ========================================');
    console.log('[STUDENT SERVICE] Total test groups created:', testTypeGroups.size);
    console.log('[STUDENT SERVICE] Test group names:', Array.from(testTypeGroups.keys()).join(', '));
    testTypeGroups.forEach((group, testName) => {
      console.log(`[STUDENT SERVICE] Group "${testName}":`, {
        subjectsCount: group.subjects.length,
        subjects: group.subjects.map((s: any) => `${s.subjectName} (${s.marksObtained}/${s.totalMarks})`).join(', ')
      });
    });
    console.log('[STUDENT SERVICE] ========================================');

    // Transform groups into final result format
    const transformedResults = Array.from(testTypeGroups.values()).map((group: any) => {
      // Calculate overall statistics for this test
      let overallPercentage = 0;
      // FIX: Prioritize the raw overall grade from the backend, or default to 'N/A'
      let overallGrade = group.rawOverallGrade || 'N/A'; 

      if (group.subjects.length > 0) {
        const totalMarks = group.subjects.reduce((sum: number, s: any) => sum + s.totalMarks, 0);
        const obtainedMarks = group.subjects.reduce((sum: number, s: any) => sum + s.marksObtained, 0);
        overallPercentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;

        // Note: The original logic to derive overallGrade from subject grades is removed 
        // as it is unreliable and only the backend's explicit grade should be trusted.
      }

      // Remove the subjectNames Set and raw fields before returning (it was only for deduplication)
      const transformedResult = {
        _id: group._id,
        examType: group.examType,
        subjects: group.subjects,
        overallPercentage: Math.round(overallPercentage * 100) / 100,
        overallGrade,
        rank: group.rank,
        academicYear: group.academicYear
      };

      console.log('[STUDENT SERVICE] Transformed result:', {
        id: transformedResult._id,
        examType: transformedResult.examType,
        subjectsCount: transformedResult.subjects.length,
        overallPercentage: transformedResult.overallPercentage,
        grade: transformedResult.overallGrade,
        rank: transformedResult.rank
      });
      return transformedResult;
    });

    console.log('[STUDENT SERVICE] Final transformed results count:', transformedResults.length, 'from', testTypeGroups.size, 'test types');
    console.log('[STUDENT SERVICE] Test types found:', Array.from(testTypeGroups.keys()).join(', '));
    
    // Log summary of each test
    transformedResults.forEach((result, index) => {
      console.log(`[STUDENT SERVICE] Test ${index + 1}: ${result.examType} - ${result.subjects.length} subjects - ${result.overallPercentage}%`);
    });

    return transformedResults;
  } catch (error: any) {
    console.error('[STUDENT SERVICE] Error fetching results:', error);
    console.error('[STUDENT SERVICE] Error response:', error?.response?.data);
    console.error('[STUDENT SERVICE] Error status:', error?.response?.status);
    return [];
  }
}

export async function getStudentMessages(): Promise<Message[]> {
  try {
    console.log('[STUDENT SERVICE] Fetching messages...');
    
    // Check user role to determine which endpoint to use
    const role = await AsyncStorage.getItem('role');
    console.log('[STUDENT SERVICE] User role:', role);
    
    let response;
    
    if (role === 'teacher') {
      // Teachers use the teacher messages endpoint
      console.log('[STUDENT SERVICE] Fetching messages for teacher...');
      response = await api.get('/messages/teacher/messages');
    } else {
      // Students use the student messages endpoint
      console.log('[STUDENT SERVICE] Fetching messages for student...');
      response = await api.get('/messages/student');
    }

    console.log('[STUDENT SERVICE] Messages response:', response.data);

    // Backend returns { success: true, data: { messages: [...], pagination: {...} } }
    const messages = response.data?.data?.messages || response.data?.messages || response.data?.data || [];

    // Map backend format to frontend format
    return messages.map((msg: any) => ({
      _id: msg.id || msg._id,
      id: msg.id || msg._id,
      title: msg.title || msg.subject,
      subject: msg.subject || msg.title || 'No Subject',
      message: msg.message || '',
      sender: msg.sender || 'School Admin',
      senderRole: msg.senderRole || 'admin',
      adminId: msg.adminId,
      class: msg.class,
      section: msg.section,
      createdAt: msg.createdAt,
      isRead: msg.isRead || false,
      messageAge: msg.messageAge,
      urgencyIndicator: msg.urgencyIndicator
    }));
  } catch (error: any) {
    console.error('[STUDENT SERVICE] Error fetching messages:', error);
    console.error('[STUDENT SERVICE] Error response:', error?.response?.data);
    console.error('[STUDENT SERVICE] Error status:', error?.response?.status);
    return [];
  }
}

export async function submitAssignment(assignmentId: string, attachments: any[]): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append('assignmentId', assignmentId);

    attachments.forEach((attachment, index) => {
      formData.append('attachments', attachment);
    });

    const response = await api.post(`/assignments/${assignmentId}/submit`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });

    return response.data.success || false;
  } catch (error) {
    console.error('Error submitting assignment:', error);
    return false;
  }
}

export async function getSchoolInfo(): Promise<SchoolInfo | null> {
  try {
    console.log('[STUDENT SERVICE] Fetching school info...');

    // 1. Get schoolCode from AsyncStorage
    const schoolCode = await AsyncStorage.getItem('schoolCode');

    // 2. Get schoolId and schoolCode from stored user data
    const userDataStr = await AsyncStorage.getItem('userData');
    let schoolId = null;
    let userSchoolCode = null;

    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      schoolId = userData.schoolId?._id || userData.schoolId || userData._schoolId || userData.schoolId;
      userSchoolCode = userData.schoolCode;
    }

    // Determine the identifier to fetch (ID is preferred, but Code works as fallback)
    const schoolIdOrCode = schoolId || schoolCode || userSchoolCode;

    if (!schoolIdOrCode) {
      console.log('[STUDENT SERVICE] No school ID or Code found in storage');
      return null;
    }

    console.log('[STUDENT SERVICE] Fetching school info for:', schoolIdOrCode);
    const response = await api.get(`/schools/${schoolIdOrCode}/info`);
    console.log('[STUDENT SERVICE] Raw school info response:', response.data);

    const data = response.data?.data || response.data;
    if (!data) {
      console.log('[STUDENT SERVICE] No school data found in response.');
      return null;
    }

    const mappedData = {
      ...data,
      schoolName: data.name || data.schoolName,
      schoolCode: data.code || data.schoolCode,
      logo: data.logoUrl || data.logo,
    };
    console.log('[STUDENT SERVICE] Mapped school info:', { schoolName: mappedData.schoolName, logo: mappedData.logo });
    return mappedData;
  } catch (error: any) {
    console.error('[STUDENT SERVICE] Error fetching school info:', error?.response?.data || error?.message);
    return null;
  }
}

export async function getStudentFees(): Promise<FeeRecord | null> {
  try {
    const response = await api.get('/fees/my-fees');
    return response.data.data || response.data || null;
  } catch (error) {
    console.error('Error fetching student fees:', error);
    return null;
  }
}

export interface StudentProfile {
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
    whatsappNumber?: string;
  };
  address?: {
    permanent?: {
      street?: string;
      area?: string;
      city?: string;
      state?: string;
      country?: string;
      pincode?: string;
      landmark?: string;
    };
    current?: any;
  };
  identity?: {
    aadharNumber?: string;
    panNumber?: string;
  };
  studentDetails?: any;
  isActive?: boolean;
  lastLogin?: string;
}

/**
 * Fetch student profile from students collection in school database
 * This fetches the complete student data from the school's students collection
 * Uses the reports endpoint which queries the students collection
 */
export async function getStudentProfile(): Promise<StudentProfile | null> {
  try {
    const userData = await AsyncStorage.getItem('userData');
    if (!userData) throw new Error('No user data found');

    const user = JSON.parse(userData);
    const userId = user.userId || user._id;

    if (!userId) {
      throw new Error('Missing userId');
    }

    const role = user.role || 'student';
    console.log(`[STUDENT SERVICE] Fetching profile for role: ${role}, userId: ${userId}`);

    if (role === 'teacher') {
      const response = await api.get(`/users/${userId}`);
      console.log('[STUDENT SERVICE] Teacher profile response:', response.data);
      const data = response.data;
      if (!data) return null;

      const mappedProfile: StudentProfile = {
        _id: data._id || data.userId || '',
        userId: data.userId || '',
        name: {
          displayName: data.name?.displayName || [data.name?.firstName, data.name?.lastName].filter(Boolean).join(' ') || ''
        },
        email: data.email || '',
        schoolCode: data.schoolCode || user.schoolCode || '',
        isActive: data.isActive !== undefined ? data.isActive : true,
        lastLogin: data.lastLogin || '',
        studentDetails: {}
      };
      console.log('[STUDENT SERVICE] Mapped teacher profile:', mappedProfile);
      return mappedProfile;
    } else {
      const response = await api.get('/users/my-profile');
      console.log('[STUDENT SERVICE] Student profile response:', response.data);

      if (response.data?.success && response.data?.data) {
        const data = response.data.data;
        const mappedProfile: StudentProfile = {
          _id: data.studentId || user._id || '',
          userId: data.studentId || user.userId || '',
          name: {
            displayName: data.studentName || user.name?.displayName || user.name || ''
          },
          email: data.email || user.email || '',
          schoolCode: data.schoolCode || user.schoolCode || '',
          isActive: data.isActive !== undefined ? data.isActive : (user.isActive !== undefined ? user.isActive : true),
          lastLogin: data.lastLogin || user.lastLogin || '',
          studentDetails: {
            admissionNumber: data.enrollmentNo || data.studentId || '',
            academic: {
              currentClass: data.class,
              currentSection: data.section,
              rollNumber: data.rollNumber,
              academicYear: data.academicYear
            },
            personal: {
              dateOfBirth: data.dob,
              gender: data.gender,
              bloodGroup: data.bloodGroup,
              nationality: data.nationality
            },
            family: {
              father: { name: data.fatherName, phone: data.parentMobile },
              mother: { name: data.motherName },
              guardian: { name: data.guardianName }
            }
          },
          contact: {
            primaryPhone: data.mobile || data.parentMobile || ''
          },
          address: {
            permanent: {
              street: data.address,
              city: data.city,
              state: data.state,
              pincode: data.pinCode
            }
          }
        };
        console.log('[STUDENT SERVICE] Mapped student profile:', mappedProfile);
        return mappedProfile;
      }
    }

    return null;
  } catch (error: any) {
    console.error('[STUDENT SERVICE] Error fetching student profile:', error);
    console.error('[STUDENT SERVICE] Error response:', error?.response?.data);
    console.error('[STUDENT SERVICE] Error status:', error?.response?.status);
    return null;
  }
}