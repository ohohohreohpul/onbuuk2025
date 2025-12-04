import { useState, useEffect } from 'react';
import { Building2, Users, CreditCard, Settings, Shield, LogOut, Mail } from 'lucide-react';
import { superAdminAuth } from '../../lib/superAdminAuth';
import SuperAdminLogin from './SuperAdminLogin';
import { supabase } from '../../lib/supabase';
import PlatformEmailEvents from './PlatformEmailEvents';
import PlatformEmailSettings from './PlatformEmailSettings';
import PlatformEmailLogs from './PlatformEmailLogs';

interface Business {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  is_trial: boolean;
  trial_ends_at: string | null;
  subscription_status: string | null;
  created_at: string;
  permalink: string;
}

export default function SuperAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'businesses' | 'stats' | 'emails'>('businesses');
  const [emailSubView, setEmailSubView] = useState<'events' | 'settings' | 'logs'>('events');

  useEffect(() => {
    setIsAuthenticated(superAdminAuth.isAuthenticated());
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadBusinesses();
    }
  }, [isAuthenticated]);

  const loadBusinesses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBusinesses(data || []);
    } catch (err) {
      console.error('Error loading businesses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await superAdminAuth.logout();
    setIsAuthenticated(false);
  };

  const updateBusinessPlan = async (businessId: string, planType: string) => {
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ plan_type: planType })
        .eq('id', businessId);

      if (error) throw error;
      await loadBusinesses();
    } catch (err) {
      console.error('Error updating plan:', err);
      alert('Failed to update plan');
    }
  };

  if (!isAuthenticated) {
    return <SuperAdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  const stats = {
    totalBusinesses: businesses.length,
    standardPlan: businesses.filter(b => b.plan_type === 'standard').length,
    proPlan: businesses.filter(b => b.plan_type === 'pro').length,
    trialActive: businesses.filter(b => b.is_trial).length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-red-500" />
              <div>
                <h1 className="text-2xl font-bold">Super Admin Portal</h1>
                <p className="text-sm text-slate-400">Buuk System Management</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setSelectedView('businesses')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold transition-colors ${
              selectedView === 'businesses'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-5 h-5" />
            All Businesses
          </button>
          <button
            onClick={() => setSelectedView('stats')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold transition-colors ${
              selectedView === 'stats'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-5 h-5" />
            Statistics
          </button>
          <button
            onClick={() => setSelectedView('emails')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold transition-colors ${
              selectedView === 'emails'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Mail className="w-5 h-5" />
            Platform Emails
          </button>
        </div>

        {selectedView === 'emails' && (
          <div>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setEmailSubView('events')}
                className={`px-4 py-2 font-medium transition-colors ${
                  emailSubView === 'events'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Email Events
              </button>
              <button
                onClick={() => setEmailSubView('settings')}
                className={`px-4 py-2 font-medium transition-colors ${
                  emailSubView === 'settings'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setEmailSubView('logs')}
                className={`px-4 py-2 font-medium transition-colors ${
                  emailSubView === 'logs'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Email Logs
              </button>
            </div>

            {emailSubView === 'events' && <PlatformEmailEvents />}
            {emailSubView === 'settings' && <PlatformEmailSettings />}
            {emailSubView === 'logs' && <PlatformEmailLogs />}
          </div>
        )}

        {selectedView === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 shadow">
              <div className="flex items-center justify-between mb-2">
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.totalBusinesses}</p>
              <p className="text-sm text-slate-600">Total Businesses</p>
            </div>

            <div className="bg-white p-6 shadow">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.standardPlan}</p>
              <p className="text-sm text-slate-600">Standard Plan</p>
            </div>

            <div className="bg-white p-6 shadow">
              <div className="flex items-center justify-between mb-2">
                <CreditCard className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.proPlan}</p>
              <p className="text-sm text-slate-600">Pro Plan</p>
            </div>

            <div className="bg-white p-6 shadow">
              <div className="flex items-center justify-between mb-2">
                <Shield className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.trialActive}</p>
              <p className="text-sm text-slate-600">Active Trials</p>
            </div>
          </div>
        )}

        {selectedView === 'businesses' && (
          <div className="bg-white shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">All Businesses</h2>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-slate-500">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Business
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Permalink
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Plan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {businesses.map((business) => (
                      <tr key={business.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{business.name}</div>
                            <div className="text-sm text-slate-500">{business.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700 font-mono">{business.permalink}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={business.plan_type}
                            onChange={(e) => updateBusinessPlan(business.id, e.target.value)}
                            className="text-sm border border-slate-300 px-2 py-1"
                          >
                            <option value="standard">Standard</option>
                            <option value="pro">Pro</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {business.is_trial ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold bg-yellow-100 text-yellow-800">
                              Trial
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold bg-green-100 text-green-800">
                              {business.subscription_status || 'Active'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {new Date(business.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <a
                            href={`/?business=${business.permalink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Site
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
