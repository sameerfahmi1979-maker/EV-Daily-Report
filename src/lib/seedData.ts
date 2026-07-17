import { supabase } from './supabase';

export async function seedUserData(userId: string) {
  try {
    const stations = [
      {
        name: 'Downtown Amman Station',
        location: 'Downtown Amman',
        capacity_kw: 150,
        station_code: 'STATION-A1',
        status: 'active',
        user_id: userId,
      },
      {
        name: 'Highway Rest Stop',
        location: 'Amman-Aqaba Highway',
        capacity_kw: 200,
        station_code: 'STATION-B2',
        status: 'active',
        user_id: userId,
      },
      {
        name: 'Mall of Jordan',
        location: 'Amman',
        capacity_kw: 100,
        station_code: 'STATION-C3',
        status: 'active',
        user_id: userId,
      },
    ];

    const { data: insertedStations, error: stationsError } = await supabase
      .from('stations')
      .insert(stations)
      .select();

    if (stationsError) throw stationsError;

    if (insertedStations && insertedStations.length > 0) {
      const firstStationId = insertedStations[0].id;

      const rateStructure = {
        station_id: firstStationId,
        name: 'Jordan EDCO TOU Rates',
        description: 'Standard Time-of-Use rates for Jordan',
        effective_from: '2025-01-01',
        is_active: true,
      };

      const { data: insertedRate, error: rateError } = await supabase
        .from('rate_structures')
        .insert([rateStructure])
        .select()
        .single();

      if (rateError) throw rateError;

      if (insertedRate) {
        const ratePeriods = [
          {
            rate_structure_id: insertedRate.id,
            period_name: 'Super Off-Peak',
            start_time: '00:00:00',
            end_time: '06:00:00',
            days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            season: 'all',
            energy_rate_per_kwh: 0.085,
            demand_charge_per_kw: 0.0,
            priority: 1,
          },
          {
            rate_structure_id: insertedRate.id,
            period_name: 'Off-Peak',
            start_time: '06:00:00',
            end_time: '12:00:00',
            days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            season: 'all',
            energy_rate_per_kwh: 0.12,
            demand_charge_per_kw: 2.5,
            priority: 2,
          },
          {
            rate_structure_id: insertedRate.id,
            period_name: 'Mid-Peak',
            start_time: '12:00:00',
            end_time: '18:00:00',
            days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            season: 'all',
            energy_rate_per_kwh: 0.165,
            demand_charge_per_kw: 8.0,
            priority: 3,
          },
          {
            rate_structure_id: insertedRate.id,
            period_name: 'Peak',
            start_time: '18:00:00',
            end_time: '24:00:00',
            days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            season: 'summer',
            energy_rate_per_kwh: 0.22,
            demand_charge_per_kw: 18.0,
            priority: 4,
          },
          {
            rate_structure_id: insertedRate.id,
            period_name: 'Peak',
            start_time: '18:00:00',
            end_time: '24:00:00',
            days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            season: 'winter',
            energy_rate_per_kwh: 0.18,
            demand_charge_per_kw: 12.0,
            priority: 4,
          },
        ];

        const { error: periodsError } = await supabase
          .from('rate_periods')
          .insert(ratePeriods);

        if (periodsError) throw periodsError;

        const fixedCharges = [
          {
            station_id: firstStationId,
            charge_name: 'Connection Fee',
            charge_type: 'per_session',
            amount: 2.0,
            is_active: true,
          },
          {
            station_id: firstStationId,
            charge_name: 'Service Fee',
            charge_type: 'per_session',
            amount: 1.5,
            is_active: true,
          },
        ];

        const { error: chargesError } = await supabase
          .from('fixed_charges')
          .insert(fixedCharges);

        if (chargesError) throw chargesError;
      }
    }

    return { success: true, message: 'Seed data inserted successfully' };
  } catch (error: any) {
    console.error('Error seeding data:', error);
    return { success: false, message: error.message };
  }
}

export async function checkIfUserHasData(): Promise<boolean> {
  const { data, error } = await supabase
    .from('stations')
    .select('id')
    .limit(1);

  if (error) {
    console.error('Error checking user data:', error);
    return false;
  }

  return data && data.length > 0;
}
