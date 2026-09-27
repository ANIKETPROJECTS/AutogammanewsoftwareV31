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
      // Replace the placeholder in the VPS copy only. Never commit the real token.
      WHATSAPP_ACCESS_TOKEN:
        process.env.WHATSAPP_ACCESS_TOKEN || "EAAS0h8ZCJ7eIBSQz9FjRb5QctS6R5JYAWrhZAZAIOF0VVPZBt6uAgXomXSzsbNKsMv5qNhTl0Tj4hryZBwvdc6LEdZBdWybGHcdF10YDYm7ZA2Y135Xnvfse3ZBo6Km6mZA0Htg1HL4AZA09hpm9ehD7z2bnGIfU2kQNWyHEkuKjmibzSfzXIZA1CaZCghVbqSTg4epIEOwI4PfGtGeboGUaiaNvKXlotl6tf815wIw8tR6D1Ic3IaNIdPTxaHBiDBNOIcvKqPm0T9sTVjq732r4qcZAw6ZB5YRiRUYRBeUuSWEzM9X6OpL64EBXybb8wTU716THRSFHXAmWvvUemkJw3ZBSGsB",
      ...(process.env.CHROMIUM_PATH
        ? { CHROMIUM_PATH: process.env.CHROMIUM_PATH }
        : {})
    }
  }]
};