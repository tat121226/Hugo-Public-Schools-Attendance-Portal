/**
 * Hugo Student Outreach System
 * Web application routing
 */

function doGet(request) {
  const parameters =
    request &&
    request.parameter
      ? request.parameter
      : {};

  const page =
    String(
      parameters.page ||
      'referral'
    )
      .trim()
      .toLowerCase();

  const routes = {
    referral: {
      template:
        'Index',

      title:
        OUTREACH_CONFIG.APP_NAME
    },

    login: {
      template:
        'Login',

      title:
        'Backend Login | Hugo Public Schools'
    },

    dashboard: {
      template:
        'Dashboard',

      title:
        'Student Support Dashboard | Hugo Public Schools'
    },

    attendance: {
      template:
        'Attendance',

      title:
        'Attendance Management | Hugo Public Schools'
    }
  };

  const route =
    routes[page];

  if (!route) {
    return HtmlService
      .createHtmlOutput(
        '<!DOCTYPE html>' +
        '<html lang="en">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>Page Not Found</title>' +
        '</head>' +
        '<body style="font-family:Arial,sans-serif;padding:40px">' +
        '<h2>Page not found</h2>' +
        '<p>The requested system page does not exist.</p>' +
        '</body>' +
        '</html>'
      )
      .setTitle(
        'Page Not Found'
      );
  }

  const requestedSession =
    String(
      parameters.session || ''
    )
      .trim()
      .toLowerCase();

  const template =
    HtmlService
      .createTemplateFromFile(
        route.template
      );

  template.appName =
    OUTREACH_CONFIG.APP_NAME;

  template.currentPage =
    page;

  template.initialSessionToken =
    /^[a-f0-9]{64}$/.test(
      requestedSession
    )
      ? requestedSession
      : '';

  return template
    .evaluate()
    .setTitle(
      route.title
    )
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1, viewport-fit=cover'
    )
    .setXFrameOptionsMode(
      HtmlService
        .XFrameOptionsMode
        .DEFAULT
    );
}

function includeOutreachFile_(
  fileName
) {
  return HtmlService
    .createHtmlOutputFromFile(
      fileName
    )
    .getContent();
}

function getOutreachWebAppUrl() {
  return (
    ScriptApp
      .getService()
      .getUrl() ||
    ''
  );
}