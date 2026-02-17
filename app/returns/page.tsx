import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Returns & Refunds',
};

export default function ReturnsPage() {
    return (
        <main className="min-h-screen bg-white py-16 px-6">
            <article className="max-w-2xl mx-auto prose prose-neutral prose-sm">
                <Link href="/" className="text-xs text-neutral-400 no-underline hover:text-neutral-600">&larr; Back to home</Link>

                <h1>Returns &amp; Refunds Policy</h1>
                <p className="text-neutral-500">Last updated: February 2026</p>

                <h2>1. Custom products</h2>
                <p>
                    All prints from Contour Map Studio are custom-made to order using your unique route data and
                    design choices. Because each item is individually produced, we cannot accept returns for
                    change of mind or incorrect customisation.
                </p>

                <h2>2. Damaged or defective items</h2>
                <p>
                    If your order arrives damaged, defective, or significantly different from what was shown at
                    checkout, we will gladly offer a replacement or full refund. To request this:
                </p>
                <ul>
                    <li>Contact us within <strong>14 days</strong> of receiving your order.</li>
                    <li>Email <a href="mailto:hello@contourmapstudio.com">hello@contourmapstudio.com</a> with your order number and photos of the issue.</li>
                    <li>We will review your claim and respond within 3 business days.</li>
                </ul>

                <h2>3. Lost or undelivered orders</h2>
                <p>
                    If your order has not arrived within the estimated delivery window, please contact us. We will
                    work with our fulfilment partner (Printful) and the shipping carrier to locate your package.
                    If the order is confirmed lost, we will send a replacement or issue a refund.
                </p>

                <h2>4. Refund process</h2>
                <ul>
                    <li>Approved refunds are processed to the original payment method via Stripe.</li>
                    <li>Refunds typically appear within 5&ndash;10 business days, depending on your bank.</li>
                    <li>Shipping costs are refunded if the issue was caused by a manufacturing or shipping error.</li>
                </ul>

                <h2>5. Cancellations</h2>
                <p>
                    Because orders are sent to production shortly after payment, cancellations can only be
                    accommodated if the order has not yet entered production. Contact us as soon as possible
                    if you need to cancel.
                </p>

                <h2>6. Contact</h2>
                <p>
                    For any returns or refund enquiries, email us at{' '}
                    <a href="mailto:hello@contourmapstudio.com">hello@contourmapstudio.com</a>.
                </p>
            </article>
        </main>
    );
}
