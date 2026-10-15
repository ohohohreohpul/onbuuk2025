import { describe, expect, it } from 'vitest';
import { autoMap, readCsvTable } from '../dataImport/csvTable';
import { buildCustomers } from '../dataImport/buildRows';

const build = (csv: string) => {
  const table = readCsvTable(csv);
  return buildCustomers(table, autoMap('customers', table.headers));
};

describe('buildCustomers', () => {
  it('puts the first name in front of a surname-only "Name" column', () => {
    const { rows } = build('Anrede;Vorname;Name;E-Mail;Newsletter\nFrau;Anna;Schmidt;anna@example.de;abonnieren\n');
    expect(rows[0]).toMatchObject({ name: 'Anna Schmidt', email: 'anna@example.de', newsletter_status: 'subscribed' });
  });

  it('keeps a full name that already contains the first name', () => {
    const { rows } = build('Vorname;Name;E-Mail\nAnna;Anna Schmidt;anna@example.de\n');
    expect(rows[0].name).toBe('Anna Schmidt');
  });

  it('leaves the newsletter status empty when the column is blank or missing', () => {
    expect(build('Name;E-Mail;Newsletter\nBen;ben@example.de;\n').rows[0].newsletter_status).toBeNull();
    expect(build('Name;E-Mail\nBen;ben@example.de\n').rows[0].newsletter_status).toBeNull();
  });
});
