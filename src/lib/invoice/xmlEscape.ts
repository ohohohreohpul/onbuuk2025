/**
 * Text for XML 1.0: escapes markup and drops characters XML forbids (control
 * characters, lone surrogates). Customer names come from a public form, and an
 * issued invoice can never be fixed afterwards, so the XML must always parse.
 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export const escapeXml = (value: string) =>
  value.replace(FORBIDDEN, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
