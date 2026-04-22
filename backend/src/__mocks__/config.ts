/**
 * Config mock for tests — avoids need for real env variables.
 */
const config = {
  server: {
    port: 5000,
    nodeEnv: 'test',
    isProduction: false,
    isDevelopment: false,
    isTest: true,
    corsOrigin: 'http://localhost:5173',
    apiBaseUrl: 'http://localhost:5000',
  },
  db: {
    mongoUri: 'mongodb://localhost:27017/test',
  },
  redis: {
    url: 'redis://localhost:6379',
  },
  jwt: {
    secret: 'test-jwt-secret-that-is-at-least-32-characters-long',
    refreshSecret: 'test-refresh-secret-that-is-at-least-32-characters-long',
    expiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  csrf: {
    secret: 'test-csrf-secret-at-least-32-characters',
  },
  email: {
    host: 'smtp.test.com',
    port: 587,
    user: 'test@test.com',
    pass: 'testpassword',
    from: 'noreply@test.com',
  },
  uploads: {
    maxFileSize: 5 * 1024 * 1024,
  },
};

export default config;
