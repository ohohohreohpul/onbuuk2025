/**
 * Turns the invoice PDF into a ZUGFeRD 2.3 / Factur-X (profile EN 16931) PDF:
 * the CII XML is attached as factur-x.xml, plus the PDF/A-3 parts a reader
 * looks for - XMP metadata naming the attachment and an sRGB output intent.
 *
 * Dates come from the invoice, so a reprint is byte-for-byte the same file.
 */
import { AFRelationship, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { escapeXml } from './xmlEscape';
import { ZUGFERD_FILE_NAME } from './zugferdXml';

/** sRGB IEC61966-2.1 v2 "micro" profile, CC0 (github.com/saucecontrol/Compact-ICC-Profiles). */
const SRGB_ICC_BASE64 =
  'AAAByGxjbXMCEAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5knZEAPUCAsD1AdCyBnqUijgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAABfY3BydAAAAQwAAAAMd3RwdAAAARgAAAAUclhZWgAAASwAAAAUZ1hZWgAAAUAAAAAUYlhZWgAAAVQAAAAUclRSQwAAAWgAAABgZ1RSQwAAAWgAAABgYlRSQwAAAWgAAABgZGVzYwAAAAAAAAAFdVJHQgAAAAAAAAAAAAAAAHRleHQAAAAAQ0MwAFhZWiAAAAAAAADzVAABAAAAARbJWFlaIAAAAAAAAG+gAAA48gAAA49YWVogAAAAAAAAYpYAALeJAAAY2lhZWiAAAAAAAAAkoAAAD4UAALbEY3VydgAAAAAAAAAqAAAAfAD4AZwCdQODBMkGTggSChgMYg70Ec8U9hhqHC4gQySsKWoufjPrObM/1kZXTTZUdlwXZB1shnVWfo2ILJI2nKunjLLbvpnKx9dl5Hfx+f//';

const FACTURX_NS = 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#';

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** XMP packet: PDF/A-3B identification, Dublin Core title and the Factur-X extension schema. */
function xmpMetadata(title: string, date: Date, producer: string): string {
  const iso = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const property = (name: string, description: string) =>
    `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`;
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:format>application/pdf</dc:format><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>${escapeXml(producer)}</xmp:CreatorTool><xmp:CreateDate>${iso}</xmp:CreateDate><xmp:ModifyDate>${iso}</xmp:ModifyDate></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>${escapeXml(producer)}</pdf:Producer></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="${FACTURX_NS}"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>${ZUGFERD_FILE_NAME}</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>EN 16931</fx:ConformanceLevel></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema><pdfaSchema:namespaceURI>${FACTURX_NS}</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>${property('DocumentFileName', 'name of the embedded XML invoice file')}${property('DocumentType', 'INVOICE')}${property('Version', 'The actual version of the Factur-X XML schema')}${property('ConformanceLevel', 'The conformance level of the embedded Factur-X data')}</rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export interface ZugferdPdfOptions {
  title: string;
  issuedAt: Date;
  producer?: string;
}

/** Embeds the XML into the drawn invoice PDF and returns the hybrid ZUGFeRD PDF. */
export async function embedZugferd(pdfBytes: Uint8Array, xml: string, options: ZugferdPdfOptions): Promise<Uint8Array> {
  const producer = options.producer ?? 'Zenno';
  const date = options.issuedAt;
  const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  pdf.setTitle(options.title);
  pdf.setProducer(producer);
  pdf.setCreator(producer);
  pdf.setCreationDate(date);
  pdf.setModificationDate(date);

  await pdf.attach(new TextEncoder().encode(xml), ZUGFERD_FILE_NAME, {
    mimeType: 'text/xml',
    description: 'Factur-X/ZUGFeRD invoice',
    creationDate: date,
    modificationDate: date,
    afRelationship: AFRelationship.Alternative,
  });

  const { context, catalog } = pdf;
  const metadata = context.stream(new TextEncoder().encode(xmpMetadata(options.title, date, producer)), {
    Type: 'Metadata', Subtype: 'XML',
  });
  catalog.set(PDFName.of('Metadata'), context.register(metadata));

  const icc = context.stream(base64ToBytes(SRGB_ICC_BASE64), { N: 3 });
  catalog.set(PDFName.of('OutputIntents'), context.obj([context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    DestOutputProfile: context.register(icc),
  })]));

  if (!context.trailerInfo.ID) {
    const id = PDFHexString.of(Array.from(new TextEncoder().encode(options.title.padEnd(16, '0').slice(0, 16)))
      .map((byte) => byte.toString(16).padStart(2, '0')).join(''));
    context.trailerInfo.ID = context.obj([id, id]);
  }

  return pdf.save({ useObjectStreams: false });
}
