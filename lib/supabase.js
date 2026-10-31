import { createClient } from '@supabase/supabase-js';

// ── HELPER: convertir camelCase a snake_case ──
function _camelToSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(_camelToSnake);
  var out = {};
  for (var k in obj) {
    if (!obj.hasOwnProperty(k)) continue;
    var snakeKey = k.replace(/[A-Z]/g, function(m) { return '_' + m.toLowerCase(); });
    out[snakeKey] = _camelToSnake(obj[k]);
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
    var camelKey = k.replace(/_([a-z])/g, function(m, c) { return c.toUpperCase(); });
    out[camelKey] = _snakeToCamel(obj[k]);
  }
  return out;
}

function wrapQueryBuilder(builder) {
  return new Proxy(builder, {
    get(target, prop) {
      if (prop === 'insert' || prop === 'update' || prop === 'upsert') {
        return function(values, options) {
          const snakeValues = _camelToSnake(values);
          const resultBuilder = target[prop](snakeValues, options);
          return wrapQueryBuilder(resultBuilder);
        };
      }

      if (prop === 'then') {
        return function(onfulfilled, onrejected) {
          return target.then(function(result) {
            if (result && result.data !== undefined) {
              result.data = _snakeToCamel(result.data);
            }
            return onfulfilled ? onfulfilled(result) : result;
          }, onrejected);
        };
      }

      const val = Reflect.get(target, prop);
      if (typeof val === 'function') {
        return function(...args) {
          const res = val.apply(target, args);
          if (res && typeof res === 'object' && typeof res.then === 'function') {
            return wrapQueryBuilder(res);
          }
          return res;
        };
      }
      return val;
    }
  });
}

let _supabaseAdmin = null;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
      );
    }

    const rawClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    _supabaseAdmin = new Proxy(rawClient, {
      get(target, prop) {
        if (prop === 'from') {
          return function(table) {
            const queryBuilder = target.from(table);
            return wrapQueryBuilder(queryBuilder);
          };
        }
        return Reflect.get(target, prop);
      }
    });
  }
  return _supabaseAdmin;
}

export { getSupabaseAdmin };
