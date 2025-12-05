import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Globe, Plus, Check, X, AlertCircle, Copy, RefreshCw, Trash2, Crown, ExternalLink } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { usePremiumFeatures } from '../../../hooks/usePremiumFeatures';

interface CustomDomain {
  id: string;
  domain: string;
  status: 'pending' | 'verified' | 'failed' | 'provisioning' | 'active';
  dns_configured: boolean;
  ssl_status: string;
  ssl_certificate_status: 'pending' | 'provisioning' | 'active' | 'failed';
  verified_at: string | null;
  last_checked_at: string | null;
  error_message: string | null;
  netlify_api_error: string | null;
  netlify_domain_id: string | null;
  provisioned_at: string | null;
  is_primary: boolean;
  created_at: string;
}

export default function CustomDomainSettings() {
  const { businessId } = useTenant();
  const premiumFeatures = usePremiumFeatures();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [netlifyUrl, setNetlifyUrl] = useState('');
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchDomains();
    fetchNetlifyUrl();
  }, [businessId]);

  const fetchNetlifyUrl = async () => {
    // Get Netlify URL from environment or settings
    const url = import.meta.env.VITE_NETLIFY_SITE_URL || window.location.hostname;
    setNetlifyUrl(url);
  };

  const fetchDomains = async () => {
    if (!businessId) return;

    const { data, error } = await supabase
      .from('custom_domains')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDomains(data);
    }
    setLoading(false);
  };

  const handleUpgrade = async () => {
    if (upgrading || !businessId) return;

    setUpgrading(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upgrade-subscription`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          business_id: businessId,
          plan_type: 'pro',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Stripe checkout error:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No checkout URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to start upgrade process. Please try again or contact support.');
      setUpgrading(false);
    }
  };

  const validateDomain = (domain: string): string | null => {
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

    if (!domain) {
      return 'Please enter a domain';
    }

    if (!domainRegex.test(domain)) {
      return 'Please enter a valid domain (e.g., bookings.example.com)';
    }

    // Check if domain already exists
    if (domains.some(d => d.domain.toLowerCase() === domain.toLowerCase())) {
      return 'This domain is already added';
    }

    return null;
  };

  const handleAddDomain = async () => {
    if (!businessId || !premiumFeatures.canUseCustomDomain) return;

    const error = validateDomain(newDomain);
    if (error) {
      alert(error);
      return;
    }

    setAdding(true);

    try {
      const { data, error: insertError } = await supabase
        .from('custom_domains')
        .insert({
          business_id: businessId,
          domain: newDomain.toLowerCase().trim(),
          status: 'pending',
          dns_configured: false,
          ssl_status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setDomains([data, ...domains]);
      setNewDomain('');
      setShowInstructions(true);
    } catch (error) {
      console.error('Error adding domain:', error);
      alert('Failed to add domain. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifying(domainId);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-custom-domain`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ domain_id: domainId }),
      });

      const result = await response.json();

      if (result.error) {
        alert(`Verification failed: ${result.error}`);
      } else if (result.configured) {
        alert('Domain verified successfully! SSL certificate will be provisioned automatically by Netlify.');
      } else {
        alert(`DNS not configured yet: ${result.error || 'Please check your DNS settings.'}`);
      }

      await fetchDomains();
    } catch (error) {
      console.error('Error verifying domain:', error);
      alert('Failed to verify domain. Please try again.');
    } finally {
      setVerifying(null);
    }
  };

  const handleSetPrimary = async (domainId: string) => {
    try {
      const { error } = await supabase
        .from('custom_domains')
        .update({ is_primary: true })
        .eq('id', domainId);

      if (error) throw error;

      await fetchDomains();
    } catch (error) {
      console.error('Error setting primary domain:', error);
      alert('Failed to set primary domain.');
    }
  };

  const handleRemoveDomain = async (domainId: string, domain: string) => {
    if (!confirm(`Are you sure you want to remove ${domain}? This will remove it from Netlify and your database.`)) {
      return;
    }

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-domain-from-netlify`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ domain_id: domainId }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(`Failed to remove domain: ${result.error}`);
        return;
      }

      setDomains(domains.filter(d => d.id !== domainId));
      alert('Domain removed successfully!');
    } catch (error) {
      console.error('Error removing domain:', error);
      alert('Failed to remove domain. Please try again.');
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusBadge = (domain: CustomDomain) => {
    if (domain.status === 'active' || (domain.status === 'verified' && domain.ssl_certificate_status === 'active')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
          <Check className="w-3 h-3" />
          <span>Active</span>
        </span>
      );
    }

    if (domain.status === 'provisioning') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Adding to Platform</span>
        </span>
      );
    }

    if (domain.status === 'verified' && domain.dns_configured) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
          <Check className="w-3 h-3" />
          <span>DNS Verified</span>
        </span>
      );
    }

    if (domain.status === 'failed') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
          <X className="w-3 h-3" />
          <span>Failed</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center space-x-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
        <AlertCircle className="w-3 h-3" />
        <span>Pending DNS</span>
      </span>
    );
  };

  const getSSLBadge = (domain: CustomDomain) => {
    if (domain.ssl_certificate_status === 'active') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
          <Check className="w-3 h-3" />
          <span>SSL Active</span>
        </span>
      );
    }

    if (domain.ssl_certificate_status === 'provisioning') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>SSL Provisioning</span>
        </span>
      );
    }

    if (domain.ssl_certificate_status === 'failed') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
          <X className="w-3 h-3" />
          <span>SSL Failed</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center space-x-1 px-2 py-1 bg-stone-100 text-stone-600 text-xs font-medium rounded">
        <AlertCircle className="w-3 h-3" />
        <span>SSL Pending</span>
      </span>
    );
  };

  if (!premiumFeatures.canUseCustomDomain) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-lg p-8 text-center">
          <Crown className="w-16 h-16 text-amber-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-amber-900 mb-2">Custom Domains - Pro Feature</h3>
          <p className="text-amber-800 mb-6">
            Connect your own domain to create a fully branded booking experience.
            Upgrade to Pro to unlock custom domains with automatic SSL certificates.
          </p>
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="px-6 py-3 bg-amber-600 text-white font-semibold rounded hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {upgrading ? 'Processing...' : 'Upgrade to Pro →'}
          </button>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg p-6">
          <h4 className="font-medium text-stone-800 mb-4">Why Use a Custom Domain?</h4>
          <ul className="space-y-3 text-sm text-stone-600">
            <li className="flex items-start space-x-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Professional appearance with your own brand (e.g., bookings.yourbusiness.com)</span>
            </li>
            <li className="flex items-start space-x-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Builds trust with your customers</span>
            </li>
            <li className="flex items-start space-x-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Automatic SSL certificate for secure HTTPS connections</span>
            </li>
            <li className="flex items-start space-x-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Better SEO and memorability</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-stone-600">Loading domains...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Globe className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Custom Domain Setup</h3>
            <p className="text-sm text-blue-800 mt-1">
              Connect your own domain to create a fully branded booking experience.
              Add your domain, configure DNS, and we'll handle the SSL certificate automatically through Netlify.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-stone-800 mb-4">Add Custom Domain</h3>

        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
            placeholder="bookings.yourdomain.com"
            className="flex-1 px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
          />
          <button
            onClick={handleAddDomain}
            disabled={adding || !newDomain.trim()}
            className="flex items-center space-x-2 px-6 py-2 bg-stone-800 text-white rounded hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>{adding ? 'Adding...' : 'Add Domain'}</span>
          </button>
        </div>

        <p className="text-xs text-stone-500">
          Enter a subdomain like "bookings.yourdomain.com" or "book.yourdomain.com"
        </p>
      </div>

      {domains.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-stone-200">
            <h3 className="text-lg font-medium text-stone-800">Your Domains</h3>
          </div>

          <div className="divide-y divide-stone-200">
            {domains.map((domain) => (
              <div key={domain.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-medium text-stone-800">{domain.domain}</h4>
                      {getStatusBadge(domain)}
                      {domain.netlify_domain_id && getSSLBadge(domain)}
                      {domain.is_primary && (
                        <span className="px-2 py-1 bg-stone-800 text-white text-xs font-medium rounded">
                          Primary
                        </span>
                      )}
                    </div>

                    {domain.error_message && (
                      <div className="flex items-start space-x-2 text-sm text-red-600 mb-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{domain.error_message}</span>
                      </div>
                    )}

                    {domain.netlify_api_error && (
                      <div className="flex items-start space-x-2 text-sm text-red-600 mb-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>Platform error: {domain.netlify_api_error}</span>
                      </div>
                    )}

                    <div className="text-sm text-stone-600 space-y-1">
                      {domain.verified_at && (
                        <p>DNS Verified: {new Date(domain.verified_at).toLocaleDateString()}</p>
                      )}
                      {domain.provisioned_at && (
                        <p>Added to Platform: {new Date(domain.provisioned_at).toLocaleDateString()}</p>
                      )}
                      {domain.last_checked_at && (
                        <p className="text-xs">
                          Last checked: {new Date(domain.last_checked_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {domain.status === 'provisioning' && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-start space-x-2">
                          <RefreshCw className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium">Adding domain to platform...</p>
                            <p className="mt-1 text-xs">This usually takes 5-15 minutes. SSL certificate will be provisioned automatically.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {domain.status === 'verified' && !domain.is_primary && (
                      <button
                        onClick={() => handleSetPrimary(domain.id)}
                        className="px-3 py-1 text-sm border border-stone-300 text-stone-700 rounded hover:bg-stone-50"
                      >
                        Set as Primary
                      </button>
                    )}
                    <button
                      onClick={() => handleVerifyDomain(domain.id)}
                      disabled={verifying === domain.id}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-stone-800 text-white rounded hover:bg-stone-700 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${verifying === domain.id ? 'animate-spin' : ''}`} />
                      <span>{verifying === domain.id ? 'Checking...' : 'Verify'}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveDomain(domain.id, domain.domain)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {domain.status !== 'verified' && (
                  <div className="mt-4 p-4 bg-stone-50 border border-stone-200 rounded">
                    <h5 className="font-medium text-stone-800 mb-3 flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>DNS Configuration Required</span>
                    </h5>

                    <p className="text-sm text-stone-600 mb-3">
                      Add the following CNAME record to your DNS provider:
                    </p>

                    <div className="bg-white border border-stone-200 rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-stone-100">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-stone-700">Type</th>
                            <th className="px-4 py-2 text-left font-medium text-stone-700">Name</th>
                            <th className="px-4 py-2 text-left font-medium text-stone-700">Value</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-4 py-3 border-t border-stone-200">
                              <code className="px-2 py-1 bg-stone-100 rounded text-xs">CNAME</code>
                            </td>
                            <td className="px-4 py-3 border-t border-stone-200">
                              <code className="text-xs">{domain.domain.split('.')[0]}</code>
                            </td>
                            <td className="px-4 py-3 border-t border-stone-200">
                              <code className="text-xs">{netlifyUrl}</code>
                            </td>
                            <td className="px-4 py-3 border-t border-stone-200 text-right">
                              <button
                                onClick={() => copyToClipboard(netlifyUrl, `cname-${domain.id}`)}
                                className="flex items-center space-x-1 text-xs text-stone-600 hover:text-stone-800"
                              >
                                {copiedField === `cname-${domain.id}` ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 text-xs text-stone-600 space-y-1">
                      <p className="flex items-start space-x-2">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>DNS changes can take up to 48 hours to propagate, but usually happen within a few minutes.</span>
                      </p>
                      <p className="flex items-start space-x-2">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>Once verified, Netlify will automatically provision an SSL certificate for HTTPS.</span>
                      </p>
                    </div>
                  </div>
                )}

                {domain.status === 'verified' && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-start space-x-2 text-sm text-green-800">
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Domain Active</p>
                        <p className="mt-1">
                          Your domain is properly configured and your booking site is accessible at{' '}
                          <a
                            href={`https://${domain.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 underline hover:no-underline"
                          >
                            <span>https://{domain.domain}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-stone-50 border border-stone-200 rounded-lg p-6">
        <h4 className="font-medium text-stone-800 mb-3">Setup Process</h4>
        <div className="text-sm text-stone-600 space-y-3">
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
            <div>
              <p className="font-medium text-stone-800">Add Your Domain</p>
              <p className="text-xs mt-1">Enter your custom domain (e.g., booking.yourdomain.com)</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
            <div>
              <p className="font-medium text-stone-800">Configure DNS</p>
              <p className="text-xs mt-1">Add a CNAME record at your domain registrar pointing to {netlifyUrl}</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center text-xs font-medium">3</span>
            <div>
              <p className="font-medium text-stone-800">Verify DNS</p>
              <p className="text-xs mt-1">Wait a few minutes and click "Verify" - DNS changes can take 5-60 minutes</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center text-xs font-medium">4</span>
            <div>
              <p className="font-medium text-stone-800">Platform Configuration</p>
              <p className="text-xs mt-1">Your domain is automatically added to our platform after DNS verification</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center text-xs font-medium">5</span>
            <div>
              <p className="font-medium text-stone-800">SSL Certificate</p>
              <p className="text-xs mt-1">SSL certificate is provisioned automatically (5-15 minutes) - your domain will be live with HTTPS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
