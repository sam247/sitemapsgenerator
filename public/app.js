const { AppProvider, Page, Card, Button, Banner } = window.Polaris;

function App() {
    const [loading, setLoading] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');

    const generateSitemap = async () => {
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const response = await fetch('/api/generate-sitemap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (data.success) {
                setMessage('Sitemap generated successfully! You can find it at /sitemap.xml');
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
                        Your sitemap will be automatically updated every 6 hours.
                        The sitemap is available at /sitemap.xml
                    </Banner>
                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <Button
                            primary
                            onClick={generateSitemap}
                            loading={loading}
                        >
                            Generate Sitemap Now
                        </Button>
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