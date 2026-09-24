const path = require('path');
const fs = require('fs');

// Try loading core/.env first, then root .env
const coreEnv = path.join(__dirname, '../../.env');
const rootEnv = path.join(__dirname, '../../../../.env');
if (fs.existsSync(coreEnv)) {
  require('dotenv').config({ path: coreEnv });
} else if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else {
  require('dotenv').config();
}

module.exports = {
  PORT: process.env.PORT || 3005,
  AI_PROVIDER: process.env.AI_PROVIDER || 'gemini',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  CUSTOM_AI_BASE_URL: process.env.CUSTOM_AI_BASE_URL || '',
  CUSTOM_AI_API_KEY: process.env.CUSTOM_AI_API_KEY || '',
  CUSTOM_AI_MODEL: process.env.CUSTOM_AI_MODEL || '',
  SALESFORCE: {
    CLIENT_ID: process.env.SALESFORCE_CLIENT_ID || 'MOCK_SF_CLIENT_ID',
    CLIENT_SECRET: process.env.SALESFORCE_CLIENT_SECRET || 'MOCK_SF_CLIENT_SECRET',
    USERNAME: process.env.SALESFORCE_USERNAME || 'MOCK_SF_USERNAME',
    PASSWORD: process.env.SALESFORCE_PASSWORD || 'MOCK_SF_PASSWORD'
  },
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '',
  IS_MOCK_SHEETS: !process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  IS_MOCK_SALESFORCE: !process.env.SALESFORCE_CLIENT_ID || process.env.SALESFORCE_CLIENT_ID === 'MOCK_SF_CLIENT_ID'
};

