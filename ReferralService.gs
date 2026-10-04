/**
 * Hugo Student Outreach Referral System
 * Public staff referral submission service
 *
 * The referral form does not require a Google account.
 * The reporter enters any valid email address.
 */

function getStaffFormBootstrap() {
  const spreadsheet =
    getOutreachSpreadsheet_();

  return {
    success: true,

    appName:
      getOutreachSetting_('APP_NAME') ||
      OUTREACH_CONFIG.APP_NAME,

    campuses:
      getActiveListValues_(
        spreadsheet.getSheetByName(
          OUTREACH_CONFIG.SHEETS.CAMPUSES
        ),
        'Campus Code',
        'Active'
      ),

    needCategories:
      getActiveListValues_(
        spreadsheet.getSheetByName(
          OUTREACH_CONFIG.SHEETS.NEED_CATEGORIES
        ),
        'Category',
        'Active'
      ),

    urgencyLevels:
      OUTREACH_CONFIG.URGENCY_LEVELS.slice(),

    grades:
      ['Pre-K', 'K'].concat(
        Array.from(
          { length: 12 },
          function(_, index) {
            return String(index + 1);
          }
        )
      )
  };
}

function submitStudentReferral(payload) {
  const clean =
    validateAndCleanReferral_(payload);

  const reporterEmail =
    clean.reporterEmail;

  const spreadsheet =
    getOutreachSpreadsheet_();

  const referralsSheet =
    spreadsheet.getSheetByName(
      OUTREACH_CONFIG.SHEETS.REFERRALS
    );

  if (!referralsSheet) {
    throw new Error(
      'The Referrals tab could not be found.'
    );
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  let referralId;
  let submittedAt;

  try {
    referralId =
      nextOutreachId_(
        'NEXT_REFERRAL_NUMBER',
        OUTREACH_CONFIG.ID_PREFIX,
        6
      );

    submittedAt = new Date();

    appendObjectRow_(
      referralsSheet,
      {
        'Referral ID':
          referralId,

        'Submitted At':
          submittedAt,

        'Submitted By Name':
          clean.reporterName,

        'Submitted By Email':
          reporterEmail,

        'Student First Name':
          clean.studentFirstName,

        'Student Last Name':
          clean.studentLastName,

        'Student ID':
          clean.studentId,

        'Grade':
          clean.grade,

        'Campus':
          clean.campus,

        'Need Category':
          clean.needCategory,

        'Urgency':
          clean.urgency,

        'Situation Description':
          clean.situationDescription,

        'Assistance Already Provided':
          clean.assistanceAlreadyProvided,

        'Parent/Guardian Name':
          clean.parentGuardianName,

        'Parent/Guardian Phone':
          clean.parentGuardianPhone,

        'Assigned To':
          '',

        'Status':
          'New',

        'Follow-Up Date':
          '',

        'Resolution Summary':
          '',

        'Last Updated At':
          submittedAt,

        'Last Updated By':
          reporterEmail,

        'Closed At':
          ''
      }
    );

    writeAuditLog_({
      userEmail:
        reporterEmail,

      action:
        'CREATE_REFERRAL',

      recordType:
        'Referral',

      recordId:
        referralId,

      details: {
        campus:
          clean.campus,

        category:
          clean.needCategory,

        urgency:
          clean.urgency
      }
    });
  } finally {
    lock.releaseLock();
  }

  /*
   * Email failures never remove or invalidate
   * a successfully saved referral.
   */
  sendNewReferralNotifications_({
    referralId:
      referralId,

    submittedAt:
      submittedAt,

    reporterName:
      clean.reporterName,

    reporterEmail:
      reporterEmail,

    studentName:
      clean.studentFirstName +
      ' ' +
      clean.studentLastName,

    campus:
      clean.campus,

    grade:
      clean.grade,

    category:
      clean.needCategory,

    urgency:
      clean.urgency
  });

  return {
    success: true,
    referralId: referralId,
    message:
      'Your referral has been submitted successfully.'
  };
}

function validateAndCleanReferral_(payload) {
  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    throw new Error(
      'The referral form was empty. Please complete the form and try again.'
    );
  }

  const clean = {
    reporterName:
      cleanText_(
        payload.reporterName,
        100
      ),

    reporterEmail:
      cleanText_(
        payload.reporterEmail,
        150
      ).toLowerCase(),

    studentFirstName:
      cleanText_(
        payload.studentFirstName,
        75
      ),

    studentLastName:
      cleanText_(
        payload.studentLastName,
        75
      ),

    studentId:
      cleanText_(
        payload.studentId,
        30
      ),

    grade:
      cleanText_(
        payload.grade,
        10
      ),

    campus:
      cleanText_(
        payload.campus,
        10
      ),

    needCategory:
      cleanText_(
        payload.needCategory,
        100
      ),

    urgency:
      cleanText_(
        payload.urgency,
        20
      ),

    situationDescription:
      cleanMultilineText_(
        payload.situationDescription,
        3000
      ),

    assistanceAlreadyProvided:
      cleanMultilineText_(
        payload.assistanceAlreadyProvided,
        2000
      ),

    parentGuardianName:
      cleanText_(
        payload.parentGuardianName,
        100
      ),

    parentGuardianPhone:
      cleanText_(
        payload.parentGuardianPhone,
        40
      ),

    acknowledgement:
      payload.acknowledgement === true
  };

  const required = [
    [
      'Your full name',
      clean.reporterName
    ],
    [
      'Your email address',
      clean.reporterEmail
    ],
    [
      'Student first name',
      clean.studentFirstName
    ],
    [
      'Student last name',
      clean.studentLastName
    ],
    [
      'Grade',
      clean.grade
    ],
    [
      'Campus',
      clean.campus
    ],
    [
      'Type of need',
      clean.needCategory
    ],
    [
      'Urgency',
      clean.urgency
    ],
    [
      'Description of the situation',
      clean.situationDescription
    ]
  ];

  const missing =
    required.filter(function(item) {
      return !item[1];
    });

  if (missing.length) {
    throw new Error(
      'Please complete: ' +
      missing.map(function(item) {
        return item[0];
      }).join(', ') +
      '.'
    );
  }

  if (
    !isValidReferralEmail_(
      clean.reporterEmail
    )
  ) {
    throw new Error(
      'Please enter a valid email address.'
    );
  }

  if (
    clean.situationDescription.length < 10
  ) {
    throw new Error(
      'Please provide a little more detail about the situation.'
    );
  }

  if (!clean.acknowledgement) {
    throw new Error(
      'Please confirm that this form is not being used for an emergency or a mental-health or safety concern.'
    );
  }

  const bootstrap =
    getStaffFormBootstrap();

  if (
    bootstrap.campuses.indexOf(
      clean.campus
    ) === -1
  ) {
    throw new Error(
      'Please select a valid campus.'
    );
  }

  if (
    bootstrap.needCategories.indexOf(
      clean.needCategory
    ) === -1
  ) {
    throw new Error(
      'Please select a valid type of need.'
    );
  }

  if (
    bootstrap.urgencyLevels.indexOf(
      clean.urgency
    ) === -1
  ) {
    throw new Error(
      'Please select a valid urgency level.'
    );
  }

  if (
    bootstrap.grades.indexOf(
      clean.grade
    ) === -1
  ) {
    throw new Error(
      'Please select a valid grade.'
    );
  }

  return clean;
}

function isValidReferralEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || '').trim()
  );
}

function getOutreachSpreadsheet_() {
  const spreadsheetId =
    PropertiesService
      .getScriptProperties()
      .getProperty('SPREADSHEET_ID');

  if (!spreadsheetId) {
    throw new Error(
      'The system database has not been configured. Run setupStudentOutreachSystem() from the spreadsheet.'
    );
  }

  return SpreadsheetApp.openById(
    spreadsheetId
  );
}

function getOutreachSetting_(
  settingName
) {
  const sheet =
    getOutreachSpreadsheet_()
      .getSheetByName(
        OUTREACH_CONFIG.SHEETS.SETTINGS
      );

  if (!sheet) {
    throw new Error(
      'The Settings tab could not be found.'
    );
  }

  const values =
    sheet
      .getDataRange()
      .getDisplayValues();

  for (
    let row = 1;
    row < values.length;
    row += 1
  ) {
    if (
      String(values[row][0]).trim() ===
      settingName
    ) {
      return String(
        values[row][1]
      ).trim();
    }
  }

  return '';
}

function setOutreachSetting_(
  settingName,
  value
) {
  const sheet =
    getOutreachSpreadsheet_()
      .getSheetByName(
        OUTREACH_CONFIG.SHEETS.SETTINGS
      );

  if (!sheet) {
    throw new Error(
      'The Settings tab could not be found.'
    );
  }

  const values =
    sheet
      .getDataRange()
      .getDisplayValues();

  for (
    let row = 1;
    row < values.length;
    row += 1
  ) {
    if (
      String(values[row][0]).trim() ===
      settingName
    ) {
      sheet
        .getRange(
          row + 1,
          2
        )
        .setValue(value);

      return;
    }
  }

  throw new Error(
    'Missing system setting: ' +
    settingName
  );
}

function nextOutreachId_(
  counterSetting,
  prefix,
  width
) {
  const current =
    Number(
      getOutreachSetting_(
        counterSetting
      ) || 1
    );

  if (
    !Number.isFinite(current) ||
    current < 1
  ) {
    throw new Error(
      'Invalid counter setting: ' +
      counterSetting
    );
  }

  setOutreachSetting_(
    counterSetting,
    String(current + 1)
  );

  return (
    prefix +
    '-' +
    String(current).padStart(
      width,
      '0'
    )
  );
}

function appendObjectRow_(
  sheet,
  rowObject
) {
  if (!sheet) {
    throw new Error(
      'A required spreadsheet tab could not be found.'
    );
  }

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0];

  const row =
    headers.map(function(header) {
      return Object.prototype
        .hasOwnProperty.call(
          rowObject,
          header
        )
        ? rowObject[header]
        : '';
    });

  sheet.appendRow(row);
}

function getActiveListValues_(
  sheet,
  valueHeader,
  activeHeader
) {
  if (!sheet) {
    return [];
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length < 2) {
    return [];
  }

  const headers =
    values[0].map(String);

  const valueIndex =
    headers.indexOf(valueHeader);

  const activeIndex =
    headers.indexOf(activeHeader);

  if (
    valueIndex === -1 ||
    activeIndex === -1
  ) {
    return [];
  }

  return values
    .slice(1)
    .filter(function(row) {
      const active =
        row[activeIndex];

      return (
        active === true ||
        String(active)
          .toUpperCase() === 'TRUE'
      );
    })
    .map(function(row) {
      return String(
        row[valueIndex]
      ).trim();
    })
    .filter(String);
}

function writeAuditLog_(entry) {
  const sheet =
    getOutreachSpreadsheet_()
      .getSheetByName(
        OUTREACH_CONFIG.SHEETS.AUDIT_LOG
      );

  const auditId =
    nextOutreachId_(
      'NEXT_AUDIT_NUMBER',
      'AUD',
      7
    );

  appendObjectRow_(
    sheet,
    {
      'Audit ID':
        auditId,

      'Timestamp':
        new Date(),

      'User Email':
        entry.userEmail || '',

      'Action':
        entry.action || '',

      'Record Type':
        entry.recordType || '',

      'Record ID':
        entry.recordId || '',

      'Details':
        JSON.stringify(
          entry.details || {}
        )
    }
  );
}

function sendNewReferralNotifications_(
  referral
) {
  const outreachEmail =
    getOutreachSetting_(
      'OUTREACH_EMAIL'
    );

  const shouldConfirmSubmitter =
    getOutreachSetting_(
      'SEND_SUBMITTER_CONFIRMATION'
    ).toUpperCase() === 'TRUE';

  if (outreachEmail) {
    const urgentLabel =
      referral.urgency === 'Urgent'
        ? '[URGENT] '
        : '';

    const subject =
      urgentLabel +
      'New Student Outreach Referral ' +
      referral.referralId +
      ' - ' +
      referral.campus;

    const body = [
      'A new student support referral has been submitted.',
      '',
      'Referral: ' +
        referral.referralId,
      'Student: ' +
        referral.studentName,
      'Campus: ' +
        referral.campus,
      'Grade: ' +
        referral.grade,
      'Type of need: ' +
        referral.category,
      'Urgency: ' +
        referral.urgency,
      'Submitted by: ' +
        referral.reporterName +
        ' (' +
        referral.reporterEmail +
        ')',
      '',
      'Sign in to the student support dashboard to review and manage this case.'
    ].join('\n');

    sendAndLogEmail_(
      referral.referralId,
      outreachEmail,
      'NEW_REFERRAL',
      subject,
      body
    );
  } else {
    logEmailNotification_({
      referralId:
        referral.referralId,

      recipient:
        '',

      notificationType:
        'NEW_REFERRAL',

      subject:
        'Outreach email is not configured',

      status:
        'NOT_CONFIGURED',

      errorMessage:
        'Enter an OUTREACH_EMAIL value on the Settings sheet.'
    });
  }

  if (shouldConfirmSubmitter) {
    const confirmationSubject =
      'Referral received: ' +
      referral.referralId;

    const confirmationBody = [
      'Your student support referral was received successfully.',
      '',
      'Referral number: ' +
        referral.referralId,
      'Campus: ' +
        referral.campus,
      'Submitted: ' +
        Utilities.formatDate(
          referral.submittedAt,
          OUTREACH_CONFIG.TIME_ZONE,
          'MMMM d, yyyy h:mm a'
        ),
      '',
      'The Support Specialist will review the referral. Please keep the referral number for your records.',
      '',
      'This email does not contain confidential case details.'
    ].join('\n');

    sendAndLogEmail_(
      referral.referralId,
      referral.reporterEmail,
      'SUBMITTER_CONFIRMATION',
      confirmationSubject,
      confirmationBody
    );
  }
}

function sendAndLogEmail_(
  referralId,
  recipient,
  notificationType,
  subject,
  body
) {
  try {
    MailApp.sendEmail({
      to:
        recipient,

      subject:
        subject,

      body:
        body,

      name:
        getOutreachSetting_(
          'APP_NAME'
        ) ||
        OUTREACH_CONFIG.APP_NAME
    });

    logEmailNotification_({
      referralId:
        referralId,

      recipient:
        recipient,

      notificationType:
        notificationType,

      subject:
        subject,

      status:
        'SENT',

      sentAt:
        new Date(),

      errorMessage:
        ''
    });
  } catch (error) {
    logEmailNotification_({
      referralId:
        referralId,

      recipient:
        recipient,

      notificationType:
        notificationType,

      subject:
        subject,

      status:
        'FAILED',

      sentAt:
        '',

      errorMessage:
        error && error.message
          ? error.message
          : String(error)
    });
  }
}

function logEmailNotification_(entry) {
  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const sheet =
      getOutreachSpreadsheet_()
        .getSheetByName(
          OUTREACH_CONFIG.SHEETS.NOTIFICATIONS
        );

    const notificationId =
      nextOutreachId_(
        'NEXT_NOTIFICATION_NUMBER',
        'EMAIL',
        7
      );

    appendObjectRow_(
      sheet,
      {
        'Notification ID':
          notificationId,

        'Referral ID':
          entry.referralId || '',

        'Recipient':
          entry.recipient || '',

        'Notification Type':
          entry.notificationType || '',

        'Subject':
          entry.subject || '',

        'Status':
          entry.status || '',

        'Sent At':
          entry.sentAt || '',

        'Error Message':
          entry.errorMessage || ''
      }
    );
  } finally {
    lock.releaseLock();
  }
}

function cleanText_(
  value,
  maximumLength
) {
  return String(
    value == null
      ? ''
      : value
  )
    .replace(
      /[\r\n\t]+/g,
      ' '
    )
    .replace(
      /\s{2,}/g,
      ' '
    )
    .trim()
    .slice(
      0,
      maximumLength
    );
}

function cleanMultilineText_(
  value,
  maximumLength
) {
  return String(
    value == null
      ? ''
      : value
  )
    .replace(
      /\r\n/g,
      '\n'
    )
    .replace(
      /\r/g,
      '\n'
    )
    .trim()
    .slice(
      0,
      maximumLength
    );
}