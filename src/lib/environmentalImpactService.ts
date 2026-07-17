// =============================================
// environmentalImpactService.ts
// Real environmental impact calculations
// Sources: EPA, IEA, USDA, DOE, JEPCO, EIA, WHO, Argonne
// =============================================

// ── Constants ────────────────────────────────
// Jordan grid emission factor (IEA 2023)
const GRID_EMISSION_FACTOR = 0.540;        // kg CO₂ per kWh

// ICE vehicle emissions
const ICE_EMISSION_PER_KM = 0.192;         // kg CO₂ per km (avg passenger car)
const ICE_FUEL_CONSUMPTION = 0.08;         // liters per km (8L/100km)

// EV efficiency (grid-adjusted)
const EV_EMISSION_PER_KM = 0.053;          // kg CO₂ per km (using grid factor)
const EV_EFFICIENCY = 0.18;                // kWh per km (avg EV)

// Trees (USDA Forest Service)
const CO2_PER_TREE_PER_YEAR = 21.77;       // kg CO₂ absorbed per tree/year

// Household (JEPCO Jordan average)
const HOUSEHOLD_DAILY_KWH = 30;            // kWh per day

// Oil (EIA)
const LITERS_PER_BARREL = 159;             // liters per barrel of oil

// Coal (EIA)
const CO2_PER_KG_COAL = 2.86;             // kg CO₂ per kg of coal burned

// PM2.5 tailpipe (WHO estimates)
const PM25_PER_SESSION = 0.0035;           // kg PM2.5 avoided per EV session

// Water (Argonne National Lab)
const WATER_PER_LITER_FUEL = 13;           // liters of water per liter of gasoline refined

export interface EnvironmentalImpact {
  co2Avoided: number;          // kg
  gasolineSaved: number;       // liters
  treesEquivalent: number;     // count
  kmDrivenEquivalent: number;  // km
  householdsPowered: number;   // days
  oilBarrelsSaved: number;     // barrels
  coalNotBurned: number;       // kg
  pm25Avoided: number;         // kg
  waterSaved: number;          // liters
  energyUsed: number;          // kWh (passthrough)
  co2Intensity: number;        // kg CO₂ / kWh
  fuelCostSaved: number;       // JOD
}

// Gasoline price in Jordan (JOD per liter, 2024 avg)
const GASOLINE_PRICE_JOD = 0.960;

/**
 * Calculate all environmental impact metrics from total kWh consumed
 * and total number of charging sessions.
 */
export function calculateEnvironmentalImpact(
  totalKwh: number,
  totalSessions: number
): EnvironmentalImpact {
  // km that could be driven on this energy
  const evKmDriven = totalKwh / EV_EFFICIENCY;

  // CO₂ that an ICE car would have emitted for same distance
  const iceCO2 = evKmDriven * ICE_EMISSION_PER_KM;

  // CO₂ from grid electricity for EV
  const evCO2 = totalKwh * GRID_EMISSION_FACTOR;

  // Net CO₂ avoided = ICE emissions - EV grid emissions
  // But only if ICE > EV (which it always is in practice)
  const co2Avoided = Math.max(0, iceCO2 - evCO2);

  // Gasoline saved (liters) — fuel the ICE car would have used
  const gasolineSaved = evKmDriven * ICE_FUEL_CONSUMPTION;

  // Trees equivalent — how many trees absorb same CO₂ in a year
  const treesEquivalent = co2Avoided / CO2_PER_TREE_PER_YEAR;

  // Km driven equivalent — how far an ICE car drives to emit this CO₂
  const kmDrivenEquivalent = co2Avoided / ICE_EMISSION_PER_KM;

  // Households powered — days of household electricity
  const householdsPowered = totalKwh / HOUSEHOLD_DAILY_KWH;

  // Oil barrels saved
  const oilBarrelsSaved = gasolineSaved / LITERS_PER_BARREL;

  // Coal not burned (kg)
  const coalNotBurned = co2Avoided / CO2_PER_KG_COAL;

  // PM2.5 avoided (kg) — based on sessions
  const pm25Avoided = totalSessions * PM25_PER_SESSION;

  // Water saved (liters) — refinery water use avoided
  const waterSaved = gasolineSaved * WATER_PER_LITER_FUEL;

  // CO₂ intensity
  const co2Intensity = totalKwh > 0 ? co2Avoided / totalKwh : 0;

  // Fuel cost saved (JOD)
  const fuelCostSaved = gasolineSaved * GASOLINE_PRICE_JOD;

  return {
    co2Avoided,
    gasolineSaved,
    treesEquivalent,
    kmDrivenEquivalent,
    householdsPowered,
    oilBarrelsSaved,
    coalNotBurned,
    pm25Avoided,
    waterSaved,
    energyUsed: totalKwh,
    co2Intensity,
    fuelCostSaved,
  };
}
