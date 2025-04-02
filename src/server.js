const express = require('express');
const Shopify = require('shopify-api-node');
const schedule = require('node-schedule');
const { Builder } = require('xml2js');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// Shopify API credentials
const SHOPIFY_API_KEY = 'b80607d72a775c29be0b8bf599cb6a90';
const SHOPIFY_API_SECRET = '188bf34356899c3c66ab635b3ef31b9e';
const SCOPES = 'read_products,read_collections,read_content';
const HOST = process.env.HOST || 'https://sitemapsgenerator.onrender.com';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Store shop credentials (in production, use a database)
const shopCredentials = new Map();

// Verify Shopify webhook requests
const verifyShopifyWebhook = (req, res, next) => {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const topic = req.headers['x-shopify-topic'];
    const shop = req.headers['x-shopify-shop-domain'];
    
    const hash = crypto
        .createHmac('sha256', SHOPIFY_API_SECRET)
        .update(req.rawBody)
        .digest('base64');
    
    if (hash === hmac) {
        next();
    } else {
        res.status(401).send('Invalid webhook signature');
    }
};

// Install app route
app.get('/install', (req, res) => {
    const shop = req.query.shop;
    if (!shop) {
        return res.status(400).send('Missing shop parameter');
    }
    
    const state = crypto.randomBytes(16).toString('hex');
    
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${HOST}/auth/callback&state=${state}`;
    
    res.redirect(installUrl);
});

// OAuth callback route
app.get('/auth/callback', async (req, res) => {
    const { code, shop, state } = req.query;
    
    if (!code || !shop) {
        return res.status(400).send('Missing required parameters');
    }
    
    try {
        const accessTokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: SHOPIFY_API_KEY,
                client_secret: SHOPIFY_API_SECRET,
                code: code
            })
        });
        
        if (!accessTokenResponse.ok) {
            throw new Error(`Failed to get access token: ${accessTokenResponse.statusText}`);
        }
        
        const { access_token } = await accessTokenResponse.json();
        
        // Store the credentials
        shopCredentials.set(shop, { accessToken: access_token });
        
        // Generate initial sitemap
        await generateSitemap(shop, access_token);
        
        // Redirect to app
        res.redirect(`https://${shop}/admin/apps/${SHOPIFY_API_KEY}`);
    } catch (error) {
        console.error('Error during OAuth:', error);
        res.status(500).send('Error during authentication. Please try again.');
    }
});

// Sitemap generation function
async function generateSitemap(shop, accessToken) {
    const shopify = new Shopify({
        shopName: shop,
        accessToken: accessToken
    });

    try {
        // Fetch all products
        const products = await shopify.product.list();
        // Fetch all collections
        const collections = await shopify.collection.list();
        // Fetch all pages
        const pages = await shopify.page.list();

        // Generate XML sitemap
        const sitemap = {
            urlset: {
                $: {
                    xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9'
                },
                url: [
                    // Homepage
                    {
                        loc: `https://${shop}`,
                        changefreq: 'daily',
                        priority: '1.0'
                    },
                    // Products
                    ...products.map(product => ({
                        loc: `https://${shop}/products/${product.handle}`,
                        changefreq: 'daily',
                        priority: '0.8'
                    })),
                    // Collections
                    ...collections.map(collection => ({
                        loc: `https://${shop}/collections/${collection.handle}`,
                        changefreq: 'daily',
                        priority: '0.7'
                    })),
                    // Pages
                    ...pages.map(page => ({
                        loc: `https://${shop}/pages/${page.handle}`,
                        changefreq: 'weekly',
                        priority: '0.5'
                    }))
                ]
            }
        };

        const builder = new Builder();
        const xml = builder.buildObject(sitemap);

        // Save sitemap
        await fs.writeFile(path.join(__dirname, 'public', `${shop}-sitemap.xml`), xml);
        
        return true;
    } catch (error) {
        console.error('Error generating sitemap:', error);
        return false;
    }
}

// Schedule periodic sitemap generation (every 6 hours)
schedule.scheduleJob('0 */6 * * *', async () => {
    for (const [shop, credentials] of shopCredentials) {
        await generateSitemap(shop, credentials.accessToken);
    }
});

// Routes
app.post('/api/generate-sitemap', async (req, res) => {
    const shop = req.headers['x-shopify-shop-domain'];
    const credentials = shopCredentials.get(shop);
    
    if (!credentials) {
        return res.status(401).json({ error: 'Shop not authenticated' });
    }

    const success = await generateSitemap(shop, credentials.accessToken);
    res.json({ success });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 