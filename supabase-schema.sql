-- ============================================================
-- ESQUEMA SUPABASE — Panel Magic Studio
-- 7 tablas
-- ============================================================

-- 1. APPOINTMENTS
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_phone TEXT DEFAULT '',
  services JSONB DEFAULT '[]'::jsonb,
  service TEXT DEFAULT '',
  employee TEXT DEFAULT 'Todas',
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER DEFAULT 15,
  price DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  is_paid BOOLEAN DEFAULT false,
  type TEXT DEFAULT NULL,
  source TEXT DEFAULT NULL,
  modified_from TEXT DEFAULT NULL,
  cancelled_at TIMESTAMPTZ DEFAULT NULL,
  iva_amount DECIMAL(10,2) DEFAULT 0,
  iva_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SETTINGS (documento único)
CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  start TEXT DEFAULT '09:00',
  "end" TEXT DEFAULT '20:00',
  weekly JSONB DEFAULT '{}'::jsonb,
  special_days JSONB DEFAULT '{}'::jsonb
);

-- 3. SERVICES
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration INTEGER NOT NULL,
  "desc" TEXT DEFAULT '',
  category TEXT DEFAULT '',
  employee TEXT DEFAULT 'Todas',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CATEGORIES
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'sparkles',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. EMPLOYEES
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT DEFAULT '',
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. EXPENSES
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept TEXT NOT NULL,
  category TEXT DEFAULT 'Otros',
  date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  base_amount DECIMAL(10,2) NOT NULL,
  iva_rate DECIMAL(5,2) DEFAULT 0,
  iva_amount DECIMAL(10,2) DEFAULT 0,
  invoice_photo TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. BLOCKS
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reason TEXT DEFAULT 'Otro',
  recurrence TEXT DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','biweekly')),
  date DATE DEFAULT NULL,
  weekday INTEGER DEFAULT NULL CHECK (weekday IS NULL OR (weekday >= 0 AND weekday <= 6)),
  recurrence_end DATE DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Permisos para uso con anon key
-- ============================================================
-- El panel usa la anon key, así que permitimos acceso completo
-- a todas las tablas para usuarios anónimos.

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir todo (SELECT, INSERT, UPDATE, DELETE) para todo público (anon y authenticated)
CREATE POLICY "Allow all for public" ON appointments FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for public" ON settings FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for public" ON services FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for public" ON categories FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for public" ON employees FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for public" ON expenses FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for public" ON blocks FOR ALL TO public USING (true) WITH CHECK (true);

-- ============================================================
-- ÍNDICES RECOMENDADOS
-- ============================================================
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_client_phone ON appointments(client_phone);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_blocks_employee ON blocks(employee);
CREATE INDEX idx_blocks_date ON blocks(date);

-- ============================================================
-- FUNCIÓN PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ACTIVAR TIEMPO REAL (SUPABASE REALTIME)
-- ============================================================
-- Agrega las tablas a la publicación de replicación para habilitar
-- actualizaciones en tiempo real de forma automática.
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE services;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE blocks;
