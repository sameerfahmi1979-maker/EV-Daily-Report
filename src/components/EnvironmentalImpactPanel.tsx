import {
  Leaf, TreePine, Car, Droplets, Factory,
  Fuel, Home, Flame, Wind, Zap,
} from 'lucide-react';
import { EnvironmentalImpact } from '../lib/environmentalImpactService';

interface Props {
  impact: EnvironmentalImpact;
}

const metrics = [
  {
    key: 'co2Avoided',
    label: 'CO₂ Avoided',
    unit: 'kg',
    icon: Leaf,
    color: '#2ECC71',
    bg: 'rgba(46,204,113,0.12)',
    format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)} t` : `${v.toFixed(1)} kg`,
  },
  {
    key: 'gasolineSaved',
    label: 'Gasoline Saved',
    unit: 'L',
    icon: Fuel,
    color: '#F1C40F',
    bg: 'rgba(241,196,15,0.12)',
    format: (v: number) => `${v.toFixed(0)} L`,
  },
  {
    key: 'treesEquivalent',
    label: 'Trees Equivalent',
    unit: 'trees/yr',
    icon: TreePine,
    color: '#27AE60',
    bg: 'rgba(39,174,96,0.12)',
    format: (v: number) => `${v.toFixed(0)}`,
  },
  {
    key: 'kmDrivenEquivalent',
    label: 'ICE Km Avoided',
    unit: 'km',
    icon: Car,
    color: '#3498DB',
    bg: 'rgba(52,152,219,0.12)',
    format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v.toFixed(0)}`,
  },
  {
    key: 'householdsPowered',
    label: 'Households Powered',
    unit: 'days',
    icon: Home,
    color: '#9B59B6',
    bg: 'rgba(155,89,182,0.12)',
    format: (v: number) => `${v.toFixed(0)} days`,
  },
  {
    key: 'oilBarrelsSaved',
    label: 'Oil Barrels Saved',
    unit: 'barrels',
    icon: Factory,
    color: '#E67E22',
    bg: 'rgba(230,126,34,0.12)',
    format: (v: number) => v >= 1 ? `${v.toFixed(1)}` : `${(v * 159).toFixed(0)} L`,
  },
  {
    key: 'coalNotBurned',
    label: 'Coal Not Burned',
    unit: 'kg',
    icon: Flame,
    color: '#E74C3C',
    bg: 'rgba(231,76,60,0.12)',
    format: (v: number) => `${v.toFixed(1)} kg`,
  },
  {
    key: 'pm25Avoided',
    label: 'PM2.5 Avoided',
    unit: 'g',
    icon: Wind,
    color: '#1ABC9C',
    bg: 'rgba(26,188,156,0.12)',
    format: (v: number) => v >= 1 ? `${v.toFixed(2)} kg` : `${(v * 1000).toFixed(0)} g`,
  },
  {
    key: 'waterSaved',
    label: 'Water Saved',
    unit: 'L',
    icon: Droplets,
    color: '#2980B9',
    bg: 'rgba(41,128,185,0.12)',
    format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K L` : `${v.toFixed(0)} L`,
  },
];

export default function EnvironmentalImpactPanel({ impact }: Props) {
  return (
    <div className="space-y-3">
      {/* Hero stat */}
      <div className="text-center py-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Zap size={20} className="text-[#2ECC71]" />
          <span className="text-[10px] uppercase tracking-widest text-[#8888a0]">Clean Energy Used</span>
        </div>
        <div className="text-2xl font-bold text-[#2ECC71]">
          {impact.energyUsed >= 1000
            ? `${(impact.energyUsed / 1000).toFixed(2)} MWh`
            : `${impact.energyUsed.toFixed(1)} kWh`}
        </div>
        <div className="text-[10px] text-[#8888a0] mt-0.5">
          CO₂ intensity: {impact.co2Intensity.toFixed(3)} kg/kWh
        </div>
      </div>

      {/* 9-metric grid */}
      <div className="grid grid-cols-3 gap-2">
        {metrics.map(m => {
          const val = (impact as any)[m.key] || 0;
          return (
            <div
              key={m.key}
              className="rounded-lg p-2.5 text-center transition-transform hover:scale-105"
              style={{ backgroundColor: m.bg }}
            >
              <m.icon size={16} className="mx-auto mb-1" style={{ color: m.color }} />
              <div className="text-sm font-bold text-[#e0e0e8]">{m.format(val)}</div>
              <div className="text-[9px] text-[#8888a0] leading-tight mt-0.5">{m.label}</div>
            </div>
          );
        })}
      </div>

      {/* Fuel cost saved */}
      <div className="bg-[#1a1a2e] rounded-lg p-3 text-center border border-[#3a3a4e]">
        <div className="text-[10px] text-[#8888a0] uppercase tracking-wider">Estimated Fuel Cost Saved</div>
        <div className="text-xl font-bold text-[#F1C40F] mt-1">
          {impact.fuelCostSaved.toFixed(3)} JOD
        </div>
      </div>
    </div>
  );
}
