/**
 * Sovereign API Service Layer (Connected to Production Routes)
 */
export const sovereignApi = {
    listEvidence: async (filters) => {
        const params = new URLSearchParams();
        if (filters.classification && filters.classification !== 'ALL')
            params.append('classification', filters.classification);
        if (filters.search)
            params.append('search', filters.search);
        if (filters.severity && filters.severity.length > 0)
            params.append('severities', filters.severity.join(','));
        const res = await fetch(`/api/evidence?${params.toString()}`);
        if (!res.ok)
            throw new Error("Failed to fetch evidence");
        return await res.json();
    },
    getEvidenceDetails: async (id) => {
        const res = await fetch(`/api/evidence/${id}`);
        if (!res.ok)
            throw new Error("Evidence retrieval blocked");
        return await res.json();
    },
    updateEvidenceClassification: async (id, classification, reason) => {
        const res = await fetch(`/api/evidence/${id}/hold`, {
            method: 'POST',
            body: JSON.stringify({ classification, reason })
        });
        return await res.json();
    },
    deleteEvidence: async (id, reason, mfa) => {
        const res = await fetch(`/api/evidence/${id}/delete`, {
            method: 'POST',
            body: JSON.stringify({ reason, mfa_code: mfa, typed: 'DELETE' })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || "Delete failed");
        }
        return await res.json();
    },
    // Protocols (to be implemented with Prisma)
    listProtocols: async () => {
        const res = await fetch('/api/protocols');
        if (res.ok)
            return await res.json();
        return [];
    },
    saveProtocol: async (protocol) => {
        await fetch('/api/protocols', { method: 'POST', body: JSON.stringify(protocol) });
    },
    publishProtocol: async (id) => {
        await fetch(`/api/protocols/${id}/publish`, { method: 'POST' });
    }
};
