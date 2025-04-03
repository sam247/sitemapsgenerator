const { AppProvider, Page, Card, Button, Banner, Stack, Select, Text, Spinner } = window.Polaris;
const { Provider } = window.appBridgeReact;

function App() {
    const [loading, setLoading] = React.useState(true);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [sitemapType, setSitemapType] = React.useState('xml');
    const [appInitialized, setAppInitialized] = React.useState(false);

    React.useEffect(() => {
        // Check if we have the required parameters
        const urlParams = new URLSearchParams(window.location.search);
        const shop = urlParams.get('shop');
        const host = urlParams.get('host');

        if (!shop || !host) {
            setError('Missing required parameters. Please try installing the app again.');
            setLoading(false);
            return;
        }

        // Initialize App Bridge
        const app = window.appBridge.createApp({
            apiKey: 'b80607d72a775c29be0b8bf599cb6a90',
            host: host,
            forceRedirect: true
        });

        // Set the app instance in window for the Provider
        window.app = app;

        setAppInitialized(true);
        setLoading(false);
    }, []);

    const generateSitemap = async () => {
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const response = await fetch('/api/generate-sitemap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: sitemapType
                })
            });

            const data = await response.json();

            if (data.success) {
                setMessage(`Sitemap generated successfully! You can find it at /sitemap.${sitemapType}`);
            } else {
                setError('Failed to generate sitemap. Please try again.');
            }
        } catch (err) {
            setError('An error occurred while generating the sitemap.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spinner size="large" />
            </div>
        );
    }

    if (!appInitialized) {
        return (
            <div style={{ padding: '20px' }}>
                <Banner status="critical">
                    {error || 'Unable to initialize the app. Please try installing again.'}
                </Banner>
            </div>
        );
    }

    return (
        <Provider config={window.app}>
            <AppProvider i18n={{}}>
                <Page title="Sitemap Generator">
                    <Card sectioned>
                        <Banner status="info">
                            Your sitemaps will be automatically updated every 6 hours.
                            The sitemaps are available at:
                            <ul>
                                <li>/sitemap.xml</li>
                                <li>/sitemap.html</li>
                            </ul>
                        </Banner>
                        <div style={{ marginTop: '20px' }}>
                            <Stack vertical spacing="4">
                                <Select
                                    label="Sitemap Type"
                                    options={[
                                        {label: 'XML Sitemap', value: 'xml'},
                                        {label: 'HTML Sitemap', value: 'html'}
                                    ]}
                                    value={sitemapType}
                                    onChange={setSitemapType}
                                />
                                <Button
                                    primary
                                    onClick={generateSitemap}
                                    loading={loading}
                                >
                                    Generate {sitemapType.toUpperCase()} Sitemap Now
                                </Button>
                            </Stack>
                        </div>
                        {message && (
                            <Banner status="success" style={{ marginTop: '20px' }}>
                                {message}
                            </Banner>
                        )}
                        {error && (
                            <Banner status="critical" style={{ marginTop: '20px' }}>
                                {error}
                            </Banner>
                        )}
                    </Card>
                </Page>
            </AppProvider>
        </Provider>
    );
}

ReactDOM.render(<App />, document.getElementById('root')); 