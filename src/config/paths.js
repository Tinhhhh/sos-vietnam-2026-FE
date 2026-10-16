export const paths = {
  citizen: {
    home: { path: '/', getHref: () => '/' },
  },
  officer: {
    login: { path: '/officer/login', getHref: () => '/officer/login' },
    dashboard: { path: '/officer/dashboard', getHref: () => '/officer/dashboard' },
    statistics: { path: '/officer/statistics', getHref: () => '/officer/statistics' },
  },
  dispatcher: {
    root: { path: '/dispatcher', getHref: () => '/dispatcher' },
  },
};
