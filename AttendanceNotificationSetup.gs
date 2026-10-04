/**
 * Hugo Public Schools
 * Attendance threshold notification setup
 *
 * Add this as a NEW Apps Script file and run
 * setupAttendanceNotificationAutomation() one time.
 */

const ATTENDANCE_NOTIFICATION_HEADERS = Object.freeze([
  'Notification ID',
  'Semester',
  'Threshold',
  'Student ID',
  'Student Name',
  'Grade',
  'Campus',
  'Absence Count',
  'Threshold Absence Date',
  'Recipients',
  'Subject',
  'Status',
  'Attempt Started At',
  'Sent At',
  'Error',
  'Created At',
  'Created By',
  'Letter File Name',
  'Detail Report File Name',
  'Student Email',
  'Student Email Subject',
  'Student Email Status',
  'Student Email Sent At',
  'Student Email Error'
]);

function setupAttendanceNotificationAutomation() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      'Open the system spreadsheet before running notification setup.'
    );
  }

  spreadsheet.setSpreadsheetTimeZone(
    'America/Chicago'
  );

  const notificationSheet =
    spreadsheet.getSheetByName(
      'Attendance Notifications'
    ) || spreadsheet.insertSheet(
      'Attendance Notifications'
    );

  ensureAttendanceNotificationHeaders_(
    notificationSheet
  );

  formatAttendanceNotificationSheet_(
    notificationSheet
  );

  seedAttendanceNotificationSettings_(
    spreadsheet
  );

  SpreadsheetApp.flush();

  return {
    success: true,
    message:
      'Attendance notification automation is configured.'
  };
}

function ensureAttendanceNotificationHeaders_(
  sheet
) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(
      1,
      1,
      1,
      ATTENDANCE_NOTIFICATION_HEADERS.length
    ).setValues([
      ATTENDANCE_NOTIFICATION_HEADERS
    ]);

    return;
  }

  const existingHeaders = sheet
    .getRange(
      1,
      1,
      1,
      Math.max(sheet.getLastColumn(), 1)
    )
    .getDisplayValues()[0]
    .map(function(value) {
      return String(value || '').trim();
    });

  const missingHeaders =
    ATTENDANCE_NOTIFICATION_HEADERS.filter(
      function(header) {
        return existingHeaders.indexOf(header) === -1;
      }
    );

  if (missingHeaders.length) {
    sheet.getRange(
      1,
      sheet.getLastColumn() + 1,
      1,
      missingHeaders.length
    ).setValues([
      missingHeaders
    ]);
  }
}

function formatAttendanceNotificationSheet_(
  sheet
) {
  const columnCount = sheet.getLastColumn();

  sheet.getRange(
    1,
    1,
    1,
    columnCount
  )
    .setBackground('#111111')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 34);

  for (
    let column = 1;
    column <= columnCount;
    column += 1
  ) {
    sheet.setColumnWidth(column, 155);
  }

  const headers = sheet.getRange(
    1,
    1,
    1,
    columnCount
  ).getDisplayValues()[0];

  [
    'Threshold Absence Date'
  ].forEach(function(header) {
    const index = headers.indexOf(header);

    if (index !== -1) {
      sheet.getRange(
        2,
        index + 1,
        Math.max(sheet.getMaxRows() - 1, 1),
        1
      ).setNumberFormat('m/d/yyyy');
    }
  });

  [
    'Attempt Started At',
    'Sent At',
    'Created At',
    'Student Email Sent At'
  ].forEach(function(header) {
    const index = headers.indexOf(header);

    if (index !== -1) {
      sheet.getRange(
        2,
        index + 1,
        Math.max(sheet.getMaxRows() - 1, 1),
        1
      ).setNumberFormat('m/d/yyyy h:mm am/pm');
    }
  });
}

function seedAttendanceNotificationSettings_(
  spreadsheet
) {
  const sheet = spreadsheet.getSheetByName(
    'Settings'
  );

  if (!sheet) {
    throw new Error(
      'The Settings tab could not be found.'
    );
  }

  const existing = sheet.getLastRow() < 2
    ? []
    : sheet.getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        1
      )
      .getDisplayValues()
      .map(function(row) {
        return String(row[0] || '').trim();
      });

  const settings = [
    [
      'ATTENDANCE_NOTIFICATIONS_ENABLED',
      'TRUE',
      'TRUE sends threshold emails; FALSE pauses them'
    ],
    [
      'ATTENDANCE_STUDENT_EMAILS_ENABLED',
      'TRUE',
      'TRUE sends a separate student-safe email at thresholds 4 through 9'
    ],
    [
      'ATTENDANCE_STUDENT_EMAIL_CAMPUSES',
      'HIS;HMS;HHS',
      'Campuses whose students receive automated attendance emails; HES is intentionally excluded'
    ],
    [
      'ATTENDANCE_FIRST_SEMESTER_START',
      '2026-08-06',
      'First semester beginning date'
    ],
    [
      'ATTENDANCE_FIRST_SEMESTER_END',
      '2026-12-17',
      'First semester ending date'
    ],
    [
      'ATTENDANCE_SECOND_SEMESTER_START',
      '2027-01-05',
      'Second semester beginning date'
    ],
    [
      'ATTENDANCE_SECOND_SEMESTER_END',
      '2027-05-20',
      'Second semester ending date'
    ],
    [
      'NEXT_ATTENDANCE_NOTIFICATION_NUMBER',
      '1',
      'Counter used to create attendance notification IDs'
    ],
    [
      'ATTENDANCE_HES_CONTACT_NAME',
      'Sarah Heady',
      'HES attendance contact'
    ],
    [
      'ATTENDANCE_HES_CONTACT_EMAIL',
      'sheady@hugoschools.com',
      'HES attendance contact email'
    ],
    [
      'ATTENDANCE_HES_ADMIN_NAMES',
      'Shelby Dawes',
      'HES principal names separated by semicolons'
    ],
    [
      'ATTENDANCE_HES_ADMIN_EMAILS',
      'sdawes@hugoschools.com',
      'HES principal emails separated by semicolons'
    ],
    [
      'ATTENDANCE_HIS_CONTACT_NAME',
      'Tammie Oakes',
      'HIS attendance contact'
    ],
    [
      'ATTENDANCE_HIS_CONTACT_EMAIL',
      'toakes@hugoschools.com',
      'HIS attendance contact email'
    ],
    [
      'ATTENDANCE_HIS_ADMIN_NAMES',
      'Vivian Shanklin',
      'HIS principal names separated by semicolons'
    ],
    [
      'ATTENDANCE_HIS_ADMIN_EMAILS',
      'vshanklin@hugoschools.com',
      'HIS principal emails separated by semicolons'
    ],
    [
      'ATTENDANCE_HMS_CONTACT_NAME',
      'Alpha Benson',
      'HMS attendance contact'
    ],
    [
      'ATTENDANCE_HMS_CONTACT_EMAIL',
      'abenson@hugoschools.com',
      'HMS attendance contact email'
    ],
    [
      'ATTENDANCE_HMS_ADMIN_NAMES',
      'Kendra Taylor',
      'HMS principal names separated by semicolons'
    ],
    [
      'ATTENDANCE_HMS_ADMIN_EMAILS',
      'ktaylor@hugoschools.com',
      'HMS principal emails separated by semicolons'
    ],
    [
      'ATTENDANCE_HHS_CONTACT_NAME',
      'Kaylea Bailey',
      'HHS attendance contact'
    ],
    [
      'ATTENDANCE_HHS_CONTACT_EMAIL',
      'kbailey@hugoschools.com',
      'HHS attendance contact email'
    ],
    [
      'ATTENDANCE_HHS_ADMIN_NAMES',
      'Sammy Drinkard;Jana Lampton',
      'HHS principal names separated by semicolons'
    ],
    [
      'ATTENDANCE_HHS_ADMIN_EMAILS',
      'sdrinkard@hugoschools.com;jlampton@hugoschools.com',
      'HHS principal emails separated by semicolons'
    ],
    [
      'ATTENDANCE_DISTRICT_ADMIN_NAME',
      'Madison Debo',
      'District Student Support Specialist'
    ],
    [
      'ATTENDANCE_DISTRICT_ADMIN_EMAIL',
      'mdebo@hugoschools.com',
      'District Student Support Specialist email'
    ],
    [
      'ATTENDANCE_SRO_NAMES',
      'Ron Miller;Kayla Buchanan',
      'SRO names separated by semicolons'
    ],
    [
      'ATTENDANCE_SRO_EMAILS',
      'rmiller@hugoschools.com;kbuchanan@hugoschools.com',
      'SRO emails separated by semicolons'
    ]
  ];

  const missing = settings.filter(
    function(row) {
      return existing.indexOf(row[0]) === -1;
    }
  );

  if (missing.length) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      missing.length,
      3
    ).setValues(missing);
  }
}
