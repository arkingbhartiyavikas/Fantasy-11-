import { supabase } from './supabase';

export const db = supabase;

type DocRef = { collectionName: string, id: string, _path: string };
type QueryObj = { collectionName: string, filters: any[] };

export const doc = (dbMock: any, collectionName: string, docId?: string): DocRef => {
    return { collectionName, id: docId || Math.random().toString(36).slice(2), _path: `${collectionName}/${docId || ''}` };
};

export const collection = (dbMock: any, collectionName: string): QueryObj => {
    return { collectionName, filters: [] };
};

export const setDoc = async (docRef: DocRef, data: any, options?: { merge?: boolean }) => {
    const { collectionName, id } = docRef;
    const documentId = `${collectionName}/${id}`;
    
    if (options?.merge) {
        const { data: existing } = await supabase.from('firebase_docs').select('data').eq('id', documentId).single();
        const mergedData = existing ? { ...existing.data, ...data } : data;
        await supabase.from('firebase_docs').upsert({
            id: documentId,
            collection_name: collectionName,
            doc_id: id,
            data: mergedData,
            updated_at: new Date().toISOString()
        });
    } else {
        await supabase.from('firebase_docs').upsert({
            id: documentId,
            collection_name: collectionName,
            doc_id: id,
            data: data,
            updated_at: new Date().toISOString()
        });
    }
};

export const updateDoc = async (docRef: DocRef, data: any) => {
    await setDoc(docRef, data, { merge: true });
};

export const getDoc = async (docRef: DocRef) => {
    const { collectionName, id } = docRef;
    const documentId = `${collectionName}/${id}`;
    const { data: result } = await supabase.from('firebase_docs').select('data').eq('id', documentId).single();
    
    return {
        exists: () => !!result,
        data: () => result?.data,
        id: id
    };
};

export const deleteDoc = async (docRef: DocRef) => {
    const { collectionName, id } = docRef;
    const documentId = `${collectionName}/${id}`;
    await supabase.from('firebase_docs').delete().eq('id', documentId);
};

export const onSnapshot = (
    ref: any,
    callback: (snapshot: any) => void,
    onError?: (error: any) => void
) => {
    if (ref._path) { // doc snapshot
        const docRef = ref as DocRef;
        const documentId = `${docRef.collectionName}/${docRef.id}`;
        
        getDoc(docRef).then(callback);
        
        const channel = supabase.channel(`public:firebase_docs:id=eq.${documentId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'firebase_docs', filter: `id=eq.${documentId}` }, payload => {
                if (payload.eventType === 'DELETE') {
                     callback({ exists: () => false, data: () => undefined, id: docRef.id });
                } else {
                     callback({ exists: () => true, data: () => payload.new.data, id: docRef.id });
                }
            }).subscribe();
        return () => supabase.removeChannel(channel);
    } else {
        // query snapshot
        const qRef = ref as QueryObj;
        
        // In-memory cache to avoid re-fetching all documents on every change
        let currentDocs: Record<string, any> = {};
        
        const notify = () => {
             const docsArray = Object.values(currentDocs).map((d: any) => ({
                 id: d.doc_id,
                 data: () => d.data
             }));
             callback({ docs: docsArray, size: docsArray.length });
        };
        
        const fetchAll = async () => {
             let queryBuilder = supabase.from('firebase_docs').select('*').eq('collection_name', qRef.collectionName);
             for(let f of qRef.filters) {
                 if (f.op === '==') {
                     queryBuilder = queryBuilder.filter(`data->>${f.field}`, 'eq', f.val);
                 }
             }
             const { data } = await queryBuilder.limit(500);
             if (data) {
                 currentDocs = {};
                 data.forEach((d: any) => { currentDocs[d.doc_id] = d; });
                 notify();
             }
        };
         
        fetchAll();
        
        const channel = supabase.channel(`public:firebase_docs:collection_name=eq.${qRef.collectionName}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'firebase_docs', filter: `collection_name=eq.${qRef.collectionName}` }, (payload) => {
                 let changed = false;
                 
                 // Process inserts/updates
                 if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                     const newData = payload.new;
                     // Test if it matches filters
                     let match = true;
                     for (let f of qRef.filters) {
                         if (f.op === '==' && newData.data && newData.data[f.field] !== f.val) {
                             match = false;
                             break;
                         }
                     }
                     if (match) {
                         currentDocs[newData.doc_id] = newData;
                         changed = true;
                     } else if (currentDocs[newData.doc_id]) {
                         delete currentDocs[newData.doc_id];
                         changed = true;
                     }
                 } else if (payload.eventType === 'DELETE') {
                     const oldData = payload.old;
                     if (oldData && oldData.doc_id && currentDocs[oldData.doc_id]) {
                         delete currentDocs[oldData.doc_id];
                         changed = true;
                     } else {
                         // Sometimes DELETE only has id, so we might need to iterate
                         const deletedId = oldData.id;
                         const docId = Object.keys(currentDocs).find(k => currentDocs[k].id === deletedId);
                         if (docId) {
                             delete currentDocs[docId];
                             changed = true;
                         }
                     }
                 }
                 
                 if (changed) {
                     notify();
                 }
            }).subscribe();
        return () => supabase.removeChannel(channel);
    }
}

export const getDocs = async (q: any) => {
    const qRef = q as QueryObj;
    if (qRef.collectionName) {
         let queryBuilder = supabase.from('firebase_docs').select('*').eq('collection_name', qRef.collectionName);
         for(let f of qRef.filters) {
             if (f.op === '==') {
                 // Supabase JSONB filter
                 queryBuilder = queryBuilder.filter(`data->>${f.field}`, 'eq', f.val);
             }
         }
         const { data } = await queryBuilder.limit(500);
         return {
             docs: (data || []).map((d: any) => ({
                 id: d.doc_id,
                 data: () => d.data
             }))
         };
    }
    return { docs: [] };
}

export const query = (ref: any, ...ops: any[]) => {
    let q = { ...ref, filters: [...(ref.filters||[])] };
    for (let op of ops) {
        if (op.type === 'where') q.filters.push(op);
    }
    return q; 
};

export const where = (field: string, op: string, val: any) => ({ type: 'where', field, op, val });

export const increment = (amount: number) => amount; 

export const writeBatch = (dbMock: any) => {
    const ops: any[] = [];
    return {
       update: (ref: any, data: any) => ops.push({ type: 'update', ref, data }),
       delete: (ref: any) => ops.push({ type: 'delete', ref }),
       set: (ref: any, data: any, options?: { merge?: boolean }) => ops.push({ type: 'set', ref, data, options }),
       commit: async () => {
           for (const op of ops) {
               if (op.type === 'update') await updateDoc(op.ref, op.data);
               else if (op.type === 'set') await setDoc(op.ref, op.data, op.options);
               else if (op.type === 'delete') await deleteDoc(op.ref);
           }
       }
    };
};
