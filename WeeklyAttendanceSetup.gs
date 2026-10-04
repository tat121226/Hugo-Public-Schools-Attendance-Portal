/**
 * Converts the attendance module from daily reports
 * to weekly Monday-Friday attendance reports.
 */

const WEEKLY_ATTENDANCE_REPORT_HEADERS =
  Object.freeze([
    'Report ID',
    'Week Start',
    'Week End',
    'Campus',
    'School Days',
    'Total Enrollment',
    'Possible Attendance Days',
    'Absent Days',
    'Present Days',
    'Attendance Rate',
    'Submitted At',
    'Submitted By',
    'Updated At',
    'Updated By'
  ]);

const WEEKLY_ATTENDANCE_RECORD_HEADERS =
  Object.freeze([
    'Attendance ID',
    'Report ID',
    'Week Start',
    'Week End',
    'Absence Date',
    'Student ID',
    'Student Name',
    'Grade',
    'Campus',
    'Status',
    'Recorded At',
    'Recorded By',
    'Removed At',
    'Removed By'
  ]);

function setupWeeklyAttendanceModule() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      'Open the system spreadsheet before running weekly attendance setup.'
    );
  }

  let weeklySheet =
    spreadsheet.getSheetByName(
      'Attendance Weekly Reports'
    );

  const dailySheet =
    spreadsheet.getSheetByName(
      'Attendance Daily Reports'
    );

  if (!weeklySheet) {
    if (
      dailySheet &&
      dailySheet.getLastRow() <= 1
    ) {
      dailySheet.setName(
        'Attendance Weekly Reports'
      );

      weeklySheet =
        dailySheet;
    } else {
      weeklySheet =
        spreadsheet.insertSheet(
          'Attendance Weekly Reports'
        );
    }
  }

  let recordsSheet =
    spreadsheet.getSheetByName(
      'Attendance Records'
    );

  if (!recordsSheet) {
    recordsSheet =
      spreadsheet.insertSheet(
        'Attendance Records'
      );
  }

  prepareWeeklyAttendanceSheet_(
    weeklySheet,
    WEEKLY_ATTENDANCE_REPORT_HEADERS
  );

  prepareWeeklyAttendanceSheet_(
    recordsSheet,
    WEEKLY_ATTENDANCE_RECORD_HEADERS
  );

  seedWeeklyAttendanceSettings_(
    spreadsheet
  );

  return {
  success: true,
  message:
    'The weekly attendance sheets are ready.'
};
}

function prepareWeeklyAttendanceSheet_(
  sheet,
  requiredHeaders
) {
  if (sheet.getLastRow() <= 1) {
    sheet.clear();

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
  } else {
    const existingHeaders =
      sheet
        .getRange(
          1,
          1,
          1,
          sheet.getLastColumn()
        )
        .getDisplayValues()[0]
        .map(function(value) {
          return String(
            value || ''
          ).trim();
        });

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

  const headerCount =
    sheet.getLastColumn();

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

  formatWeeklyAttendanceSheet_(
    sheet
  );
}

function formatWeeklyAttendanceSheet_(
  sheet
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

  const rowCount =
    Math.max(
      sheet.getMaxRows() - 1,
      1
    );

  [
    'Week Start',
    'Week End',
    'Absence Date'
  ].forEach(function(header) {
    const index =
      headers.indexOf(header);

    if (index !== -1) {
      sheet
        .getRange(
          2,
          index + 1,
          rowCount,
          1
        )
        .setNumberFormat(
          'm/d/yyyy'
        );
    }
  });

  [
    'Submitted At',
    'Updated At',
    'Recorded At',
    'Removed At'
  ].forEach(function(header) {
    const index =
      headers.indexOf(header);

    if (index !== -1) {
      sheet
        .getRange(
          2,
          index + 1,
          rowCount,
          1
        )
        .setNumberFormat(
          'm/d/yyyy h:mm am/pm'
        );
    }
  });

  const rateIndex =
    headers.indexOf(
      'Attendance Rate'
    );

  if (rateIndex !== -1) {
    sheet
      .getRange(
        2,
        rateIndex + 1,
        rowCount,
        1
      )
      .setNumberFormat(
        '0.0%'
      );
  }

  const studentIdIndex =
    headers.indexOf(
      'Student ID'
    );

  if (studentIdIndex !== -1) {
    sheet
      .getRange(
        2,
        studentIdIndex + 1,
        rowCount,
        1
      )
      .setNumberFormat('@');
  }
}

function seedWeeklyAttendanceSettings_(
  spreadsheet
) {
  const sheet =
    spreadsheet.getSheetByName(
      'Settings'
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
              row[0] || ''
            ).trim();
          });

  const settings = [
    [
      'NEXT_ATTENDANCE_REPORT_NUMBER',
      '1',
      'Counter used to create weekly attendance report IDs'
    ],
    [
      'NEXT_ATTENDANCE_RECORD_NUMBER',
      '1',
      'Counter used to create student absence records'
    ]
  ];

  const missing =
    settings.filter(
      function(row) {
        return (
          existing.indexOf(
            row[0]
          ) === -1
        );
      }
    );

  if (missing.length) {
    sheet
      .getRange(
        sheet.getLastRow() + 1,
        1,
        missing.length,
        3
      )
      .setValues(
        missing
      );
  }
}