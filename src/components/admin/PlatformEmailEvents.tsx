import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Power, Users, Building2, Shield, Settings, Edit, CheckCircle } from 'lucide-react';
import EmailTemplateEditor from './EmailTemplateEditor';

interface EmailEvent {
  id: string;
  event_key: string;
  event_name: string;
  event_description: string;
  enabled: boolean;
  category: string;
  available_variables: string[];
  trigger_type: string;
  stats?: {
    sent_today: number;
    success_rate: number;
  };
}

const categoryIcons: Record<string, any> = {
  staff: Users,
  business: Building2,
  security: Shield,
  admin: Shield,
  system: Settings,
};

const categoryColors: Record<string, string> = {
  staff: 'bg-blue-100 text-blue-700',
  business: 'bg-green-100 text-green-700',
  security: 'bg-red-100 text-red-700',
  admin: 'bg-orange-100 text-orange-700',
  system: 'bg-gray-100 text-gray-700',
};

export default function PlatformEmailEvents() {
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_email_events')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;

      const eventsWithStats = await Promise.all(
        (data || []).map(async (event) => {
          const today = new Date().toISOString().split('T')[0];

          const { count: totalToday } = await supabase
            .from('platform_email_logs')
            .select('*', { count: 'exact', head: true })
            .eq('event_key', event.event_key)
            .gte('sent_at', `${today}T00:00:00`)
            .lte('sent_at', `${today}T23:59:59`);

          const { count: successToday } = await supabase
            .from('platform_email_logs')
            .select('*', { count: 'exact', head: true })
            .eq('event_key', event.event_key)
            .eq('status', 'sent')
            .gte('sent_at', `${today}T00:00:00`)
            .lte('sent_at', `${today}T23:59:59`);

          return {
            ...event,
            stats: {
              sent_today: totalToday || 0,
              success_rate: totalToday ? Math.round(((successToday || 0) / totalToday) * 100) : 100,
            },
          };
        })
      );

      setEvents(eventsWithStats);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = async (eventKey: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('platform_email_events')
        .update({ enabled: !currentState })
        .eq('event_key', eventKey);

      if (error) throw error;
      await loadEvents();
    } catch (err) {
      console.error('Error toggling event:', err);
      alert('Failed to toggle event');
    }
  };

  const groupedEvents = events.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, EmailEvent[]>);

  if (selectedEvent) {
    return (
      <EmailTemplateEditor
        eventKey={selectedEvent}
        onClose={() => {
          setSelectedEvent(null);
          loadEvents();
        }}
      />
    );
  }

  if (loading) {
    return <div className="text-center py-8">Loading email events...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Platform Email Events</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage all platform email notifications. Enable/disable events or customize templates.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {Object.entries(groupedEvents).map(([category, categoryEvents]) => {
            const Icon = categoryIcons[category] || Mail;
            const colorClass = categoryColors[category] || 'bg-gray-100 text-gray-700';

            return (
              <div key={category} className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`p-2 rounded ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-semibold capitalize">{category} Emails</h3>
                </div>

                <div className="space-y-3">
                  {categoryEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-gray-900">{event.event_name}</h4>
                          <span className="px-2 py-1 text-xs bg-white border border-gray-200 text-gray-600 capitalize">
                            {event.trigger_type}
                          </span>
                          {event.enabled ? (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Enabled
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{event.event_description}</p>
                        {event.stats && (
                          <p className="text-xs text-gray-500 mt-2">
                            {event.stats.sent_today} sent today • {event.stats.success_rate}% success rate
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 ml-4">
                        <button
                          onClick={() => setSelectedEvent(event.event_key)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white hover:bg-slate-800 transition-colors text-sm font-medium"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Template
                        </button>
                        <button
                          onClick={() => toggleEvent(event.event_key, event.enabled)}
                          className={`p-2 transition-colors ${
                            event.enabled
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                          }`}
                          title={event.enabled ? 'Disable' : 'Enable'}
                        >
                          <Power className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
