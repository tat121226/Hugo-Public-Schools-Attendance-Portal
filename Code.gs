/**
 * Hugo Student Outreach Referral System
 * Phase 1: Spreadsheet database setup
 *
 * Add this file to a Google Apps Script project that is bound to a new,
 * blank Google Sheet. Run setupStudentOutreachSystem() one time.
 */

const OUTREACH_CONFIG = Object.freeze({
  APP_NAME: 'Student Support Referral System',
  ALLOWED_DOMAIN: 'hugoschools.com',
  TIME_ZONE: 'America/Chicago',
  ID_PREFIX: 'SR',
  SHEETS: Object.freeze({
    REFERRALS: 'Referrals',
    CASE_UPDATES: 'Case Updates',
    USERS: 'Users',
    CAMPUSES: 'Campuses',
    NEED_CATEGORIES: 'Need Categories',
    NOTIFICATIONS: 'Email Notifications',
    AUDIT_LOG: 'Audit Log',
    SETTINGS: 'Settings'
  }),
  CAMPUSES: Object.freeze(['HES', 'HIS', 'HMS', 'HHS']),
  NEED_CATEGORIES: Object.freeze([
    'Food',
    'Clothing',
    'Housing',
    'Hygiene Items',
    'School Supplies',
    'Transportation',
    'Medical Assistance',
    'Attendance Concern',
    'Family Assistance',
    'Other'
  ]),
  URGENCY_LEVELS: Object.freeze(['Standard', 'Priority', 'Urgent']),
  CASE_STATUSES: Object.freeze([
    'New',
    'Under Review',
    'Contact Attempted',
    'Assistance in Progress',
    'Assistance Provided',
    'Unable to Contact',
    'Closed'
  ]),
  ROLES: Object.freeze([
    'STAFF',
    'OUTREACH_COORDINATOR',
    'CAMPUS_ADMIN',
    'DISTRICT_ADMIN',
    'REPORTS_ONLY'
  ])
});

const SHEET_DEFINITIONS = Object.freeze({
  'Referrals': [
    'Referral ID',
    'Submitted At',
    'Submitted By Name',
    'Submitted By Email',
    'Student First Name',
    'Student Last Name',
    'Student ID',
    'Grade',
    'Campus',
    'Need Category',
    'Urgency',
    'Situation Description',
    'Assistance Already Provided',
    'Parent/Guardian Name',
    'Parent/Guardian Phone',
    'Assigned To',
    'Status',
    'Follow-Up Date',
    'Resolution Summary',
    'Last Updated At',
    'Last Updated By',
    'Closed At'
  ],
  'Case Updates': [
    'Update ID',
    'Referral ID',
    'Update Type',
    'Previous Status',
    'New Status',
    'Case Note',
    'Follow-Up Date',
    'Created At',
    'Created By'
  ],
  'Users': [
    'Username',
    'Full Name',
    'Email',
    'New Password',
    'Password Hash',
    'Role',
    'Campus',
    'Active',
    'Updated At',
    'Last Login At'
  ],
  'Campuses': ['Campus Code', 'Campus Name', 'Active'],
  'Need Categories': ['Category', 'Active', 'Display Order'],
  'Email Notifications': [
    'Notification ID',
    'Referral ID',
    'Recipient',
    'Notification Type',
    'Subject',
    'Status',
    'Sent At',
    'Error Message'
  ],
  'Audit Log': [
    'Audit ID',
    'Timestamp',
    'User Email',
    'Action',
    'Record Type',
    'Record ID',
    'Details'
  ],
  'Settings': ['Setting', 'Value', 'Description']
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Outreach System')
    .addItem('Run Initial Setup', 'setupStudentOutreachSystem')
    .addItem('View Setup Summary', 'showSetupSummary')
    .addSeparator()
    .addItem('Rebuild Simple Users Sheet', 'rebuildSimpleUsersSheet')
    .addItem('Secure New User Passwords', 'secureUserPasswords')
    .addToUi();
}

/**
 * Creates the complete database structure without erasing existing case data.
 */
function setupStudentOutreachSystem() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.setSpreadsheetTimeZone(OUTREACH_CONFIG.TIME_ZONE);

  Object.keys(SHEET_DEFINITIONS).forEach(function(sheetName) {
    const sheet = getOrCreateSheet_(spreadsheet, sheetName);
    ensureHeaders_(sheet, SHEET_DEFINITIONS[sheetName]);
    formatSheet_(sheet, SHEET_DEFINITIONS[sheetName].length);
  });

  seedCampuses_(spreadsheet);
  seedNeedCategories_(spreadsheet);
  seedSettings_(spreadsheet);
  addReferralValidations_(spreadsheet);
  addUserValidations_(spreadsheet);
  addConditionalFormatting_(spreadsheet);

  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: spreadsheet.getId(),
    APP_NAME: OUTREACH_CONFIG.APP_NAME,
    ALLOWED_DOMAIN: OUTREACH_CONFIG.ALLOWED_DOMAIN,
    TIME_ZONE: OUTREACH_CONFIG.TIME_ZONE
  }, false);

  SpreadsheetApp.flush();

  SpreadsheetApp.getUi().alert(
    'Setup complete',
    'The outreach system database has been created. Your next step is to add the outreach coordinator and campus administrators to the Users sheet.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function rebuildSimpleUsersSheet() {
  const ui = SpreadsheetApp.getUi();
  const choice = ui.alert(
    'Rebuild Users Sheet',
    'This will erase the current Users tab, replace it with the simple username/password layout, and permanently remove the User Management tab. Continue?',
    ui.ButtonSet.YES_NO
  );

  if (choice !== ui.Button.YES) return;

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let usersSheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.USERS);
  if (!usersSheet) usersSheet = spreadsheet.insertSheet(OUTREACH_CONFIG.SHEETS.USERS);

  usersSheet.clear();
  usersSheet.getRange(1, 1, usersSheet.getMaxRows(), usersSheet.getMaxColumns())
    .clearDataValidations();
  usersSheet.getRange(1, 1, 1, SHEET_DEFINITIONS.Users.length)
    .setValues([SHEET_DEFINITIONS.Users]);
  formatSheet_(usersSheet, SHEET_DEFINITIONS.Users.length);
  addUserValidations_(spreadsheet);
  usersSheet.getRange(2, 1, Math.max(usersSheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  usersSheet.getRange(2, 4, Math.max(usersSheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');

  const oldManagementSheet = spreadsheet.getSheetByName('User Management');
  if (oldManagementSheet) spreadsheet.deleteSheet(oldManagementSheet);

  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());

  SpreadsheetApp.flush();
  ui.alert(
    'Users Sheet Ready',
    'Enter each username and password in the Users tab, then use Outreach System → Secure New User Passwords. The readable New Password cells will be cleared after hashing.',
    ui.ButtonSet.OK
  );
}

function secureUserPasswords() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.USERS);
  if (!sheet) throw new Error('The Users tab was not found. Run Rebuild Simple Users Sheet first.');

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(value) { return String(value).trim(); });
  const usernameColumn = headers.indexOf('Username');
  const passwordColumn = headers.indexOf('New Password');
  const hashColumn = headers.indexOf('Password Hash');
  const roleColumn = headers.indexOf('Role');
  const campusColumn = headers.indexOf('Campus');
  const updatedColumn = headers.indexOf('Updated At');

  if ([usernameColumn, passwordColumn, hashColumn, roleColumn, campusColumn, updatedColumn].some(function(index) {
    return index === -1;
  })) {
    throw new Error('The Users tab does not have the required simple-login columns. Run Rebuild Simple Users Sheet again.');
  }

  const usernameCounts = {};
  values.slice(1).forEach(function(row) {
    const username = String(row[usernameColumn] || '').trim().toLowerCase();
    if (username) usernameCounts[username] = Number(usernameCounts[username] || 0) + 1;
  });

  const allowedRoles = ['OUTREACH_COORDINATOR', 'CAMPUS_ADMIN', 'DISTRICT_ADMIN', 'REPORTS_ONLY'];
  const allowedCampuses = ['ALL'].concat(OUTREACH_CONFIG.CAMPUSES);
  let secured = 0;
  const errors = [];

  values.slice(1).forEach(function(row, index) {
    const sheetRow = index + 2;
    const newPassword = String(row[passwordColumn] || '');
    if (!newPassword) return;

    const username = String(row[usernameColumn] || '').trim().toLowerCase();
    const role = String(row[roleColumn] || '').trim().toUpperCase();
    const campus = String(row[campusColumn] || '').trim().toUpperCase();

    try {
      if (!/^[a-z0-9][a-z0-9._-]{2,38}[a-z0-9]$/.test(username)) {
        throw new Error('Username must be 4-40 characters using letters, numbers, periods, underscores, or hyphens.');
      }
      if (usernameCounts[username] !== 1) throw new Error('Username is duplicated.');
      if (newPassword.length < 8) throw new Error('Password must contain at least 8 characters.');
      if (newPassword.length > 256) throw new Error('Password is too long.');
      if (allowedRoles.indexOf(role) === -1) throw new Error('Select a backend role.');
      if (allowedCampuses.indexOf(campus) === -1) throw new Error('Select a valid campus.');

      sheet.getRange(sheetRow, usernameColumn + 1).setValue(username);
      sheet.getRange(sheetRow, passwordColumn + 1).clearContent();
      sheet.getRange(sheetRow, hashColumn + 1).setValue(hashUserPasswordForSheet_(newPassword));
      sheet.getRange(sheetRow, updatedColumn + 1).setValue(new Date());
      secured += 1;
    } catch (error) {
      errors.push('Row ' + sheetRow + ': ' + error.message);
    }
  });

  SpreadsheetApp.getUi().alert(
    'User Passwords Secured',
    'Passwords secured: ' + secured + '\nErrors: ' + errors.length +
      (errors.length ? '\n\n' + errors.join('\n') : '\n\nReadable passwords were cleared from processed rows.'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function hashUserPasswordForSheet_(password) {
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password || '')
  );

  return rawHash.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function showSetupSummary() {
  const summary = getSystemSetupSummary();
  const lines = [
    summary.appName,
    '',
    'Spreadsheet: ' + summary.spreadsheetName,
    'Required sheets ready: ' + summary.readySheets + '/' + summary.totalSheets,
    'Campuses: ' + summary.campuses.join(', '),
    'Allowed domain: @' + summary.allowedDomain,
    '',
    summary.isReady ? 'Database setup is complete.' : 'Run Initial Setup to finish the database.'
  ];

  SpreadsheetApp.getUi().alert('Outreach System Setup', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function getSystemSetupSummary() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = Object.keys(SHEET_DEFINITIONS);
  const readySheets = requiredSheets.filter(function(sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return false;
    const requiredHeaders = SHEET_DEFINITIONS[sheetName];
    const actualHeaders = sheet.getRange(1, 1, 1, requiredHeaders.length).getDisplayValues()[0];
    return requiredHeaders.every(function(header, index) {
      return actualHeaders[index] === header;
    });
  });

  return {
    appName: OUTREACH_CONFIG.APP_NAME,
    spreadsheetName: spreadsheet.getName(),
    spreadsheetId: spreadsheet.getId(),
    readySheets: readySheets.length,
    totalSheets: requiredSheets.length,
    campuses: OUTREACH_CONFIG.CAMPUSES.slice(),
    allowedDomain: OUTREACH_CONFIG.ALLOWED_DOMAIN,
    isReady: readySheets.length === requiredSheets.length
  };
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

/**
 * Adds only missing headers. Existing columns and data are left intact.
 */
function ensureHeaders_(sheet, requiredHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const hasAnyHeader = existingHeaders.some(function(value) {
    return String(value).trim() !== '';
  });

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return;
  }

  const missingHeaders = requiredHeaders.filter(function(header) {
    return existingHeaders.indexOf(header) === -1;
  });

  if (missingHeaders.length) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}

function formatSheet_(sheet, headerCount) {
  const headerRange = sheet.getRange(1, 1, 1, headerCount);
  headerRange
    .setBackground('#111111')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 34);
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), headerCount)
    .setVerticalAlignment('middle');

  for (let column = 1; column <= headerCount; column += 1) {
    sheet.setColumnWidth(column, 150);
  }
}

function seedCampuses_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.CAMPUSES);
  const campusNames = {
    HES: 'Hugo Elementary School',
    HIS: 'Hugo Intermediate School',
    HMS: 'Hugo Middle School',
    HHS: 'Hugo High School'
  };

  const existing = getFirstColumnValues_(sheet);
  const rows = OUTREACH_CONFIG.CAMPUSES
    .filter(function(code) { return existing.indexOf(code) === -1; })
    .map(function(code) { return [code, campusNames[code], true]; });

  appendRows_(sheet, rows);
}

function seedNeedCategories_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.NEED_CATEGORIES);
  const existing = getFirstColumnValues_(sheet);
  const rows = OUTREACH_CONFIG.NEED_CATEGORIES
    .filter(function(category) { return existing.indexOf(category) === -1; })
    .map(function(category, index) {
      return [category, true, OUTREACH_CONFIG.NEED_CATEGORIES.indexOf(category) + 1];
    });

  appendRows_(sheet, rows);
}

function seedSettings_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.SETTINGS);
  const existing = getFirstColumnValues_(sheet);
  const settings = [
    ['APP_NAME', OUTREACH_CONFIG.APP_NAME, 'Name displayed throughout the system'],
    ['ALLOWED_DOMAIN', OUTREACH_CONFIG.ALLOWED_DOMAIN, 'Only accounts from this Google Workspace domain may use the system'],
    ['OUTREACH_EMAIL', '', 'Email address that receives every new referral'],
    ['HES_ADMIN_EMAILS', '', 'Comma-separated HES administrator email addresses'],
    ['HIS_ADMIN_EMAILS', '', 'Comma-separated HIS administrator email addresses'],
    ['HMS_ADMIN_EMAILS', '', 'Comma-separated HMS administrator email addresses'],
    ['HHS_ADMIN_EMAILS', '', 'Comma-separated HHS administrator email addresses'],
    ['SEND_SUBMITTER_CONFIRMATION', 'TRUE', 'Send a confirmation email to the staff member who submitted the referral'],
    ['SEND_ADMIN_NEW_REFERRAL_EMAILS', 'FALSE', 'Campus administrators do not receive case emails unless this is changed to TRUE'],
    ['NEXT_REFERRAL_NUMBER', '1', 'Internal counter used to create referral IDs'],
    ['NEXT_UPDATE_NUMBER', '1', 'Internal counter used to create update IDs'],
    ['NEXT_NOTIFICATION_NUMBER', '1', 'Internal counter used to create notification IDs'],
    ['NEXT_AUDIT_NUMBER', '1', 'Internal counter used to create audit IDs'],
    ['AUTH_SESSION_SECONDS', '7200', 'Backend login session length in seconds']
  ];

  const rows = settings.filter(function(row) {
    return existing.indexOf(row[0]) === -1;
  });

  appendRows_(sheet, rows);
}

function addReferralValidations_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.REFERRALS);
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  const campusColumn = findHeaderColumn_(sheet, 'Campus');
  const categoryColumn = findHeaderColumn_(sheet, 'Need Category');
  const urgencyColumn = findHeaderColumn_(sheet, 'Urgency');
  const statusColumn = findHeaderColumn_(sheet, 'Status');

  setListValidation_(sheet.getRange(2, campusColumn, rows, 1), OUTREACH_CONFIG.CAMPUSES);
  setListValidation_(sheet.getRange(2, categoryColumn, rows, 1), OUTREACH_CONFIG.NEED_CATEGORIES);
  setListValidation_(sheet.getRange(2, urgencyColumn, rows, 1), OUTREACH_CONFIG.URGENCY_LEVELS);
  setListValidation_(sheet.getRange(2, statusColumn, rows, 1), OUTREACH_CONFIG.CASE_STATUSES);
}

function addUserValidations_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.USERS);
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  const roleColumn = findHeaderColumn_(sheet, 'Role');
  const campusColumn = findHeaderColumn_(sheet, 'Campus');
  const activeColumn = findHeaderColumn_(sheet, 'Active');

  setListValidation_(sheet.getRange(2, roleColumn, rows, 1), OUTREACH_CONFIG.ROLES.filter(function(role) {
    return role !== 'STAFF';
  }));
  setListValidation_(sheet.getRange(2, campusColumn, rows, 1), ['ALL'].concat(OUTREACH_CONFIG.CAMPUSES));
  sheet.getRange(2, activeColumn, rows, 1).insertCheckboxes();
}

function addConditionalFormatting_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.REFERRALS);
  const urgencyColumn = findHeaderColumn_(sheet, 'Urgency');
  const statusColumn = findHeaderColumn_(sheet, 'Status');
  const maxRows = Math.max(sheet.getMaxRows(), 2);
  const urgencyRange = sheet.getRange(2, urgencyColumn, maxRows - 1, 1);
  const statusRange = sheet.getRange(2, statusColumn, maxRows - 1, 1);

  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Urgent')
      .setBackground('#B91C1C')
      .setFontColor('#FFFFFF')
      .setBold(true)
      .setRanges([urgencyRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Priority')
      .setBackground('#FDE68A')
      .setFontColor('#111827')
      .setRanges([urgencyRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Closed')
      .setBackground('#D1FAE5')
      .setFontColor('#065F46')
      .setRanges([statusRange])
      .build()
  ];

  sheet.setConditionalFormatRules(rules);
}

function setListValidation_(range, values) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

function findHeaderColumn_(sheet, header) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const index = headers.indexOf(header);
  if (index === -1) throw new Error('Missing header "' + header + '" on sheet "' + sheet.getName() + '".');
  return index + 1;
}

function getFirstColumnValues_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues()
    .map(function(row) { return String(row[0]).trim(); })
    .filter(String);
}

function appendRows_(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}
