// Fill these placeholders in the VPS-local copy only.
// Never commit this file after adding real credentials.
module.exports = {
  apps: [
    {
      name: 'autogarage-crmnew',
      script: 'dist/index.cjs',
      env: {
        NODE_ENV: 'production',
        PORT: 3004,

        // Required application credentials
        MONGODB_URI: 'mongodb://localhost:27017/autogarage_crm_new',
        SESSION_SECRET: 'REPLACE_WITH_LONG_RANDOM_SESSION_SECRET',

        // WhatsApp Cloud API
        WHATSAPP_ACCESS_TOKEN: 'REPLACE_WITH_ROTATED_META_ACCESS_TOKEN',
        WHATSAPP_PHONE_NUMBER_ID: '1216638684872283',
        WHATSAPP_BUSINESS_ACCOUNT_ID: '1389597003041842',
        WHATSAPP_APP_SECRET: 'REPLACE_WITH_META_APP_SECRET',
        WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'REPLACE_WITH_WEBHOOK_VERIFY_TOKEN',

        // Optional: set these only if the corresponding integrations are used.
        AIRAVATA_INTEGRATION_SECRET: '',
        QZ_CERTIFICATE: '',
        QZ_PRIVATE_KEY: '',
        CHROMIUM_PATH: '',
      },
    },
  ],
};