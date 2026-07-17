import React from 'react';
import { Leaf, TreePine, Car } from 'lucide-react';

interface Props {
  totalCO2Reduction: number;
  treesEquivalent: number;
  kmDrivenEquivalent: number;
  energyUsed: number;
}

export default function CO2ImpactCard({ totalCO2Reduction, treesEquivalent, kmDrivenEquivalent, energyUsed }: Props) {
  return (
    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
      <div className="flex items-center gap-2 mb-4">
        <Leaf className="w-6 h-6 text-green-600" />
        <h3 className="text-lg font-semibold text-gray-900">Environmental Impact</h3>
      </div>

      <div className="mb-6">
        <div className="text-4xl font-bold text-green-600 mb-1">
          {totalCO2Reduction.toFixed(1)} kg
        </div>
        <p className="text-sm text-gray-600">CO2 emissions prevented</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white/60 rounded-lg p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <TreePine className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {treesEquivalent.toFixed(0)}
              </div>
              <p className="text-xs text-gray-600">Trees planted equivalent</p>
              <p className="text-xs text-gray-500">(absorbing CO2 for 1 year)</p>
            </div>
          </div>
        </div>

        <div className="bg-white/60 rounded-lg p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {kmDrivenEquivalent.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
              </div>
              <p className="text-xs text-gray-600">Gasoline car distance avoided</p>
              <p className="text-xs text-gray-500">(CO2 emissions equivalent)</p>
            </div>
          </div>
        </div>

        <div className="bg-white/60 rounded-lg p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Clean Energy Used</p>
              <div className="text-xl font-bold text-gray-900">
                {energyUsed.toFixed(2)} kWh
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600 mb-1">CO2 Intensity</p>
              <div className="text-xl font-bold text-gray-900">
                {energyUsed > 0 ? (totalCO2Reduction / energyUsed).toFixed(3) : '0.000'} kg/kWh
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-green-300">
        <p className="text-xs text-gray-600 text-center">
          By choosing electric vehicles, you're making a positive impact on our environment
        </p>
      </div>
    </div>
  );
}
