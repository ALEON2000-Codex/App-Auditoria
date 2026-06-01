# Arquitectura Enterprise - App de Auditorias de Cumplimiento

## Stack

- Frontend movil: React Native + Expo + TypeScript + Expo Router.
- Backend: Supabase Auth, PostgreSQL, Row Level Security, Storage y Edge Functions.
- Persistencia offline: AsyncStorage para cola temporal de reportes y evidencias pendientes.
- Evidencias: `expo-image-picker` para camara/galeria y Supabase Storage para archivos.
- Firmas: `react-native-signature-canvas`, guardando imagen final en Storage y referencia inmutable en BD.

## Decision de aislamiento regional

La recomendacion base es usar una sola instancia Supabase con tablas multi-region y RLS estricta por `region`.

Para escenarios regulatorios mas severos, la variante mas fuerte seria crear dos proyectos Supabase separados, uno para Costa y otro para Sierra, y un panel corporativo central que consulte ambos con credenciales de servidor.

## Modelo de acceso

Roles:

- `auditor`: crea reportes y consulta informacion de su region.
- `regional_admin`: administra catalogos, preguntas y usuarios de su region.
- `vip`: descarga historicos de su region.
- `super_admin`: administra ambas regiones desde panel protegido.

Regiones:

- `costa`
- `sierra`

Regla critica: un usuario autenticado solo puede leer o escribir filas cuya columna `region` coincida con `profiles.region`, salvo `super_admin`.

## Registro por invitacion institucional

1. Un administrador regional crea una invitacion con email institucional, region, rol y expiracion.
2. Una Edge Function envia el correo de invitacion.
3. El usuario completa el registro con Supabase Auth.
4. Un trigger valida dominio corporativo e invitacion activa.
5. El perfil queda asociado a la region y rol definidos por la invitacion.

## Flujo movil de auditoria

1. Login.
2. Resolver perfil, region y rol.
3. Seleccionar tipo de visita.
4. Configurar reporte: local, responsable y auditor/equipo.
5. Mostrar resumen historico del local.
6. Cargar checklist activo por region y tipo de visita.
7. Completar preguntas con respuesta, observacion obligatoria y evidencias.
8. Pantalla de conclusiones con nota, observaciones generales y firmas.
9. Guardado final, correo automatico y bloqueo del reporte.

## Offline first

- Guardar respuestas y evidencias pendientes en AsyncStorage.
- Mantener cola `pending-sync`.
- Subir primero evidencias y firmas.
- Luego insertar o actualizar reporte y respuestas.
- Usar UUIDs generados localmente para reconciliacion.

## Supabase Storage

Buckets:

- `audit-evidence`
- `audit-signatures`
- `audit-reports`

Rutas:

- `region/yyyy-mm-dd/store-id/report-id/question-id/file-name.jpg`
- `region/yyyy-mm-dd/store-id/report-id/auditor.png`
- `region/yyyy-mm-dd/store-id/report-id/responsible.png`
- `region/yyyy-mm-dd/store-id/report-id/report.pdf`

## Edge Functions

- `send-invitation`: crea invitacion y envia email.
- `finalize-report`: valida reporte, bloquea cambios, genera resumen/PDF y dispara correo.
- `export-region-history`: genera CSV/XLSX para usuarios VIP o administradores.

## Arquitectura de carpetas Expo

```text
app/
  _layout.tsx
  (auth)/
    _layout.tsx
    sign-in.tsx
    accept-invitation.tsx
  (auditor)/
    _layout.tsx
    index.tsx
    reports/
      new.tsx
      [reportId]/
        checklist.tsx
        conclusions.tsx
  (admin)/
    _layout.tsx
    index.tsx
    questions.tsx
    invitations.tsx
    exports.tsx

src/
  app/
    providers/
      auth-provider.tsx
      query-provider.tsx
    navigation/
      role-guard.tsx
  config/
    env.ts
    constants.ts
  features/
    audits/
      components/
        conclusions-screen.tsx
        evidence-picker.tsx
        historical-summary-card.tsx
        question-card.tsx
      domain/
        score.ts
        validation.ts
      hooks/
        use-audit-draft.ts
        use-checklist.ts
        use-offline-sync.ts
      services/
        audit-repository.ts
        evidence-storage.ts
      types.ts
    signatures/
      components/
        signature-pad.tsx
      services/
        signature-storage.ts
    admin/
      components/
        question-editor.tsx
        invitation-form.tsx
      services/
        admin-repository.ts
    auth/
      services/
        auth-service.ts
      hooks/
        use-session-profile.ts
  lib/
    supabase.ts
    storage-paths.ts
  shared/
    components/
      app-button.tsx
      form-field.tsx
      loading-state.tsx
    theme/
      colors.ts
      spacing.ts
```
