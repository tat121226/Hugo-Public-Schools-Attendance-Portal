/**
 * Hugo Student Outreach System
 * Weekly attendance backend service
 */

const ATTENDANCE_ENTRY_ROLES = Object.freeze([
  'ATTENDANCE_CLERK',
  'CAMPUS_ADMIN',
  'REPORTS_ONLY',
  'DISTRICT_ADMIN',
  'OUTREACH_COORDINATOR'
]);

const ATTENDANCE_EDIT_ROLES = Object.freeze([
  'ATTENDANCE_CLERK',
  'CAMPUS_ADMIN',
  'DISTRICT_ADMIN',
  'OUTREACH_COORDINATOR'
]);

const ATTENDANCE_CAMPUS_SCOPED_ROLES = Object.freeze([
  'ATTENDANCE_CLERK',
  'CAMPUS_ADMIN'
]);


/**
 * Opens the attendance module and returns the signed-in user's settings.
 */
function getAttendanceBootstrap(sessionToken) {
  const user = requireAttendanceUser_(sessionToken);

  return {
    success: true,
    user: user,

    permissions: {
      canEnterAttendance: ATTENDANCE_EDIT_ROLES.indexOf(user.role) !== -1,
      canAddStudents: ATTENDANCE_EDIT_ROLES.indexOf(user.role) !== -1,
      canManageStudents: ATTENDANCE_EDIT_ROLES.indexOf(user.role) !== -1,
      canChangeStudentCampusOrStatus: attendanceCanViewAllCampuses_(user),
      canViewAllCampuses: attendanceCanViewAllCampuses_(user),
      canViewInterventions: user.role !== 'REPORTS_ONLY',
      canSeeReferralSide: ['DISTRICT_ADMIN', 'OUTREACH_COORDINATOR']
        .indexOf(user.role) !== -1
    },

    campuses: OUTREACH_CONFIG.CAMPUSES.slice(),

    defaultCampus:
      ATTENDANCE_CAMPUS_SCOPED_ROLES.indexOf(user.role) !== -1
        ? user.campus
        : 'HES',

    currentWeekStart: attendanceCurrentMonday_()
  };
}


/**
 * Searches the Students tab by student ID, name, or grade.
 */
function searchAttendanceStudents(
  sessionToken,
  campus,
  searchText
) {
  const user = requireAttendanceUser_(sessionToken);
  const selectedCampus = enforceAttendanceCampus_(user, campus);

  const search = String(searchText || '')
    .trim()
    .toLowerCase();

  const students = getActiveAttendanceStudents_(selectedCampus)
    .filter(function(student) {
      if (!search) {
        return true;
      }

      const searchableText = [
        student.studentId,
        student.fullName,
        student.grade
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.indexOf(search) !== -1;
    })
    .slice(0, 100);

  return {
    success: true,
    campus: selectedCampus,
    students: students
  };
}


/**
 * Adds one student to the Students sheet from Attendance Management.
 */
function createAttendanceStudent(sessionToken, studentInput) {
  const user = requireAttendanceEditor_(
    requireAttendanceUser_(sessionToken)
  );
  const input = studentInput || {};
  const studentId = attendanceCleanStudentField_(input.studentId, 50);
  const firstName = attendanceCleanStudentField_(input.firstName, 80);
  const lastName = attendanceCleanStudentField_(input.lastName, 80);
  const grade = attendanceCleanStudentField_(input.grade, 20);
  const campus = enforceAttendanceCampus_(user, input.campus);
  const dateOfBirthText = attendanceCleanStudentField_(input.dateOfBirth, 10);
  const studentEmail = attendanceCleanStudentField_(input.studentEmail, 160)
    .toLowerCase();
  const parentGuardianName = attendanceCleanStudentField_(
    input.parentGuardianName,
    160
  );
  const parentGuardianPhone = attendanceCleanStudentField_(
    input.parentGuardianPhone,
    40
  );
  const streetAddress = attendanceCleanStudentField_(input.streetAddress, 180);
  const city = attendanceCleanStudentField_(input.city, 100);
  const state = attendanceCleanStudentField_(input.state, 30).toUpperCase();
  const zipCode = attendanceCleanStudentField_(input.zipCode, 20);

  if (!studentId) throw new Error('Enter the student ID.');
  if (!firstName) throw new Error('Enter the student first name.');
  if (!lastName) throw new Error('Enter the student last name.');
  if (!grade) throw new Error('Select or enter the student grade.');
  if (!dateOfBirthText) throw new Error('Enter the student date of birth.');

  const dateOfBirth = attendanceParseStudentBirthDate_(dateOfBirthText);
  if (!dateOfBirth) {
    throw new Error('Enter a valid student date of birth.');
  }

  if (studentEmail && !attendanceValidStudentEmail_(studentEmail)) {
    throw new Error('Enter a valid student email address or leave it blank.');
  }

  const fullName = (firstName + ' ' + lastName).trim();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getAttendanceSheet_('Students');
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0]
      .map(function(header) { return String(header || '').trim(); });

    const requiredHeaders = [
      'Student ID',
      'Grade',
      'Campus',
      'Active',
      'Updated At'
    ];
    requiredHeaders.forEach(function(header) {
      if (headers.indexOf(header) === -1) {
        throw new Error(
          'The Students sheet is missing the required "' + header + '" column.'
        );
      }
    });

    const hasCombinedName =
      headers.indexOf('Name') !== -1 ||
      headers.indexOf('Student Name') !== -1;
    const hasSeparateName =
      headers.indexOf('First Name') !== -1 &&
      headers.indexOf('Last Name') !== -1;
    if (!hasCombinedName && !hasSeparateName) {
      throw new Error(
        'The Students sheet needs either a Name column or First Name and Last Name columns.'
      );
    }

    const duplicate = sheetToObjects_(sheet).find(function(record) {
      return String(record['Student ID'] || '').trim().toLowerCase() ===
        studentId.toLowerCase();
    });
    if (duplicate) {
      const activeText = authBoolean_(duplicate['Active'])
        ? 'active'
        : 'inactive';
      throw new Error(
        'Student ID ' + studentId + ' already exists in the Students sheet and is ' +
        activeText + '.'
      );
    }

    const row = {
      'Student ID': studentId,
      'Name': fullName,
      'Student Name': fullName,
      'First Name': firstName,
      'Last Name': lastName,
      'Grade': grade,
      'Campus': campus,
      'Date of Birth': dateOfBirth,
      'Student Email': studentEmail,
      'Parent/Guardian Name': parentGuardianName,
      'Parent/Guardian Phone': parentGuardianPhone,
      'Street Address': streetAddress,
      'City': city,
      'State': state,
      'ZIP Code': zipCode,
      'Active': true,
      'Updated At': new Date()
    };

    appendObjectRow_(sheet, row);

    writeAuditLog_({
      userEmail: user.email,
      action: 'ADD_ATTENDANCE_STUDENT',
      recordType: 'Student',
      recordId: studentId,
      details: {
        studentName: fullName,
        grade: grade,
        campus: campus,
        addedBy: user.username
      }
    });

    return {
      success: true,
      message: fullName + ' was added successfully.',
      student: attendanceStudentForClient_(row)
    };
  } finally {
    lock.releaseLock();
  }
}


function attendanceCleanStudentField_(value, maxLength) {
  const cleaned = String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length > maxLength) {
    throw new Error('One of the student fields is longer than allowed.');
  }
  return cleaned;
}


function attendanceParseStudentBirthDate_(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date > new Date() ||
    year < 1900
  ) {
    return null;
  }
  return date;
}


function attendanceValidStudentEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}


/**
 * Searches active and inactive students for the student-management screen.
 */
function searchAttendanceStudentsForManagement(
  sessionToken,
  campus,
  searchText
) {
  const user = requireAttendanceEditor_(
    requireAttendanceUser_(sessionToken)
  );
  const selectedCampus = enforceAttendanceCampus_(user, campus);
  const search = String(searchText || '').trim().toLowerCase();

  if (search.length < 2) {
    return {
      success: true,
      campus: selectedCampus,
      students: []
    };
  }

  const students = sheetToObjects_(getAttendanceSheet_('Students'))
    .filter(function(record) {
      return String(record['Campus'] || '').trim().toUpperCase() === selectedCampus;
    })
    .map(attendanceStudentForClient_)
    .filter(function(student) {
      const searchable = [
        student.studentId,
        student.fullName,
        student.grade,
        student.studentEmail
      ].join(' ').toLowerCase();
      return searchable.indexOf(search) !== -1;
    })
    .sort(function(a, b) {
      return a.fullName.localeCompare(b.fullName);
    })
    .slice(0, 100);

  return {
    success: true,
    campus: selectedCampus,
    students: students
  };
}


/**
 * Loads one complete student record for editing.
 */
function getAttendanceStudentForManagement(sessionToken, studentId) {
  const user = requireAttendanceEditor_(
    requireAttendanceUser_(sessionToken)
  );
  const located = findAttendanceStudentRecordById_(studentId);

  if (!located) throw new Error('The student record could not be found.');

  const student = attendanceStudentForManagement_(located.record);
  enforceAttendanceCampus_(user, student.campus);

  return {
    success: true,
    student: student,
    canChangeCampusOrStatus: attendanceCanViewAllCampuses_(user)
  };
}


/**
 * Updates one existing Students sheet record without changing Student ID.
 */
function updateAttendanceStudent(sessionToken, studentInput) {
  const user = requireAttendanceEditor_(
    requireAttendanceUser_(sessionToken)
  );
  const input = studentInput || {};
  const studentId = attendanceCleanStudentField_(input.studentId, 50);

  if (!studentId) throw new Error('The student ID is required.');

  const firstName = attendanceCleanStudentField_(input.firstName, 80);
  const lastName = attendanceCleanStudentField_(input.lastName, 80);
  const grade = attendanceCleanStudentField_(input.grade, 20);
  const requestedCampus = String(input.campus || '').trim().toUpperCase();
  const dateOfBirthText = attendanceCleanStudentField_(input.dateOfBirth, 10);
  const studentEmail = attendanceCleanStudentField_(input.studentEmail, 160)
    .toLowerCase();
  const parentGuardianName = attendanceCleanStudentField_(
    input.parentGuardianName,
    160
  );
  const parentGuardianPhone = attendanceCleanStudentField_(
    input.parentGuardianPhone,
    40
  );
  const streetAddress = attendanceCleanStudentField_(input.streetAddress, 180);
  const city = attendanceCleanStudentField_(input.city, 100);
  const state = attendanceCleanStudentField_(input.state, 30).toUpperCase();
  const zipCode = attendanceCleanStudentField_(input.zipCode, 20);
  const requestedActive = input.active === true ||
    String(input.active || '').trim().toUpperCase() === 'TRUE';

  if (!firstName) throw new Error('Enter the student first name.');
  if (!lastName) throw new Error('Enter the student last name.');
  if (!grade) throw new Error('Select or enter the student grade.');
  if (!dateOfBirthText) throw new Error('Enter the student date of birth.');

  const dateOfBirth = attendanceParseStudentBirthDate_(dateOfBirthText);
  if (!dateOfBirth) throw new Error('Enter a valid student date of birth.');
  if (studentEmail && !attendanceValidStudentEmail_(studentEmail)) {
    throw new Error('Enter a valid student email address or leave it blank.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const located = findAttendanceStudentRecordById_(studentId);
    if (!located) throw new Error('The student record could not be found.');

    const original = attendanceStudentForManagement_(located.record);
    enforceAttendanceCampus_(user, original.campus);

    const canChangeCampusOrStatus = attendanceCanViewAllCampuses_(user);
    let campus = original.campus;
    let active = original.active;

    if (canChangeCampusOrStatus) {
      campus = enforceAttendanceCampus_(user, requestedCampus);
      active = requestedActive;
    } else if (
      requestedCampus !== original.campus ||
      requestedActive !== original.active
    ) {
      throw new Error(
        'Only a district administrator or outreach coordinator can change a student campus or active status.'
      );
    }

    const fullName = (firstName + ' ' + lastName).trim();
    const updated = {
      'Name': fullName,
      'Student Name': fullName,
      'First Name': firstName,
      'Last Name': lastName,
      'Grade': grade,
      'Campus': campus,
      'Date of Birth': dateOfBirth,
      'Student Email': studentEmail,
      'Parent/Guardian Name': parentGuardianName,
      'Parent/Guardian Phone': parentGuardianPhone,
      'Street Address': streetAddress,
      'City': city,
      'State': state,
      'ZIP Code': zipCode,
      'Active': active,
      'Updated At': new Date()
    };

    const updatedForComparison = attendanceStudentForManagement_(
      Object.assign({}, located.record, updated)
    );
    const changedFields = attendanceChangedStudentFields_(
      original,
      updatedForComparison
    );

    if (!changedFields.length) {
      return {
        success: true,
        message: 'No student information needed to be changed.',
        student: original,
        changedFields: []
      };
    }

    updateObjectRow_(
      located.sheet,
      located.rowNumber,
      updated
    );

    writeAuditLog_({
      userEmail: user.email,
      action: 'UPDATE_ATTENDANCE_STUDENT',
      recordType: 'Student',
      recordId: studentId,
      details: {
        changedFields: changedFields,
        previousCampus: original.campus,
        newCampus: updatedForComparison.campus,
        previousActive: original.active,
        newActive: updatedForComparison.active,
        updatedBy: user.username
      }
    });

    return {
      success: true,
      message: fullName + ' was updated successfully.',
      student: updatedForComparison,
      changedFields: changedFields
    };
  } finally {
    lock.releaseLock();
  }
}


function findAttendanceStudentRecordById_(studentId) {
  const cleanId = String(studentId || '').trim().toLowerCase();
  if (!cleanId) return null;

  const sheet = getAttendanceSheet_('Students');
  const record = sheetToObjects_(sheet).find(function(item) {
    return String(item['Student ID'] || '').trim().toLowerCase() === cleanId;
  });

  return record
    ? { sheet: sheet, rowNumber: record._rowNumber, record: record }
    : null;
}


function attendanceStudentForManagement_(record) {
  const student = attendanceStudentForClient_(record);
  const combined = String(student.fullName || '').trim();
  const parts = combined.split(/\s+/).filter(Boolean);

  student.firstName = String(record['First Name'] || '').trim() ||
    (parts.length ? parts[0] : '');
  student.lastName = String(record['Last Name'] || '').trim() ||
    (parts.length > 1 ? parts.slice(1).join(' ') : '');
  student.active = authBoolean_(record['Active']);
  return student;
}


function attendanceChangedStudentFields_(before, after) {
  const labels = {
    firstName: 'First Name',
    lastName: 'Last Name',
    grade: 'Grade',
    campus: 'Campus',
    dateOfBirth: 'Date of Birth',
    studentEmail: 'Student Email',
    parentGuardianName: 'Parent/Guardian Name',
    parentGuardianPhone: 'Parent/Guardian Phone',
    streetAddress: 'Street Address',
    city: 'City',
    state: 'State',
    zipCode: 'ZIP Code',
    active: 'Active Status'
  };

  return Object.keys(labels).filter(function(key) {
    return String(before[key] == null ? '' : before[key]) !==
      String(after[key] == null ? '' : after[key]);
  }).map(function(key) {
    return labels[key];
  });
}


/**
 * Loads a campus's weekly attendance report.
 */
function getWeeklyAttendanceReport(
  sessionToken,
  weekStart,
  campus
) {
  const user = requireAttendanceUser_(sessionToken);
  const selectedCampus = enforceAttendanceCampus_(user, campus);

  const startDate = parseAttendanceDate_(weekStart);
  requireMonday_(startDate);

  const startKey = attendanceDateKey_(startDate);
  const endKey = attendanceDateKey_(
    addAttendanceDays_(startDate, 4)
  );

  const students =
    getActiveAttendanceStudents_(selectedCampus);

  const reportSheet =
    getAttendanceSheet_('Attendance Weekly Reports');

  const report = sheetToObjects_(reportSheet)
    .find(function(item) {
      return (
        attendanceDateKey_(item['Week Start']) === startKey &&
        String(item['Campus'] || '')
          .trim()
          .toUpperCase() === selectedCampus
      );
    });

  const recordsSheet =
    getAttendanceSheet_('Attendance Records');

  const records = sheetToObjects_(recordsSheet)
    .filter(function(item) {
      return (
        attendanceDateKey_(item['Week Start']) === startKey &&
        String(item['Campus'] || '')
          .trim()
          .toUpperCase() === selectedCampus &&
        String(item['Status'] || '')
          .trim()
          .toUpperCase() === 'ABSENT'
      );
    });

  const groupedStudents = {};

  records.forEach(function(record) {
    const studentId = String(
      record['Student ID'] || ''
    ).trim();

    if (!groupedStudents[studentId]) {
      groupedStudents[studentId] = {
        studentId: studentId,

        fullName: String(
          record['Student Name'] || ''
        ).trim(),

        grade: String(
          record['Grade'] || ''
        ).trim(),

        campus: selectedCampus,
        absentDates: []
      };
    }

    groupedStudents[studentId].absentDates.push(
      attendanceDateKey_(record['Absence Date'])
    );
  });

  const absentStudents = Object.keys(groupedStudents)
    .map(function(studentId) {
      groupedStudents[studentId].absentDates.sort();
      return groupedStudents[studentId];
    })
    .sort(function(a, b) {
      return a.fullName.localeCompare(b.fullName);
    });

  return {
    success: true,
    weekStart: startKey,
    weekEnd: endKey,
    campus: selectedCampus,
    totalEnrollment: students.length,
    reportSubmitted: Boolean(report),

    schoolDays:
      report
        ? Number(report['School Days'] || 5)
        : 5,

    report:
      report
        ? attendanceReportForClient_(report)
        : null,

    absentStudents: absentStudents
  };
}


/**
 * Creates or updates a campus's weekly attendance report.
 *
 * Expected payload:
 *
 * {
 *   campus: "HES",
 *   weekStart: "2026-08-10",
 *   schoolDays: 5,
 *   absences: [
 *     {
 *       studentId: "12345",
 *       absentDates: [
 *         "2026-08-10",
 *         "2026-08-12"
 *       ]
 *     }
 *   ]
 * }
 */
function saveWeeklyAttendanceReport(
  sessionToken,
  payload
) {
  const user = requireAttendanceUser_(sessionToken);
  requireAttendanceEditor_(user);

  if (!payload || typeof payload !== 'object') {
    throw new Error(
      'The weekly attendance report was empty.'
    );
  }

  const campus = enforceAttendanceCampus_(
    user,
    payload.campus
  );

  const weekStart = parseAttendanceDate_(
    payload.weekStart
  );

  requireMonday_(weekStart);

  const weekStartKey =
    attendanceDateKey_(weekStart);

  const weekEnd =
    addAttendanceDays_(weekStart, 4);

  const weekEndKey =
    attendanceDateKey_(weekEnd);

  const schoolDays = Number(payload.schoolDays);

  if (
    !Number.isInteger(schoolDays) ||
    schoolDays < 1 ||
    schoolDays > 5
  ) {
    throw new Error(
      'School days must be a whole number from 1 through 5.'
    );
  }

  const students =
    getActiveAttendanceStudents_(campus);

  if (!students.length) {
    throw new Error(
      'No active students were found for ' +
      campus +
      '.'
    );
  }

  const studentMap = {};

  students.forEach(function(student) {
    studentMap[student.studentId] = student;
  });

  const desiredAbsences = {};

  const submitted = Array.isArray(payload.absences)
    ? payload.absences
    : [];

  submitted.forEach(function(entry) {
    const studentId = String(
      entry && entry.studentId || ''
    ).trim();

    if (!studentMap[studentId]) {
      throw new Error(
        'Student ID ' +
        studentId +
        ' is not active at ' +
        campus +
        '.'
      );
    }

    const dates = Array.isArray(entry.absentDates)
      ? entry.absentDates
      : [];

    dates.forEach(function(dateValue) {
      const absenceDate =
        parseAttendanceDate_(dateValue);

      const dateKey =
        attendanceDateKey_(absenceDate);

      if (
        dateKey < weekStartKey ||
        dateKey > weekEndKey
      ) {
        throw new Error(
          'Every absence must fall between Monday and Friday of the selected week.'
        );
      }

      desiredAbsences[
        studentId + '|' + dateKey
      ] = {
        student: studentMap[studentId],
        absenceDate: absenceDate,
        dateKey: dateKey
      };
    });
  });

  const totalEnrollment = students.length;

  const possibleDays =
    totalEnrollment * schoolDays;

  const absentDays =
    Object.keys(desiredAbsences).length;

  if (absentDays > possibleDays) {
    throw new Error(
      'Absent days cannot exceed possible attendance days.'
    );
  }

  const presentDays =
    possibleDays - absentDays;

  const attendanceRate =
    possibleDays
      ? presentDays / possibleDays
      : 0;

  const reportSheet =
    getAttendanceSheet_('Attendance Weekly Reports');

  const recordSheet =
    getAttendanceSheet_('Attendance Records');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  let saveResult;
  let affectedStudentIds = [];

  try {
    const existingReport =
      sheetToObjects_(reportSheet)
        .find(function(item) {
          return (
            attendanceDateKey_(
              item['Week Start']
            ) === weekStartKey &&
            String(item['Campus'] || '')
              .trim()
              .toUpperCase() === campus
          );
        });

    let reportId;

    if (existingReport) {
      reportId = String(
        existingReport['Report ID'] || ''
      ).trim();

      updateObjectRow_(
        reportSheet,
        existingReport._rowNumber,
        {
          'School Days': schoolDays,
          'Total Enrollment': totalEnrollment,
          'Possible Attendance Days': possibleDays,
          'Absent Days': absentDays,
          'Present Days': presentDays,
          'Attendance Rate': attendanceRate,
          'Updated At': new Date(),
          'Updated By': user.username
        }
      );
    } else {
      reportId = nextOutreachId_(
        'NEXT_ATTENDANCE_REPORT_NUMBER',
        'AWK',
        6
      );

      appendObjectRow_(reportSheet, {
        'Report ID': reportId,
        'Week Start': weekStart,
        'Week End': weekEnd,
        'Campus': campus,
        'School Days': schoolDays,
        'Total Enrollment': totalEnrollment,
        'Possible Attendance Days': possibleDays,
        'Absent Days': absentDays,
        'Present Days': presentDays,
        'Attendance Rate': attendanceRate,
        'Submitted At': new Date(),
        'Submitted By': user.username,
        'Updated At': new Date(),
        'Updated By': user.username
      });
    }

    const existingRecords =
      sheetToObjects_(recordSheet)
        .filter(function(item) {
          return (
            attendanceDateKey_(
              item['Week Start']
            ) === weekStartKey &&
            String(item['Campus'] || '')
              .trim()
              .toUpperCase() === campus &&
            String(item['Status'] || '')
              .trim()
              .toUpperCase() === 'ABSENT'
          );
        });

    const existingKeys = {};

    const affectedStudents = {};

    Object.keys(desiredAbsences)
      .forEach(function(key) {
        affectedStudents[
          key.split('|')[0]
        ] = true;
      });

    existingRecords.forEach(function(record) {
      affectedStudents[
        String(
          record['Student ID'] || ''
        ).trim()
      ] = true;

      const key =
        String(
          record['Student ID'] || ''
        ).trim() +
        '|' +
        attendanceDateKey_(
          record['Absence Date']
        );

      existingKeys[key] = record;
    });

    Object.keys(desiredAbsences)
      .forEach(function(key) {
        if (existingKeys[key]) {
          return;
        }

        const desired =
          desiredAbsences[key];

        appendObjectRow_(recordSheet, {
          'Attendance ID': nextOutreachId_(
            'NEXT_ATTENDANCE_RECORD_NUMBER',
            'ABS',
            7
          ),

          'Report ID': reportId,
          'Week Start': weekStart,
          'Week End': weekEnd,
          'Absence Date': desired.absenceDate,

          'Student ID':
            desired.student.studentId,

          'Student Name':
            desired.student.fullName,

          'Grade':
            desired.student.grade,

          'Campus': campus,
          'Status': 'ABSENT',
          'Recorded At': new Date(),
          'Recorded By': user.username,
          'Removed At': '',
          'Removed By': ''
        });
      });

    existingRecords.forEach(function(record) {
      const key =
        String(
          record['Student ID'] || ''
        ).trim() +
        '|' +
        attendanceDateKey_(
          record['Absence Date']
        );

      if (desiredAbsences[key]) {
        return;
      }

      updateObjectRow_(
        recordSheet,
        record._rowNumber,
        {
          'Status': 'REMOVED',
          'Removed At': new Date(),
          'Removed By': user.username
        }
      );
    });

    writeAuditLog_({
      userEmail: user.email,

      action:
        existingReport
          ? 'UPDATE_WEEKLY_ATTENDANCE'
          : 'SUBMIT_WEEKLY_ATTENDANCE',

      recordType:
        'Weekly Attendance Report',

      recordId: reportId,

      details: {
        weekStart: weekStartKey,
        campus: campus,
        schoolDays: schoolDays,
        totalEnrollment: totalEnrollment,
        absentDays: absentDays,
        attendanceRate: attendanceRate
      }
    });

    affectedStudentIds = Object.keys(
      affectedStudents
    ).filter(Boolean);

    saveResult = {
      success: true,
      reportId: reportId,
      weekStart: weekStartKey,
      weekEnd: weekEndKey,
      campus: campus,
      schoolDays: schoolDays,
      totalEnrollment: totalEnrollment,

      absentStudents:
        submitted.filter(function(entry) {
          return (
            entry &&
            Array.isArray(entry.absentDates) &&
            entry.absentDates.length
          );
        }).length,

      absentDays: absentDays,
      presentDays: presentDays,
      attendanceRate: attendanceRate,

      message:
        'Weekly attendance was saved successfully.'
    };
  } finally {
    lock.releaseLock();
  }

  /*
   * Check every student with an active absence record for this campus.
   * This catches students who reached a threshold before notification
   * automation was installed or whose qualifying absence occurred in a
   * different weekly report. The notification sheet prevents duplicates.
   */
  const notificationStudentIds = {};

  SpreadsheetApp.flush();

  affectedStudentIds.forEach(function(studentId) {
    const cleanId = String(studentId || '').trim();

    if (cleanId) {
      notificationStudentIds[cleanId] = true;
    }
  });

  sheetToObjects_(recordSheet)
    .forEach(function(record) {
      const recordCampus = String(
        record['Campus'] || ''
      ).trim().toUpperCase();

      const recordStatus = String(
        record['Status'] || ''
      ).trim().toUpperCase();

      const studentId = String(
        record['Student ID'] || ''
      ).trim();

      if (
        recordCampus === campus &&
        recordStatus === 'ABSENT' &&
        studentId
      ) {
        notificationStudentIds[studentId] = true;
      }
    });

  const notificationCandidateIds = Object.keys(
    notificationStudentIds
  );

  /*
   * Attendance must remain saved even if an email
   * provider or PDF conversion is temporarily unavailable.
   * The notification service logs failures and retries them
   * the next time attendance affecting that student is saved.
   */
  try {
    saveResult.notifications =
      processAttendanceThresholdNotifications_(
        notificationCandidateIds,
        weekEndKey,
        user.username
      );

    const notificationSummary =
      saveResult.notifications || {};

    saveResult.notificationStudentsChecked =
      notificationCandidateIds.length;

    const notificationsSent = Number(
      notificationSummary.sent || 0
    );

    const notificationsFailed = Number(
      notificationSummary.failed || 0
    );

    const fourthAbsencePacketsSent = Number(
      notificationSummary.fourthAbsencePacketsSent || 0
    );

    const fourthAbsenceStudentsBatched = Number(
      notificationSummary.fourthAbsenceStudentsBatched || 0
    );

    const studentEmailsSent = Number(
      notificationSummary.studentEmailsSent || 0
    );

    const studentEmailsFailed = Number(
      notificationSummary.studentEmailsFailed || 0
    );

    const studentEmailsSkipped = Number(
      notificationSummary.studentEmailsSkipped || 0
    );

    saveResult.fourthAbsencePacketsSent =
      fourthAbsencePacketsSent;

    saveResult.fourthAbsenceStudentsBatched =
      fourthAbsenceStudentsBatched;

    saveResult.studentEmailsSent = studentEmailsSent;
    saveResult.studentEmailsFailed = studentEmailsFailed;
    saveResult.studentEmailsSkipped = studentEmailsSkipped;

    if (notificationsSent > 0) {
      saveResult.message +=
        ' ' +
        notificationsSent +
        ' attendance notification email(s) sent.';
    }

    if (notificationsFailed > 0) {
      saveResult.message +=
        ' ' +
        notificationsFailed +
        ' notification email(s) failed. Check the Attendance Notifications tab.';
    }

    if (fourthAbsencePacketsSent > 0) {
      saveResult.message +=
        ' A fourth-absence print packet containing ' +
        fourthAbsenceStudentsBatched +
        ' student(s) was emailed to the campus recipients.';
    }

    if (studentEmailsSent > 0) {
      saveResult.message +=
        ' ' +
        studentEmailsSent +
        ' student attendance email(s) sent.';
    }

    if (studentEmailsSkipped > 0) {
      saveResult.message +=
        ' ' +
        studentEmailsSkipped +
        ' student email(s) not sent because the campus was excluded or a valid Student Email was not available.';
    }

    if (studentEmailsFailed > 0) {
      saveResult.message +=
        ' ' +
        studentEmailsFailed +
        ' student email(s) failed. Check the Attendance Notifications tab.';
    }

    if (
      notificationsSent === 0 &&
      notificationsFailed === 0 &&
      studentEmailsSent === 0 &&
      studentEmailsFailed === 0
    ) {
      saveResult.message +=
        ' No new attendance notification emails were required.';
    }

    writeAuditLog_({
      userEmail: user.email,
      action: 'ATTENDANCE_NOTIFICATION_RESULT',
      recordType: 'Weekly Attendance Report',
      recordId: saveResult.reportId,
      details: {
        weekStart: weekStartKey,
        campus: campus,
        studentsChecked: notificationCandidateIds.length,
        enabled: notificationSummary.enabled,
        semester: notificationSummary.semester || '',
        sent: Number(notificationSummary.sent || 0),
        failed: Number(notificationSummary.failed || 0),
        skipped: Number(notificationSummary.skipped || 0),
        fourthAbsencePacketsSent:
          fourthAbsencePacketsSent,
        fourthAbsenceStudentsBatched:
          fourthAbsenceStudentsBatched,
        studentEmailsSent: studentEmailsSent,
        studentEmailsFailed: studentEmailsFailed,
        studentEmailsSkipped: studentEmailsSkipped,
        message: notificationSummary.message || '',
        errors: notificationSummary.errors || []
      }
    });
  } catch (notificationError) {
    saveResult.notificationWarning = String(
      notificationError &&
      notificationError.message
        ? notificationError.message
        : notificationError
    );

    saveResult.message +=
      ' Attendance notification processing failed: ' +
      saveResult.notificationWarning;

    writeAuditLog_({
      userEmail: user.email,
      action: 'ATTENDANCE_NOTIFICATION_ERROR',
      recordType: 'Weekly Attendance Report',
      recordId: saveResult.reportId,
      details: {
        weekStart: weekStartKey,
        campus: campus,
        error: saveResult.notificationWarning
      }
    });
  }

  return saveResult;
}


/**
 * Returns attendance totals and student absence totals.
 */
function getAttendanceOverview(
  sessionToken,
  filters
) {
  const user =
    requireAttendanceUser_(sessionToken);

  const clean =
    filters && typeof filters === 'object'
      ? filters
      : {};

  const endDate = clean.endDate
    ? parseAttendanceDate_(clean.endDate)
    : parseAttendanceDate_(
        attendanceDateKey_(new Date())
      );

  const startDate = clean.startDate
    ? parseAttendanceDate_(clean.startDate)
    : addAttendanceDays_(endDate, -89);

  if (
    startDate.getTime() >
    endDate.getTime()
  ) {
    throw new Error(
      'The start date must be before the end date.'
    );
  }

  let campuses;

  if (!attendanceCanViewAllCampuses_(user)) {
    campuses = [user.campus];
  } else {
    const requested = String(
      clean.campus || ''
    )
      .trim()
      .toUpperCase();

    campuses = requested
      ? [
          enforceAttendanceCampus_(
            user,
            requested
          )
        ]
      : OUTREACH_CONFIG.CAMPUSES.slice();
  }

  const startKey =
    attendanceDateKey_(startDate);

  const endKey =
    attendanceDateKey_(endDate);

  const reports = sheetToObjects_(
    getAttendanceSheet_(
      'Attendance Weekly Reports'
    )
  ).filter(function(record) {
    const key = attendanceDateKey_(
      record['Week Start']
    );

    const campus = String(
      record['Campus'] || ''
    )
      .trim()
      .toUpperCase();

    return (
      key >= startKey &&
      key <= endKey &&
      campuses.indexOf(campus) !== -1
    );
  });

  const records = sheetToObjects_(
    getAttendanceSheet_(
      'Attendance Records'
    )
  ).filter(function(record) {
    const key = attendanceDateKey_(
      record['Absence Date']
    );

    const campus = String(
      record['Campus'] || ''
    )
      .trim()
      .toUpperCase();

    return (
      String(record['Status'] || '')
        .trim()
        .toUpperCase() === 'ABSENT' &&
      key >= startKey &&
      key <= endKey &&
      campuses.indexOf(campus) !== -1
    );
  });

  const campusSummaries =
    campuses.map(function(campus) {
      const campusReports =
        reports.filter(function(report) {
          return (
            String(report['Campus'] || '')
              .trim()
              .toUpperCase() === campus
          );
        });

      const possibleDays =
        sumAttendanceColumn_(
          campusReports,
          'Possible Attendance Days'
        );

      const presentDays =
        sumAttendanceColumn_(
          campusReports,
          'Present Days'
        );

      const absentDays =
        sumAttendanceColumn_(
          campusReports,
          'Absent Days'
        );

      return {
        campus: campus,
        submittedWeeks: campusReports.length,
        possibleDays: possibleDays,
        presentDays: presentDays,
        absentDays: absentDays,

        attendanceRate:
          possibleDays
            ? presentDays / possibleDays
            : 0
      };
    });

  const totals = {};

  records.forEach(function(record) {
    const studentId = String(
      record['Student ID'] || ''
    ).trim();

    if (!totals[studentId]) {
      totals[studentId] = {
        studentId: studentId,

        fullName: String(
          record['Student Name'] || ''
        ).trim(),

        grade: String(
          record['Grade'] || ''
        ).trim(),

        campus: String(
          record['Campus'] || ''
        )
          .trim()
          .toUpperCase(),

        absenceCount: 0,
        lastAbsence: ''
      };
    }

    totals[studentId].absenceCount += 1;

    const dateKey =
      attendanceDateKey_(
        record['Absence Date']
      );

    if (
      dateKey >
      totals[studentId].lastAbsence
    ) {
      totals[studentId].lastAbsence =
        dateKey;
    }
  });

  const students = Object.keys(totals)
    .map(function(studentId) {
      return totals[studentId];
    })
    .sort(function(a, b) {
      return (
        b.absenceCount - a.absenceCount ||
        a.fullName.localeCompare(b.fullName)
      );
    });

  const recentReports =
    reports
      .map(attendanceReportForClient_)
      .sort(function(a, b) {
        return (
          b.weekStart.localeCompare(
            a.weekStart
          ) ||
          a.campus.localeCompare(
            b.campus
          )
        );
      })
      .slice(0, 50);

  return {
    success: true,
    startDate: startKey,
    endDate: endKey,
    campuses: campuses,
    campusSummaries: campusSummaries,
    totalReports: reports.length,
    totalAbsences: records.length,
    students: students,
    recentReports: recentReports
  };
}


/**
 * Returns one student's complete absence history.
 */
function getAttendanceStudentHistory(
  sessionToken,
  studentId
) {
  const user =
    requireAttendanceUser_(sessionToken);

  const cleanId = String(
    studentId || ''
  ).trim();

  if (!cleanId) {
    throw new Error(
      'Select a student.'
    );
  }

  const student =
    findAttendanceStudentById_(cleanId);

  if (!student) {
    throw new Error(
      'The student could not be found.'
    );
  }

  enforceAttendanceCampus_(
    user,
    student.campus
  );

  const absences = sheetToObjects_(
    getAttendanceSheet_(
      'Attendance Records'
    )
  )
    .filter(function(record) {
      return (
        String(
          record['Student ID'] || ''
        ).trim() === cleanId &&
        String(record['Status'] || '')
          .trim()
          .toUpperCase() === 'ABSENT'
      );
    })
    .map(attendanceRecordForClient_)
    .sort(function(a, b) {
      return b.absenceDate.localeCompare(
        a.absenceDate
      );
    });

  return {
    success: true,
    student: student,
    absenceCount: absences.length,
    absences: absences
  };
}


/**
 * Confirms the user has attendance access.
 */
function requireAttendanceUser_(sessionToken) {
  const user =
    requireDashboardSession_(sessionToken);

  if (
    ATTENDANCE_ENTRY_ROLES.indexOf(
      user.role
    ) === -1
  ) {
    throw new Error(
      'Your account does not have attendance access.'
    );
  }

  if (
    ATTENDANCE_CAMPUS_SCOPED_ROLES.indexOf(user.role) !== -1 &&
    OUTREACH_CONFIG.CAMPUSES.indexOf(
      user.campus
    ) === -1
  ) {
    throw new Error(
      'Your attendance account does not have a valid campus assigned.'
    );
  }

  return user;
}


/**
 * Prevents attendance clerks from viewing another campus.
 */
function enforceAttendanceCampus_(
  user,
  campus
) {
  const selected = String(campus || '')
    .trim()
    .toUpperCase();

  if (
    OUTREACH_CONFIG.CAMPUSES.indexOf(
      selected
    ) === -1
  ) {
    throw new Error(
      'Select a valid campus.'
    );
  }

  if (
    ATTENDANCE_CAMPUS_SCOPED_ROLES.indexOf(user.role) !== -1 &&
    selected !== user.campus
  ) {
    throw new Error(
      'You can only access attendance for your assigned campus.'
    );
  }

  return selected;
}


function attendanceCanViewAllCampuses_(user) {
  return ATTENDANCE_CAMPUS_SCOPED_ROLES.indexOf(user.role) === -1;
}


function requireAttendanceEditor_(user) {
  if (ATTENDANCE_EDIT_ROLES.indexOf(user.role) === -1) {
    throw new Error('Your account has read-only attendance access.');
  }
  return user;
}


/**
 * Returns active students for one campus.
 *
 * Supports either:
 * - Name
 * - Student Name
 * - First Name and Last Name
 */
function getActiveAttendanceStudents_(
  campus
) {
  return sheetToObjects_(
    getAttendanceSheet_('Students')
  )
    .filter(function(record) {
      return (
        authBoolean_(record['Active']) &&
        String(record['Campus'] || '')
          .trim()
          .toUpperCase() === campus
      );
    })
    .map(attendanceStudentForClient_)
    .filter(function(student) {
      return Boolean(
        student.studentId &&
        student.fullName
      );
    })
    .sort(function(a, b) {
      return a.fullName.localeCompare(
        b.fullName
      );
    });
}


/**
 * Finds a student using the Student ID.
 */
function findAttendanceStudentById_(
  studentId
) {
  const record = sheetToObjects_(
    getAttendanceSheet_('Students')
  ).find(function(item) {
    return (
      String(
        item['Student ID'] || ''
      ).trim() === studentId
    );
  });

  return record
    ? attendanceStudentForClient_(record)
    : null;
}


/**
 * Converts a Students sheet row for the website.
 */
function attendanceStudentForClient_(
  record
) {
  const combined = String(
    record['Name'] ||
    record['Student Name'] ||
    ''
  ).trim();

  const separate = (
    String(
      record['First Name'] || ''
    ).trim() +
    ' ' +
    String(
      record['Last Name'] || ''
    ).trim()
  ).trim();

  return {
    studentId: String(
      record['Student ID'] || ''
    ).trim(),

    fullName: combined || separate,

    grade: String(
      record['Grade'] || ''
    ).trim(),

    dateOfBirth: attendanceDateKey_(
      record['Date of Birth']
    ),

    age: attendanceStudentAge_(
      record['Date of Birth'],
      new Date()
    ),

    isAdult: attendanceStudentAge_(
      record['Date of Birth'],
      new Date()
    ) >= 18,

    ferpaStatus: attendanceFerpaStatus_(
      record['Date of Birth'],
      new Date()
    ),

    campus: String(
      record['Campus'] || ''
    )
      .trim()
      .toUpperCase(),

    parentGuardianName: String(
      record['Parent/Guardian Name'] || ''
    ).trim(),

    parentGuardianPhone: String(
      record['Parent/Guardian Phone'] || ''
    ).trim(),

    studentEmail: String(
      record['Student Email'] || ''
    ).trim().toLowerCase(),

    streetAddress: String(
      record['Street Address'] || ''
    ).trim(),

    city: String(
      record['City'] || ''
    ).trim(),

    state: String(
      record['State'] || ''
    ).trim(),

    zipCode: String(
      record['ZIP Code'] || ''
    ).trim(),

    active: authBoolean_(record['Active'])
  };
}


/**
 * Calculates a student's age on the supplied reference date.
 * Returns null when the date of birth is missing or invalid.
 */
function attendanceStudentAge_(dateOfBirth, referenceDate) {
  const birthKey = attendanceDateKey_(dateOfBirth);
  const referenceKey = attendanceDateKey_(referenceDate || new Date());
  if (!birthKey || !referenceKey) return null;

  const birthParts = birthKey.split('-').map(Number);
  const referenceParts = referenceKey.split('-').map(Number);
  let age = referenceParts[0] - birthParts[0];
  if (
    referenceParts[1] < birthParts[1] ||
    (referenceParts[1] === birthParts[1] && referenceParts[2] < birthParts[2])
  ) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}


/**
 * FERPA rights generally transfer to a student at age 18.
 */
function attendanceFerpaStatus_(dateOfBirth, referenceDate) {
  const age = attendanceStudentAge_(dateOfBirth, referenceDate);
  if (age === null) return 'DOB MISSING - VERIFY AGE';
  return age >= 18
    ? 'ELIGIBLE STUDENT - AGE 18+'
    : 'MINOR STUDENT';
}


/**
 * Converts an Attendance Records row for the website.
 */
function attendanceRecordForClient_(
  record
) {
  return {
    attendanceId: String(
      record['Attendance ID'] || ''
    ).trim(),

    reportId: String(
      record['Report ID'] || ''
    ).trim(),

    weekStart: attendanceDateKey_(
      record['Week Start']
    ),

    weekEnd: attendanceDateKey_(
      record['Week End']
    ),

    absenceDate: attendanceDateKey_(
      record['Absence Date']
    ),

    studentId: String(
      record['Student ID'] || ''
    ).trim(),

    fullName: String(
      record['Student Name'] || ''
    ).trim(),

    grade: String(
      record['Grade'] || ''
    ).trim(),

    campus: String(
      record['Campus'] || ''
    )
      .trim()
      .toUpperCase()
  };
}


/**
 * Converts a Weekly Reports row for the website.
 */
function attendanceReportForClient_(
  record
) {
  return {
    reportId: String(
      record['Report ID'] || ''
    ).trim(),

    weekStart: attendanceDateKey_(
      record['Week Start']
    ),

    weekEnd: attendanceDateKey_(
      record['Week End']
    ),

    campus: String(
      record['Campus'] || ''
    )
      .trim()
      .toUpperCase(),

    schoolDays: Number(
      record['School Days'] || 0
    ),

    totalEnrollment: Number(
      record['Total Enrollment'] || 0
    ),

    possibleDays: Number(
      record[
        'Possible Attendance Days'
      ] || 0
    ),

    absentDays: Number(
      record['Absent Days'] || 0
    ),

    presentDays: Number(
      record['Present Days'] || 0
    ),

    attendanceRate: Number(
      record['Attendance Rate'] || 0
    ),

    submittedBy: String(
      record['Submitted By'] || ''
    ).trim(),

    updatedBy: String(
      record['Updated By'] || ''
    ).trim()
  };
}


/**
 * Returns a required attendance sheet.
 */
function getAttendanceSheet_(sheetName) {
  const sheet =
    getOutreachSpreadsheet_()
      .getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(
      'The "' +
      sheetName +
      '" tab could not be found.'
    );
  }

  return sheet;
}


/**
 * Adds values from a numeric sheet column.
 */
function sumAttendanceColumn_(
  records,
  header
) {
  return records.reduce(
    function(total, record) {
      return (
        total +
        Number(record[header] || 0)
      );
    },
    0
  );
}


/**
 * Returns the Monday of the current week.
 */
function attendanceCurrentMonday_() {
  const todayText =
    Utilities.formatDate(
      new Date(),
      OUTREACH_CONFIG.TIME_ZONE,
      'yyyy-MM-dd'
    );

  const today =
    parseAttendanceDate_(todayText);

  const day = today.getDay();

  const distance =
    day === 0
      ? -6
      : 1 - day;

  return attendanceDateKey_(
    addAttendanceDays_(
      today,
      distance
    )
  );
}


/**
 * Confirms that the selected week begins on Monday.
 */
function requireMonday_(date) {
  if (date.getDay() !== 1) {
    throw new Error(
      'Week Start must be a Monday.'
    );
  }
}


/**
 * Adds calendar days to a date.
 */
function addAttendanceDays_(
  date,
  days
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    12,
    0,
    0
  );
}


/**
 * Converts yyyy-MM-dd into a safe date.
 */
function parseAttendanceDate_(value) {
  const text = String(value || '').trim();

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      text
    );

  if (!match) {
    throw new Error(
      'Select a valid date.'
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(
      'Select a valid date.'
    );
  }

  return date;
}


/**
 * Converts a date into yyyy-MM-dd.
 */
function attendanceDateKey_(value) {
  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(value) ===
      '[object Date]' &&
    !Number.isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      OUTREACH_CONFIG.TIME_ZONE,
      'yyyy-MM-dd'
    );
  }

  const text = String(value || '').trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {
    return text;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? ''
    : Utilities.formatDate(
        parsed,
        OUTREACH_CONFIG.TIME_ZONE,
        'yyyy-MM-dd'
      );
}
