import { useState, useEffect } from 'react';
import { X, Calendar, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';

interface TimeBlocksModalProps {
  specialistId: string;
  specialistName: string;
  onClose: () => void;
}

interface TimeBlock {
  id?: string;
  start_time: string;
  end_time: string;
  reason: string;
}

export default function TimeBlocksModal({ specialistId, specialistName, onClose }: TimeBlocksModalProps) {
  const { businessId } = useTenant();
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTimeBlocks();
  }, [specialistId]);

  const fetchTimeBlocks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('specialist_id', specialistId)
      .gte('end_time', new Date().toISOString())
      .order('start_time');

    setTimeBlocks(data || []);
    setLoading(false);
  };

  const addTimeBlock = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const endTime = new Date(tomorrow);
    endTime.setHours(17, 0, 0, 0);

    setTimeBlocks([
      ...timeBlocks,
      {
        start_time: tomorrow.toISOString().slice(0, 16),
        end_time: endTime.toISOString().slice(0, 16),
        reason: 'Time Off',
      },
    ]);
  };

  const updateTimeBlock = (index: number, field: keyof TimeBlock, value: string) => {
    setTimeBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, [field]: value } : block))
    );
  };

  const removeTimeBlock = async (index: number) => {
    const block = timeBlocks[index];
    if (block.id) {
      await supabase.from('time_blocks').delete().eq('id', block.id);
    }
    setTimeBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);

    try {
      const existingIds = timeBlocks.filter((b) => b.id).map((b) => b.id);
      await supabase
        .from('time_blocks')
        .delete()
        .eq('specialist_id', specialistId)
        .not('id', 'in', `(${existingIds.join(',')})`);

      for (const block of timeBlocks) {
        const blockData = {
          business_id: businessId,
          specialist_id: specialistId,
          start_time: new Date(block.start_time).toISOString(),
          end_time: new Date(block.end_time).toISOString(),
          reason: block.reason,
        };

        if (block.id) {
          await supabase
            .from('time_blocks')
            .update(blockData)
            .eq('id', block.id);
        } else {
          await supabase.from('time_blocks').insert(blockData);
        }
      }

      onClose();
    } catch (error) {
      console.error('Error saving time blocks:', error);
      alert('Failed to save time blocks');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-stone-700" />
            <div>
              <h2 className="text-xl font-semibold text-stone-900">Time Blocks</h2>
              <p className="text-sm text-stone-600">{specialistName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-stone-500">Loading...</div>
          ) : (
            <>
              <div className="space-y-4">
                {timeBlocks.length === 0 ? (
                  <div className="text-center py-8 text-stone-500">
                    No time blocks scheduled. Add vacation or unavailable periods below.
                  </div>
                ) : (
                  timeBlocks.map((block, index) => (
                    <div
                      key={index}
                      className="p-4 border border-stone-200 rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <input
                          type="text"
                          value={block.reason}
                          onChange={(e) => updateTimeBlock(index, 'reason', e.target.value)}
                          placeholder="Reason (e.g., Vacation, Sick Leave)"
                          className="flex-1 px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
                        />
                        <button
                          onClick={() => removeTimeBlock(index)}
                          className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Start Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={block.start_time}
                            onChange={(e) => updateTimeBlock(index, 'start_time', e.target.value)}
                            className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            End Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={block.end_time}
                            onChange={(e) => updateTimeBlock(index, 'end_time', e.target.value)}
                            className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={addTimeBlock}
                className="mt-4 w-full py-3 border-2 border-dashed border-stone-300 text-stone-600 hover:border-stone-400 hover:text-stone-700 transition-colors rounded-lg flex items-center justify-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add Time Block</span>
              </button>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Time blocks prevent bookings during specified periods. Use this for vacations, holidays, or other unavailable times.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-stone-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-stone-900 text-white hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Time Blocks'}
          </button>
        </div>
      </div>
    </div>
  );
}
