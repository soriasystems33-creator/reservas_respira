// ============================================================
// SUPABASE-CLIENT — Reemplazo completo de Firebase Compat SDK
// Panel Estetica Respira Studio — https://github.com/your-org/panel-Estetica Respira
// ============================================================

// ── CONFIGURACIÓN (REEMPLAZAR con tus datos de Supabase) ──
const SUPABASE_URL = "https://kgaqsgrkmdkvgcralqmb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnYXFzZ3JrbWRrdmdjcmFscW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDY1ODMsImV4cCI6MjEwMDk4MjU4M30.hmgCX4c1sfW6GIY2kbcj2BbrC4NMGpq65ZX4ZeMpwBA";

var supabase, db, auth;

// ── HELPER: convertir camelCase a snake_case ──
function _camelToSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(_camelToSnake);
  var out = {};
  for (var k in obj) {
    if (!obj.hasOwnProperty(k)) continue;
    if (k === 'createdAt' || k === 'updatedAt') {
      out[k] = obj[k];
    } else {
      var snakeKey = k.replace(/[A-Z]/g, function(m, i) { return '_' + m.toLowerCase(); });
      out[snakeKey] = _camelToSnake(obj[k]);
    }
  }
  return out;
}

// ── HELPER: convertir snake_case a camelCase ──
function _snakeToCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(_snakeToCamel);
  var out = {};
  for (var k in obj) {
    if (!obj.hasOwnProperty(k)) continue;
    if (k === 'createdAt' || k === 'updatedAt') {
      out[k] = obj[k];
    } else {
      var camelKey = k.replace(/_([a-z])/g, function(m, c) { return c.toUpperCase(); });
      out[camelKey] = _snakeToCamel(obj[k]);
    }
  }
  return out;
}

// ── HELPER: extraer tabla e ID de la ruta al estilo Firebase ──
function _extractFromPath(parts) {
  return {
    table: parts[4],
    id: parts.length > 5 ? parts[5] : null
  };
}

// ── MISMAS FUNCIONES GLOBALES QUE EL SDK COMPAT DE FIREBASE ──
function initializeApp(cfg) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

// Map of active listeners per table so local operations trigger immediate local refresh
var _tableListeners = {};

function _notifyTable(table) {
  if (_tableListeners[table]) {
    _tableListeners[table].forEach(function(fn) { fn(); });
  }
}

async function _prepareSettingsPayload(refId, data) {
  var id = refId || 'main';
  var res = await supabase.from('settings').select('*').eq('id', id).maybeSingle();
  var existing = res.data || {};
  var currentWeekly = (existing.weekly && typeof existing.weekly === 'object') ? Object.assign({}, existing.weekly) : {};

  var payload = { id: id };

  if (data.start !== undefined) payload.start = data.start;
  if (data.end !== undefined) payload.end = data.end;
  if (data.specialDays !== undefined || data.special_days !== undefined) {
    payload.special_days = data.specialDays !== undefined ? data.specialDays : data.special_days;
  }

  var hasWeeklyUpdate = false;
  for (var k in data) {
    if (k.startsWith('weekly_') || k.startsWith('weekly__')) {
      var normKey = 'weekly_' + k.replace(/^weekly_+/, '');
      currentWeekly[normKey] = data[k];
      hasWeeklyUpdate = true;
    }
  }

  if (data.weekly !== undefined) {
    for (var d in data.weekly) {
      currentWeekly[d] = data.weekly[d];
    }
    hasWeeklyUpdate = true;
  }

  if (hasWeeklyUpdate || Object.keys(currentWeekly).length > 0) {
    payload.weekly = currentWeekly;
  }

  return payload;
}

function _formatSettingsDoc(d) {
  if (!d) return null;
  var camel = _snakeToCamel(d);
  camel.specialDays = camel.specialDays || camel.special_days || {};

  if (camel.weekly && typeof camel.weekly === 'object') {
    for (var k in camel.weekly) {
      if (k.startsWith('weekly_') || k.startsWith('weekly__')) {
        var normKey = 'weekly_' + k.replace(/^weekly_+/, '');
        camel[normKey] = camel.weekly[k];
      }
    }
  }
  return camel;
}

function addDoc(ref, data) {
  return supabase.from(ref.table).insert(_camelToSnake(data)).select().single().then(function(r) {
    if (r.error) throw r.error;
    _notifyTable(ref.table);
    return _snakeToCamel(r.data);
  });
}

function setDoc(ref, data, opts) {
  if (ref.table === 'settings') {
    return _prepareSettingsPayload(ref.id, data).then(function(payload) {
      return supabase.from('settings').upsert(payload).then(function(r) {
        if (r.error) throw r.error;
        _notifyTable('settings');
      });
    });
  }
  return supabase.from(ref.table).upsert({ ..._camelToSnake(data), id: ref.id }).then(function(r) {
    if (r.error) throw r.error;
    _notifyTable(ref.table);
  });
}

function updateDoc(ref, data) {
  if (ref.table === 'settings') {
    return _prepareSettingsPayload(ref.id, data).then(function(payload) {
      return supabase.from('settings').update(payload).eq('id', ref.id || 'main').then(function(r) {
        if (r.error) throw r.error;
        _notifyTable('settings');
      });
    });
  }
  return supabase.from(ref.table).update(_camelToSnake(data)).eq('id', ref.id).then(function(r) {
    if (r.error) throw r.error;
    _notifyTable(ref.table);
  });
}

function deleteDoc(ref) {
  return supabase.from(ref.table).delete().eq('id', ref.id).then(function(r) {
    if (r.error) throw r.error;
    _notifyTable(ref.table);
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
            var camel = table === 'settings' ? _formatSettingsDoc(d) : _snakeToCamel(d);
            return { id: d.id, data: function() { return camel; }, exists: true };
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
        var camelData = snapData ? (table === 'settings' ? _formatSettingsDoc(snapData) : _snakeToCamel(snapData)) : null;
        cb({
          data: function() { return camelData; },
          exists: !!snapData
        });
      });
    }
  }

  fetchData();

  if (!_tableListeners[table]) _tableListeners[table] = [];
  _tableListeners[table].push(fetchData);

  channel = supabase
    .channel('public:' + table + ':' + (ref.id || '*'))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: table },
      function() { if (!destroyed) fetchData(); }
    )
    .subscribe();

  return function() {
    destroyed = true;
    if (_tableListeners[table]) {
      _tableListeners[table] = _tableListeners[table].filter(function(fn) { return fn !== fetchData; });
    }
    if (channel) supabase.removeChannel(channel);
  };
}

function query(ref) { return ref; }
