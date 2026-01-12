import { useState, useEffect } from 'react';
import { Code, Copy, Check, ExternalLink, Monitor, MessageSquare, Layout, Palette, Crown, Lock } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { supabase } from '../../../lib/supabase';
import { usePremiumFeatures } from '../../../hooks/usePremiumFeatures';

type WidgetType = 'full-page' | 'floating-button' | 'inline';
type ButtonPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface WidgetConfig {
  type: WidgetType;
  buttonText: string;
  buttonPosition: ButtonPosition;
  buttonColor: string;
  buttonTextColor: string;
  width: string;
  height: string;
}

export default function WidgetEmbed() {
  const { businessId } = useTenant();
  const premiumFeatures = usePremiumFeatures();
  const [copied, setCopied] = useState<string | null>(null);
  const [bookingUrl, setBookingUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<WidgetConfig>({
    type: 'floating-button',
    buttonText: 'Book Now',
    buttonPosition: 'bottom-right',
    buttonColor: '#008374',
    buttonTextColor: '#ffffff',
    width: '100%',
    height: '700px',
  });

  useEffect(() => {
    fetchBusinessDomain();
  }, [businessId]);

  const fetchBusinessDomain = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('permalink, custom_domain')
        .eq('id', businessId)
        .single();

      if (!error && data) {
        // Use custom domain if available, otherwise use permalink
        if (data.custom_domain) {
          setBookingUrl(`https://${data.custom_domain}`);
        } else if (data.permalink) {
          setBookingUrl(`https://${data.permalink}.onbuuk.com`);
        }
      }
    } catch (err) {
      console.error('Error fetching business domain:', err);
    } finally {
      setLoading(false);
    }
  };

  const getBookingUrl = () => {
    return bookingUrl || '';
  };

  const generateFullPageEmbed = () => {
    return `<!-- Buuk Booking Widget - Full Page -->
<iframe 
  src="${getBookingUrl()}"
  style="width: ${config.width}; height: ${config.height}; border: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"
  title="Book an Appointment"
  loading="lazy"
></iframe>`;
  };

  const generateInlineEmbed = () => {
    return `<!-- Buuk Booking Widget - Inline -->
<div id="buuk-booking-widget" style="width: 100%; max-width: 600px; margin: 0 auto;">
  <iframe 
    src="${getBookingUrl()}"
    style="width: 100%; height: ${config.height}; border: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"
    title="Book an Appointment"
    loading="lazy"
  ></iframe>
</div>`;
  };

  const generateFloatingButtonEmbed = () => {
    const positionStyles = {
      'bottom-right': 'bottom: 24px; right: 24px;',
      'bottom-left': 'bottom: 24px; left: 24px;',
      'top-right': 'top: 24px; right: 24px;',
      'top-left': 'top: 24px; left: 24px;',
    };

    return `<!-- Buuk Booking Widget - Floating Button -->
<style>
  #buuk-floating-btn {
    position: fixed;
    ${positionStyles[config.buttonPosition]}
    z-index: 9999;
    background: ${config.buttonColor};
    color: ${config.buttonTextColor};
    border: none;
    padding: 14px 28px;
    border-radius: 50px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    transition: all 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  #buuk-floating-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  }
  #buuk-modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 10000;
    backdrop-filter: blur(4px);
  }
  #buuk-modal-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 500px;
    height: 85vh;
    max-height: 700px;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  }
  #buuk-modal-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    background: rgba(0,0,0,0.1);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    transition: background 0.2s;
  }
  #buuk-modal-close:hover {
    background: rgba(0,0,0,0.2);
  }
  #buuk-modal-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>

<button id="buuk-floating-btn">${config.buttonText}</button>

<div id="buuk-modal-overlay">
  <div id="buuk-modal-content">
    <button id="buuk-modal-close">×</button>
    <iframe id="buuk-modal-iframe" src="" title="Book an Appointment" loading="lazy"></iframe>
  </div>
</div>

<script>
(function() {
  const btn = document.getElementById('buuk-floating-btn');
  const overlay = document.getElementById('buuk-modal-overlay');
  const closeBtn = document.getElementById('buuk-modal-close');
  const iframe = document.getElementById('buuk-modal-iframe');
  const bookingUrl = '${getBookingUrl()}';

  btn.addEventListener('click', function() {
    iframe.src = bookingUrl;
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  });

  closeBtn.addEventListener('click', function() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
})();
</script>`;
  };

  const getEmbedCode = () => {
    switch (config.type) {
      case 'full-page':
        return generateFullPageEmbed();
      case 'inline':
        return generateInlineEmbed();
      case 'floating-button':
        return generateFloatingButtonEmbed();
      default:
        return '';
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const widgetTypes = [
    {
      id: 'floating-button' as WidgetType,
      name: 'Floating Button',
      description: 'A button that floats on the page and opens a booking popup',
      icon: MessageSquare,
    },
    {
      id: 'full-page' as WidgetType,
      name: 'Full Page Embed',
      description: 'Embed the full booking page directly on your website',
      icon: Monitor,
    },
    {
      id: 'inline' as WidgetType,
      name: 'Inline Widget',
      description: 'A compact widget that fits within your page content',
      icon: Layout,
    },
  ];

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-500">Loading...</div>
      </div>
    );
  }

  // Premium feature gate
  if (!premiumFeatures.isPro) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-xl font-semibold text-stone-800 mb-2">Premium Feature</h3>
          <p className="text-stone-600 mb-6 max-w-md mx-auto">
            Embeddable widgets allow you to add booking functionality directly to your website. 
            Upgrade to Pro to unlock this feature.
          </p>
          <div className="flex items-center justify-center gap-2 text-amber-700 font-medium">
            <Crown className="w-5 h-5" />
            <span>Available on Pro Plan</span>
          </div>
        </div>

        {/* Preview of what they'll get */}
        <div className="opacity-50 pointer-events-none">
          <div className="border border-stone-200 rounded-xl p-6">
            <h4 className="font-medium text-stone-800 mb-4">Widget Types Available with Pro:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {widgetTypes.map((type) => (
                <div key={type.id} className="p-4 border border-stone-200 rounded-lg">
                  <type.icon className="w-6 h-6 text-stone-400 mb-2" />
                  <h5 className="font-medium text-stone-700">{type.name}</h5>
                  <p className="text-xs text-stone-500 mt-1">{type.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if booking URL is set
  if (!bookingUrl) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Booking URL Not Found</h3>
          <p className="text-sm text-yellow-700 mb-4">
            We couldn't find your booking page URL. Please ensure your subdomain is configured in <strong>Store Profile</strong>.
          </p>
          <p className="text-sm text-yellow-600">
            If you've already set up your subdomain, try refreshing the page.
          </p>
        </div>
        
        {/* Manual URL input as fallback */}
        <div className="border border-stone-200 rounded-xl p-6">
          <h4 className="font-medium text-stone-800 mb-3">Enter Your Booking URL Manually</h4>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://yourbusiness.onbuuk.com"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              className="flex-1 px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800"
            />
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Enter your full booking page URL (e.g., https://mybusiness.onbuuk.com)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold text-stone-800">Embed Booking Widget</h3>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <Crown className="w-3 h-3" />
            Pro
          </span>
        </div>
        <p className="text-sm text-stone-600">
          Add a booking widget to your website. Choose from different styles and customize the appearance.
        </p>
      </div>

      {/* Widget Type Selection */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-3">Widget Type</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {widgetTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setConfig({ ...config, type: type.id })}
              className={`p-4 border-2 rounded-xl text-left transition-all ${
                config.type === type.id
                  ? 'border-stone-800 bg-stone-50'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <type.icon className={`w-6 h-6 mb-2 ${config.type === type.id ? 'text-stone-800' : 'text-stone-400'}`} />
              <h4 className="font-medium text-stone-800">{type.name}</h4>
              <p className="text-xs text-stone-500 mt-1">{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Configuration Options */}
      {config.type === 'floating-button' && (
        <div className="space-y-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
          <h4 className="font-medium text-stone-800 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Button Customization
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Button Text</label>
              <input
                type="text"
                value={config.buttonText}
                onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800"
                placeholder="Book Now"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Position</label>
              <select
                value={config.buttonPosition}
                onChange={(e) => setConfig({ ...config, buttonPosition: e.target.value as ButtonPosition })}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Button Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.buttonColor}
                  onChange={(e) => setConfig({ ...config, buttonColor: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer border border-stone-200"
                />
                <input
                  type="text"
                  value={config.buttonColor}
                  onChange={(e) => setConfig({ ...config, buttonColor: e.target.value })}
                  className="flex-1 px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.buttonTextColor}
                  onChange={(e) => setConfig({ ...config, buttonTextColor: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer border border-stone-200"
                />
                <input
                  type="text"
                  value={config.buttonTextColor}
                  onChange={(e) => setConfig({ ...config, buttonTextColor: e.target.value })}
                  className="flex-1 px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800 font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Button Preview */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-stone-700 mb-2">Preview</label>
            <div className="bg-white border border-stone-200 rounded-lg p-8 flex items-center justify-center min-h-[100px] relative">
              <button
                style={{
                  background: config.buttonColor,
                  color: config.buttonTextColor,
                  padding: '14px 28px',
                  borderRadius: '50px',
                  fontSize: '16px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                }}
              >
                {config.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}

      {(config.type === 'full-page' || config.type === 'inline') && (
        <div className="space-y-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
          <h4 className="font-medium text-stone-800 flex items-center gap-2">
            <Layout className="w-4 h-4" />
            Size Configuration
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Width</label>
              <input
                type="text"
                value={config.width}
                onChange={(e) => setConfig({ ...config, width: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800"
                placeholder="100%"
              />
              <p className="text-xs text-stone-500 mt-1">e.g., 100%, 600px, 80vw</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Height</label>
              <input
                type="text"
                value={config.height}
                onChange={(e) => setConfig({ ...config, height: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800"
                placeholder="700px"
              />
              <p className="text-xs text-stone-500 mt-1">e.g., 700px, 80vh</p>
            </div>
          </div>
        </div>
      )}

      {/* Embed Code */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-stone-700 flex items-center gap-2">
            <Code className="w-4 h-4" />
            Embed Code
          </label>
          <button
            onClick={() => copyToClipboard(getEmbedCode(), 'embed')}
            className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors text-sm"
          >
            {copied === 'embed' ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Code
              </>
            )}
          </button>
        </div>
        
        <div className="relative">
          <pre className="bg-stone-900 text-stone-100 p-4 rounded-xl overflow-x-auto text-sm font-mono whitespace-pre-wrap">
            {getEmbedCode()}
          </pre>
        </div>
      </div>

      {/* Direct Link */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h4 className="font-medium text-blue-800 flex items-center gap-2 mb-2">
          <ExternalLink className="w-4 h-4" />
          Direct Booking Link
        </h4>
        <p className="text-sm text-blue-700 mb-3">
          Share this link directly with your customers:
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={getBookingUrl()}
            readOnly
            className="flex-1 px-4 py-2 bg-white border border-blue-200 rounded-lg text-sm font-mono"
          />
          <button
            onClick={() => copyToClipboard(getBookingUrl(), 'link')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
          >
            {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={getBookingUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
        <h4 className="font-medium text-stone-800 mb-3">How to Use</h4>
        <ol className="text-sm text-stone-600 space-y-2 list-decimal list-inside">
          <li>Choose your preferred widget type above</li>
          <li>Customize the appearance if needed</li>
          <li>Copy the embed code using the "Copy Code" button</li>
          <li>Paste the code into your website's HTML where you want the widget to appear</li>
          <li>For the floating button, paste it just before the closing <code className="bg-stone-200 px-1 rounded">&lt;/body&gt;</code> tag</li>
        </ol>
      </div>
    </div>
  );
}
