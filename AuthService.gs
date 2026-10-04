/**
 * Hugo Student Outreach Referral System
 * Simple username/password authentication
 */

const SIMPLE_AUTH_SESSION_PREFIX = 'outreach_simple_session_';
const SIMPLE_AUTH_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,38}[a-z0-9]$/;
const OUTREACH_ADMIN_WEB_APP_URL = 'https://script.google.com/a/macros/hugoschools.com/s/AKfycbyo_c3wRGFouzIRWljtzdA3tPxrouU7I-JJNNtydFp1u6l_FmhX2-7LVAJ0-SgFamCk/exec';

function hashPassword(password) {
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password || '')
  );

  return rawHash.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function loginAdmin(username, password) {
  const typedUsername = cleanSimpleUsername_(username);
  const typedPassword = String(password || '');

  if (!typedUsername || !typedPassword || typedPassword.length > 256) {
    return { success: false, message: 'Invalid username or password.' };
  }

  const sheet = getOutreachSpreadsheet_().getSheetByName(OUTREACH_CONFIG.SHEETS.USERS);
  const located = findSimpleUser_(sheet, typedUsername);

  if (!located) {
    return { success: false, message: 'Login diagnostic: username was not found in the Users tab.' };
  }

  if (!authBoolean_(located.record['Active'])) {
    return { success: false, message: 'Login diagnostic: this user is not marked Active.' };
  }

  const savedHash = String(located.record['Password Hash'] || '').trim().toLowerCase();
  if (!savedHash) {
    return { success: false, message: 'Login diagnostic: this user does not have a Password Hash.' };
  }

  if (savedHash.length !== 64) {
    return { success: false, message: 'Login diagnostic: the stored Password Hash is not the expected 64-character SHA-256 value.' };
  }

  if (savedHash !== hashPassword(typedPassword)) {
    return { success: false, message: 'Login diagnostic: the password does not match the stored Password Hash.' };
  }

  let user;
  try {
    user = simpleUserFromRecord_(located.record);
  } catch (error) {
    return { success: false, message: error.message };
  }

  updateObjectRow_(sheet, located.rowNumber, {
    'Last Login At': new Date(),
    'Updated At': new Date()
  });

  const sessionToken = createSimpleBackendSession_(
    user,
    authSessionVersion_(located.record)
  );

  writeAuditLog_({
    userEmail: user.email,
    action: 'BACKEND_LOGIN',
    recordType: 'User',
    recordId: user.username,
    details: { role: user.role, campus: user.campus }
  });

  return {
    success: true,
    user: user,
    sessionToken: sessionToken,
    dashboardUrl: buildOutreachPageUrl_(
      ['DISTRICT_ADMIN', 'OUTREACH_COORDINATOR'].indexOf(user.role) !== -1
        ? 'dashboard'
        : 'attendance'
    ) + '&session=' + encodeURIComponent(sessionToken)
  };
}

function requireDashboardSession_(sessionToken) {
  const token = cleanSimpleAuthToken_(sessionToken);
  if (!token) throw new Error('Your dashboard session has expired. Please sign in again.');

  const cache = CacheService.getScriptCache();
  const cached = cache.get(SIMPLE_AUTH_SESSION_PREFIX + token);
  if (!cached) throw new Error('Your dashboard session has expired. Please sign in again.');

  let session;
  try {
    session = JSON.parse(cached);
  } catch (error) {
    cache.remove(SIMPLE_AUTH_SESSION_PREFIX + token);
    throw new Error('Your dashboard session is invalid. Please sign in again.');
  }

  const sheet = getOutreachSpreadsheet_().getSheetByName(OUTREACH_CONFIG.SHEETS.USERS);
  const located = findSimpleUser_(sheet, session.username);
  if (!located || !authBoolean_(located.record['Active'])) {
    cache.remove(SIMPLE_AUTH_SESSION_PREFIX + token);
    throw new Error('Your account is no longer active.');
  }

  const user = simpleUserFromRecord_(located.record);
  const currentSessionVersion = authSessionVersion_(located.record);
  const sessionVersion = Number(session.sessionVersion || 0);

  if (sessionVersion !== currentSessionVersion) {
    cache.remove(SIMPLE_AUTH_SESSION_PREFIX + token);
    throw new Error(
      'Your password was changed. Please sign in again with your new password.'
    );
  }

  refreshSimpleBackendSession_(token, user, currentSessionVersion);
  return user;
}

function changeBackendPassword(sessionToken, payload) {
  const token = cleanSimpleAuthToken_(sessionToken);
  const user = requireDashboardSession_(token);
  const clean = payload && typeof payload === 'object' ? payload : {};
  const currentPassword = String(clean.currentPassword || '');
  const newPassword = String(clean.newPassword || '');
  const confirmPassword = String(clean.confirmPassword || '');

  if (!currentPassword) throw new Error('Enter your current password.');
  validateNewBackendPassword_(newPassword, confirmPassword);

  const spreadsheet = getOutreachSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(OUTREACH_CONFIG.SHEETS.USERS);
  if (!sheet) throw new Error('The Users tab could not be found.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSimplePasswordColumns_(sheet);
    const located = findSimpleUser_(sheet, user.username);
    if (!located || !authBoolean_(located.record['Active'])) {
      throw new Error('Your account is no longer active.');
    }

    const savedHash = String(
      located.record['Password Hash'] || ''
    ).trim().toLowerCase();

    if (!savedHash || savedHash !== hashPassword(currentPassword)) {
      throw new Error('Your current password is incorrect.');
    }

    const newHash = hashPassword(newPassword);
    if (newHash === savedHash) {
      throw new Error('Your new password must be different from your current password.');
    }

    const nextSessionVersion = authSessionVersion_(located.record) + 1;
    updateObjectRow_(sheet, located.rowNumber, {
      'New Password': '',
      'Password Hash': newHash,
      'Password Changed At': new Date(),
      'Session Version': nextSessionVersion,
      'Updated At': new Date()
    });

    CacheService.getScriptCache().remove(SIMPLE_AUTH_SESSION_PREFIX + token);

    writeAuditLog_({
      userEmail: user.email,
      action: 'CHANGE_OWN_PASSWORD',
      recordType: 'User',
      recordId: user.username,
      details: { sessionsInvalidated: true }
    });

    return {
      success: true,
      message: 'Your password was changed successfully. Please sign in again.',
      loginUrl: buildOutreachPageUrl_('login')
    };
  } finally {
    lock.releaseLock();
  }
}

function logoutBackendSession(sessionToken) {
  const token = cleanSimpleAuthToken_(sessionToken);
  if (token) CacheService.getScriptCache().remove(SIMPLE_AUTH_SESSION_PREFIX + token);
  return { success: true, loginUrl: buildOutreachPageUrl_('login') };
}

function createSimpleBackendSession_(user, sessionVersion) {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
  refreshSimpleBackendSession_(token, user, sessionVersion);
  return token;
}

function refreshSimpleBackendSession_(token, user, sessionVersion) {
  CacheService.getScriptCache().put(
    SIMPLE_AUTH_SESSION_PREFIX + token,
    JSON.stringify({
      username: user.username,
      issuedAt: Date.now(),
      sessionVersion: Number(sessionVersion || 0)
    }),
    getSimpleAuthSessionSeconds_()
  );
}

function authSessionVersion_(record) {
  const version = Number(record && record['Session Version']);
  return Number.isFinite(version) && version >= 0
    ? Math.floor(version)
    : 0;
}

function validateNewBackendPassword_(newPassword, confirmPassword) {
  if (newPassword !== confirmPassword) {
    throw new Error('The new passwords do not match.');
  }
  if (newPassword.length < 8) {
    throw new Error('Your new password must be at least 8 characters.');
  }
  if (newPassword.length > 128) {
    throw new Error('Your new password must be 128 characters or fewer.');
  }
  if (newPassword !== newPassword.trim()) {
    throw new Error('Your new password cannot begin or end with a space.');
  }
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new Error('Your new password must contain at least one letter and one number.');
  }
}

function ensureSimplePasswordColumns_(sheet) {
  const required = ['Password Changed At', 'Session Version'];
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

function getSimpleAuthSessionSeconds_() {
  const seconds = Number(getOutreachSetting_('AUTH_SESSION_SECONDS'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.floor(seconds), 21600) : 7200;
}

function findSimpleUser_(sheet, username) {
  const cleanUsername = cleanSimpleUsername_(username);
  const record = sheetToObjects_(sheet).find(function(item) {
    return cleanSimpleUsername_(item['Username']) === cleanUsername;
  });
  return record ? { rowNumber: record._rowNumber, record: record } : null;
}

function simpleUserFromRecord_(record) {
  const username = cleanSimpleUsername_(record['Username']);
  const role = String(record['Role'] || '').trim().toUpperCase();
  const campus = String(record['Campus'] || '').trim().toUpperCase() || 'ALL';

  const backendRoles = [
    'OUTREACH_COORDINATOR',
    'DISTRICT_ADMIN',
    'CAMPUS_ADMIN',
    'REPORTS_ONLY',
    'ATTENDANCE_CLERK'
  ];
  if (backendRoles.indexOf(role) === -1) {
    throw new Error('This user does not have dashboard access.');
  }

  return {
    username: username,
    fullName: String(record['Full Name'] || '').trim() || username,
    email: String(record['Email'] || '').trim().toLowerCase() || username,
    role: role,
    campus: campus
  };
}

function cleanSimpleUsername_(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanSimpleAuthToken_(value) {
  const token = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(token) ? token : '';
}

function authBoolean_(value) {
  return value === true || String(value || '').trim().toUpperCase() === 'TRUE';
}

function buildOutreachPageUrl_(pageName) {
  return OUTREACH_ADMIN_WEB_APP_URL + '?page=' + encodeURIComponent(pageName);
}

function backendRoleLabel_(role) {
  const labels = {
    OUTREACH_COORDINATOR: 'Outreach Coordinator',
    CAMPUS_ADMIN: 'Campus Administrator',
    DISTRICT_ADMIN: 'District Administrator',
    REPORTS_ONLY: 'Reports Only',
    ATTENDANCE_CLERK: 'Attendance Clerk'
  };
  return labels[role] || role;
}