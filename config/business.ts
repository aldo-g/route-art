/**
 * Legal identity of the business operating the store.
 *
 * EU and UK consumer law (Consumer Rights Directive / UK Consumer Contracts Regulations,
 * E-Commerce Directive) requires an online store to display the trader's legal name,
 * geographic address, email, and VAT number if registered. These details are rendered on
 * /terms, /privacy, /returns and in the site footer.
 *
 * TODO before launch: replace every bracketed placeholder below with the real details.
 */
export const BUSINESS = {
    /** Public brand name. */
    tradingName: 'Contour Map Studio',
    /** Registered legal entity or sole-trader name (e.g. "Jane Doe, trading as Contour Map Studio"). */
    legalName: '[Legal business name]',
    /** Postal address lines, in order. */
    addressLines: ['[Street address]', '[Postcode and city]', '[Country]'],
    /** Public support mailbox. */
    email: 'hello@contourmapstudio.com',
    website: 'contourmapstudio.com',
    /** VAT registration number, or null if not VAT registered. */
    vatNumber: null as string | null,
    /** Company registration number, or null for a sole trader. */
    companyNumber: null as string | null,
};

/** True while any placeholder is still in place — used to surface a warning in dev. */
export function businessDetailsIncomplete(): boolean {
    return [BUSINESS.legalName, ...BUSINESS.addressLines].some(v => v.startsWith('['));
}

/** Single-line postal address for compact contexts such as the footer. */
export function formatBusinessAddress(): string {
    return BUSINESS.addressLines.join(', ');
}
