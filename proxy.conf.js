const PROXY_CONFIG = [
  {
    context: ['/api'],
    target: 'https://test-db-moda-dev.apps.c2-dev.fortisbank.com.pl',
    secure: false,
    changeOrigin: true,
    timeout: 300000,
  },
];

module.exports = PROXY_CONFIG;
