import { describe, expect, it } from 'vitest';
import { readCsvTable } from '../dataImport/csvTable';
import { consentRowsFromCsv } from '../../components/admin/receptionist/consentCsv';

describe('consentRowsFromCsv', () => {
  it('reads German headers and only clear yes values as consent', () => {
    const table = readCsvTable('Vorname;Nachname;E-Mail;Handy;Einwilligung\nAnna;Kopelke;Anna@Web.de;0157 7180 7377;ja\nBert;Meyer;bert@web.de;0176 1;nein\nCara;;cara@web.de;0151 2;\n');
    expect(consentRowsFromCsv(table)).toEqual([
      { name: 'Anna Kopelke', email: 'anna@web.de', phone: '0157 7180 7377', consent: true },
      { name: 'Bert Meyer', email: 'bert@web.de', phone: '0176 1', consent: false },
      { name: 'Cara', email: 'cara@web.de', phone: '0151 2', consent: false },
    ]);
  });

  it('reads English headers and skips rows without email and phone', () => {
    const table = readCsvTable('name,email,phone,consent\nDana,dana@x.de,+49 151 3,yes\nNobody,,,yes\n');
    expect(consentRowsFromCsv(table)).toEqual([{ name: 'Dana', email: 'dana@x.de', phone: '+49 151 3', consent: true }]);
  });

  it('never treats a missing consent column as consent', () => {
    const table = readCsvTable('name,email,phone\nEve,eve@x.de,0151 4\n');
    expect(consentRowsFromCsv(table)[0].consent).toBe(false);
  });
});
