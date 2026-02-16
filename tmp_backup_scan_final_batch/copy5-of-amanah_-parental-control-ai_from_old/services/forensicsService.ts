
import { EvidenceCustody } from '../types';

export const generateSHA256 = async (text: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * توثيق حدث جديد في سلسلة الحيازة
 */
export const logCustodyEvent = async (
  prevEvent: EvidenceCustody | null,
  data: Omit<EvidenceCustody, 'hash_hex' | 'prev_hash_hex'>
): Promise<EvidenceCustody> => {
  const prevHash = prevEvent ? prevEvent.hash_hex : 'GENESIS_BLOCK';
  const canonicalData = JSON.stringify({ ...data, prevHash });
  const currentHash = await generateSHA256(canonicalData);

  return {
    ...data,
    prev_hash_hex: prevHash,
    hash_hex: currentHash
  };
};

/**
 * التحقق من سلامة السلسلة بالكامل
 */
export const verifyChainIntegrity = async (chain: EvidenceCustody[]): Promise<boolean> => {
  for (let i = 1; i < chain.length; i++) {
    const current = chain[i];
    const prev = chain[i - 1];
    if (current.prev_hash_hex !== prev.hash_hex) return false;
    
    const testData = JSON.stringify({
      custody_id: current.custody_id,
      evidence_id: current.evidence_id,
      incident_id: current.incident_id,
      actor: current.actor,
      event_key: current.event_key,
      created_at: current.created_at,
      event_json: current.event_json,
      prevHash: prev.hash_hex
    });
    const testHash = await generateSHA256(testData);
    if (testHash !== current.hash_hex) return false;
  }
  return true;
};
