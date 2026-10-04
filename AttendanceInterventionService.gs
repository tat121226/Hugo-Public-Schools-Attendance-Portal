/**
 * Hugo Public Schools - Attendance Intervention case and timeline service.
 * Automatic entries are written by AttendanceNotifications.gs.
 * Staff notes are append-only; no edit or delete endpoint is provided.
 */

const ATTENDANCE_CASE_SHEET_ = 'Attendance Intervention Cases';
const ATTENDANCE_TIMELINE_SHEET_ = 'Attendance Intervention Timeline';

function requireAttendanceInterventionAccess_(user) {
  if (user.role === 'REPORTS_ONLY') {
    throw new Error('Your account has attendance summary access only.');
  }
  return user;
}

function getAttendanceInterventions(sessionToken, filters) {
  const user = requireAttendanceUser_(sessionToken);
  requireAttendanceInterventionAccess_(user);
  const clean = filters && typeof filters === 'object' ? filters : {};
  const settings = getAttendanceNotificationSettings_();
  const referenceDate = clean.referenceDate || attendanceDateKey_(new Date());
  const semester = getAttendanceNotificationSemester_(referenceDate, settings);

  if (!semester) {
    throw new Error('Select a date inside a configured semester.');
  }

  let campus = String(clean.campus || '').trim().toUpperCase();
  if (!attendanceCanViewAllCampuses_(user)) campus = user.campus;
  if (campus) campus = enforceAttendanceCampus_(user, campus);

  syncAttendanceInterventionCases_(semester, user.username);

  const cases = sheetToObjects_(getAttendanceSheet_(ATTENDANCE_CASE_SHEET_))
    .filter(function(record) {
      return String(record['Semester'] || '').trim() === semester.id &&
        (!campus || String(record['Campus'] || '').trim().toUpperCase() === campus);
    })
    .map(attendanceCaseForClient_)
    .sort(function(a, b) {
      return b.absenceCount - a.absenceCount ||
        b.lastActivity.localeCompare(a.lastActivity) ||
        a.studentName.localeCompare(b.studentName);
    });

  return {
    success: true,
    semester: semester,
    cases: cases,
    totals: {
      open: cases.filter(function(item) { return item.status === 'OPEN'; }).length,
      fourToFive: cases.filter(function(item) {
        return item.absenceCount >= 4 && item.absenceCount <= 5;
      }).length,
      sixToSeven: cases.filter(function(item) {
        return item.absenceCount >= 6 && item.absenceCount <= 7;
      }).length,
      eightPlus: cases.filter(function(item) { return item.absenceCount >= 8; }).length,
      ferpaAdult: cases.filter(function(item) { return item.isAdult; }).length,
      missingDob: cases.filter(function(item) { return !item.dateOfBirth; }).length
    }
  };
}

function getAttendanceInterventionCase(sessionToken, caseId) {
  const user = requireAttendanceUser_(sessionToken);
  requireAttendanceInterventionAccess_(user);
  const cleanId = String(caseId || '').trim();
  const record = sheetToObjects_(getAttendanceSheet_(ATTENDANCE_CASE_SHEET_))
    .find(function(item) {
      return String(item['Case ID'] || '').trim() === cleanId;
    });

  if (!record) throw new Error('The attendance intervention case was not found.');
  enforceAttendanceCampus_(user, String(record['Campus'] || '').trim());

  const timeline = sheetToObjects_(getAttendanceSheet_(ATTENDANCE_TIMELINE_SHEET_))
    .filter(function(item) {
      return String(item['Case ID'] || '').trim() === cleanId;
    })
    .map(attendanceTimelineForClient_)
    .sort(function(a, b) {
      return b.createdAt.localeCompare(a.createdAt);
    });

  const student = findAttendanceStudentById_(
    String(record['Student ID'] || '').trim()
  );

  return {
    success: true,
    case: attendanceCaseForClient_(record),
    student: student || {},
    timeline: timeline
  };
}

function addAttendanceInterventionNote(sessionToken, payload) {
  const user = requireAttendanceUser_(sessionToken);
  requireAttendanceInterventionAccess_(user);
  requireAttendanceEditor_(user);
  const clean = payload && typeof payload === 'object' ? payload : {};
  const caseId = String(clean.caseId || '').trim();
  const caseRecord = sheetToObjects_(getAttendanceSheet_(ATTENDANCE_CASE_SHEET_))
    .find(function(item) {
      return String(item['Case ID'] || '').trim() === caseId;
    });

  if (!caseRecord) throw new Error('The attendance intervention case was not found.');
  enforceAttendanceCampus_(user, String(caseRecord['Campus'] || '').trim());

  const title = String(clean.title || '').trim();
  const details = String(clean.details || '').trim();
  if (!title) throw new Error('Select a follow-up type.');
  if (!details) throw new Error('Enter follow-up notes.');
  if (details.length > 5000) throw new Error('Notes must be 5,000 characters or fewer.');

  const entry = appendAttendanceTimelineEntry_({
    caseId: caseId,
    semester: String(caseRecord['Semester'] || '').trim(),
    studentId: String(caseRecord['Student ID'] || '').trim(),
    studentName: String(caseRecord['Student Name'] || '').trim(),
    campus: String(caseRecord['Campus'] || '').trim(),
    eventDate: clean.eventDate || attendanceDateKey_(new Date()),
    eventType: 'STAFF_NOTE',
    threshold: '',
    title: title,
    details: details,
    contactMethod: clean.contactMethod,
    contactWith: clean.contactWith,
    outcome: clean.outcome,
    nextStep: clean.nextStep,
    followUpDate: clean.followUpDate,
    source: 'STAFF',
    relatedNotificationId: '',
    createdBy: user.username
  });

  touchAttendanceCase_(caseRecord._rowNumber, {
    lastActivityAt: new Date(),
    lastActivityBy: user.username
  });

  writeAuditLog_({
    userEmail: user.email,
    action: 'ADD_ATTENDANCE_INTERVENTION_NOTE',
    recordType: 'Attendance Intervention',
    recordId: caseId,
    details: { timelineId: entry.timelineId, title: title }
  });

  return getAttendanceInterventionCase(sessionToken, caseId);
}

function syncAttendanceInterventionCases_(semester, createdBy) {
  const records = sheetToObjects_(getAttendanceSheet_('Attendance Records'))
    .filter(function(record) {
      const key = attendanceDateKey_(record['Absence Date']);
      return String(record['Status'] || '').trim().toUpperCase() === 'ABSENT' &&
        key >= semester.start && key <= semester.end;
    });
  const totals = {};

  records.forEach(function(record) {
    const id = String(record['Student ID'] || '').trim();
    if (!totals[id]) totals[id] = {};
    totals[id][attendanceDateKey_(record['Absence Date'])] = true;
  });

  Object.keys(totals).forEach(function(studentId) {
    const count = Object.keys(totals[studentId]).length;
    if (count < 4) return;
    const student = findAttendanceStudentById_(studentId);
    if (student) ensureAttendanceInterventionCase_(student, semester, count, createdBy);
  });

  const caseSheet = getAttendanceSheet_(ATTENDANCE_CASE_SHEET_);
  sheetToObjects_(caseSheet)
    .filter(function(item) {
      return String(item['Semester'] || '').trim() === semester.id;
    })
    .forEach(function(item) {
      const studentId = String(item['Student ID'] || '').trim();
      const count = totals[studentId]
        ? Object.keys(totals[studentId]).length
        : 0;
      if (count >= 4) return;
      updateObjectRow_(caseSheet, item._rowNumber, {
        'Current Absence Count': count,
        'Current Stage': 'BELOW THRESHOLD - HISTORY RETAINED'
      });
    });

  const notificationSheet = getOutreachSpreadsheet_()
    .getSheetByName('Attendance Notifications');

  if (notificationSheet) {
    sheetToObjects_(notificationSheet)
      .filter(function(item) {
        return String(item['Semester'] || '').trim() === semester.id &&
          ['SENT', 'FAILED'].indexOf(
            String(item['Status'] || '').trim().toUpperCase()
          ) !== -1;
      })
      .forEach(function(item) {
        const studentId = String(item['Student ID'] || '').trim();
        const student = findAttendanceStudentById_(studentId);
        if (!student) return;
        student.absenceCount = Number(item['Absence Count'] || 0);

        const threshold = Number(item['Threshold'] || 0);
        const rule = typeof ATTENDANCE_THRESHOLD_RULES_ !== 'undefined'
          ? ATTENDANCE_THRESHOLD_RULES_[threshold]
          : null;

        recordAutomaticAttendanceIntervention_({
          semester: semester,
          threshold: threshold,
          thresholdDate: attendanceDateKey_(item['Threshold Absence Date']),
          student: student,
          title: rule ? rule.action : String(item['Subject'] || 'Attendance Notice'),
          details: 'Attendance threshold notification recorded. Status: ' +
            String(item['Status'] || '').trim().toUpperCase() + '.',
          recipients: String(item['Recipients'] || '')
            .split(',')
            .map(function(value) { return value.trim(); })
            .filter(Boolean),
          status: String(item['Status'] || '').trim().toUpperCase(),
          nextStep: typeof attendanceThresholdNextStep_ === 'function'
            ? attendanceThresholdNextStep_(threshold)
            : '',
          notificationId: String(item['Notification ID'] || '').trim(),
          createdBy: String(item['Created By'] || createdBy || 'SYSTEM').trim()
        });
      });
  }
}

function ensureAttendanceInterventionCase_(student, semester, absenceCount, createdBy) {
  const sheet = getAttendanceSheet_(ATTENDANCE_CASE_SHEET_);
  const existing = sheetToObjects_(sheet).find(function(item) {
    return String(item['Semester'] || '').trim() === semester.id &&
      String(item['Student ID'] || '').trim() === student.studentId;
  });
  const now = new Date();
  const values = {
    'Student Name': student.fullName,
    'Grade': student.grade,
    'Date of Birth': student.dateOfBirth ? parseAttendanceDate_(student.dateOfBirth) : '',
    'Age': student.age === null ? '' : student.age,
    'FERPA Status': student.ferpaStatus,
    'Campus': student.campus,
    'Parent/Guardian Name': student.parentGuardianName,
    'Parent/Guardian Phone': student.parentGuardianPhone,
    'Street Address': student.streetAddress,
    'City': student.city,
    'State': student.state,
    'ZIP Code': student.zipCode,
    'Current Absence Count': absenceCount,
    'Current Stage': attendanceInterventionStage_(absenceCount)
  };

  if (existing) {
    if (
      Number(existing['Current Absence Count'] || 0) !== Number(absenceCount) ||
      String(existing['Current Stage'] || '').trim() !==
        attendanceInterventionStage_(absenceCount)
    ) {
      values['Last Activity At'] = now;
      values['Last Activity By'] = createdBy || 'SYSTEM';
    }
    updateObjectRow_(sheet, existing._rowNumber, values);
    return String(existing['Case ID'] || '').trim();
  }

  const caseId = 'AIC-' + semester.id.replace(/[^A-Z0-9]/gi, '') + '-' +
    student.studentId;
  values['Case ID'] = caseId;
  values['Semester'] = semester.id;
  values['Student ID'] = student.studentId;
  values['Case Status'] = 'OPEN';
  values['Opened At'] = now;
  values['Opened By'] = createdBy || 'SYSTEM';
  values['Last Activity At'] = now;
  values['Last Activity By'] = createdBy || 'SYSTEM';
  appendObjectRow_(sheet, values);
  return caseId;
}

function recordAutomaticAttendanceIntervention_(data) {
  const student = data.student;
  const caseId = ensureAttendanceInterventionCase_(
    student, data.semester, student.absenceCount, data.createdBy
  );
  const sheet = getAttendanceSheet_(ATTENDANCE_TIMELINE_SHEET_);
  const alreadyExists = sheetToObjects_(sheet).some(function(item) {
    return String(item['Case ID'] || '').trim() === caseId &&
      String(item['Source'] || '').trim() === 'AUTOMATION' &&
      Number(item['Threshold']) === Number(data.threshold) &&
      String(item['Related Notification ID'] || '').trim() ===
        String(data.notificationId || '').trim() &&
      String(item['Outcome'] || '').trim() ===
        String(data.status || '').trim();
  });
  if (alreadyExists) return;

  appendAttendanceTimelineEntry_({
    caseId: caseId,
    semester: data.semester.id,
    studentId: student.studentId,
    studentName: student.fullName,
    campus: student.campus,
    eventDate: data.thresholdDate,
    eventType: 'AUTOMATIC_THRESHOLD',
    threshold: data.threshold,
    title: data.title,
    details: data.details,
    contactMethod: 'Email to authorized staff',
    contactWith: data.recipients.join(', '),
    outcome: data.status,
    nextStep: data.nextStep,
    followUpDate: '',
    source: 'AUTOMATION',
    relatedNotificationId: data.notificationId,
    createdBy: data.createdBy || 'SYSTEM'
  });
}

function appendAttendanceTimelineEntry_(data) {
  const sheet = getAttendanceSheet_(ATTENDANCE_TIMELINE_SHEET_);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const prior = sheet.getLastRow() > 1
      ? sheet.getRange(sheet.getLastRow(), 1, 1, sheet.getLastColumn())
          .getDisplayValues()[0]
      : [];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0];
    const hashIndex = headers.indexOf('Entry Hash');
    const previousHash = hashIndex === -1 ? '' : String(prior[hashIndex] || '');
    const now = new Date();
    const timelineId = 'AIT-' + Utilities.getUuid().split('-')[0].toUpperCase();
    const canonical = [
      timelineId, data.caseId, data.semester, data.studentId, data.eventDate,
      data.eventType, data.threshold, data.title, data.details, data.outcome,
      now.toISOString(), data.createdBy, previousHash
    ].join('|');
    const entryHash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, canonical
    ).map(function(byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ('0' + value.toString(16)).slice(-2);
    }).join('');

    appendObjectRow_(sheet, {
      'Timeline ID': timelineId,
      'Case ID': data.caseId,
      'Semester': data.semester,
      'Student ID': data.studentId,
      'Student Name': data.studentName,
      'Campus': data.campus,
      'Event Date': parseAttendanceDate_(data.eventDate),
      'Event Type': data.eventType,
      'Threshold': data.threshold,
      'Title': data.title,
      'Details': data.details,
      'Contact Method': String(data.contactMethod || '').trim(),
      'Contact With': String(data.contactWith || '').trim(),
      'Outcome': String(data.outcome || '').trim(),
      'Next Step': String(data.nextStep || '').trim(),
      'Follow-Up Date': data.followUpDate ? parseAttendanceDate_(data.followUpDate) : '',
      'Source': data.source,
      'Related Notification ID': data.relatedNotificationId,
      'Created At': now,
      'Created By': data.createdBy,
      'Previous Hash': previousHash,
      'Entry Hash': entryHash
    });
    return { timelineId: timelineId, entryHash: entryHash };
  } finally {
    lock.releaseLock();
  }
}

function touchAttendanceCase_(rowNumber, values) {
  updateObjectRow_(getAttendanceSheet_(ATTENDANCE_CASE_SHEET_), rowNumber, {
    'Last Activity At': values.lastActivityAt,
    'Last Activity By': values.lastActivityBy
  });
}

function attendanceInterventionStage_(count) {
  if (count >= 9) return 'NINTH ABSENCE';
  if (count === 8) return 'CREDIT/TRUANCY WARNING REVIEW';
  if (count === 7) return 'YOUTH SERVICES REFERRAL';
  if (count === 6) return 'HOME VISIT';
  if (count === 5) return 'PARENT CONTACT';
  return 'FOURTH ABSENCE LETTER';
}

function attendanceCaseForClient_(record) {
  return {
    caseId: String(record['Case ID'] || '').trim(),
    semester: String(record['Semester'] || '').trim(),
    studentId: String(record['Student ID'] || '').trim(),
    studentName: String(record['Student Name'] || '').trim(),
    grade: String(record['Grade'] || '').trim(),
    dateOfBirth: attendanceDateKey_(record['Date of Birth']),
    age: attendanceStudentAge_(record['Date of Birth'], new Date()),
    isAdult: attendanceStudentAge_(record['Date of Birth'], new Date()) >= 18,
    ferpaStatus: attendanceFerpaStatus_(record['Date of Birth'], new Date()),
    campus: String(record['Campus'] || '').trim(),
    parentGuardianName: String(record['Parent/Guardian Name'] || '').trim(),
    parentGuardianPhone: String(record['Parent/Guardian Phone'] || '').trim(),
    address: [record['Street Address'], record['City'], record['State'],
      record['ZIP Code']].filter(Boolean).join(', '),
    absenceCount: Number(record['Current Absence Count'] || 0),
    stage: String(record['Current Stage'] || '').trim(),
    status: String(record['Case Status'] || '').trim(),
    lastActivity: attendanceDateTimeKey_(record['Last Activity At'])
  };
}

function attendanceTimelineForClient_(record) {
  return {
    timelineId: String(record['Timeline ID'] || '').trim(),
    eventDate: attendanceDateKey_(record['Event Date']),
    eventType: String(record['Event Type'] || '').trim(),
    threshold: Number(record['Threshold'] || 0),
    title: String(record['Title'] || '').trim(),
    details: String(record['Details'] || '').trim(),
    contactMethod: String(record['Contact Method'] || '').trim(),
    contactWith: String(record['Contact With'] || '').trim(),
    outcome: String(record['Outcome'] || '').trim(),
    nextStep: String(record['Next Step'] || '').trim(),
    followUpDate: attendanceDateKey_(record['Follow-Up Date']),
    source: String(record['Source'] || '').trim(),
    createdAt: attendanceDateTimeKey_(record['Created At']),
    createdBy: String(record['Created By'] || '').trim()
  };
}

function attendanceDateTimeKey_(value) {
  if (!value) return '';
  const date = Object.prototype.toString.call(value) === '[object Date]'
    ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : Utilities.formatDate(
    date, OUTREACH_CONFIG.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss"
  );
}