export const paths = {
  citizen: {
    home: { path: '/', getHref: () => '/' },
  },
  officer: {
    login: { path: '/officer/login', getHref: () => '/officer/login' },
    dashboard: { path: '/officer/dashboard', getHref: () => '/officer/dashboard' },
    statistics: { path: '/officer/statistics', getHref: () => '/officer/statistics' },
    newAccount: { path: '/officer/accounts/new', getHref: () => '/officer/accounts/new' },
    unit: { path: '/officer/unit', getHref: () => '/officer/unit' },
  },
  // Field officer's link (no login): case, route, browser GPS, video call, "Đã đến"
  field: {
    link: { path: '/f/:token', getHref: (token) => `/f/${token}` },
  },
  dispatcher: {
    root: { path: '/dispatcher', getHref: () => '/dispatcher' },
  },
};
