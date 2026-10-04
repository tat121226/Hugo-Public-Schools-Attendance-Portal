/**
 * Hugo Public Schools
 * Semester attendance threshold notifications
 *
 * Requires:
 * - AttendanceNotificationSetup.gs
 * - AttendanceService.gs with the notification hook
 */

const ATTENDANCE_THRESHOLD_RULES_ = Object.freeze({
  4: Object.freeze({
    action: 'FOURTH ABSENCE LETTER',
    subject: 'Fourth Absence Letter',
    includeLetter: true,
    includeDistrict: false,
    includeSros: false
  }),
  5: Object.freeze({
    action: 'PARENT CONTACT',
    subject: 'PARENT CONTACT REQUIRED - Fifth Absence',
    includeLetter: false,
    includeDistrict: true,
    includeSros: false
  }),
  6: Object.freeze({
    action: 'HOME VISIT',
    subject: 'HOME VISIT REQUIRED - Sixth Absence',
    includeLetter: false,
    includeDistrict: true,
    includeSros: true
  }),
  7: Object.freeze({
    action:
      'REFERRAL WILL BE MADE TO YOUTH SERVICES OR TRIBAL YOUTH SERVICES',
    subject:
      'YOUTH SERVICES REFERRAL - Seventh Absence',
    includeLetter: false,
    includeDistrict: true,
    includeSros: true
  }),
  8: Object.freeze({
    action: 'EIGHTH ABSENCE - CREDIT/TRUANCY WARNING REVIEW',
    subject: 'EIGHTH ABSENCE WARNING REVIEW',
    includeLetter: false,
    includeDistrict: true,
    includeSros: true
  }),
  9: Object.freeze({
    action: 'NINTH ABSENCE',
    subject: 'NINTH ABSENCE NOTICE',
    includeLetter: false,
    includeDistrict: true,
    includeSros: true
  })
});

const ATTENDANCE_NOTIFICATION_THRESHOLDS_ =
  Object.freeze([4, 5, 6, 7, 8, 9]);

const ATTENDANCE_NOTIFICATION_SHEET_ =
  'Attendance Notifications';

const ATTENDANCE_PENDING_TIMEOUT_MINUTES_ = 15;

/* Embedded from the supplied Hugo letter so generated PDFs keep the logo. */
const ATTENDANCE_HUGO_LOGO_BASE64_ =
  'iVBORw0KGgoAAAANSUhEUgAAAFwAAABaCAMAAAACaMF3AAAAXVBMVEX9/f2urqwDAwJtbWzQ0NAiHAhRUFBfX14oKCiXlY7e4ObX2uPWyp7xz1DbxTbSszHDvKD2zzjivDO3pWKKcxuOeCWagyipjij+4j2vlSVgURU0Kwv+7UFFORB4ZhtjjYijAAAGs0lEQVRo3tWZiZajKhCG24W4pSGkAQWU93/MW1WoUaOmp3tyzp2aJR2lP3+Kn0X4+IiRpK8iG0t+5OxFycvHJl7Di3fCf6m8LC5HsVVenpXchVd13uxFXidso7yod0s2dV4ewLMm34/mGX5U9AR+/dyL6zP80uTbUpxzcTuFy73Yh6+K8DuG+Gr+BhzS8rmG87fC+T+qnL8z538ZLv8Y/inRst9U/vkMz1/30EUFPq/59bCHXhfw64seWsUBYw2Hzt/sjy0r+B1HibOxpcwKiCzZwKsiu2yHXCyarOA3KAe/XLDT8ZwlzRpeHoznVbOEX+vsG5PFE/yynYnSPfjtFM4wjuBw56G8pHJrOL81BEfGE7yObX15hjd0LU+auWye5NkBvAJGkn/sR7avvKw35arntBD8iEtRHMDzczif4Mnfh2P/jA36z8Hv74a/Keec0vLvwt+T8zhR/ALevIb/OC1pka2jnOE8sn8D34sJHldyb4Bz/ms4ewq8FJVHtBA/bNDkIGB2VVrI38Hn1416+TpR1xW2KjOS2D+DXx9xuy2/TE3RSvFTuJRdB//gj3WeOdFNY5Wf2tWLqHzRoHVdfwveI3RQUgyjzkjv1MM1hq+V51lZltU34L2NUD+9ezIRb5BwJxz8HyRIv+cEL7O8YOtlziM2E3RnntztsN9IgQQjOd73YRiGcKs2777L9NdJVVyKcgXvxJqLOhnvxof6TngzE8utiuKBrh43q3pW7iLUx4aTd/yhtcYqZIbesHb3VX1wy3VXtXwuqyY4wQYhLV62vVMkfW7IPvh2BYUEpfRU/AWWz5lexZfkc1YgDa6FhzApWQjLUqIfnBmVUt2CuPeBblCTxLxUo2LvhuhedifDCfTb0ItUg6ChE0y7ZQV55xWyvG05Z9jUHgunA3QNNUmPC1xvhAWbkblS11qhBxbr2KaoHOrK7Nxz2JB6KQe84aXxsoMfuE09FE6NEj1ZFbxeU74DN+BlL/puVDel1vTaYwp1bxxlmLUieGGgKneDWREdC70coIoKhgIPDHheF2JeKCkBjcGAf4/5eoTtg1L0KQTK8Vw4IXuXuk7eIV0O04ZKwTwa+3ELXNWPcByABtTLBFQOurdfsiH91jISSGpSLERKQ0du12CN0EPOVSfRoQ7FDWNaKCtCjMWwyARnjqFJupgoQf6KNgtYKMSSLShnXOBT8bsXrh1SPXoxJ4JB4b3BspBY8pzjkmFz9WQ3uKviB9UalAKcatTf4WcZWg7WdY4HyJOh1F7iGw50ZBYxA4c+BwRNSSZ4FM44wQf62uIt3UFu8BFwxdhWMdtDGNDOKY84uETlvSC4l/eo1iHczjSEdDMcHI7FZdeyIAIIpqyijax7GA27P+VcQV7g91qoHycfDGOWUtN12KWhAtSeBp8BE6cEP4KbOYeGld1ksKXP4joqGy8THPRy5tBZnvLgOqp8au80PwTBOy4s3IPEDTDykjlX9prYcWSZ3kAHGkg1KHU9TGIDdgSaGgCuW5DOleE+9D1UJXBq3T0qyWdZnOfqcoajVAXOC9RePcCtAulgLs5g3Op6akHs8unTSMuqjK5dkryqqvxjMyI6MjTCQTmDNoeGspj/njo31Msd77N6Hae5zdRJi48WJUEyULBkA0z1wpkeKwBWa9XCkk9URZNca+MEvVlqx/GDzBuCTdHiYBToKqzFOSx0cRGxAy+yi1M2RtvurlsYdZAAw4sFowlJs6MaJsLYySd4eSlZWSTJhVJwIyyGMbvwkkYVbgToZOFBneGTcqwdAGF19zEt/m/tFAdwalCn1a6tFsqj36cGW8PNEfxwqz1ex2amb4E+DuBmgu+9O20aqmRs0K3BPAx6WaU4o+ej7Sa4ecAr3Firt4lZAJL6ZlrwuFBPtaE1Wg5LQapFfZvZeoQzuMeKpfakgCsLeHMjd9mnFU9BmuZtKBAxhdLH21Cwkn8gEqou0lfOLqdOPW+gzXCtEV4cwMetPzrRKBBO/rXWTWcf6XbrD65BuUjWBG+q7xyI5PnsX6t1dbBpmWM5PbIJnuPRyfF267iLln/NncN+nR2I3PQUSievDkTqR5dbxm0X3k4pQbZS9PHVJMfwBDw1xqNjm69duBmJI1wFiBfwvTiC6yWb+Gf75+AtbKINW0f46vjsMsPVTCblJ/BklLKCqzP4Ev0S/qirnjvIV72XFiiq1ujg3gEP34OrvTiAhwWW0M5lp/Bdt1S7cGh4vY4QquZ1D33HkWV1cIL6vcPWGv+eHIicHhM/jYp/dkx8Hm89mv+/wf8DPJkEEEUqm8cAAAAASUVORK5CYII=';

/**
 * Checks all affected students after a weekly report is saved.
 * Absences are counted independently inside each configured semester.
 */
function processAttendanceThresholdNotifications_(
  studentIds,
  referenceDate,
  recordedBy
) {
  const settings =
    getAttendanceNotificationSettings_();

  if (
    !attendanceNotificationBoolean_(
      settings.ATTENDANCE_NOTIFICATIONS_ENABLED
    )
  ) {
    return {
      enabled: false,
      sent: 0,
      failed: 0,
      skipped: 0
    };
  }

  const semester =
    getAttendanceNotificationSemester_(
      referenceDate,
      settings
    );

  if (!semester) {
    return {
      enabled: true,
      sent: 0,
      failed: 0,
      skipped: 0,
      message:
        'The saved week is outside the configured semester dates.'
    };
  }

  const cleanIds = Array.from(
    new Set(
      (Array.isArray(studentIds)
        ? studentIds
        : []
      )
        .map(function(value) {
          return String(value || '').trim();
        })
        .filter(Boolean)
    )
  );

  if (!cleanIds.length) {
    return {
      enabled: true,
      semester: semester.label,
      sent: 0,
      failed: 0,
      skipped: 0
    };
  }

  const records = sheetToObjects_(
    getAttendanceSheet_('Attendance Records')
  ).filter(function(record) {
    const dateKey = attendanceDateKey_(
      record['Absence Date']
    );

    return (
      cleanIds.indexOf(
        String(record['Student ID'] || '').trim()
      ) !== -1 &&
      String(record['Status'] || '')
        .trim()
        .toUpperCase() === 'ABSENT' &&
      dateKey >= semester.start &&
      dateKey <= semester.end
    );
  });

  const grouped = {};

  records.forEach(function(record) {
    const studentId = String(
      record['Student ID'] || ''
    ).trim();

    if (!grouped[studentId]) {
      grouped[studentId] = [];
    }

    grouped[studentId].push(record);
  });

  const summary = {
    enabled: true,
    semester: semester.label,
    sent: 0,
    failed: 0,
    skipped: 0,
    fourthAbsencePacketsSent: 0,
    fourthAbsenceStudentsBatched: 0,
    studentEmailsSent: 0,
    studentEmailsFailed: 0,
    studentEmailsSkipped: 0,
    errors: []
  };

  const fourthAbsenceBatchItems = [];

  cleanIds.forEach(function(studentId) {
    const studentRecords =
      (grouped[studentId] || [])
        .slice()
        .sort(function(a, b) {
          return attendanceDateKey_(
            a['Absence Date']
          ).localeCompare(
            attendanceDateKey_(
              b['Absence Date']
            )
          );
        });

    const uniqueDates = [];
    const seenDates = {};

    studentRecords.forEach(function(record) {
      const dateKey = attendanceDateKey_(
        record['Absence Date']
      );

      if (dateKey && !seenDates[dateKey]) {
        seenDates[dateKey] = true;
        uniqueDates.push(dateKey);
      }
    });

    const absenceCount = uniqueDates.length;

    if (absenceCount < 4) {
      return;
    }

    const latestRecord =
      studentRecords[studentRecords.length - 1];

    const rosterStudent =
      findAttendanceStudentById_(studentId) || {};

    const student = {
      studentId: studentId,
      fullName: String(
        latestRecord['Student Name'] || ''
      ).trim(),
      grade: String(
        latestRecord['Grade'] || ''
      ).trim(),
      campus: String(
        latestRecord['Campus'] || ''
      )
        .trim()
        .toUpperCase(),
      absenceCount: absenceCount,
      absenceDates: uniqueDates,
      parentGuardianName:
        rosterStudent.parentGuardianName || '',
      parentGuardianPhone:
        rosterStudent.parentGuardianPhone || '',
      studentEmail:
        rosterStudent.studentEmail || '',
      dateOfBirth: rosterStudent.dateOfBirth || '',
      age: rosterStudent.age,
      isAdult: rosterStudent.isAdult === true,
      ferpaStatus: rosterStudent.ferpaStatus || 'DOB MISSING - VERIFY AGE',
      streetAddress:
        rosterStudent.streetAddress || '',
      city: rosterStudent.city || '',
      state: rosterStudent.state || '',
      zipCode: rosterStudent.zipCode || ''
    };

    ensureAttendanceInterventionCase_(
      student,
      semester,
      absenceCount,
      recordedBy
    );

    ATTENDANCE_NOTIFICATION_THRESHOLDS_
      .forEach(function(threshold) {
        if (absenceCount < threshold) {
          return;
        }

        const rule =
          ATTENDANCE_THRESHOLD_RULES_[threshold];

        const campus =
          getAttendanceCampusConfiguration_(
            student.campus,
            settings
          );

        const recipients =
          getAttendanceThresholdRecipients_(
            campus,
            rule,
            settings
          );

        const subject =
          rule.subject +
          ' - ' +
          student.fullName +
          ' (' +
          student.campus +
          ')';

        const letterFileName =
          rule.includeLetter
            ? safeAttendanceFileName_(
                student.fullName +
                ' - Fourth Absence Letter.pdf'
              )
            : '';

        const detailFileName =
          safeAttendanceFileName_(
            student.fullName +
            ' - Attendance Detail.pdf'
          );

        const reservation =
          reserveAttendanceNotification_(
            {
              semester: semester,
              threshold: threshold,
              student: student,
              thresholdDate:
                uniqueDates[threshold - 1],
              recipients: recipients,
              subject: subject,
              recordedBy: recordedBy,
              letterFileName: letterFileName,
              detailFileName: detailFileName
            }
          );

        if (!reservation) {
          summary.skipped += 1;
          return;
        }

        if (reservation.staffAlreadySent) {
          sendStudentAttendanceNotification_(
            reservation.rowNumber,
            student,
            campus,
            semester,
            threshold,
            rule,
            settings,
            summary
          );
          return;
        }

        if (threshold === 4) {
          fourthAbsenceBatchItems.push({
            student: student,
            campus: campus,
            semester: semester,
            threshold: threshold,
            thresholdDate: uniqueDates[threshold - 1],
            recipients: recipients,
            rule: rule,
            reservation: reservation,
            letterFileName: letterFileName,
            detailFileName: detailFileName
          });
          return;
        }

        try {
          const attachments = [];

          if (rule.includeLetter) {
            attachments.push(
              createFourthAbsenceLetterPdf_(
                student,
                campus,
                semester,
                letterFileName
              )
            );
          }

          attachments.push(
            createAttendanceDetailPdf_(
              student,
              campus,
              semester,
              detailFileName
            )
          );

          const message =
            buildAttendanceThresholdEmail_(
              student,
              campus,
              semester,
              threshold,
              rule
            );

          MailApp.sendEmail({
            to: recipients.join(','),
            subject: subject,
            body: message.text,
            htmlBody: message.html,
            attachments: attachments,
            name:
              'Hugo Public Schools Attendance'
          });

          completeAttendanceNotification_(
            reservation.rowNumber,
            'SENT',
            ''
          );

          recordAutomaticAttendanceIntervention_({
            semester: semester,
            threshold: threshold,
            thresholdDate: uniqueDates[threshold - 1],
            student: student,
            title: rule.action,
            details: attendanceAutomaticTimelineDetails_(
              threshold,
              student
            ),
            recipients: recipients,
            status: 'SENT',
            nextStep: attendanceThresholdNextStep_(threshold),
            notificationId: reservation.notificationId,
            createdBy: recordedBy
          });

          sendStudentAttendanceNotification_(
            reservation.rowNumber,
            student,
            campus,
            semester,
            threshold,
            rule,
            settings,
            summary
          );

          summary.sent += 1;
        } catch (error) {
          const errorText = String(
            error && error.message
              ? error.message
              : error
          );

          completeAttendanceNotification_(
            reservation.rowNumber,
            'FAILED',
            errorText
          );

          recordAutomaticAttendanceIntervention_({
            semester: semester,
            threshold: threshold,
            thresholdDate: uniqueDates[threshold - 1],
            student: student,
            title: rule.action + ' - EMAIL FAILED',
            details: errorText,
            recipients: recipients,
            status: 'FAILED',
            nextStep: 'Correct the email error and resave attendance to retry.',
            notificationId: reservation.notificationId,
            createdBy: recordedBy
          });

          summary.failed += 1;
          summary.errors.push(
            student.fullName +
            ' threshold ' +
            threshold +
            ': ' +
            errorText
          );
        }
      });
  });

  sendFourthAbsenceBatchPackets_(
    fourthAbsenceBatchItems,
    semester,
    referenceDate,
    recordedBy,
    summary
  );

  return summary;
}

function getAttendanceNotificationSettings_() {
  const sheet = getAttendanceSheet_('Settings');
  const values = sheet.getDataRange()
    .getDisplayValues();
  const settings = {};

  values.slice(1).forEach(function(row) {
    const key = String(row[0] || '').trim();

    if (key) {
      settings[key] = String(row[1] || '').trim();
    }
  });

  return settings;
}

function getAttendanceNotificationSemester_(
  referenceDate,
  settings
) {
  const dateKey = normalizeAttendanceSettingDate_(
    referenceDate
  );

  const semesters = [
    {
      id: '2026-2027-S1',
      label: 'First Semester 2026-2027',
      start: normalizeAttendanceSettingDate_(
        settings.ATTENDANCE_FIRST_SEMESTER_START
      ),
      end: normalizeAttendanceSettingDate_(
        settings.ATTENDANCE_FIRST_SEMESTER_END
      )
    },
    {
      id: '2026-2027-S2',
      label: 'Second Semester 2026-2027',
      start: normalizeAttendanceSettingDate_(
        settings.ATTENDANCE_SECOND_SEMESTER_START
      ),
      end: normalizeAttendanceSettingDate_(
        settings.ATTENDANCE_SECOND_SEMESTER_END
      )
    }
  ];

  return semesters.find(function(semester) {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(semester.start) &&
      /^\d{4}-\d{2}-\d{2}$/.test(semester.end) &&
      dateKey >= semester.start &&
      dateKey <= semester.end
    );
  }) || null;
}

function getAttendanceCampusConfiguration_(
  campusCode,
  settings
) {
  const staticCampuses = {
    HES: {
      name: 'Hugo Elementary School',
      address: '1100 David Roebuck Lane',
      cityStateZip: 'Hugo, Oklahoma 74743',
      phone: '580.326.8373',
      fax: '405.256.1929',
      letterAdministrators: [
        {
          name: 'Shelby Dawes',
          title: 'Principal'
        },
        {
          name: 'Kimberly Graham',
          title: 'Assistant Principal'
        }
      ]
    },
    HIS: {
      name: 'Hugo Intermediate School',
      address: '505 N. 8th Street',
      cityStateZip: 'Hugo, Oklahoma 74743',
      phone: '580.326.0106',
      fax: '405.256.1930',
      letterAdministrators: [
        {
          name: 'Vivian Shanklin',
          title: 'Principal'
        }
      ]
    },
    HMS: {
      name: 'Hugo Middle School',
      address: '300 North E Street',
      cityStateZip: 'Hugo, Oklahoma 74743',
      phone: '580.326.3365',
      fax: '405.256.1931',
      letterAdministrators: [
        {
          name: 'Kendra Taylor',
          title: 'Principal'
        },
        {
          name: 'Alpha Benson',
          title: 'Assistant Principal'
        }
      ]
    },
    HHS: {
      name: 'Hugo High School',
      address: '704 North Second Street',
      cityStateZip: 'Hugo, Oklahoma 74743',
      phone: '580.326.9648',
      fax: '580.326.4811',
      letterAdministrators: [
        {
          name: 'Sammy Drinkard',
          title: 'Principal'
        },
        {
          name: 'Jana Lampton',
          title: 'Assistant Principal'
        }
      ]
    }
  };

  const base = staticCampuses[campusCode];

  if (!base) {
    throw new Error(
      'No notification configuration was found for ' +
      campusCode +
      '.'
    );
  }

  const prefix = 'ATTENDANCE_' + campusCode + '_';

  const adminNames = splitAttendanceSetting_(
    settings[prefix + 'ADMIN_NAMES']
  );

  const adminEmails = splitAttendanceSetting_(
    settings[prefix + 'ADMIN_EMAILS']
  );

  if (!adminNames.length || !adminEmails.length) {
    throw new Error(
      campusCode +
      ' principal settings are incomplete.'
    );
  }

  return {
    code: campusCode,
    name: base.name,
    address: base.address,
    cityStateZip: base.cityStateZip,
    phone: base.phone,
    fax: base.fax,
    contactName: settings[
      prefix + 'CONTACT_NAME'
    ],
    contactEmail: settings[
      prefix + 'CONTACT_EMAIL'
    ],
    adminNames: adminNames,
    adminEmails: adminEmails,
    letterAdministrators:
      base.letterAdministrators.slice(),
    principalName:
      base.letterAdministrators[0].name
  };
}

function getAttendanceThresholdRecipients_(
  campus,
  rule,
  settings
) {
  let recipients = [campus.contactEmail]
    .concat(campus.adminEmails);

  if (rule.includeDistrict) {
    recipients.push(
      settings.ATTENDANCE_DISTRICT_ADMIN_EMAIL
    );
  }

  if (rule.includeSros) {
    recipients = recipients.concat(
      splitAttendanceSetting_(
        settings.ATTENDANCE_SRO_EMAILS
      )
    );
  }

  const unique = [];

  recipients.forEach(function(email) {
    const clean = String(email || '')
      .trim()
      .toLowerCase();

    if (
      clean &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) &&
      unique.indexOf(clean) === -1
    ) {
      unique.push(clean);
    }
  });

  if (!unique.length) {
    throw new Error(
      'No valid notification recipients were configured.'
    );
  }

  return unique;
}

function reserveAttendanceNotification_(data) {
  const sheet = getAttendanceSheet_(
    ATTENDANCE_NOTIFICATION_SHEET_
  );

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const now = new Date();
    const existing = sheetToObjects_(sheet)
      .find(function(record) {
        return (
          String(record['Semester'] || '').trim() ===
            data.semester.id &&
          Number(record['Threshold']) ===
            data.threshold &&
          String(record['Student ID'] || '').trim() ===
            data.student.studentId
        );
      });

    if (existing) {
      const status = String(
        existing['Status'] || ''
      )
        .trim()
        .toUpperCase();

      if (status === 'SENT') {
        const studentStatus = String(
          existing['Student Email Status'] || ''
        )
          .trim()
          .toUpperCase();

        if (studentStatus === 'SENT') {
          return null;
        }

        return {
          rowNumber: existing._rowNumber,
          notificationId: String(
            existing['Notification ID'] || ''
          ).trim(),
          staffAlreadySent: true
        };
      }

      const startedAt = new Date(
        existing['Attempt Started At'] || 0
      );

      const pendingIsFresh =
        status === 'PENDING' &&
        !Number.isNaN(startedAt.getTime()) &&
        (
          now.getTime() - startedAt.getTime()
        ) <
          ATTENDANCE_PENDING_TIMEOUT_MINUTES_ *
          60 *
          1000;

      if (pendingIsFresh) {
        return null;
      }

      updateObjectRow_(
        sheet,
        existing._rowNumber,
        {
          'Student Name': data.student.fullName,
          'Grade': data.student.grade,
          'Campus': data.student.campus,
          'Absence Count': data.student.absenceCount,
          'Threshold Absence Date':
            parseAttendanceDate_(data.thresholdDate),
          'Recipients': data.recipients.join(', '),
          'Subject': data.subject,
          'Status': 'PENDING',
          'Attempt Started At': now,
          'Sent At': '',
          'Error': '',
          'Created By': data.recordedBy,
          'Letter File Name': data.letterFileName,
          'Detail Report File Name': data.detailFileName
          ,
          'Student Email': data.student.studentEmail || ''
        }
      );

      return {
        rowNumber: existing._rowNumber,
        notificationId: String(
          existing['Notification ID'] || ''
        ).trim()
      };
    }

    const notificationId =
      createAttendanceNotificationId_();

    appendObjectRow_(sheet, {
      'Notification ID': notificationId,
      'Semester': data.semester.id,
      'Threshold': data.threshold,
      'Student ID': data.student.studentId,
      'Student Name': data.student.fullName,
      'Grade': data.student.grade,
      'Campus': data.student.campus,
      'Absence Count': data.student.absenceCount,
      'Threshold Absence Date':
        parseAttendanceDate_(data.thresholdDate),
      'Recipients': data.recipients.join(', '),
      'Subject': data.subject,
      'Status': 'PENDING',
      'Attempt Started At': now,
      'Sent At': '',
      'Error': '',
      'Created At': now,
      'Created By': data.recordedBy,
      'Letter File Name': data.letterFileName,
      'Detail Report File Name': data.detailFileName
      ,
      'Student Email': data.student.studentEmail || '',
      'Student Email Subject': '',
      'Student Email Status': 'NOT ATTEMPTED',
      'Student Email Sent At': '',
      'Student Email Error': ''
    });

    return {
      rowNumber: sheet.getLastRow(),
      notificationId: notificationId
    };
  } finally {
    lock.releaseLock();
  }
}

function completeAttendanceNotification_(
  rowNumber,
  status,
  errorText
) {
  const sheet = getAttendanceSheet_(
    ATTENDANCE_NOTIFICATION_SHEET_
  );

  updateObjectRow_(
    sheet,
    rowNumber,
    {
      'Status': status,
      'Sent At': status === 'SENT'
        ? new Date()
        : '',
      'Error': errorText || ''
    }
  );
}

function createFourthAbsenceLetterPdf_(
  student,
  campus,
  semester,
  fileName
) {
  const html = buildFourthAbsenceLetterHtml_(
    student,
    campus,
    semester
  );

  return htmlToAttendancePdf_(html, fileName);
}

function createAttendanceDetailPdf_(
  student,
  campus,
  semester,
  fileName
) {
  const html = buildAttendanceDetailHtml_(
    student,
    campus,
    semester
  );

  return htmlToAttendancePdf_(html, fileName);
}

function htmlToAttendancePdf_(html, fileName) {
  return Utilities
    .newBlob(
      html,
      'text/html',
      fileName.replace(/\.pdf$/i, '.html')
    )
    .getAs(MimeType.PDF)
    .setName(fileName);
}

/**
 * Sends one printable fourth-absence packet per campus.
 * Each student's existing letter is followed by the existing
 * Student Attendance Detail Report. Individual notification rows
 * and intervention timeline entries are still completed separately.
 */
function sendFourthAbsenceBatchPackets_(
  items,
  semester,
  referenceDate,
  recordedBy,
  summary
) {
  if (!Array.isArray(items) || !items.length) {
    return;
  }

  const groups = {};

  items.forEach(function(item) {
    const campusCode = item.campus.code;

    if (!groups[campusCode]) {
      groups[campusCode] = [];
    }

    groups[campusCode].push(item);
  });

  Object.keys(groups).forEach(function(campusCode) {
    const campusItems = groups[campusCode]
      .slice()
      .sort(function(a, b) {
        return a.student.fullName.localeCompare(
          b.student.fullName
        );
      });

    const campus = campusItems[0].campus;
    const recipients = campusItems[0].recipients;
    const weekEnding = formatAttendanceShortDate_(
      referenceDate
    );

    const subject =
      'Fourth Absence Letter Packet - ' +
      campus.code +
      ' - Week Ending ' +
      weekEnding;

    const packetFileName = safeAttendanceFileName_(
      campus.code +
      ' - Fourth Absence Letter Packet - ' +
      attendanceDateKey_(referenceDate) +
      '.pdf'
    );

    campusItems.forEach(function(item) {
      updateAttendanceNotificationBatchMetadata_(
        item.reservation.rowNumber,
        subject,
        packetFileName
      );
    });

    try {
      const packet = createFourthAbsenceBatchPdf_(
        campusItems,
        packetFileName
      );

      const message = buildFourthAbsenceBatchEmail_(
        campusItems,
        campus,
        semester,
        weekEnding
      );

      MailApp.sendEmail({
        to: recipients.join(','),
        subject: subject,
        body: message.text,
        htmlBody: message.html,
        attachments: [packet],
        name: 'Hugo Public Schools Attendance'
      });

      campusItems.forEach(function(item) {
        completeAttendanceNotification_(
          item.reservation.rowNumber,
          'SENT',
          ''
        );

        recordAutomaticAttendanceIntervention_({
          semester: semester,
          threshold: 4,
          thresholdDate: item.thresholdDate,
          student: item.student,
          title: item.rule.action,
          details: attendanceAutomaticTimelineDetails_(
            4,
            item.student
          ),
          recipients: item.recipients,
          status: 'SENT',
          nextStep: attendanceThresholdNextStep_(4),
          notificationId:
            item.reservation.notificationId,
          createdBy: recordedBy
        });

        sendStudentAttendanceNotification_(
          item.reservation.rowNumber,
          item.student,
          campus,
          semester,
          4,
          item.rule,
          getAttendanceNotificationSettings_(),
          summary
        );
      });

      summary.sent += 1;
      summary.fourthAbsencePacketsSent += 1;
      summary.fourthAbsenceStudentsBatched +=
        campusItems.length;
    } catch (error) {
      const errorText = String(
        error && error.message
          ? error.message
          : error
      );

      campusItems.forEach(function(item) {
        completeAttendanceNotification_(
          item.reservation.rowNumber,
          'FAILED',
          errorText
        );

        recordAutomaticAttendanceIntervention_({
          semester: semester,
          threshold: 4,
          thresholdDate: item.thresholdDate,
          student: item.student,
          title:
            item.rule.action + ' - EMAIL FAILED',
          details: errorText,
          recipients: item.recipients,
          status: 'FAILED',
          nextStep:
            'Correct the email error and resave attendance to retry.',
          notificationId:
            item.reservation.notificationId,
          createdBy: recordedBy
        });
      });

      summary.failed += 1;
      summary.errors.push(
        campus.code +
        ' fourth-absence packet: ' +
        errorText
      );
    }
  });
}

function updateAttendanceNotificationBatchMetadata_(
  rowNumber,
  subject,
  packetFileName
) {
  const sheet = getAttendanceSheet_(
    ATTENDANCE_NOTIFICATION_SHEET_
  );

  updateObjectRow_(sheet, rowNumber, {
    'Subject': subject,
    'Letter File Name': packetFileName,
    'Detail Report File Name': packetFileName
  });
}

function createFourthAbsenceBatchPdf_(
  items,
  fileName
) {
  const html = buildFourthAbsenceBatchHtml_(items);
  return htmlToAttendancePdf_(html, fileName);
}

function buildFourthAbsenceBatchHtml_(items) {
  if (!items.length) {
    throw new Error(
      'No fourth-absence letters were available for the packet.'
    );
  }

  const firstItem = items[0];

  const sampleLetterHtml =
    buildFourthAbsenceLetterHtml_(
      firstItem.student,
      firstItem.campus,
      firstItem.semester
    );

  const sampleDetailHtml =
    buildAttendanceDetailHtml_(
      firstItem.student,
      firstItem.campus,
      firstItem.semester
    );

  const letterCss = scopeAttendanceBatchCss_(
    extractAttendanceHtmlStyles_(sampleLetterHtml),
    'attendance-batch-letter'
  );

  const detailCss = scopeAttendanceBatchCss_(
    extractAttendanceHtmlStyles_(sampleDetailHtml),
    'attendance-batch-detail'
  );

  const pages = [];

  items.forEach(function(item) {
    const letterHtml = buildFourthAbsenceLetterHtml_(
      item.student,
      item.campus,
      item.semester
    );

    const detailHtml = buildAttendanceDetailHtml_(
      item.student,
      item.campus,
      item.semester
    );

    pages.push(
      '<section class="attendance-batch-page attendance-batch-letter">' +
      extractAttendanceHtmlBody_(letterHtml) +
      '</section>'
    );

    pages.push(
      '<section class="attendance-batch-page attendance-batch-detail">' +
      extractAttendanceHtmlBody_(detailHtml) +
      '</section>'
    );
  });

  return '<!DOCTYPE html>' +
    '<html><head><meta charset="UTF-8">' +
    '<style>' +
    '@page{size:letter;margin:.42in .62in .38in;}' +
    'body{margin:0;}' +
    '.attendance-batch-page{' +
      'display:block;' +
      'width:100%;' +
      'page-break-after:always;' +
      'break-after:page;' +
    '}' +
    '.attendance-batch-page:last-child{' +
      'page-break-after:auto;' +
      'break-after:auto;' +
    '}' +
    '.attendance-batch-detail{' +
      'padding:.13in 0;' +
    '}' +
    letterCss +
    detailCss +
    '</style></head><body>' +
    pages.join('') +
    '</body></html>';
}

function extractAttendanceHtmlBody_(html) {
  const match = String(html || '').match(
    /<body[^>]*>([\s\S]*?)<\/body>/i
  );

  if (!match) {
    throw new Error(
      'The attendance PDF body could not be prepared.'
    );
  }

  return match[1];
}

function extractAttendanceHtmlStyles_(html) {
  const styles = [];
  const pattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;

  while ((match = pattern.exec(String(html || '')))) {
    styles.push(match[1]);
  }

  if (!styles.length) {
    throw new Error(
      'The attendance PDF styles could not be prepared.'
    );
  }

  return styles.join('\n');
}

function scopeAttendanceBatchCss_(css, scopeClass) {
  const scope = '.' + scopeClass;

  return String(css || '')
    .replace(/@page\s*\{[^}]*\}/gi, '')
    .replace(
      /(^|})(\s*)([^@{}][^{}]*)\{/g,
      function(match, boundary, spacing, selectors) {
        const scopedSelectors = selectors
          .split(',')
          .map(function(selector) {
            const clean = selector.trim();

            if (clean === 'body') {
              return scope;
            }

            if (clean === '*') {
              return scope + ', ' + scope + ' *';
            }

            return scope + ' ' + clean;
          })
          .join(', ');

        return boundary + spacing +
          scopedSelectors + '{';
      }
    );
}

function buildFourthAbsenceBatchEmail_(
  items,
  campus,
  semester,
  weekEnding
) {
  const studentLines = items.map(function(item) {
    let review = '';

    if (item.student.isAdult) {
      review = ' - FERPA: Address letter to student';
    } else if (!item.student.dateOfBirth) {
      review = ' - FERPA review: Date of birth missing';
    }

    return '- ' +
      item.student.fullName +
      ' (Grade ' +
      (item.student.grade || 'Not listed') +
      ', ' +
      item.student.absenceCount +
      ' semester absences)' +
      review;
  });

  const text =
    'FOURTH ABSENCE LETTER PACKET\n\n' +
    'Campus: ' + campus.name + '\n' +
    'Semester: ' + semester.label + '\n' +
    'Week ending: ' + weekEnding + '\n' +
    'Students included: ' + items.length + '\n\n' +
    studentLines.join('\n') + '\n\n' +
    'The attached PDF is arranged for batch printing. ' +
    'Each student\'s fourth-absence letter is immediately followed by that student\'s current Student Attendance Detail Report.\n\n' +
    'Please review, print, and deliver each letter according to campus procedures. This is an internal staff email and was not automatically sent to a student or parent/guardian.';

  const rows = items.map(function(item) {
    let review = 'Standard parent/guardian letter';

    if (item.student.isAdult) {
      review =
        'FERPA: Letter addressed directly to student';
    } else if (!item.student.dateOfBirth) {
      review =
        'FERPA review required: Date of birth missing';
    }

    return '<tr>' +
      '<td style="padding:8px;border:1px solid #ccc">' +
        escapeAttendanceHtml_(item.student.fullName) +
      '</td>' +
      '<td style="padding:8px;border:1px solid #ccc">' +
        escapeAttendanceHtml_(
          item.student.grade || 'Not listed'
        ) +
      '</td>' +
      '<td style="padding:8px;border:1px solid #ccc;text-align:center">' +
        item.student.absenceCount +
      '</td>' +
      '<td style="padding:8px;border:1px solid #ccc">' +
        escapeAttendanceHtml_(review) +
      '</td>' +
    '</tr>';
  }).join('');

  const html =
    '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:760px">' +
      '<div style="background:#111;color:#fff;border-top:6px solid #c5b358;padding:16px 20px">' +
        '<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase">Hugo Public Schools Attendance</div>' +
        '<div style="font-size:22px;font-weight:bold;margin-top:4px">Fourth Absence Letter Packet</div>' +
      '</div>' +
      '<div style="border:1px solid #ccc;border-top:0;padding:20px">' +
        '<p><strong>Campus:</strong> ' +
          escapeAttendanceHtml_(campus.name) +
          '<br><strong>Semester:</strong> ' +
          escapeAttendanceHtml_(semester.label) +
          '<br><strong>Week ending:</strong> ' +
          escapeAttendanceHtml_(weekEnding) +
          '<br><strong>Students included:</strong> ' +
          items.length +
        '</p>' +
        '<table style="border-collapse:collapse;width:100%;margin:18px 0">' +
          '<thead><tr style="background:#111;color:#fff">' +
            '<th style="padding:8px;border:1px solid #111;text-align:left">Student</th>' +
            '<th style="padding:8px;border:1px solid #111;text-align:left">Grade</th>' +
            '<th style="padding:8px;border:1px solid #111">Absences</th>' +
            '<th style="padding:8px;border:1px solid #111;text-align:left">Letter Review</th>' +
          '</tr></thead><tbody>' +
          rows +
          '</tbody></table>' +
        '<p><strong>The attached PDF is arranged for batch printing.</strong> Each student&rsquo;s fourth-absence letter is immediately followed by that student&rsquo;s current Student Attendance Detail Report.</p>' +
        '<p>Please review, print, and deliver each letter according to campus procedures.</p>' +
        '<p style="font-size:12px;color:#555;margin-top:24px">This is an internal staff email. The system did not automatically send the packet to a student or parent/guardian.</p>' +
      '</div>' +
    '</div>';

  return {
    text: text,
    html: html
  };
}

function buildFourthAbsenceLetterHtml_(
  student,
  campus,
  semester
) {
  const contactLines = [];

  campus.letterAdministrators.forEach(
    function(administrator) {
      contactLines.push(
        '<div><strong>' +
        escapeAttendanceHtml_(administrator.name) +
        ', ' +
        escapeAttendanceHtml_(administrator.title) +
        '</strong>' +
        '</div>'
      );
    }
  );

  const adultStudent = student.isAdult === true;
  const recipientBlock = adultStudent
    ? '<div style="margin:0 0 12px;font-size:10pt;line-height:1.3">' +
        '<strong>Student Recipient:</strong> ' +
          escapeAttendanceHtml_(student.fullName) + '<br>' +
        '<strong>Address:</strong> ' +
          escapeAttendanceHtml_(attendanceStudentAddress_(student) || 'Not listed') +
      '</div>'
    : '<div style="margin:0 0 12px;font-size:10pt;line-height:1.3">' +
        '<strong>Parent/Guardian:</strong> ' +
          escapeAttendanceHtml_(student.parentGuardianName || 'Not listed') + '<br>' +
        '<strong>Phone:</strong> ' +
          escapeAttendanceHtml_(student.parentGuardianPhone || 'Not listed') + '<br>' +
        '<strong>Address:</strong> ' +
          escapeAttendanceHtml_(attendanceStudentAddress_(student) || 'Not listed') +
      '</div>';

  const letterContent = adultStudent
    ? '<p class="salutation">Dear ' +
        escapeAttendanceHtml_(student.fullName) + ',</p>' +
      '<p>I am writing to check in regarding your attendance and to offer our support. According to our records, you have been absent four (4) or more days during the current semester. A Student Attendance Detail Report is attached for your review. Please let us know if this information appears inaccurate. If you have medical documentation or other absence documentation, please submit it to the school as soon as possible.</p>' +
      '<p>All non-activity absences count in this policy. DOCTOR/DENTIST APPOINTMENTS ARE ABSENCES AND COUNT TOWARD THE TOTAL NUMBER OF ABSENCES ALLOWED PER SEMESTER. Students are required to provide the office with signed doctor\'s notes within five days of returning to school after a medical absence. If you have already submitted supporting documentation, it will be kept on file in the school office.</p>' +
      '<p>Because you are 18 years of age or older, rights under the Family Educational Rights and Privacy Act generally belong to you as an eligible student. This attendance notice is therefore addressed directly to you. Education-record information should be shared with a parent or guardian only when you have provided appropriate consent or when another FERPA exception and district policy permit the disclosure.</p>' +
      '<p>The ' + escapeAttendanceHtml_(campus.name) +
        ' Student Handbook outlines the district&rsquo;s attendance expectations and procedures. Students who miss more than eight (8) days in a semester may not receive credit. Please contact the school promptly so we can review your attendance and discuss available support.</p>' +
      '<p class="closing">If you have questions, concerns, or believe there is a discrepancy in our records, please contact the school directly. We appreciate your prompt attention to this matter.</p>'
    : '<p class="salutation">Dear ' +
        escapeAttendanceHtml_(student.parentGuardianName || 'Parent/Guardian') + ',</p>' +
      '<p>I am writing to check in regarding your student, <strong class="student-line">' +
        escapeAttendanceHtml_(student.fullName) +
        '</strong>, and to offer our support. According to our records, your child has been absent four (4) or more days during the current semester. A Student Attendance Detail Report is attached for your review. Please let us know if this information appears inaccurate. If you have medical documentation or other excused absence notes, please submit them to the school as soon as possible.</p>' +
      '<p>All non-activity absences count in this policy. DOCTOR/DENTIST APPOINTMENTS ARE ABSENCES AND COUNT TOWARD THE TOTAL NUMBER OF ABSENCES ALLOWED PER SEMESTER. Students are required to provide the office with signed doctor\'s notes within five days of returning to school after a medical absence. If you have already submitted supporting documentation, it will be kept on file in the school office.</p>' +
      '<p>The State of Oklahoma and the Hugo Board of Education recognize that regular school attendance is vital to student success. Oklahoma State Law 70 O.S. &sect; 10-105(A) states that <span class="quote">&ldquo;it shall be unlawful for a parent, guardian, custodian, or other person having control of a minor child to neglect or refuse to cause or compel such child to attend and comply with the rules of a public, private, or other school, unless other means of education are provided for the full term the schools of the district are in session.&rdquo;</span> The law further requires parents or guardians to notify the school of the cause of any student&rsquo;s absence.</p>' +
      '<p>In addition, the ' + escapeAttendanceHtml_(campus.name) +
        ' Student Handbook outlines the district&rsquo;s attendance expectations and procedures. Students who miss more than eight (8) days in a semester may not receive credit and may be referred to the District Attorney for truancy proceedings, as required by state law.</p>' +
      '<p>When students attend school regularly, they are far more likely to be successful academically, remain engaged, and continue making progress toward graduation. Our goal is to partner with you to improve your student&rsquo;s attendance and support continued learning. Upon a sixth absence, school personnel and School Resource Officers will be notified for a home visit. Upon a seventh absence, a referral will be made to Youth Services and/or Tribal Youth Services.</p>' +
      '<p class="closing">If you have any questions, concerns, or believe there is a discrepancy in our records, please contact the school directly. We appreciate your cooperation and your commitment to your child&rsquo;s education.</p>';

  return '<!DOCTYPE html>' +
    '<html><head><meta charset="UTF-8">' +
    '<style>' +
    '@page{size:letter;margin:.42in .62in .38in;}' +
    '*{box-sizing:border-box;}' +
    'body{margin:0;color:#111;font-family:Georgia,"Times New Roman",serif;font-size:11.1pt;line-height:1.18;}' +
    '.header{display:table;width:100%;margin:0 0 10px;table-layout:fixed;}' +
    '.logo-cell,.school-cell{display:table-cell;vertical-align:top;text-align:center;}' +
    '.logo-cell{width:20%;padding-top:4px;}' +
    '.school-cell{width:60%;font-weight:bold;font-size:11.7pt;line-height:1.25;}' +
    '.school-name{font-size:13.5pt;margin-bottom:2px;}' +
    '.logo{width:92px;height:90px;object-fit:contain;}' +
    '.contacts{text-align:center;font-size:9.5pt;line-height:1.35;margin:2px 0 12px;}' +
    '.contacts div{margin:3px 0;}' +
    'p{margin:0 0 10px;text-align:justify;text-indent:.38in;}' +
    '.salutation,.closing{margin-top:0;text-indent:0;text-align:left;}' +
    '.student-line{white-space:nowrap;}' +
    '.quote{font-style:italic;}' +
    '.signature{margin-top:2px;line-height:1.2;}' +
    '.footer{margin-top:14px;border-top:3px solid #7b3f16;padding-top:5px;text-align:center;font-family:Arial,sans-serif;font-size:10.3pt;}' +
    '</style></head><body>' +
    '<div class="header">' +
      '<div class="logo-cell">' +
        attendanceLogoMarkup_() +
      '</div>' +
      '<div class="school-cell">' +
        '<div class="school-name">' +
          escapeAttendanceHtml_(campus.name) +
        '</div>' +
        '<div>' + escapeAttendanceHtml_(campus.address) + '</div>' +
        '<div>' + escapeAttendanceHtml_(campus.cityStateZip) + '</div>' +
        '<div>Phone: ' + escapeAttendanceHtml_(campus.phone) + '</div>' +
        '<div>Fax: ' + escapeAttendanceHtml_(campus.fax) + '</div>' +
      '</div>' +
      '<div class="logo-cell">' +
        attendanceLogoMarkup_() +
      '</div>' +
    '</div>' +
    '<div class="contacts">' +
      contactLines.join('') +
    '</div>' +
    recipientBlock +
    letterContent +
    '<p class="closing">Sincerely,</p>' +
    '<div class="signature">' +
      '<div>' + escapeAttendanceHtml_(campus.principalName) + '</div>' +
      '<div>' + escapeAttendanceHtml_(campus.code) + ' Principal</div>' +
    '</div>' +
    '<div class="footer">The District of Choice: Engaging Students in Meaningful Learning Every Day</div>' +
    '</body></html>';
}

function buildAttendanceDetailHtml_(
  student,
  campus,
  semester
) {
  const rows = student.absenceDates
    .map(function(dateKey, index) {
      return '<tr>' +
        '<td>' + (index + 1) + '</td>' +
        '<td>' +
          escapeAttendanceHtml_(
            formatAttendanceLongDate_(dateKey)
          ) +
        '</td>' +
        '<td>' +
          escapeAttendanceHtml_(
            formatAttendanceWeekday_(dateKey)
          ) +
        '</td>' +
        '<td>Absent</td>' +
      '</tr>';
    })
    .join('');

  return '<!DOCTYPE html>' +
    '<html><head><meta charset="UTF-8">' +
    '<style>' +
    '@page{size:letter;margin:.55in;}' +
    'body{margin:0;color:#111;font-family:Arial,sans-serif;font-size:11pt;}' +
    '.title{text-align:center;border-bottom:4px solid #c5b358;padding-bottom:12px;margin-bottom:20px;}' +
    'h1{font-size:20pt;margin:0 0 4px;}' +
    'h2{font-size:13pt;margin:0;font-weight:normal;}' +
    '.details{display:table;width:100%;margin-bottom:20px;border:1px solid #bbb;}' +
    '.detail-row{display:table-row;}' +
    '.label,.value{display:table-cell;padding:7px 9px;border-bottom:1px solid #ddd;}' +
    '.label{width:26%;font-weight:bold;background:#f1f1f1;}' +
    'table{width:100%;border-collapse:collapse;}' +
    'th{background:#111;color:#fff;padding:8px;border:1px solid #111;text-align:left;}' +
    'td{padding:8px;border:1px solid #bbb;}' +
    'th:first-child,td:first-child{width:9%;text-align:center;}' +
    '.total{margin-top:14px;text-align:right;font-weight:bold;font-size:12pt;}' +
    '.footer{margin-top:28px;padding-top:8px;border-top:3px solid #c5b358;text-align:center;font-size:9.5pt;}' +
    '.ferpa-alert{margin:0 0 16px;padding:11px 13px;border:2px solid #a32323;background:#fff0f0;color:#7d1010;font-weight:bold;}' +
    '</style></head><body>' +
    '<div class="title">' +
      '<h1>Student Attendance Detail Report</h1>' +
      '<h2>' + escapeAttendanceHtml_(campus.name) + '</h2>' +
    '</div>' +
    (student.isAdult
      ? '<div class="ferpa-alert">FERPA ALERT: This student is age 18 or older. Verify student consent or another applicable FERPA exception and district policy before releasing education-record information to a parent/guardian.</div>'
      : (!student.dateOfBirth
        ? '<div class="ferpa-alert">FERPA REVIEW REQUIRED: Date of Birth is missing. Verify the student&rsquo;s age before releasing education-record information to a parent/guardian.</div>'
        : '')) +
    '<div class="details">' +
      attendanceDetailRow_('Student', student.fullName) +
      attendanceDetailRow_('Student ID', student.studentId) +
      attendanceDetailRow_('Grade', student.grade || 'Not listed') +
      attendanceDetailRow_('Date of Birth',
        student.dateOfBirth ? formatAttendanceShortDate_(student.dateOfBirth) : 'Not listed') +
      attendanceDetailRow_('Age',
        student.age === null || student.age === undefined ? 'Unknown' : student.age) +
      attendanceDetailRow_('FERPA Status', student.ferpaStatus) +
      attendanceDetailRow_('Parent/Guardian',
        student.parentGuardianName || 'Not listed') +
      attendanceDetailRow_('Parent/Guardian Phone',
        student.parentGuardianPhone || 'Not listed') +
      attendanceDetailRow_('Mailing Address',
        attendanceStudentAddress_(student) || 'Not listed') +
      attendanceDetailRow_('Semester', semester.label) +
      attendanceDetailRow_(
        'Semester Dates',
        formatAttendanceShortDate_(semester.start) +
        ' through ' +
        formatAttendanceShortDate_(semester.end)
      ) +
    '</div>' +
    '<table><thead><tr>' +
      '<th>#</th><th>Absence Date</th><th>Day</th><th>Status</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="total">Total Semester Absences: ' +
      student.absenceCount +
    '</div>' +
    '<div class="footer">Hugo Public Schools &middot; Generated ' +
      escapeAttendanceHtml_(
        Utilities.formatDate(
          new Date(),
          OUTREACH_CONFIG.TIME_ZONE,
          'MMMM d, yyyy h:mm a'
        )
      ) +
    '</div>' +
    '</body></html>';
}

function buildAttendanceThresholdEmail_(
  student,
  campus,
  semester,
  threshold,
  rule
) {
  let instructions;

  if (threshold === 4) {
    instructions =
      'The attached fourth-absence letter and Student Attendance Detail Report are ready for review and delivery to the parent/guardian according to campus procedures.';
  } else if (threshold === 5) {
    instructions =
      'PARENT CONTACT is required. Please contact the parent/guardian and document the contact according to district procedures.';
  } else if (threshold === 6) {
    instructions =
      'HOME VISIT action is required. Please coordinate the home visit according to district procedures.';
  } else if (threshold === 7) {
    instructions =
      'A REFERRAL WILL BE MADE TO YOUTH SERVICES OR TRIBAL YOUTH SERVICES. Please complete and document the appropriate referral according to district procedures.';
  } else if (threshold === 8) {
    instructions =
      'EIGHTH ABSENCE - CREDIT/TRUANCY WARNING REVIEW is required. Review credit and truancy consequences and document all follow-up in Attendance Interventions.';
  } else {
    instructions =
      'This notice indicates that the student has reached the NINTH ABSENCE during the current semester. Please complete the required follow-up according to district procedures.';
  }

  const text =
    rule.action + '\n\n' +
    (student.isAdult
      ? 'FERPA ALERT: Student is age 18 or older. Verify student consent or another applicable FERPA exception and district policy before releasing education-record information to a parent/guardian.\n\n'
      : (!student.dateOfBirth
        ? 'FERPA REVIEW REQUIRED: Date of Birth is missing. Verify the student\'s age before releasing education-record information to a parent/guardian.\n\n'
        : '')) +
    'Student: ' + student.fullName + '\n' +
    'Student ID: ' + student.studentId + '\n' +
    'Grade: ' + (student.grade || 'Not listed') + '\n' +
    'Campus: ' + campus.name + '\n' +
    'Semester: ' + semester.label + '\n' +
    'Current semester absences: ' +
      student.absenceCount + '\n\n' +
    instructions + '\n\n' +
    'A current Student Attendance Detail Report is attached. This is an internal staff notification and was not automatically sent to the parent/guardian.';

  const html =
    '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:680px">' +
      '<div style="background:#111;color:#fff;border-top:6px solid #c5b358;padding:16px 20px">' +
        '<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase">Hugo Public Schools Attendance</div>' +
        '<div style="font-size:22px;font-weight:bold;margin-top:4px">' +
          escapeAttendanceHtml_(rule.action) +
        '</div>' +
      '</div>' +
      '<div style="border:1px solid #ccc;border-top:0;padding:20px">' +
        (student.isAdult
          ? '<div style="margin:0 0 18px;padding:12px;border:2px solid #a32323;background:#fff0f0;color:#7d1010;font-weight:bold">FERPA ALERT: This student is age 18 or older. Verify student consent or another applicable FERPA exception and district policy before releasing education-record information to a parent/guardian.</div>'
          : (!student.dateOfBirth
            ? '<div style="margin:0 0 18px;padding:12px;border:2px solid #c99b21;background:#fff5d6;color:#664500;font-weight:bold">FERPA REVIEW REQUIRED: Date of Birth is missing. Verify the student&rsquo;s age before releasing education-record information to a parent/guardian.</div>'
            : '')) +
        '<table style="border-collapse:collapse;width:100%;margin-bottom:18px">' +
          attendanceEmailRow_('Student', student.fullName) +
          attendanceEmailRow_('Student ID', student.studentId) +
          attendanceEmailRow_('Grade', student.grade || 'Not listed') +
          attendanceEmailRow_('Date of Birth',
            student.dateOfBirth ? formatAttendanceShortDate_(student.dateOfBirth) : 'Not listed') +
          attendanceEmailRow_('Age',
            student.age === null || student.age === undefined ? 'Unknown' : student.age) +
          attendanceEmailRow_('FERPA Status', student.ferpaStatus) +
          attendanceEmailRow_('Campus', campus.name) +
          attendanceEmailRow_('Semester', semester.label) +
          attendanceEmailRow_('Semester Absences', student.absenceCount) +
          attendanceEmailRow_('Parent/Guardian',
            student.parentGuardianName || 'Not listed') +
          attendanceEmailRow_('Parent/Guardian Phone',
            student.parentGuardianPhone || 'Not listed') +
          attendanceEmailRow_('Address',
            attendanceStudentAddress_(student) || 'Not listed') +
        '</table>' +
        '<p style="font-size:15px"><strong>' +
          escapeAttendanceHtml_(instructions) +
        '</strong></p>' +
        '<p>A current Student Attendance Detail Report is attached.</p>' +
        '<p style="font-size:12px;color:#555;margin-top:24px">This is an internal staff notification. The system did not automatically contact the parent/guardian, conduct a home visit, or submit a referral.</p>' +
      '</div>' +
    '</div>';

  return {
    text: text,
    html: html
  };
}

function attendanceLogoMarkup_() {
  return '<img class="logo" alt="Hugo Buffaloes" src="data:image/png;base64,' +
    ATTENDANCE_HUGO_LOGO_BASE64_ +
    '">';
}

function attendanceStudentAddress_(student) {
  const cityLine = [student.city, student.state, student.zipCode]
    .filter(Boolean)
    .join(' ');
  return [student.streetAddress, cityLine]
    .filter(Boolean)
    .join(', ');
}

function attendanceAutomaticTimelineDetails_(threshold, student) {
  const actions = {
    4: 'Fourth-absence letter and attendance detail report were generated and emailed to campus staff for printing and delivery.',
    5: 'Student was referred to the Student Support Specialist for parent contact.',
    6: 'Home visit notice was emailed to campus staff, district administration, and School Resource Officers.',
    7: 'Youth Services or Tribal Youth Services referral notice was emailed to the intervention team.',
    8: 'Eighth-absence credit and truancy warning review was emailed to the intervention team.',
    9: 'Ninth-absence notice was emailed to the intervention team.'
  };
  return (actions[threshold] || 'Attendance threshold notice was sent.') +
    ' Current semester absence count: ' + student.absenceCount + '.';
}

function attendanceThresholdNextStep_(threshold) {
  const steps = {
    4: 'Print and deliver the letter; document delivery in the timeline.',
    5: 'Contact the parent/guardian and document the conversation and outcome.',
    6: 'Coordinate and document the home visit.',
    7: 'Complete the appropriate referral and record confirmation.',
    8: 'Review credit/truancy consequences and document the review.',
    9: 'Complete and document final required follow-up.'
  };
  return steps[threshold] || '';
}

function attendanceDetailRow_(label, value) {
  return '<div class="detail-row">' +
    '<div class="label">' +
      escapeAttendanceHtml_(label) +
    '</div>' +
    '<div class="value">' +
      escapeAttendanceHtml_(value) +
    '</div>' +
  '</div>';
}

function attendanceEmailRow_(label, value) {
  return '<tr>' +
    '<td style="padding:6px 8px;background:#f2f2f2;border:1px solid #ddd;font-weight:bold;width:34%">' +
      escapeAttendanceHtml_(label) +
    '</td>' +
    '<td style="padding:6px 8px;border:1px solid #ddd">' +
      escapeAttendanceHtml_(value) +
    '</td>' +
  '</tr>';
}

function splitAttendanceSetting_(value) {
  return String(value || '')
    .split(/[;,]/)
    .map(function(item) {
      return item.trim();
    })
    .filter(Boolean);
}

function attendanceNotificationBoolean_(value) {
  return /^(true|yes|1|on)$/i.test(
    String(value || '').trim()
  );
}

/**
 * Accepts Date values, yyyy-MM-dd, M/d/yyyy, or MM/dd/yyyy.
 * Google Sheets may display a seeded ISO date as a local date.
 */
function normalizeAttendanceSettingDate_(value) {
  if (
    Object.prototype.toString.call(value) ===
      '[object Date]' &&
    !Number.isNaN(value.getTime())
  ) {
    return attendanceDateKey_(value);
  }

  const text = String(value || '').trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const localMatch =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);

  if (localMatch) {
    const month = Number(localMatch[1]);
    const day = Number(localMatch[2]);
    const year = Number(localMatch[3]);

    const date = new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0
    );

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return attendanceDateKey_(date);
    }
  }

  return '';
}

/**
 * Run manually from Apps Script to verify configuration and record totals.
 * This function does not send email or create notification rows.
 */
function diagnoseAttendanceNotifications() {
  const settings = getAttendanceNotificationSettings_();

  const semesters = [
    getAttendanceNotificationSemester_(
      settings.ATTENDANCE_FIRST_SEMESTER_START,
      settings
    ),
    getAttendanceNotificationSemester_(
      settings.ATTENDANCE_SECOND_SEMESTER_START,
      settings
    )
  ];

  const records = sheetToObjects_(
    getAttendanceSheet_('Attendance Records')
  ).filter(function(record) {
    return String(record['Status'] || '')
      .trim()
      .toUpperCase() === 'ABSENT';
  });

  const totals = {};

  records.forEach(function(record) {
    const dateKey = attendanceDateKey_(
      record['Absence Date']
    );

    const semester = semesters.find(
      function(item) {
        return (
          item &&
          dateKey >= item.start &&
          dateKey <= item.end
        );
      }
    );

    if (!semester) {
      return;
    }

    const studentId = String(
      record['Student ID'] || ''
    ).trim();

    const key = semester.id + '|' + studentId;

    if (!totals[key]) {
      totals[key] = {
        semester: semester.label,
        studentId: studentId,
        studentName: String(
          record['Student Name'] || ''
        ).trim(),
        campus: String(
          record['Campus'] || ''
        ).trim(),
        dates: {}
      };
    }

    totals[key].dates[dateKey] = true;
  });

  const studentsAtThreshold = Object.keys(totals)
    .map(function(key) {
      const item = totals[key];

      return {
        semester: item.semester,
        studentId: item.studentId,
        studentName: item.studentName,
        campus: item.campus,
        absenceCount: Object.keys(item.dates).length
      };
    })
    .filter(function(item) {
      return item.absenceCount >= 4;
    })
    .sort(function(a, b) {
      return (
        b.absenceCount - a.absenceCount ||
        a.studentName.localeCompare(b.studentName)
      );
    });

  const result = {
    success: true,
    notificationsEnabled:
      attendanceNotificationBoolean_(
        settings.ATTENDANCE_NOTIFICATIONS_ENABLED
      ),
    firstSemester: semesters[0],
    secondSemester: semesters[1],
    activeAbsenceRecords: records.length,
    studentsAtOrAboveFourthAbsence:
      studentsAtThreshold
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function createAttendanceNotificationId_() {
  return (
    'ATN-' +
    Utilities.formatDate(
      new Date(),
      OUTREACH_CONFIG.TIME_ZONE,
      'yyyyMMdd-HHmmss'
    ) +
    '-' +
    Utilities.getUuid()
      .split('-')[0]
      .toUpperCase()
  );
}

function safeAttendanceFileName_(value) {
  return String(value || 'Attendance.pdf')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatAttendanceLongDate_(dateKey) {
  return Utilities.formatDate(
    parseAttendanceDate_(dateKey),
    OUTREACH_CONFIG.TIME_ZONE,
    'MMMM d, yyyy'
  );
}

function formatAttendanceShortDate_(dateKey) {
  return Utilities.formatDate(
    parseAttendanceDate_(dateKey),
    OUTREACH_CONFIG.TIME_ZONE,
    'M/d/yyyy'
  );
}

function formatAttendanceWeekday_(dateKey) {
  return Utilities.formatDate(
    parseAttendanceDate_(dateKey),
    OUTREACH_CONFIG.TIME_ZONE,
    'EEEE'
  );
}

function escapeAttendanceHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function authorizeAttendanceEmail() {
  const quota = MailApp.getRemainingDailyQuota();
  console.log('Remaining email quota: ' + quota);
}

/**
 * Sends a separate, student-facing attendance notice. The staff email and
 * fourth-absence print packet remain unchanged. Internal routing, parent
 * contact data, FERPA review flags, and staff-only instructions are omitted.
 */
function sendStudentAttendanceNotification_(
  rowNumber,
  student,
  campus,
  semester,
  threshold,
  rule,
  settings,
  summary
) {
  const sheet = getAttendanceSheet_(
    ATTENDANCE_NOTIFICATION_SHEET_
  );

  if (!attendanceNotificationBoolean_(
    settings.ATTENDANCE_STUDENT_EMAILS_ENABLED || 'TRUE'
  )) {
    updateObjectRow_(sheet, rowNumber, {
      'Student Email': student.studentEmail || '',
      'Student Email Subject': '',
      'Student Email Status': 'DISABLED',
      'Student Email Sent At': '',
      'Student Email Error': ''
    });
    summary.studentEmailsSkipped += 1;
    return;
  }

  const allowedCampuses = splitAttendanceSetting_(
    settings.ATTENDANCE_STUDENT_EMAIL_CAMPUSES ||
      'HIS;HMS;HHS'
  ).map(function(value) {
    return String(value || '').trim().toUpperCase();
  });

  const campusCode = String(
    campus.code || student.campus || ''
  ).trim().toUpperCase();

  if (allowedCampuses.indexOf(campusCode) === -1) {
    updateObjectRow_(sheet, rowNumber, {
      'Student Email': student.studentEmail || '',
      'Student Email Subject': '',
      'Student Email Status': 'CAMPUS EXCLUDED',
      'Student Email Sent At': '',
      'Student Email Error': ''
    });
    summary.studentEmailsSkipped += 1;
    return;
  }

  const email = String(
    student.studentEmail || ''
  ).trim().toLowerCase();

  if (!email) {
    updateObjectRow_(sheet, rowNumber, {
      'Student Email': '',
      'Student Email Subject': '',
      'Student Email Status': 'MISSING EMAIL',
      'Student Email Sent At': '',
      'Student Email Error':
        'No Student Email is listed on the Students sheet.'
    });
    summary.studentEmailsSkipped += 1;
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    updateObjectRow_(sheet, rowNumber, {
      'Student Email': email,
      'Student Email Subject': '',
      'Student Email Status': 'INVALID EMAIL',
      'Student Email Sent At': '',
      'Student Email Error':
        'The Student Email value is not a valid email address.'
    });
    summary.studentEmailsSkipped += 1;
    return;
  }

  const subject =
    'Attendance Notice - ' +
    attendanceOrdinalWord_(threshold) +
    ' Absence';

  const message = buildStudentAttendanceEmail_(
    student,
    campus,
    semester,
    threshold,
    rule
  );

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: message.text,
      htmlBody: message.html,
      name: 'Hugo Public Schools Attendance'
    });

    updateObjectRow_(sheet, rowNumber, {
      'Student Email': email,
      'Student Email Subject': subject,
      'Student Email Status': 'SENT',
      'Student Email Sent At': new Date(),
      'Student Email Error': ''
    });
    summary.studentEmailsSent += 1;
  } catch (error) {
    const errorText = String(
      error && error.message ? error.message : error
    );

    updateObjectRow_(sheet, rowNumber, {
      'Student Email': email,
      'Student Email Subject': subject,
      'Student Email Status': 'FAILED',
      'Student Email Sent At': '',
      'Student Email Error': errorText
    });
    summary.studentEmailsFailed += 1;
    summary.errors.push(
      student.fullName +
      ' student email at threshold ' +
      threshold +
      ': ' +
      errorText
    );
  }
}

function buildStudentAttendanceEmail_(
  student,
  campus,
  semester,
  threshold,
  rule
) {
  const dateLines = student.absenceDates
    .map(function(dateKey) {
      return formatAttendanceShortDate_(dateKey);
    });

  const studentMessage = {
    4: 'You have reached four absences this semester. Please review the dates below and contact your campus attendance office if you have questions or documentation to provide.',
    5: 'You have reached five absences this semester. Please contact your campus attendance office to discuss your attendance and any support you may need.',
    6: 'You have reached six absences this semester. Your school would like to work with you to address attendance concerns and connect you with appropriate support.',
    7: 'You have reached seven absences this semester. Please contact your campus attendance office promptly to review your attendance and available support.',
    8: 'You have reached eight absences this semester. Please contact your campus attendance office promptly to review possible attendance, credit, or truancy consequences.',
    9: 'You have reached nine absences this semester. Please contact your campus attendance office immediately to review your attendance status and required next steps.'
  }[threshold] ||
    'Please contact your campus attendance office to review your attendance.';

  const text =
    'Hugo Public Schools Attendance\n\n' +
    'Hello ' + student.fullName + ',\n\n' +
    studentMessage + '\n\n' +
    'Campus: ' + campus.name + '\n' +
    'Semester: ' + semester.label + '\n' +
    'Current semester absences: ' + student.absenceCount + '\n' +
    'Absence dates:\n- ' + dateLines.join('\n- ') + '\n\n' +
    'If a date appears incorrect, or if you have documentation to submit, contact the ' +
    campus.name + ' attendance office.\n\n' +
    'This message was sent directly to the student email address listed in the school attendance system.';

  const html =
    '<div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:680px">' +
      '<div style="background:#111;color:#fff;border-top:6px solid #c5b358;padding:16px 20px">' +
        '<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase">Hugo Public Schools Attendance</div>' +
        '<div style="font-size:22px;font-weight:bold;margin-top:4px">Attendance Notice</div>' +
      '</div>' +
      '<div style="border:1px solid #ccc;border-top:0;padding:20px">' +
        '<p>Hello ' + escapeAttendanceHtml_(student.fullName) + ',</p>' +
        '<p><strong>' + escapeAttendanceHtml_(studentMessage) + '</strong></p>' +
        '<table style="border-collapse:collapse;width:100%;margin:18px 0">' +
          attendanceEmailRow_('Campus', campus.name) +
          attendanceEmailRow_('Semester', semester.label) +
          attendanceEmailRow_('Current Semester Absences', student.absenceCount) +
        '</table>' +
        '<p><strong>Absence dates</strong></p>' +
        '<ul>' + dateLines.map(function(value) {
          return '<li>' + escapeAttendanceHtml_(value) + '</li>';
        }).join('') + '</ul>' +
        '<p>If a date appears incorrect, or if you have documentation to submit, contact the ' +
          escapeAttendanceHtml_(campus.name) + ' attendance office.</p>' +
        '<p style="font-size:12px;color:#555;margin-top:24px">This message was sent directly to the student email address listed in the school attendance system.</p>' +
      '</div>' +
    '</div>';

  return { text: text, html: html };
}

function attendanceOrdinalWord_(number) {
  return ({
    4: 'Fourth',
    5: 'Fifth',
    6: 'Sixth',
    7: 'Seventh',
    8: 'Eighth',
    9: 'Ninth'
  })[number] || String(number);
}
