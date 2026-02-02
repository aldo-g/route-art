// app/api/strava/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        return new NextResponse(
            generateHtmlResponse({ error: 'Authorization denied' }),
            { headers: { 'Content-Type': 'text/html' } }
        );
    }

    if (!code) {
        return new NextResponse(
            generateHtmlResponse({ error: 'No authorization code provided' }),
            { headers: { 'Content-Type': 'text/html' } }
        );
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('Strava token exchange failed:', errorData);
            return new NextResponse(
                generateHtmlResponse({ error: 'Failed to exchange authorization code' }),
                { headers: { 'Content-Type': 'text/html' } }
            );
        }

        const tokens = await tokenResponse.json();

        // Return HTML that stores tokens in sessionStorage and communicates with opener
        return new NextResponse(
            generateHtmlResponse({ tokens }),
            { headers: { 'Content-Type': 'text/html' } }
        );
    } catch (err) {
        console.error('Strava auth error:', err);
        return new NextResponse(
            generateHtmlResponse({ error: 'Authentication failed' }),
            { headers: { 'Content-Type': 'text/html' } }
        );
    }
}

function generateHtmlResponse({ tokens, error }: { tokens?: unknown; error?: string }): string {
    const script = error
        ? `
            window.opener?.postMessage({ type: 'strava-auth-error', error: '${error}' }, '*');
            setTimeout(() => window.close(), 2000);
        `
        : `
            const tokens = ${JSON.stringify(tokens)};
            sessionStorage.setItem('stravaTokens', JSON.stringify(tokens));
            window.opener?.postMessage({ type: 'strava-auth-success', tokens }, '*');
            window.close();
        `;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${error ? 'Authorization Failed' : 'Connecting to Strava...'}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        .message {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .error { color: #dc2626; }
        .success { color: #16a34a; }
    </style>
</head>
<body>
    <div class="message">
        ${error
            ? `<p class="error">${error}</p><p>This window will close automatically.</p>`
            : '<p class="success">Connected! This window will close automatically.</p>'
        }
    </div>
    <script>${script}</script>
</body>
</html>
    `;
}
