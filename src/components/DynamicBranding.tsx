import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';

interface BrandingSettings {
  custom_page_title: string | null;
  custom_favicon_url: string | null;
  custom_og_image_url: string | null;
  custom_meta_description: string | null;
  name: string;
  plan_type: string;
  hide_powered_by_badge: boolean;
}

const DEFAULT_TITLE = 'Welcome to Buuk!';
const DEFAULT_DESCRIPTION = 'The all-in-one booking system for your business. Schedule appointments, manage clients, and grow your business with Buuk.';
const DEFAULT_FAVICON = '/iconobrowser.png';
const DEFAULT_OG_IMAGE = 'https://app.onbuuk.com/buukgc.png';

export function DynamicBranding() {
  const { businessId, isLoading } = useTenant();
  const [brandingApplied, setBrandingApplied] = useState(false);

  useEffect(() => {
    // Don't do anything while tenant is still loading
    if (isLoading) {
      return;
    }

    if (!businessId) {
      // No business context - apply Buuk defaults
      updateDocumentHead({
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        favicon: DEFAULT_FAVICON,
        ogImage: DEFAULT_OG_IMAGE,
      });
      setBrandingApplied(true);
      return;
    }

    async function fetchBranding() {
      try {
        const { data: business, error } = await supabase
          .from('businesses')
          .select('custom_page_title, custom_favicon_url, custom_og_image_url, custom_meta_description, name, plan_type, hide_powered_by_badge')
          .eq('id', businessId)
          .single();

        if (error || !business) {
          console.error('Error fetching branding:', error);
          return;
        }

        // Check if premium plan - same check as hide_powered_by_badge
        const isPremium = business.plan_type === 'pro' || business.plan_type === 'premium';
        
        // Only apply custom branding for premium users
        if (isPremium) {
          updateDocumentHead({
            title: business.custom_page_title || business.name || DEFAULT_TITLE,
            description: business.custom_meta_description || DEFAULT_DESCRIPTION,
            favicon: business.custom_favicon_url || DEFAULT_FAVICON,
            ogImage: business.custom_og_image_url || DEFAULT_OG_IMAGE,
            businessName: business.name,
          });
        } else {
          // Non-premium users get default Buuk branding
          updateDocumentHead({
            title: DEFAULT_TITLE,
            description: DEFAULT_DESCRIPTION,
            favicon: DEFAULT_FAVICON,
            ogImage: DEFAULT_OG_IMAGE,
          });
        }
      } catch (error) {
        console.error('Error fetching branding settings:', error);
      }
    }

    fetchBranding();

    // Cleanup: restore defaults when component unmounts or business changes
    return () => {
      // Don't reset on every change, only when truly unmounting
    };
  }, [businessId]);

  return null; // This component doesn't render anything
}

function updateDocumentHead({
  title,
  description,
  favicon,
  ogImage,
  businessName,
}: {
  title: string;
  description: string;
  favicon: string;
  ogImage: string;
  businessName?: string;
}) {
  // Update page title
  document.title = title;

  // Update favicon
  updateFavicon(favicon);

  // Update meta description
  updateMetaTag('description', description);

  // Update Open Graph tags
  updateMetaTag('og:title', title, 'property');
  updateMetaTag('og:description', description, 'property');
  updateMetaTag('og:image', ogImage, 'property');

  // Update Twitter tags
  updateMetaTag('twitter:title', title, 'name');
  updateMetaTag('twitter:description', description, 'name');
  updateMetaTag('twitter:image', ogImage, 'name');
}

function updateFavicon(url: string) {
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
  
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  
  // Handle relative URLs
  if (url.startsWith('/')) {
    link.href = url;
  } else {
    link.href = url;
  }
  
  // Also update apple-touch-icon if it exists
  const appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
  if (appleIcon) {
    appleIcon.href = url;
  }
}

function updateMetaTag(name: string, content: string, attributeName: 'name' | 'property' = 'name') {
  let meta = document.querySelector(`meta[${attributeName}='${name}']`) as HTMLMetaElement;
  
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attributeName, name);
    document.head.appendChild(meta);
  }
  
  meta.content = content;
}

export default DynamicBranding;
