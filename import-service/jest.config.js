module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src/handlers'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  }
};
