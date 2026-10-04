/**
 * Hugo Student Outreach Referral System
 * Outreach and administrator dashboard service
 *
 * Add this as a NEW Apps Script file named DashboardService.gs.
 */

const DASHBOARD_EDIT_ROLES = Object.freeze(['OUTREACH_COORDINATOR', 'DISTRICT_ADMIN']);
const REFERRAL_CASE_VIEW_ROLES = Object.freeze([
  'OUTREACH_COORDINATOR',
  'DISTRICT_ADMIN'
]);
const DASHBOARD_VIEW_ROLES = Object.freeze([
  'OUTREACH_COORDINATOR',
  'DISTRICT_ADMIN'
]);

function getDashboardBootstrap(sessionToken) {
  const user = requireReferralDashboardSession_(sessionToken);
  const spreadsheet = getOutreachSpreadsheet_();

  return {
    success: true,
    appName: getOutreachSetting_('APP_NAME') || OUTREACH_CONFIG.APP_NAME,
    user: user,
    permissions: dashboardPermissionsFor_(user),
    campuses: getActiveListValues_(
      spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.CAMPUSES),
      'Campus Code',
      'Active'
    ),
    needCategories: getActiveListValues_(
      spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.NEED_CATEGORIES),
      'Category',
      'Active'
    ),
    urgencyLevels: OUTREACH_CONFIG.URGENCY_LEVELS.slice(),
    statuses: OUTREACH_CONFIG.CASE_STATUSES.slice(),
    assignees: getDashboardAssignees_()
  };
}

function getDashboardData(sessionToken, filters) {
  const user = requireReferralDashboardSession_(sessionToken);
  const permissions = dashboardPermissionsFor_(user);
  const allCases = getScopedReferralRecords_(user);
  const cleanFilters = cleanDashboardFilters_(filters || {});
  const filteredCases = allCases.filter(function(record) {
    return referralMatchesFilters_(record, cleanFilters);
  });

  const sorted = filteredCases.sort(function(a, b) {
    return dashboardDateValue_(b['Submitted At']) - dashboardDateValue_(a['Submitted At']);
  });

  return {
    success: true,
    generatedAt: formatDashboardDateTime_(new Date()),
    stats: calculateDashboardStats_(allCases),
    filteredCount: sorted.length,
    cases: permissions.canViewCases
      ? sorted.slice(0, 500).map(serializeReferralSummary_)
      : []
  };
}

function getReferralDetails(sessionToken, referralId) {
  const user = requireReferralDashboardSession_(sessionToken);
  const permissions = dashboardPermissionsFor_(user);

  if (!permissions.canViewCases) {
    throw new Error('Your role can view reports but not individual student cases.');
  }

  const cleanId = cleanText_(referralId, 30);
  const match = getScopedReferralRecords_(user).find(function(record) {
    return String(record['Referral ID']) === cleanId;
  });

  if (!match) throw new Error('Referral not found or you do not have permission to view it.');

  return {
    success: true,
    referral: serializeReferralDetails_(match),
    updates: getCaseUpdatesForReferral_(cleanId),
    permissions: permissions
  };
}

function updateReferralCase(sessionToken, payload) {
  const user = requireReferralDashboardSession_(sessionToken);
  const permissions = dashboardPermissionsFor_(user);
  if (!permissions.canEditCases) throw new Error('You do not have permission to update cases.');

  const clean = validateCaseUpdate_(payload);
  const spreadsheet = getOutreachSpreadsheet_();
  const referralsSheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.REFERRALS);
  const updatesSheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.CASE_UPDATES);
  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const located = findObjectRowById_(referralsSheet, 'Referral ID', clean.referralId);
    if (!located) throw new Error('Referral not found. Reload the dashboard and try again.');

    enforceReferralScope_(user, located.record);

    const previousStatus = String(located.record['Status'] || '');
    const now = new Date();
    const closedAt = clean.status === 'Closed'
      ? (located.record['Closed At'] || now)
      : '';

    updateObjectRow_(referralsSheet, located.rowNumber, {
      'Assigned To': clean.assignedTo,
      'Status': clean.status,
      'Follow-Up Date': clean.followUpDate ? parseDashboardDate_(clean.followUpDate) : '',
      'Resolution Summary': clean.resolutionSummary,
      'Last Updated At': now,
      'Last Updated By': user.email,
      'Closed At': closedAt
    });

    const updateId = nextOutreachId_('NEXT_UPDATE_NUMBER', 'UPD', 7);
    appendObjectRow_(updatesSheet, {
      'Update ID': updateId,
      'Referral ID': clean.referralId,
      'Update Type': determineCaseUpdateType_(previousStatus, clean.status, clean.caseNote),
      'Previous Status': previousStatus,
      'New Status': clean.status,
      'Case Note': clean.caseNote,
      'Follow-Up Date': clean.followUpDate ? parseDashboardDate_(clean.followUpDate) : '',
      'Created At': now,
      'Created By': user.email
    });

    writeAuditLog_({
      userEmail: user.email,
      action: 'UPDATE_REFERRAL',
      recordType: 'Referral',
      recordId: clean.referralId,
      details: {
        previousStatus: previousStatus,
        newStatus: clean.status,
        assignedTo: clean.assignedTo,
        followUpDate: clean.followUpDate,
        updateId: updateId
      }
    });

    return {
      success: true,
      referralId: clean.referralId,
      updateId: updateId,
      message: 'Case updated successfully.'
    };
  } finally {
    lock.releaseLock();
  }
}

function requireDashboardUser_() {
  const email = requireDistrictUser_();
  const usersSheet = getOutreachSpreadsheet_().getSheetByName(OUTREACH_CONFIG.SHEETS.USERS);
  const records = sheetToObjects_(usersSheet);

  const record = records.find(function(row) {
    const rowEmail = String(row['Email'] || '').trim().toLowerCase();
    const active = row['Active'] === true || String(row['Active']).toUpperCase() === 'TRUE';
    return rowEmail === email && active;
  });

  if (!record) throw new Error('Your account has not been given dashboard access.');

  const role = String(record['Role'] || '').trim().toUpperCase();
  if (DASHBOARD_VIEW_ROLES.indexOf(role) === -1) {
    throw new Error('Your account does not have permission to access the management dashboard.');
  }

  return {
    email: email,
    fullName: String(record['Full Name'] || '').trim() || email.split('@')[0],
    role: role,
    campus: String(record['Campus'] || '').trim().toUpperCase() || 'ALL'
  };
}

function dashboardPermissionsFor_(user) {
  const canEdit = DASHBOARD_EDIT_ROLES.indexOf(user.role) !== -1;
  const canViewCases = REFERRAL_CASE_VIEW_ROLES.indexOf(user.role) !== -1;

  return {
    canViewCases: canViewCases,
    canEditCases: canEdit,
    canViewAllCampuses: user.role !== 'CAMPUS_ADMIN',
    canViewReports: true,
    campusScope: user.role === 'CAMPUS_ADMIN' ? user.campus : 'ALL'
  };
}

function requireReferralDashboardSession_(sessionToken) {
  const user = requireDashboardSession_(sessionToken);
  if (DASHBOARD_VIEW_ROLES.indexOf(user.role) === -1) {
    throw new Error('Your account opens Attendance Management.');
  }
  return user;
}

function getScopedReferralRecords_(user) {
  const sheet = getOutreachSpreadsheet_().getSheetByName(OUTREACH_CONFIG.SHEETS.REFERRALS);
  const records = sheetToObjects_(sheet);

  if (user.role !== 'CAMPUS_ADMIN') return records;
  if (OUTREACH_CONFIG.CAMPUSES.indexOf(user.campus) === -1) {
    throw new Error('Your campus administrator account does not have a valid campus assignment.');
  }

  return records.filter(function(record) {
    return String(record['Campus'] || '').trim().toUpperCase() === user.campus;
  });
}

function enforceReferralScope_(user, record) {
  if (user.role !== 'CAMPUS_ADMIN') return;
  const campus = String(record['Campus'] || '').trim().toUpperCase();
  if (campus !== user.campus) throw new Error('You do not have permission to access this campus referral.');
}

function getDashboardAssignees_() {
  const sheet = getOutreachSpreadsheet_().getSheetByName(OUTREACH_CONFIG.SHEETS.USERS);
  return sheetToObjects_(sheet)
    .filter(function(record) {
      const active = record['Active'] === true || String(record['Active']).toUpperCase() === 'TRUE';
      const role = String(record['Role'] || '').trim().toUpperCase();
      return active && DASHBOARD_EDIT_ROLES.indexOf(role) !== -1;
    })
    .map(function(record) {
      return {
        email: String(record['Email'] || '').trim().toLowerCase(),
        name: String(record['Full Name'] || '').trim() || String(record['Email'] || '').trim()
      };
    })
    .filter(function(record) { return record.email; });
}

function cleanDashboardFilters_(filters) {
  return {
    search: cleanText_(filters.search, 150).toLowerCase(),
    campus: cleanText_(filters.campus, 10).toUpperCase(),
    category: cleanText_(filters.category, 100),
    urgency: cleanText_(filters.urgency, 20),
    status: cleanText_(filters.status, 50),
    assignedTo: cleanText_(filters.assignedTo, 150).toLowerCase()
  };
}

function referralMatchesFilters_(record, filters) {
  if (filters.campus && String(record['Campus'] || '').toUpperCase() !== filters.campus) return false;
  if (filters.category && String(record['Need Category'] || '') !== filters.category) return false;
  if (filters.urgency && String(record['Urgency'] || '') !== filters.urgency) return false;
  if (filters.status && String(record['Status'] || '') !== filters.status) return false;
  if (filters.assignedTo === '__unassigned__') {
    if (String(record['Assigned To'] || '').trim() !== '') return false;
  } else if (filters.assignedTo && String(record['Assigned To'] || '').toLowerCase() !== filters.assignedTo) {
    return false;
  }

  if (filters.search) {
    const haystack = [
      record['Referral ID'],
      record['Student First Name'],
      record['Student Last Name'],
      record['Student ID'],
      record['Submitted By Name'],
      record['Submitted By Email']
    ].join(' ').toLowerCase();

    if (haystack.indexOf(filters.search) === -1) return false;
  }

  return true;
}

function calculateDashboardStats_(records) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openRecords = records.filter(function(record) {
    return String(record['Status'] || '') !== 'Closed';
  });

  return {
    total: records.length,
    newCases: records.filter(function(record) { return String(record['Status'] || '') === 'New'; }).length,
    activeCases: openRecords.length,
    urgentOpen: openRecords.filter(function(record) { return String(record['Urgency'] || '') === 'Urgent'; }).length,
    followUpsDue: openRecords.filter(function(record) {
      const followUp = dashboardDateValue_(record['Follow-Up Date']);
      return followUp > 0 && followUp < today.getTime();
    }).length,
    closedCases: records.filter(function(record) { return String(record['Status'] || '') === 'Closed'; }).length
  };
}

function serializeReferralSummary_(record) {
  return {
    referralId: String(record['Referral ID'] || ''),
    submittedAt: formatDashboardDateTime_(record['Submitted At']),
    submittedAtSort: dashboardDateValue_(record['Submitted At']),
    studentName: [record['Student First Name'], record['Student Last Name']].filter(String).join(' '),
    studentId: String(record['Student ID'] || ''),
    grade: String(record['Grade'] || ''),
    campus: String(record['Campus'] || ''),
    needCategory: String(record['Need Category'] || ''),
    urgency: String(record['Urgency'] || ''),
    assignedTo: String(record['Assigned To'] || ''),
    status: String(record['Status'] || ''),
    followUpDate: formatDashboardDate_(record['Follow-Up Date']),
    followUpOverdue: isDashboardFollowUpOverdue_(record),
    lastUpdatedAt: formatDashboardDateTime_(record['Last Updated At'])
  };
}

function serializeReferralDetails_(record) {
  return {
    referralId: String(record['Referral ID'] || ''),
    submittedAt: formatDashboardDateTime_(record['Submitted At']),
    submittedByName: String(record['Submitted By Name'] || ''),
    submittedByEmail: String(record['Submitted By Email'] || ''),
    studentFirstName: String(record['Student First Name'] || ''),
    studentLastName: String(record['Student Last Name'] || ''),
    studentName: [record['Student First Name'], record['Student Last Name']].filter(String).join(' '),
    studentId: String(record['Student ID'] || ''),
    grade: String(record['Grade'] || ''),
    campus: String(record['Campus'] || ''),
    needCategory: String(record['Need Category'] || ''),
    urgency: String(record['Urgency'] || ''),
    situationDescription: String(record['Situation Description'] || ''),
    assistanceAlreadyProvided: String(record['Assistance Already Provided'] || ''),
    parentGuardianName: String(record['Parent/Guardian Name'] || ''),
    parentGuardianPhone: String(record['Parent/Guardian Phone'] || ''),
    assignedTo: String(record['Assigned To'] || ''),
    status: String(record['Status'] || ''),
    followUpDate: formatDashboardInputDate_(record['Follow-Up Date']),
    resolutionSummary: String(record['Resolution Summary'] || ''),
    lastUpdatedAt: formatDashboardDateTime_(record['Last Updated At']),
    lastUpdatedBy: String(record['Last Updated By'] || ''),
    closedAt: formatDashboardDateTime_(record['Closed At'])
  };
}

function getCaseUpdatesForReferral_(referralId) {
  const sheet = getOutreachSpreadsheet_().getSheetByName(OUTREACH_CONFIG.SHEETS.CASE_UPDATES);
  return sheetToObjects_(sheet)
    .filter(function(record) { return String(record['Referral ID'] || '') === referralId; })
    .sort(function(a, b) {
      return dashboardDateValue_(b['Created At']) - dashboardDateValue_(a['Created At']);
    })
    .map(function(record) {
      return {
        updateId: String(record['Update ID'] || ''),
        updateType: String(record['Update Type'] || ''),
        previousStatus: String(record['Previous Status'] || ''),
        newStatus: String(record['New Status'] || ''),
        caseNote: String(record['Case Note'] || ''),
        followUpDate: formatDashboardDate_(record['Follow-Up Date']),
        createdAt: formatDashboardDateTime_(record['Created At']),
        createdBy: String(record['Created By'] || '')
      };
    });
}

function validateCaseUpdate_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('The case update was empty.');

  const clean = {
    referralId: cleanText_(payload.referralId, 30),
    assignedTo: cleanText_(payload.assignedTo, 150).toLowerCase(),
    status: cleanText_(payload.status, 50),
    followUpDate: cleanText_(payload.followUpDate, 10),
    resolutionSummary: cleanMultilineText_(payload.resolutionSummary, 3000),
    caseNote: cleanMultilineText_(payload.caseNote, 3000)
  };

  if (!clean.referralId) throw new Error('Missing referral number.');
  if (OUTREACH_CONFIG.CASE_STATUSES.indexOf(clean.status) === -1) throw new Error('Select a valid case status.');

  if (clean.assignedTo) {
    const validAssignee = getDashboardAssignees_().some(function(assignee) {
      return assignee.email === clean.assignedTo;
    });
    if (!validAssignee) throw new Error('Select a valid active assignee.');
  }

  if (clean.followUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(clean.followUpDate)) {
    throw new Error('Enter a valid follow-up date.');
  }

  if (clean.status === 'Closed' && !clean.resolutionSummary) {
    throw new Error('Enter a resolution summary before closing the case.');
  }

  if (!clean.caseNote && !clean.resolutionSummary) {
    throw new Error('Add a case note or resolution summary describing this update.');
  }

  return clean;
}

function determineCaseUpdateType_(previousStatus, newStatus, caseNote) {
  if (previousStatus !== newStatus) return newStatus === 'Closed' ? 'CASE_CLOSED' : 'STATUS_CHANGE';
  return caseNote ? 'CASE_NOTE' : 'CASE_UPDATE';
}

function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(header) { return String(header).trim(); });
  return values.slice(1)
    .map(function(row, index) {
      return { row: row, rowNumber: index + 2 };
    })
    .filter(function(item) {
      return item.row.some(function(value) { return value !== ''; });
    })
    .map(function(item) {
      const record = { _rowNumber: item.rowNumber };
      headers.forEach(function(header, column) { record[header] = item.row[column]; });
      return record;
    });
}

function findObjectRowById_(sheet, idHeader, idValue) {
  const records = sheetToObjects_(sheet);
  const record = records.find(function(item) { return String(item[idHeader] || '') === idValue; });
  return record ? { rowNumber: record._rowNumber, record: record } : null;
}

function updateObjectRow_(sheet, rowNumber, updates) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  Object.keys(updates).forEach(function(header) {
    const columnIndex = headers.indexOf(header);
    if (columnIndex === -1) throw new Error('Missing required column: ' + header);
    sheet.getRange(rowNumber, columnIndex + 1).setValue(updates[header]);
  });
}

function parseDashboardDate_(dateString) {
  const parts = String(dateString).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

function dashboardDateValue_(value) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isDashboardFollowUpOverdue_(record) {
  if (String(record['Status'] || '') === 'Closed') return false;
  const value = dashboardDateValue_(record['Follow-Up Date']);
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return value < today.getTime();
}

function formatDashboardDateTime_(value) {
  const timestamp = dashboardDateValue_(value);
  if (!timestamp) return '';
  return Utilities.formatDate(new Date(timestamp), OUTREACH_CONFIG.TIME_ZONE, 'MMM d, yyyy h:mm a');
}

function formatDashboardDate_(value) {
  const timestamp = dashboardDateValue_(value);
  if (!timestamp) return '';
  return Utilities.formatDate(new Date(timestamp), OUTREACH_CONFIG.TIME_ZONE, 'MMM d, yyyy');
}

function formatDashboardInputDate_(value) {
  const timestamp = dashboardDateValue_(value);
  if (!timestamp) return '';
  return Utilities.formatDate(new Date(timestamp), OUTREACH_CONFIG.TIME_ZONE, 'yyyy-MM-dd');
}