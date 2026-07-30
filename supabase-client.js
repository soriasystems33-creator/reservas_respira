// ============================================================
// SUPABASE-CLIENT — Reemplazo completo de Firebase Compat SDK
// Panel Magic Studio — https://github.com/your-org/panel-magic
// ============================================================

// ── CONFIGURACIÓN (REEMPLAZAR con tus datos de Supabase) ──
const SUPABASE_URL = "https://kgaqsgrkmdkvgcralqmb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnYXFzZ3JrbWRrdmdjcmFscW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDY1ODMsImV4cCI6MjEwMDk4MjU4M30.hmgCX4c1sfW6GIY2kbcj2BbrC4NMGpq65ZX4ZeMpwBA";

var supabase, db, auth;

// ── HELPER: extraer tabla e ID de la ruta al estilo Firebase ──
function _extractFromPath(parts) {
  return {
    table: parts[4],
    id: parts.length > 5 ? parts[5] : null
  };
}

// ── MISMAS FUNCIONES GLOBALES QUE EL SDK COMPAT DE FIREBASE ──
function initializeApp(cfg) {
  supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: true, persistSession: true },
    realtime: { heartbeatIntervalMs: 30000 }
  });
  return supabase;
}

function getFirestore(app) { return supabase; }

function getAuth(app) { return supabase.auth; }

function enableIndexedDbPersistence() { return Promise.resolve(); }

function signInWithEmailAndPassword(auth, email, pass) {
  return auth.signInWithPassword({ email, password: pass });
}

function onAuthStateChanged(auth, cb) {
  auth.getSession().then(function(res) {
    cb(res.data && res.data.session ? res.data.session.user : null);
  });
  var sub = auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      cb(session ? session.user : null);
    } else if (event === 'SIGNED_OUT') {
      cb(null);
    }
  });
  return sub.data.subscription;
}

function collection(db) {
  var parts = Array.prototype.slice.call(arguments, 1);
  var t = _extractFromPath(parts);
  return { _type: 'collection', path: parts.join('/'), table: t.table };
}

function doc(db) {
  var parts = Array.prototype.slice.call(arguments, 1);
  var t = _extractFromPath(parts);
  return { _type: 'doc', path: parts.join('/'), table: t.table, id: t.id };
}

function addDoc(ref, data) {
  return supabase.from(ref.table).insert(data).select().single().then(function(r) {
    if (r.error) throw r.error;
    return r.data;
  });
}

function setDoc(ref, data, opts) {
  return supabase.from(ref.table).upsert({ ...data, id: ref.id }).then(function(r) {
    if (r.error) throw r.error;
  });
}

function updateDoc(ref, data) {
  return supabase.from(ref.table).update(data).eq('id', ref.id).then(function(r) {
    if (r.error) throw r.error;
  });
}

function deleteDoc(ref) {
  return supabase.from(ref.table).delete().eq('id', ref.id).then(function(r) {
    if (r.error) throw r.error;
  });
}

function onSnapshot(ref, cb) {
  var table = ref.table;
  var destroyed = false;
  var channel = null;

  function fetchData() {
    if (destroyed) return;
    if (ref._type === 'collection') {
      supabase.from(table).select('*').then(function(r) {
        if (destroyed) return;
        if (r.error) { console.error('[supabase]', r.error); return; }
        cb({
          docs: (r.data || []).map(function(d) {
            return { id: d.id, data: function() { return d; }, exists: true };
          })
        });
      });
    } else {
      supabase.from(table).select('*').eq('id', ref.id).single().then(function(r) {
        if (destroyed) return;
        if (r.error && r.error.code !== 'PGRST116') {
          console.error('[supabase]', r.error);
          return;
        }
        var snapData = r.data || null;
        cb({
          data: function() { return snapData; },
          exists: !!snapData
        });
      });
    }
  }

  fetchData();

  channel = supabase
    .channel('public:' + table + ':' + (ref.id || '*'))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: table },
      function() { if (!destroyed) fetchData(); }
    )
    .subscribe();

  return function() {
    destroyed = true;
    if (channel) supabase.removeChannel(channel);
  };
}

function query(ref) { return ref; }
