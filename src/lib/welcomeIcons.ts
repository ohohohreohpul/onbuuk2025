import {
  Award, BadgeCheck, Calendar, Check, CheckCircle2, Clock, Gift, Heart, HelpCircle,
  Shield, ShieldCheck, Smile, Sparkles, Star, ThumbsUp, TrendingUp, Users, Zap, type LucideIcon,
} from 'lucide-react';

/**
 * Icons a shop can pick for its welcome feature cards. Importing only these
 * (instead of the whole lucide set) keeps ~680 KB out of the booking page.
 */
export const WELCOME_ICONS: Record<string, LucideIcon> = {
  Check, CheckCircle2, Clock, Star, Heart, Award, Shield,
  Sparkles, Zap, Users, Calendar, Gift, ThumbsUp, Smile,
  BadgeCheck, ShieldCheck, TrendingUp,
};

export const WELCOME_ICON_NAMES = Object.keys(WELCOME_ICONS);

export function welcomeIcon(name: string | null | undefined): LucideIcon {
  return (name && WELCOME_ICONS[name]) || HelpCircle;
}
