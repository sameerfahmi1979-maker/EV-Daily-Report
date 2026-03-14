import React, { useState, useEffect } from 'react';
import { Building2, User, Clock, Calendar } from 'lucide-react';
import { getStations } from '../lib/stationService';
import { supabase } from '../lib/supabase';
import { SHIFT_TYPES } from '../lib/shiftService';
import { Database } from '../lib/database.types';

type Station = Database['public']['Tables']['stations']['Row'];
type Operator = Database['public']['Tables']['operators']['Row'];

export interface ShiftSelection {
  stationId: string;
  stationName: string;
  operatorId: string;
  operatorName: string;
  shiftDate: string;
  shiftDuration: '8h' | '12h';
  shiftType: string;
  startTime: string;  // HH:mm format — user can override
  endTime: string;    // HH:mm format — user can override
}

interface ShiftSelectorProps {
  value: ShiftSelection | null;
  onChange: (selection: ShiftSelection | null) => void;
  disabled?: boolean;
}

export default function ShiftSelector({ value, onChange, disabled = false }: ShiftSelectorProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedStation, setSelectedStation] = useState(value?.stationId || '');
  const [selectedOperator, setSelectedOperator] = useState(value?.operatorId || '');
  const [shiftDate, setShiftDate] = useState(value?.shiftDate || new Date().toISOString().split('T')[0]);
  const [shiftDuration, setShiftDuration] = useState<'8h' | '12h'>(value?.shiftDuration || '8h');
  const [shiftType, setShiftType] = useState(value?.shiftType || '');
  const [startTime, setStartTime] = useState(value?.startTime || '');
  const [endTime, setEndTime] = useState(value?.endTime || '');

  useEffect(() => {
    loadStations();
    loadOperators();
  }, []);

  // Auto-filter shift types by selected duration
  const availableShiftTypes = Object.entries(SHIFT_TYPES).filter(
    ([, def]) => def.duration === shiftDuration
  );

  // When duration changes, auto-select first matching type
  useEffect(() => {
    const matching = availableShiftTypes;
    if (matching.length > 0 && !matching.find(([key]) => key === shiftType)) {
      setShiftType(matching[0][0]);
    }
  }, [shiftDuration]);

  // When shift type changes, pre-fill start/end times with defaults
  useEffect(() => {
    const def = SHIFT_TYPES[shiftType];
    if (def) {
      setStartTime(def.defaultStart);
      setEndTime(def.defaultEnd);
    }
  }, [shiftType]);

  // Propagate changes
  useEffect(() => {
    if (selectedStation && selectedOperator && shiftDate && shiftType && startTime && endTime) {
      const station = stations.find(s => s.id === selectedStation);
      const operator = operators.find(o => o.id === selectedOperator);
      onChange({
        stationId: selectedStation,
        stationName: station?.name || '',
        operatorId: selectedOperator,
        operatorName: operator?.name || '',
        shiftDate,
        shiftDuration,
        shiftType,
        startTime,
        endTime,
      });
    } else {
      onChange(null);
    }
  }, [selectedStation, selectedOperator, shiftDate, shiftDuration, shiftType, startTime, endTime]);

  async function loadStations() {
    try {
      const data = await getStations();
      setStations(data);
      if (data.length > 0 && !selectedStation) {
        setSelectedStation(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load stations:', err);
    }
  }

  async function loadOperators() {
    try {
      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      setOperators(data || []);
    } catch (err) {
      console.error('Failed to load operators:', err);
    }
  }

  const selectedShiftDef = SHIFT_TYPES[shiftType];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Clock size={20} className="text-blue-600" />
        Shift Assignment
      </h3>
      <p className="text-sm text-gray-500 mb-5">
        Select the station, operator, and shift for this upload. All imported sessions will be linked to this shift.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Station */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
            <Building2 size={14} />
            Station <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
          >
            <option value="">Select a station...</option>
            {stations.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.station_code ? `(${s.station_code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Operator */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
            <User size={14} />
            Operator <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedOperator}
            onChange={(e) => setSelectedOperator(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
          >
            <option value="">Select an operator...</option>
            {operators.map(o => (
              <option key={o.id} value={o.id}>
                {o.name} — Card: {o.card_number}
              </option>
            ))}
          </select>
        </div>

        {/* Shift Date */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
            <Calendar size={14} />
            Shift Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
          />
        </div>

        {/* Shift Duration */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Shift Duration <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShiftDuration('8h')}
              disabled={disabled}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                shiftDuration === '8h'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
              } disabled:opacity-50`}
            >
              8 Hours
            </button>
            <button
              type="button"
              onClick={() => setShiftDuration('12h')}
              disabled={disabled}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                shiftDuration === '12h'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
              } disabled:opacity-50`}
            >
              Extended Shift
            </button>
          </div>
        </div>

        {/* Shift Type */}
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Shift Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {availableShiftTypes.map(([key, def]) => (
              <button
                key={key}
                type="button"
                onClick={() => setShiftType(key)}
                disabled={disabled}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all text-left ${
                  shiftType === key
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                } disabled:opacity-50`}
              >
                {def.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actual Start & End Time — only editable for Extended Shift */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
            <Clock size={14} />
            Actual Start Time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={disabled || shiftDuration === '8h'}
            className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm ${
              shiftDuration === '8h' ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-50'
            }`}
          />
          {shiftDuration === '8h' && (
            <p className="text-xs text-gray-400 mt-1">Fixed for 8-hour shifts</p>
          )}
          {shiftDuration === '12h' && selectedShiftDef && startTime !== selectedShiftDef.defaultStart && (
            <p className="text-xs text-amber-600 mt-1">
              Default: {selectedShiftDef.defaultStart} — adjusted by operator
            </p>
          )}
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
            <Clock size={14} />
            Actual End Time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={disabled || shiftDuration === '8h'}
            className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm ${
              shiftDuration === '8h' ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-50'
            }`}
          />
          {shiftDuration === '8h' && (
            <p className="text-xs text-gray-400 mt-1">Fixed for 8-hour shifts</p>
          )}
          {shiftDuration === '12h' && selectedShiftDef && endTime !== selectedShiftDef.defaultEnd && (
            <p className="text-xs text-amber-600 mt-1">
              Default: {selectedShiftDef.defaultEnd} — adjusted by operator
            </p>
          )}
        </div>
      </div>

      {/* Preview */}
      {selectedShiftDef && selectedStation && selectedOperator && (
        <div className="mt-5 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div>
              <span className="text-blue-600 font-medium">Station:</span>{' '}
              <span className="text-blue-900">{stations.find(s => s.id === selectedStation)?.name}</span>
            </div>
            <div>
              <span className="text-blue-600 font-medium">Operator:</span>{' '}
              <span className="text-blue-900">{operators.find(o => o.id === selectedOperator)?.name}</span>
            </div>
            <div>
              <span className="text-blue-600 font-medium">Shift:</span>{' '}
              <span className="text-blue-900">{selectedShiftDef.label}</span>
            </div>
            <div>
              <span className="text-blue-600 font-medium">Time:</span>{' '}
              <span className="text-blue-900 font-semibold">{startTime} — {endTime}</span>
            </div>
            <div>
              <span className="text-blue-600 font-medium">Date:</span>{' '}
              <span className="text-blue-900">{shiftDate}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
