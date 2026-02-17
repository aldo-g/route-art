import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Privacy Policy',
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-white py-16 px-6">
            <article className="max-w-2xl mx-auto prose prose-neutral prose-sm">
                <Link href="/" className="text-xs text-neutral-400 no-underline hover:text-neutral-600">&larr; Back to home</Link>

                <h1>Privacy Policy</h1>
                <p className="text-neutral-500">Last updated: February 2026</p>

                <h2>Who we are</h2>
                <p>
                    Contour Map Studio (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the website
                    at contourmapstudio.com. This policy explains how we collect, use, and protect your personal data
                    when you use our service.
                </p>

                <h2>What data we collect</h2>
                <ul>
                    <li><strong>GPX/route data</strong> &mdash; uploaded files are processed in your browser. We do not store your raw route files on our servers.</li>
                    <li><strong>Poster images</strong> &mdash; when you add a poster to your cart and check out, the rendered image is uploaded to our servers to fulfil your order.</li>
                    <li><strong>Order information</strong> &mdash; name, email address, shipping address, and order details are collected at checkout to process and deliver your order.</li>
                    <li><strong>Payment data</strong> &mdash; all payments are processed by <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe</a>. We never see or store your full card number.</li>
                    <li><strong>Strava data</strong> &mdash; if you connect Strava, we access your activity list and route data via the Strava API. We do not store your Strava credentials.</li>
                    <li><strong>IP-based location</strong> &mdash; we detect your approximate country from your IP address to display prices in your local currency. This is not stored.</li>
                </ul>

                <h2>How we use your data</h2>
                <ul>
                    <li>To process and fulfil your print orders via our printing partner, Printful.</li>
                    <li>To send order confirmation and shipping updates (via Stripe email receipts).</li>
                    <li>To display prices in your local currency.</li>
                </ul>

                <h2>Third-party services</h2>
                <p>We share data with these services only as needed to operate:</p>
                <ul>
                    <li><strong>Stripe</strong> &mdash; payment processing. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a></li>
                    <li><strong>Printful</strong> &mdash; print-on-demand fulfilment. Your name, shipping address, and poster image are sent to Printful to manufacture and ship your order. <a href="https://www.printful.com/policies/privacy" target="_blank" rel="noopener noreferrer">Printful Privacy Policy</a></li>
                    <li><strong>Supabase</strong> &mdash; database and image storage.</li>
                    <li><strong>Vercel</strong> &mdash; website hosting.</li>
                    <li><strong>Strava</strong> &mdash; activity data (only if you connect your account).</li>
                </ul>

                <h2>Data retention</h2>
                <p>
                    Order data and poster images are retained for as long as needed to fulfil and support your order.
                    If you would like your data deleted, contact us at the email below.
                </p>

                <h2>Your rights</h2>
                <p>
                    Under GDPR and similar laws, you have the right to access, correct, or delete your personal data.
                    You can also request a copy of your data or object to its processing. Contact us to exercise these rights.
                </p>

                <h2>Cookies</h2>
                <p>
                    We do not use tracking cookies or third-party analytics cookies. Essential cookies may be set by
                    our hosting provider (Vercel) for basic functionality.
                </p>

                <h2>Contact</h2>
                <p>
                    For any privacy-related questions, email us at{' '}
                    <a href="mailto:hello@contourmapstudio.com">hello@contourmapstudio.com</a>.
                </p>
            </article>
        </main>
    );
}
