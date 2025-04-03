const express = require('express');
const Shopify = require('shopify-api-node');
const schedule = require('node-schedule');
const { Builder } = require('xml2js');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const bodyParser = require('body-parser');
const fetch = require('isomorphic-fetch');

const app = express();
const port = process.env.PORT || 3000;

// Shopify API credentials
const SHOPIFY_API_KEY = 'b80607d72a775c29be0b8bf599cb6a90';
const SHOPIFY_API_SECRET = '188bf34356899c3c66ab635b3ef31b9e';
const SCOPES = 'read_products,read_collections,read_content';
const HOST = process.env.HOST || 'https://sitemapsgenerator.onrender.com';

// Store state for OAuth
const stateStore = new Map();

// Middleware
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf } }));
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

// Handle app installation
app.get('/app', (req, res) => {
    const { shop, hmac, host, timestamp } = req.query;
    
    if (!shop) {
        return res.status(400).send('Missing shop parameter');
    }

    // Check if shop is already authenticated
    const credentials = shopCredentials.get(shop);
    if (credentials) {
        // Shop is already authenticated, serve the app
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
        return;
    }

    // Shop needs authentication, redirect to install
    const state = crypto.randomBytes(16).toString('hex');
    stateStore.set(shop, state);
    
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${HOST}/auth/callback&state=${state}`;
    res.redirect(installUrl);
});

// Update root route to redirect to app installation
app.get('/', (req, res) => {
    const { shop, hmac, host, timestamp } = req.query;
    
    if (!shop) {
        return res.status(400).send('Missing shop parameter');
    }

    // Verify HMAC
    const message = `shop=${shop}&host=${host}&timestamp=${timestamp}`;
    const generatedHash = crypto
        .createHmac('sha256', SHOPIFY_API_SECRET)
        .update(message)
        .digest('hex');

    if (generatedHash !== hmac) {
        return res.status(401).send('Invalid HMAC');
    }

    // Redirect to app installation
    res.redirect(`/app?shop=${shop}&hmac=${hmac}&host=${host}&timestamp=${timestamp}`);
});

// OAuth callback route
app.get('/auth/callback', async (req, res) => {
    const { code, shop, state } = req.query;
    
    if (!code || !shop || !state) {
        return res.status(400).send('Missing required parameters');
    }

    // Verify state
    const storedState = stateStore.get(shop);
    if (storedState !== state) {
        return res.status(401).send('Invalid state parameter');
    }
    stateStore.delete(shop);
    
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
        
        // Generate initial sitemaps
        await generateSitemap(shop, access_token, 'xml');
        await generateSitemap(shop, access_token, 'html');
        
        // Redirect to app with proper parameters
        const redirectUrl = `https://${shop}/admin/apps/${SHOPIFY_API_KEY}`;
        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Error during OAuth:', error);
        res.status(500).send('Error during authentication. Please try again.');
    }
});

// Generate HTML sitemap
async function generateHtmlSitemap(shop, products, collections, pages) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Sitemap - ${shop}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .section { margin: 20px 0; }
        .section h2 { color: #666; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        ul { list-style: none; padding: 0; }
        li { margin: 5px 0; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>Sitemap for ${shop}</h1>
    
    <div class="section">
        <h2>Homepage</h2>
        <ul>
            <li><a href="https://${shop}">Home</a></li>
        </ul>
    </div>

    <div class="section">
        <h2>Products</h2>
        <ul>
            ${products.map(product => `
                <li><a href="https://${shop}/products/${product.handle}">${product.title}</a></li>
            `).join('')}
        </ul>
    </div>

    <div class="section">
        <h2>Collections</h2>
        <ul>
            ${collections.map(collection => `
                <li><a href="https://${shop}/collections/${collection.handle}">${collection.title}</a></li>
            `).join('')}
        </ul>
    </div>

    <div class="section">
        <h2>Pages</h2>
        <ul>
            ${pages.map(page => `
                <li><a href="https://${shop}/pages/${page.handle}">${page.title}</a></li>
            `).join('')}
        </ul>
    </div>
</body>
</html>`;

    return html;
}

// Sitemap generation function
async function generateSitemap(shop, accessToken, type = 'xml') {
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

        if (type === 'xml') {
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
            await fs.writeFile(path.join(__dirname, 'public', `${shop}-sitemap.xml`), xml);
        } else if (type === 'html') {
            // Generate HTML sitemap
            const html = await generateHtmlSitemap(shop, products, collections, pages);
            await fs.writeFile(path.join(__dirname, 'public', `${shop}-sitemap.html`), html);
        }
        
        return true;
    } catch (error) {
        console.error('Error generating sitemap:', error);
        return false;
    }
}

// Schedule periodic sitemap generation (every 6 hours)
schedule.scheduleJob('0 */6 * * *', async () => {
    for (const [shop, credentials] of shopCredentials) {
        await generateSitemap(shop, credentials.accessToken, 'xml');
        await generateSitemap(shop, credentials.accessToken, 'html');
    }
});

// Routes
app.post('/api/generate-sitemap', async (req, res) => {
    const shop = req.headers['x-shopify-shop-domain'];
    const credentials = shopCredentials.get(shop);
    const { type = 'xml' } = req.body;
    
    if (!credentials) {
        return res.status(401).json({ error: 'Shop not authenticated' });
    }

    const success = await generateSitemap(shop, credentials.accessToken, type);
    res.json({ success });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 