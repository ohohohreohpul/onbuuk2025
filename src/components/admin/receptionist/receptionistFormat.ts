import { Globe, Mail, MessageCircle } from 'lucide-react';
import type { ChannelKey, Conversation } from './receptionistApi';
import type { ReceptionistText } from './receptionistText';

export const CHANNEL_ICON: Record<ChannelKey, typeof Globe> = { web: Globe, email: Mail, whatsapp: MessageCircle };

export function contactLabel(c: Conversation, t: ReceptionistText): string {
  return c.contact_name || c.contact_email || c.contact_phone || (c.channel === 'web' ? t.unknownVisitor : c.external_id);
}
