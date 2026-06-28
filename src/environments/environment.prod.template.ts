export const environment = {
  production: true,
  version: 'VERSION_PLACEHOLDER', // replaced by CI with the git tag
  google: {
    clientId:      'YOUR_CLIENT_ID',       // inject via CI env var GOOGLE_CLIENT_ID
    redirectUri:   'YOUR_REDIRECT_URI',    // inject via CI env var GOOGLE_REDIRECT_URI
    tokenProxyUrl: 'YOUR_TOKEN_PROXY_URL', // inject via CI env var TOKEN_PROXY_URL
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'profile',
      'email',
    ].join(' '),
  },
  sheetsApi: {
    baseUrl: 'https://sheets.googleapis.com/v4/spreadsheets',
    defaultSheetId: 'YOUR_DEFAULT_SHEET_ID', // inject via CI env var SHEET_ID
  },
  // AI API key is now stored per-user in their Google Sheet (Settings tab).
  // No CI secret needed.
};
