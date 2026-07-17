import { supabase } from '../supabase';

export async function handleAuthorize(
  chargePointId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { idTag } = payload as { idTag: string };

  // Check RFID card against operators table
  const { data: operator } = await supabase
    .from('operators')
    .select('id, name')
    .eq('card_number', idTag)
    .single();

  const status = operator ? 'Accepted' : 'Invalid';
  console.log(`[${chargePointId}] Authorize ${idTag} → ${status}${operator ? ` (${operator.name})` : ''}`);

  return {
    idTagInfo: { status },
  };
}
