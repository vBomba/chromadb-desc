const PROXY_CONFIG = [
  {
    context: ['/api'],
    target: ' http://localhost:8000',
    secure: false,
    changeOrigin: true,
    timeout: 300000,
  },
];


module.exports = PROXY_CONFIG;
