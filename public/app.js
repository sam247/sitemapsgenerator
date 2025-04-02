const { AppProvider, Page, Card, Button, Banner, Stack, Select, Text } = window.Polaris;

function App() {
    const [loading, setLoading] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [sitemapType, setSitemapType] = React.useState('xml');

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

    return (
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
    );
}

ReactDOM.render(<App />, document.getElementById('root')); 