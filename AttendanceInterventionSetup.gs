/**
 * Hugo Public Schools - Attendance Intervention setup.
 * Run setupAttendanceInterventionManager() one time.
 */

const ATTENDANCE_CASE_HEADERS = Object.freeze([
  'Case ID', 'Semester', 'Student ID', 'Student Name', 'Grade', 'Date of Birth',
  'Age', 'FERPA Status', 'Campus',
  'Parent/Guardian Name', 'Parent/Guardian Phone', 'Street Address', 'City',
  'State', 'ZIP Code', 'Current Absence Count', 'Current Stage', 'Case Status',
  'Opened At', 'Opened By', 'Last Activity At', 'Last Activity By'
]);

const ATTENDANCE_TIMELINE_HEADERS = Object.freeze([
  'Timeline ID', 'Case ID', 'Semester', 'Student ID', 'Student Name', 'Campus',
  'Event Date', 'Event Type', 'Threshold', 'Title', 'Details', 'Contact Method',
  'Contact With', 'Outcome', 'Next Step', 'Follow-Up Date', 'Source',
  'Related Notification ID', 'Created At', 'Created By', 'Previous Hash',
  'Entry Hash'
]);

function setupAttendanceInterventionManager() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Open the system spreadsheet before running setup.');
  }

  ensureAttendanceStudentContactHeaders_(spreadsheet);
  ensureAttendanceInterventionSheet_(
    spreadsheet, 'Attendance Intervention Cases', ATTENDANCE_CASE_HEADERS
  );
  ensureAttendanceInterventionSheet_(
    spreadsheet, 'Attendance Intervention Timeline', ATTENDANCE_TIMELINE_HEADERS
  );

  SpreadsheetApp.flush();
  return {
    success: true,
    message: 'Attendance Intervention Manager is ready.'
  };
}

function ensureAttendanceStudentContactHeaders_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Students');
  if (!sheet) throw new Error('The Students tab could not be found.');

  const required = [
    'Student ID', 'Name', 'Grade', 'Date of Birth', 'Campus', 'Parent/Guardian Name',
    'Parent/Guardian Phone', 'Street Address', 'City', 'State', 'ZIP Code',
    'Active', 'Updated At'
  ];

  const headers = sheet.getRange(
    1, 1, 1, Math.max(sheet.getLastColumn(), 1)
  ).getDisplayValues()[0].map(function(value) {
    return String(value || '').trim();
  });

  const missing = required.filter(function(header) {
    return headers.indexOf(header) === -1;
  });

  if (missing.length) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length)
      .setValues([missing]);
  }
}

function ensureAttendanceInterventionSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const current = sheet.getLastRow() ? sheet.getRange(
    1, 1, 1, Math.max(sheet.getLastColumn(), 1)
  ).getDisplayValues()[0].map(function(value) {
    return String(value || '').trim();
  }) : [];

  const missing = headers.filter(function(header) {
    return current.indexOf(header) === -1;
  });

  if (!current.some(Boolean)) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (missing.length) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length)
      .setValues([missing]);
  }

  const count = sheet.getLastColumn();
  sheet.getRange(1, 1, 1, count)
    .setBackground('#111111')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 34);
  for (let column = 1; column <= count; column += 1) {
    sheet.setColumnWidth(column, 155);
  }
}

function diagnoseAttendanceInterventionManager() {
  const spreadsheet = getOutreachSpreadsheet_();
  const requiredSheets = [
    'Students',
    'Attendance Records',
    'Attendance Notifications',
    'Attendance Intervention Cases',
    'Attendance Intervention Timeline'
  ];
  const sheets = {};

  requiredSheets.forEach(function(name) {
    const sheet = spreadsheet.getSheetByName(name);
    sheets[name] = sheet
      ? { exists: true, rows: Math.max(sheet.getLastRow() - 1, 0) }
      : { exists: false, rows: 0 };
  });

  const studentSheet = spreadsheet.getSheetByName('Students');
  const requiredStudentHeaders = [
    'Student ID', 'Name', 'Grade', 'Date of Birth', 'Campus', 'Parent/Guardian Name',
    'Parent/Guardian Phone', 'Street Address', 'City', 'State', 'ZIP Code',
    'Active', 'Updated At'
  ];
  const studentHeaders = studentSheet
    ? studentSheet.getRange(1, 1, 1, Math.max(studentSheet.getLastColumn(), 1))
        .getDisplayValues()[0]
        .map(function(value) { return String(value || '').trim(); })
    : [];

  const result = {
    success: requiredSheets.every(function(name) { return sheets[name].exists; }),
    sheets: sheets,
    missingStudentHeaders: requiredStudentHeaders.filter(function(header) {
      return studentHeaders.indexOf(header) === -1;
    })
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}
