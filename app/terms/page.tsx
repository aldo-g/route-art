import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Terms of Service',
};

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-white py-16 px-6">
            <article className="max-w-2xl mx-auto prose prose-neutral prose-sm">
                <Link href="/" className="text-xs text-neutral-400 no-underline hover:text-neutral-600">&larr; Back to home</Link>

                <h1>Terms of Service</h1>
                <p className="text-neutral-500">Last updated: February 2026</p>

                <h2>1. Overview</h2>
                <p>
                    These terms govern your use of Contour Map Studio (&ldquo;the Service&rdquo;), operated at
                    contourmapstudio.com. By using the Service or placing an order, you agree to these terms.
                </p>

                <h2>2. The Service</h2>
                <p>
                    Contour Map Studio lets you upload GPX route data, customise contour map artwork, and order
                    physical prints. Prints are manufactured and shipped by our partner, Printful.
                </p>

                <h2>3. Orders and payment</h2>
                <ul>
                    <li>All prices are displayed in your detected local currency and include the product price. Shipping is calculated separately at checkout.</li>
                    <li>Payments are processed securely by Stripe. We do not store your payment details.</li>
                    <li>An order is confirmed once payment is successfully processed. You will receive a confirmation via email.</li>
                    <li>We reserve the right to cancel an order if we are unable to fulfil it, in which case a full refund will be issued.</li>
                </ul>

                <h2>4. Fulfilment and shipping</h2>
                <ul>
                    <li>Orders are fulfilled by Printful, a third-party print-on-demand service.</li>
                    <li>Production typically takes 2&ndash;5 business days. Shipping times vary by destination (see estimated delivery at checkout).</li>
                    <li>We are not responsible for delays caused by the shipping carrier or customs.</li>
                </ul>

                <h2>5. Intellectual property</h2>
                <ul>
                    <li>You retain ownership of any route data and artwork you create using the Service.</li>
                    <li>By placing an order, you grant us a limited licence to use your poster image solely for the purpose of fulfilling your order.</li>
                    <li>The Service itself (code, design, branding) is our intellectual property.</li>
                </ul>

                <h2>6. User responsibilities</h2>
                <ul>
                    <li>You must provide accurate shipping and contact information.</li>
                    <li>You must not use the Service for any unlawful purpose.</li>
                    <li>You are responsible for ensuring you have the right to use any route data you upload.</li>
                </ul>

                <h2>7. Limitation of liability</h2>
                <p>
                    The Service is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law, we are not
                    liable for indirect, incidental, or consequential damages arising from your use of the Service.
                    Our total liability is limited to the amount you paid for the relevant order.
                </p>

                <h2>8. Changes to these terms</h2>
                <p>
                    We may update these terms from time to time. Continued use of the Service after changes constitutes
                    acceptance of the updated terms.
                </p>

                <h2>9. Contact</h2>
                <p>
                    Questions about these terms? Email us at{' '}
                    <a href="mailto:hello@contourmapstudio.com">hello@contourmapstudio.com</a>.
                </p>
            </article>
        </main>
    );
}
