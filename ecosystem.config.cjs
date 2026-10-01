// Fill these placeholders in the VPS copy only.
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
        SESSION_SECRET: 'ZWXk0h91TPFCHuMbu7IqcNxs2JpKiAqi27qGtmjDy5RQu3U1jMosYqh89S+GS6xWW4bliG/PGyhAEOjpiwuD6A==',

        // WhatsApp Cloud API
        WHATSAPP_ACCESS_TOKEN: 'EAAS0h8ZCJ7eIBSQz9FjRb5QctS6R5JYAWrhZAZAIOF0VVPZBt6uAgXomXSzsbNKsMv5qNhTl0Tj4hryZBwvdc6LEdZBdWybGHcdF10YDYm7ZA2Y135Xnvfse3ZBo6Km6mZA0Htg1HL4AZA09hpm9ehD7z2bnGIfU2kQNWyHEkuKjmibzSfzXIZA1CaZCghVbqSTg4epIEOwI4PfGtGeboGUaiaNvKXlotl6tf815wIw8tR6D1Ic3IaNIdPTxaHBiDBNOIcvKqPm0T9sTVjq732r4qcZAw6ZB5YRiRUYRBeUuSWEzM9X6OpL64EBXybb8wTU716THRSFHXAmWvvUemkJw3ZBSGsB',
        WHATSAPP_PHONE_NUMBER_ID: '1216638684872283',
        WHATSAPP_BUSINESS_ACCOUNT_ID: '1389597003041842',
        WHATSAPP_APP_SECRET: 'a8ab2b68450eda7d16c4be8462597e88',
        WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'airavata_wh_2026',

        // Optional: set these only if the corresponding integrations are used.
        // AIRAVATA_INTEGRATION_SECRET: '',
        // QZ_CERTIFICATE: '',
        // QZ_PRIVATE_KEY: '',
        // CHROMIUM_PATH: '',
      },
    },
  ],
};