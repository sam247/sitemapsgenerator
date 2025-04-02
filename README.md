# Shopify Sitemap Generator

A simple Shopify app that generates XML and HTML sitemaps for your store. The app automatically updates the sitemap every 6 hours and allows manual generation at any time.

## Features

- Automatic sitemap generation every 6 hours
- Manual sitemap generation with one click
- Includes products, collections, and pages
- Simple and clean interface
- One-time payment of £4.99

## Project Structure

```
.
├── package.json           # Root package.json for Render deployment
└── src/                  # Source code directory
    ├── package.json      # App dependencies
    ├── server.js         # Main server file
    └── public/           # Static files and frontend
```

## Deployment

1. Create a new app in your Shopify Partner dashboard
2. Set up a Render account and create a new Web Service
3. Connect your GitHub repository to Render
4. Configure the following environment variables in Render:
   ```
   SHOPIFY_API_KEY=b80607d72a775c29be0b8bf599cb6a90
   SHOPIFY_API_SECRET=188bf34356899c3c66ab635b3ef31b9e
   HOST=https://sitemapsgenerator.onrender.com
   ```
5. In your Shopify Partner dashboard:
   - Set the App URL to: `https://sitemapsgenerator.onrender.com`
   - Set the Allowed redirection URL(s) to: `https://sitemapsgenerator.onrender.com/auth/callback`

## Local Development

1. Install dependencies:
   ```bash
   cd src
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Use ngrok or similar to create a secure tunnel to your local server

## Support

For support, please contact us through the Shopify Partner dashboard.

## License

All rights reserved.