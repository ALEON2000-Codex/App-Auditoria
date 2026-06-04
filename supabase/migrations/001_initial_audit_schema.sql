-- ====================================================================================
-- DOCUMENTACIÓN DE ROLES Y MATRIZ DE SEGURIDAD REQUERIDA (PASO 25)
-- ====================================================================================
-- 1. 'auditor': Acceso condicionado a evaluaciones de su propia región. Consulta
--    historial local. Bloqueo total de descargas masivas de bases de datos.
-- 2. 'admin': Mismos privilegios que el auditor en su región, con autorización
--    habilitada para exportar la base de datos local en formatos CSV o Excel.
-- 3. 'super_admin': Acceso ilimitado global. Rompe el cerco regional (descarga
--    ambas ciudades unificadas). Visualiza resúmenes estadísticos por reactivo,
--    gestiona catálogo y emite códigos de invitación por cambio de terminal móvil.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  -- Llave primaria soldada al sistema de autenticación de Supabase Auth
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  
  -- Campos de identificación corporativa obligatorios
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  
  -- Restricción estricta de Roles basada en el requerimiento corporativo
  role TEXT DEFAULT 'auditor' NOT NULL 
    CONSTRAINT profiles_role_check CHECK (role IN ('auditor', 'admin', 'super_admin')),
    
  -- Restricción estricta de Regiones Geográficas operativas de Sweet & Coffee
  region TEXT NOT NULL 
    CONSTRAINT profiles_region_check CHECK (region IN ('Costa', 'Sierra', 'Global')),
    
  -- Auditoría cronológica de registros
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- ====================================================================================
-- 2. TABLA DE LOCALES COMERCIALES (SWEET & COFFEE)
-- ====================================================================================
CREATE TABLE IF NOT EXISTS public.locales (
  -- Usamos el Código Interno de la Empresa como la Llave Primaria única de la sucursal
  -- Ejemplos de entrada: 'GM', 'QE', 'MS'
  codigo_interno TEXT PRIMARY KEY,
  
  -- Nombre comercial descriptivo de la cafetería (Ej: 'Mall del Sol Local', 'Amazonas 1')
  nombre_local TEXT NOT NULL,
  
  -- Región geográfica estricta para la aplicación de filtros RLS (Ej: 'Costa', 'Sierra')
  region TEXT NOT NULL 
    CONSTRAINT locales_region_check CHECK (region IN ('Costa', 'Sierra', 'Oriente')),
    
  -- Fecha de registro de la sucursal en el sistema
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- CARGA INICIAL DE LOCALES MAESTROS DE PRUEBA
-- ====================================================================================
INSERT INTO public.locales (codigo_interno, nombre_local, region)
VALUES 
  ('GM', 'Mall del Sol Local', 'Costa'),
  ('QE', 'Amazonas 1', 'Sierra')
ON CONFLICT (codigo_interno) DO NOTHING;