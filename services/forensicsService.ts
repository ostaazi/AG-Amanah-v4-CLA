import { EvidenceCustody } from '../types';
import { logCustodyEventToDB } from './firestoreService';

const stableStringify = (input: any): string => {
  if (input === null || input === undefined) return String(input);
  if (typeof input !== 'object') return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(input).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(input[k])}`).join(',')}}`;
};

export const generateSHA256 = async (text: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const logCustodyEvent = async (
  prevEvent: EvidenceCustody | null,
  data: Omit<EvidenceCustody, 'hash_hex' | 'prev_hash_hex'>
): Promise<EvidenceCustody> => {
  const prevHash = prevEvent?.hash_hex || 'GENESIS_BLOCK';
  const canonicalData = stableStringify({
    custody_id: data.custody_id,
    evidence_id: data.evidence_id,
    incident_id: data.incident_id || null,
    actor: data.actor,
    action: data.action,
    event_key: data.event_key,
    created_at: data.created_at,
    event_json: data.event_json || null,
    reason: data.reason || null,
    prev_hash_hex: prevHash,
  });
  const currentHash = await generateSHA256(canonicalData);

  return {
    ...data,
    prev_hash_hex: prevHash,
    hash_hex: currentHash,
  };
};

export const appendCustodyEvent = async (params: {
  parentId: string;
  prevEvent: EvidenceCustody | null;
  data: Omit<EvidenceCustody, 'hash_hex' | 'prev_hash_hex'>;
}): Promise<EvidenceCustody> => {
  const built = await logCustodyEvent(params.prevEvent, params.data);
  await logCustodyEventToDB(params.parentId, built);
  return built;
};

export const verifyChainIntegrity = async (chain: EvidenceCustody[]): Promise<boolean> => {
  if (!Array.isArray(chain) || chain.length === 0) return true;

  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    const prev = i === 0 ? null : chain[i - 1];
    const expectedPrev = prev?.hash_hex || 'GENESIS_BLOCK';
    if (current.prev_hash_hex !== expectedPrev) return false;

    const canonicalData = stableStringify({
      custody_id: current.custody_id,
      evidence_id: current.evidence_id,
      incident_id: current.incident_id || null,
      actor: current.actor,
      action: current.action,
      event_key: current.event_key,
      created_at: current.created_at,
      event_json: current.event_json || null,
      reason: current.reason || null,
      prev_hash_hex: expectedPrev,
    });
    const recomputed = await generateSHA256(canonicalData);
    if (recomputed !== current.hash_hex) return false;
  }

  return true;
};
