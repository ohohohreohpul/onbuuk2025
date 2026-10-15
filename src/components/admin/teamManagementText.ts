import type { Translations } from '../../lib/bookingLanguage';

/** UI copy for TeamManagementView. */
export type TeamText = {
  systemLocked: string; inviteSent: string; inviteFailed: string; resent: string; resendFailed: string; confirmCancel: string;
  inviteCancelled: string; cancelFailed: string; deactivated: string; activated: string; statusFailed: string;
  title: string; subtitle: string; inviteMember: string; dismiss: string; tabTeam: string; tabInvitations: string; tabRoles: string;
  emptyTeamTitle: string; emptyTeamBody: string; colMember: string; colPrimaryRole: string; colAdditionalRoles: string;
  colLastLogin: string; colStatus: string; removeRole: string; addRole: string; never: string; active: string; inactive: string;
  deactivate: string; activate: string; noInvitations: string; noInvitationsBody: string; expired: string; sent: string;
  expires: string; resend: string; cancelInvite: string; noRolePermission: string; roles: string; rolePermissions: string;
  roleHint: string; systemRole: string; selectRole: string; selectRoleHint: string; inviteTitle: string; inviteBody: string;
  close: string; fullName: string; emailAddress: string; primaryRole: string; cancel: string; sending: string; sendInvite: string;
  roleOwner: string; roleAdmin: string; roleManager: string; roleReceptionist: string; roleCashier: string; roleStaff: string;
};

export type FeedbackKey = 'systemLocked' | 'inviteSent' | 'resent' | 'resendFailed' | 'inviteCancelled' | 'cancelFailed' | 'deactivated' | 'activated' | 'statusFailed';

export const TEXT: Translations<TeamText> = {
  en: {
    systemLocked: 'System roles cannot be modified.', inviteSent: 'Invitation sent to {email}.', inviteFailed: 'Failed to send invitation',
    resent: 'Invitation resent to {email}.', resendFailed: 'The invitation could not be resent.',
    confirmCancel: 'Are you sure you want to cancel this invitation?', inviteCancelled: 'Invitation cancelled.',
    cancelFailed: 'The invitation could not be cancelled.', deactivated: 'Team member deactivated.', activated: 'Team member activated.',
    statusFailed: 'The team member status could not be updated.',
    title: 'Team & Permissions', subtitle: 'Manage your team members, invitations, and role-based permissions',
    inviteMember: 'Invite Team Member', dismiss: 'Dismiss message', tabTeam: 'Team members', tabInvitations: 'Invitations',
    tabRoles: 'Roles & permissions', emptyTeamTitle: 'Build your team',
    emptyTeamBody: 'Invite the people who manage bookings, customers, and daily operations.',
    colMember: 'Member', colPrimaryRole: 'Primary role', colAdditionalRoles: 'Additional roles', colLastLogin: 'Last login', colStatus: 'Status',
    removeRole: 'Remove {role}', addRole: '+ Add role', never: 'Never', active: 'Active', inactive: 'Inactive',
    deactivate: 'Deactivate', activate: 'Activate', noInvitations: 'No pending invitations',
    noInvitationsBody: 'New invitations will appear here until they are accepted.', expired: 'Expired', sent: 'Sent {date}',
    expires: 'Expires {date}', resend: 'Resend', cancelInvite: 'Cancel invitation',
    noRolePermission: 'You do not have permission to manage roles and permissions.', roles: 'Roles',
    rolePermissions: '{role} permissions', roleHint: 'Choose what this role can see and change.', systemRole: 'System role',
    selectRole: 'Select a role', selectRoleHint: 'Its permissions will appear here.', inviteTitle: 'Invite a team member',
    inviteBody: 'They will receive a secure link to create their account.', close: 'Close', fullName: 'Full name',
    emailAddress: 'Email address', primaryRole: 'Primary role', cancel: 'Cancel', sending: 'Sending…', sendInvite: 'Send invitation',
    roleOwner: 'Owner', roleAdmin: 'Admin', roleManager: 'Manager', roleReceptionist: 'Receptionist', roleCashier: 'Cashier', roleStaff: 'Staff',
  },
  de: {
    systemLocked: 'System-Rollen können nicht geändert werden.', inviteSent: 'Einladung an {email} gesendet.', inviteFailed: 'Einladung konnte nicht gesendet werden',
    resent: 'Einladung erneut an {email} gesendet.', resendFailed: 'Die Einladung konnte nicht erneut gesendet werden.',
    confirmCancel: 'Diese Einladung wirklich zurückziehen?', inviteCancelled: 'Einladung zurückgezogen.',
    cancelFailed: 'Die Einladung konnte nicht zurückgezogen werden.', deactivated: 'Teammitglied deaktiviert.', activated: 'Teammitglied aktiviert.',
    statusFailed: 'Der Status des Teammitglieds konnte nicht geändert werden.',
    title: 'Team & Berechtigungen', subtitle: 'Teammitglieder, Einladungen und rollenbasierte Berechtigungen verwalten',
    inviteMember: 'Teammitglied einladen', dismiss: 'Meldung schließen', tabTeam: 'Teammitglieder', tabInvitations: 'Einladungen',
    tabRoles: 'Rollen & Berechtigungen', emptyTeamTitle: 'Bauen Sie Ihr Team auf',
    emptyTeamBody: 'Laden Sie die Personen ein, die Buchungen, Kund:innen und den Tagesbetrieb betreuen.',
    colMember: 'Mitglied', colPrimaryRole: 'Hauptrolle', colAdditionalRoles: 'Weitere Rollen', colLastLogin: 'Letzte Anmeldung', colStatus: 'Status',
    removeRole: '{role} entfernen', addRole: '+ Rolle hinzufügen', never: 'Nie', active: 'Aktiv', inactive: 'Inaktiv',
    deactivate: 'Deaktivieren', activate: 'Aktivieren', noInvitations: 'Keine offenen Einladungen',
    noInvitationsBody: 'Neue Einladungen erscheinen hier, bis sie angenommen wurden.', expired: 'Abgelaufen', sent: 'Gesendet am {date}',
    expires: 'Läuft ab am {date}', resend: 'Erneut senden', cancelInvite: 'Einladung zurückziehen',
    noRolePermission: 'Sie haben keine Berechtigung, Rollen und Berechtigungen zu verwalten.', roles: 'Rollen',
    rolePermissions: 'Berechtigungen: {role}', roleHint: 'Legen Sie fest, was diese Rolle sehen und ändern darf.', systemRole: 'System-Rolle',
    selectRole: 'Rolle auswählen', selectRoleHint: 'Ihre Berechtigungen erscheinen hier.', inviteTitle: 'Teammitglied einladen',
    inviteBody: 'Die Person erhält einen sicheren Link, um ihr Konto anzulegen.', close: 'Schließen', fullName: 'Vollständiger Name',
    emailAddress: 'E-Mail-Adresse', primaryRole: 'Hauptrolle', cancel: 'Abbrechen', sending: 'Wird gesendet…', sendInvite: 'Einladung senden',
    roleOwner: 'Inhaber:in', roleAdmin: 'Admin', roleManager: 'Manager:in', roleReceptionist: 'Empfang', roleCashier: 'Kasse', roleStaff: 'Mitarbeiter:in',
  },
  th: {
    systemLocked: 'แก้ไขบทบาทของระบบไม่ได้', inviteSent: 'ส่งคำเชิญถึง {email} แล้ว', inviteFailed: 'ส่งคำเชิญไม่สำเร็จ',
    resent: 'ส่งคำเชิญอีกครั้งถึง {email} แล้ว', resendFailed: 'ส่งคำเชิญอีกครั้งไม่สำเร็จ',
    confirmCancel: 'ต้องการยกเลิกคำเชิญนี้ใช่หรือไม่?', inviteCancelled: 'ยกเลิกคำเชิญแล้ว',
    cancelFailed: 'ยกเลิกคำเชิญไม่สำเร็จ', deactivated: 'ปิดการใช้งานสมาชิกทีมแล้ว', activated: 'เปิดการใช้งานสมาชิกทีมแล้ว',
    statusFailed: 'เปลี่ยนสถานะสมาชิกทีมไม่สำเร็จ',
    title: 'ทีมและสิทธิ์', subtitle: 'จัดการสมาชิกทีม คำเชิญ และสิทธิ์ตามบทบาท',
    inviteMember: 'เชิญสมาชิกทีม', dismiss: 'ปิดข้อความ', tabTeam: 'สมาชิกทีม', tabInvitations: 'คำเชิญ',
    tabRoles: 'บทบาทและสิทธิ์', emptyTeamTitle: 'สร้างทีมของคุณ',
    emptyTeamBody: 'เชิญคนที่ดูแลการจอง ลูกค้า และงานประจำวันของร้าน',
    colMember: 'สมาชิก', colPrimaryRole: 'บทบาทหลัก', colAdditionalRoles: 'บทบาทเพิ่มเติม', colLastLogin: 'เข้าสู่ระบบล่าสุด', colStatus: 'สถานะ',
    removeRole: 'นำ {role} ออก', addRole: '+ เพิ่มบทบาท', never: 'ไม่เคย', active: 'ใช้งาน', inactive: 'ไม่ใช้งาน',
    deactivate: 'ปิดการใช้งาน', activate: 'เปิดการใช้งาน', noInvitations: 'ไม่มีคำเชิญที่รอตอบรับ',
    noInvitationsBody: 'คำเชิญใหม่จะแสดงที่นี่จนกว่าจะได้รับการตอบรับ', expired: 'หมดอายุ', sent: 'ส่งเมื่อ {date}',
    expires: 'หมดอายุ {date}', resend: 'ส่งอีกครั้ง', cancelInvite: 'ยกเลิกคำเชิญ',
    noRolePermission: 'คุณไม่มีสิทธิ์จัดการบทบาทและสิทธิ์', roles: 'บทบาท',
    rolePermissions: 'สิทธิ์ของ {role}', roleHint: 'เลือกว่าบทบาทนี้ดูและแก้ไขอะไรได้บ้าง', systemRole: 'บทบาทของระบบ',
    selectRole: 'เลือกบทบาท', selectRoleHint: 'สิทธิ์ของบทบาทจะแสดงที่นี่', inviteTitle: 'เชิญสมาชิกทีม',
    inviteBody: 'ผู้ได้รับเชิญจะได้รับลิงก์ที่ปลอดภัยเพื่อสร้างบัญชี', close: 'ปิด', fullName: 'ชื่อ-นามสกุล',
    emailAddress: 'อีเมล', primaryRole: 'บทบาทหลัก', cancel: 'ยกเลิก', sending: 'กำลังส่ง…', sendInvite: 'ส่งคำเชิญ',
    roleOwner: 'เจ้าของร้าน', roleAdmin: 'ผู้ดูแล', roleManager: 'ผู้จัดการ', roleReceptionist: 'พนักงานต้อนรับ', roleCashier: 'แคชเชียร์', roleStaff: 'พนักงาน',
  },
};

export const PRIMARY_ROLE_KEY: Record<string, keyof TeamText> = {
  owner: 'roleOwner',
  admin: 'roleAdmin',
  manager: 'roleManager',
  receptionist: 'roleReceptionist',
  cashier: 'roleCashier',
  staff: 'roleStaff',
};
