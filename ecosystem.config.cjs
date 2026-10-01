module.exports = {
  apps: [{
    name: 'autogarage-crmnew',
    script: 'dist/index.cjs',
    env: {
      NODE_ENV: 'production',
      PORT: 3004,
      MONGODB_URI: 'mongodb://localhost:27017/autogarage_crm_new',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '1216638684872283',
      WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '1389597003041842',
      WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
      WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      ...(process.env.CHROMIUM_PATH
        ? { CHROMIUM_PATH: process.env.CHROMIUM_PATH }
        : {})
    }
  }]
};