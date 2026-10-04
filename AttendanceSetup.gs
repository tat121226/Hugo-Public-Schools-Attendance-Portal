/**
 * Hugo Student Outreach System
 * Attendance module spreadsheet setup
 */

const ATTENDANCE_CONFIG = Object.freeze({
  TIME_ZONE: 'America/Chicago',

  SHEETS: Object.freeze({
    STUDENTS: 'Students',
    DAILY_REPORTS: 'Attendance Reports',
    RECORDS: 'Attendance Records',
    USERS: 'Users',
    SETTINGS: 'Settings'
  }),

  CAMPUSES: Object.freeze([
    'HES',
    'HIS',
    'HMS',
    'HHS'
  ]),

  GRADES: Object.freeze([
    'Pre-K',
    'K',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12'
  ]),

  USER_ROLES: Object.freeze([
    'OUTREACH_COORDINATOR',
    'CAMPUS_ADMIN',
    'DISTRICT_ADMIN',
    'REPORTS_ONLY',
    'ATTENDANCE_CLERK'
  ])
});

const ATTENDANCE_SHEET_DEFINITIONS =
  Object.freeze({
    'Students': [
      'Student ID',
      'First Name',
      'Last Name',
      'Grade',
      'Campus',
      'Active',
      'Updated At'
    ],

    'Attendance Reports': [
      'Report ID',
      'Attendance Date',
      'Campus',
      'Total Enrollment',
      'Absent Count',
      'Present Count',
      'Attendance Rate',
      'Submitted At',
      'Submitted By',
      'Updated At',
      'Updated By'
    ],

    'Attendance Records': [
      'Attendance ID',
      'Report ID',
      'Attendance Date',
      'Student ID',
      'First Name',
      'Last Name',
      'Grade',
      'Campus',
      'Status',
      'Recorded At',
      'Recorded By',
      'Removed At',
      'Removed By'
    ]
  });

function setupAttendanceModule() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      'Open the system spreadsheet before running attendance setup.'
    );
  }

  spreadsheet.setSpreadsheetTimeZone(
    ATTENDANCE_CONFIG.TIME_ZONE
  );

  Object.keys(
    ATTENDANCE_SHEET_DEFINITIONS
  ).forEach(function(sheetName) {
    const sheet =
      getOrCreateAttendanceSheet_(
        spreadsheet,
        sheetName
      );

    ensureAttendanceHeaders_(
      sheet,
      ATTENDANCE_SHEET_DEFINITIONS[
        sheetName
      ]
    );

    formatAttendanceSheet_(
      sheet,
      ATTENDANCE_SHEET_DEFINITIONS[
        sheetName
      ].length
    );
  });

  addStudentRosterValidations_(
    spreadsheet
  );

  addAttendanceUserRoleValidation_(
    spreadsheet
  );

  seedAttendanceSettings_(
    spreadsheet
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      'SPREADSHEET_ID',
      spreadsheet.getId()
    );

  SpreadsheetApp.flush();

  SpreadsheetApp
    .getUi()
    .alert(
      'Attendance Module Ready',
      'The Students, Attendance Reports, and Attendance Records tabs have been created. Your next step is to paste the student roster into the Students tab.',
      SpreadsheetApp
        .getUi()
        .ButtonSet
        .OK
    );
}

function secureAttendanceClerkPasswords() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const usersSheet =
    spreadsheet.getSheetByName(
      ATTENDANCE_CONFIG.SHEETS.USERS
    );

  if (!usersSheet) {
    throw new Error(
      'The Users tab could not be found.'
    );
  }

  const values =
    usersSheet
      .getDataRange()
      .getValues();

  if (values.length < 2) {
    throw new Error(
      'No users were found.'
    );
  }

  const headers =
    values[0].map(function(value) {
      return String(value).trim();
    });

  const usernameColumn =
    headers.indexOf('Username');

  const passwordColumn =
    headers.indexOf('New Password');

  const hashColumn =
    headers.indexOf('Password Hash');

  const roleColumn =
    headers.indexOf('Role');

  const campusColumn =
    headers.indexOf('Campus');

  const updatedColumn =
    headers.indexOf('Updated At');

  const requiredColumns = [
    usernameColumn,
    passwordColumn,
    hashColumn,
    roleColumn,
    campusColumn,
    updatedColumn
  ];

  if (
    requiredColumns.some(function(index) {
      return index === -1;
    })
  ) {
    throw new Error(
      'The Users tab does not have the required columns.'
    );
  }

  let secured = 0;
  const errors = [];

  values
    .slice(1)
    .forEach(function(row, index) {
      const sheetRow =
        index + 2;

      const role =
        String(
          row[roleColumn] || ''
        )
          .trim()
          .toUpperCase();

      const newPassword =
        String(
          row[passwordColumn] || ''
        );

      if (
        role !== 'ATTENDANCE_CLERK' ||
        !newPassword
      ) {
        return;
      }

      const username =
        String(
          row[usernameColumn] || ''
        )
          .trim()
          .toLowerCase();

      const campus =
        String(
          row[campusColumn] || ''
        )
          .trim()
          .toUpperCase();

      try {
        if (
          !/^[a-z0-9][a-z0-9._-]{2,38}[a-z0-9]$/.test(
            username
          )
        ) {
          throw new Error(
            'Enter a valid username.'
          );
        }

        if (
          newPassword.length < 8
        ) {
          throw new Error(
            'Password must contain at least 8 characters.'
          );
        }

        if (
          ATTENDANCE_CONFIG
            .CAMPUSES
            .indexOf(campus) === -1
        ) {
          throw new Error(
            'Attendance clerks must have HES, HIS, HMS, or HHS assigned.'
          );
        }

        usersSheet
          .getRange(
            sheetRow,
            usernameColumn + 1
          )
          .setValue(username);

        usersSheet
          .getRange(
            sheetRow,
            passwordColumn + 1
          )
          .clearContent();

        usersSheet
          .getRange(
            sheetRow,
            hashColumn + 1
          )
          .setValue(
            hashAttendancePassword_(
              newPassword
            )
          );

        usersSheet
          .getRange(
            sheetRow,
            updatedColumn + 1
          )
          .setValue(new Date());

        secured += 1;
      } catch (error) {
        errors.push(
          'Row ' +
          sheetRow +
          ': ' +
          error.message
        );
      }
    });

  SpreadsheetApp
    .getUi()
    .alert(
      'Attendance Passwords Secured',
      'Passwords secured: ' +
      secured +
      '\nErrors: ' +
      errors.length +
      (
        errors.length
          ? '\n\n' +
            errors.join('\n')
          : '\n\nReadable passwords were cleared from processed rows.'
      ),
      SpreadsheetApp
        .getUi()
        .ButtonSet
        .OK
    );
}

function hashAttendancePassword_(
  password
) {
  const rawHash =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(password || '')
    );

  return rawHash
    .map(function(byte) {
      const value =
        byte < 0
          ? byte + 256
          : byte;

      return (
        '0' +
        value.toString(16)
      ).slice(-2);
    })
    .join('');
}

function getOrCreateAttendanceSheet_(
  spreadsheet,
  sheetName
) {
  return (
    spreadsheet.getSheetByName(
      sheetName
    ) ||
    spreadsheet.insertSheet(
      sheetName
    )
  );
}

function ensureAttendanceHeaders_(
  sheet,
  requiredHeaders
) {
  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  const existingHeaders =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0];

  const hasHeaders =
    existingHeaders.some(
      function(value) {
        return String(value).trim() !== '';
      }
    );

  if (!hasHeaders) {
    sheet
      .getRange(
        1,
        1,
        1,
        requiredHeaders.length
      )
      .setValues([
        requiredHeaders
      ]);

    return;
  }

  const missingHeaders =
    requiredHeaders.filter(
      function(header) {
        return (
          existingHeaders.indexOf(
            header
          ) === -1
        );
      }
    );

  if (missingHeaders.length) {
    sheet
      .getRange(
        1,
        sheet.getLastColumn() + 1,
        1,
        missingHeaders.length
      )
      .setValues([
        missingHeaders
      ]);
  }
}

function formatAttendanceSheet_(
  sheet,
  headerCount
) {
  sheet
    .getRange(
      1,
      1,
      1,
      headerCount
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
    column <= headerCount;
    column += 1
  ) {
    sheet.setColumnWidth(
      column,
      150
    );
  }
}

function addStudentRosterValidations_(
  spreadsheet
) {
  const sheet =
    spreadsheet.getSheetByName(
      ATTENDANCE_CONFIG
        .SHEETS
        .STUDENTS
    );

  if (!sheet) {
    return;
  }

  const rows =
    Math.max(
      sheet.getMaxRows() - 1,
      1
    );

  const gradeColumn =
    findAttendanceHeaderColumn_(
      sheet,
      'Grade'
    );

  const campusColumn =
    findAttendanceHeaderColumn_(
      sheet,
      'Campus'
    );

  const activeColumn =
    findAttendanceHeaderColumn_(
      sheet,
      'Active'
    );

  const studentIdColumn =
    findAttendanceHeaderColumn_(
      sheet,
      'Student ID'
    );

  setAttendanceListValidation_(
    sheet.getRange(
      2,
      gradeColumn,
      rows,
      1
    ),
    ATTENDANCE_CONFIG.GRADES
  );

  setAttendanceListValidation_(
    sheet.getRange(
      2,
      campusColumn,
      rows,
      1
    ),
    ATTENDANCE_CONFIG.CAMPUSES
  );

  sheet
    .getRange(
      2,
      activeColumn,
      rows,
      1
    )
    .insertCheckboxes();

  sheet
    .getRange(
      2,
      studentIdColumn,
      rows,
      1
    )
    .setNumberFormat('@');
}

function addAttendanceUserRoleValidation_(
  spreadsheet
) {
  const sheet =
    spreadsheet.getSheetByName(
      ATTENDANCE_CONFIG
        .SHEETS
        .USERS
    );

  if (!sheet) {
    return;
  }

  const rows =
    Math.max(
      sheet.getMaxRows() - 1,
      1
    );

  const roleColumn =
    findAttendanceHeaderColumn_(
      sheet,
      'Role'
    );

  const campusColumn =
    findAttendanceHeaderColumn_(
      sheet,
      'Campus'
    );

  setAttendanceListValidation_(
    sheet.getRange(
      2,
      roleColumn,
      rows,
      1
    ),
    ATTENDANCE_CONFIG.USER_ROLES
  );

  setAttendanceListValidation_(
    sheet.getRange(
      2,
      campusColumn,
      rows,
      1
    ),
    ['ALL'].concat(
      ATTENDANCE_CONFIG.CAMPUSES
    )
  );
}

function seedAttendanceSettings_(
  spreadsheet
) {
  const sheet =
    spreadsheet.getSheetByName(
      ATTENDANCE_CONFIG
        .SHEETS
        .SETTINGS
    );

  if (!sheet) {
    throw new Error(
      'The Settings tab could not be found.'
    );
  }

  const existing =
    sheet.getLastRow() < 2
      ? []
      : sheet
          .getRange(
            2,
            1,
            sheet.getLastRow() - 1,
            1
          )
          .getDisplayValues()
          .map(function(row) {
            return String(
              row[0]
            ).trim();
          });

  const settings = [
    [
      'NEXT_ATTENDANCE_REPORT_NUMBER',
      '1',
      'Counter used to create attendance report IDs'
    ],
    [
      'NEXT_ATTENDANCE_RECORD_NUMBER',
      '1',
      'Counter used to create student absence record IDs'
    ]
  ];

  const rows =
    settings.filter(function(row) {
      return (
        existing.indexOf(
          row[0]
        ) === -1
      );
    });

  if (rows.length) {
    sheet
      .getRange(
        sheet.getLastRow() + 1,
        1,
        rows.length,
        rows[0].length
      )
      .setValues(rows);
  }
}

function setAttendanceListValidation_(
  range,
  values
) {
  const rule =
    SpreadsheetApp
      .newDataValidation()
      .requireValueInList(
        Array.prototype.slice.call(
          values
        ),
        true
      )
      .setAllowInvalid(false)
      .build();

  range.setDataValidation(rule);
}

function findAttendanceHeaderColumn_(
  sheet,
  header
) {
  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0];

  const index =
    headers.indexOf(header);

  if (index === -1) {
    throw new Error(
      'Missing header "' +
      header +
      '" on sheet "' +
      sheet.getName() +
      '".'
    );
  }

  return index + 1;
}