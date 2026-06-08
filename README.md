# Descuentos Masivos Shopify

App privada para aplicar y revertir descuentos por porcentaje en tiendas Shopify. Corre localmente en tu computadora.

## Requisitos

- Node.js 20+
- Cuenta en [Shopify Partners](https://partners.shopify.com) para crear la app
- [ngrok](https://ngrok.com) (solo para el flujo OAuth inicial)

## Instalación

```bash
cd discounts-app
npm install
```

## Configuración

1. Copia el archivo de ejemplo:
```bash
cp .env.example .env
```

2. Ve a Shopify Partners → Apps → Create app → Custom app.
3. Obtén el **API key** y **API secret** y ponlos en el `.env`.
4. En la app de Partners, configura los **App URLs**:
   - App URL: `https://TU_NGROK.ngrok-free.app`
   - Allowed redirection URL(s): `https://TU_NGROK.ngrok-free.app/auth/callback`
5. Corre ngrok:
```bash
ngrok http 3000
```
6. Copia la URL HTTPS de ngrok en tu `.env` como `HOST`.

Ejemplo de `.env`:
```env
SHOPIFY_API_KEY=1234567890abcdef
SHOPIFY_API_SECRET=shpss_xxxxxxxx
HOST=https://abc123.ngrok-free.app
PORT=3000
SHOPIFY_API_VERSION=2024-04
```

## Uso

```bash
npm start
```

Abre `http://localhost:3000` en tu navegador.

### Flujo

1. **Conectar tienda**: ingresa `portalzen.myshopify.com` (o tu tienda B2C) y autoriza la app.
2. **Aplicar descuento**: selecciona la tienda, elige colecciones (o toda la tienda), ingresa el % y presiona **Aplicar**.
3. **Revertir**: en el historial, presiona **Revertir** en la operación activa para restaurar precios originales.

### Precauciones

- La app guarda los precios originales en `data/discounts.db`. **Haz backup de ese archivo** si vas a hacer operaciones críticas.
- Solo puede haber **un descuento activo por tienda** a la vez. Revierte antes de aplicar otro.
- La opción "Excluir productos ya con descuento" evita tocar variantes que ya tengan `compareAtPrice > price`.

## Estructura

- `lib/shopify.js` — cliente GraphQL Admin API
- `lib/db.js` — SQLite local con sql.js (sin compilación nativa)
- `public/` — interfaz web vanilla JS
- `routes/api.js` — endpoints REST para aplicar/revertir descuentos

## Notas técnicas

- Usa `productVariantsBulkUpdate` de GraphQL para modificar precios en batch.
- Incluye rate limiting de ~300ms cada 10 productos para no saturar la API de Shopify.
- Para ~1.000 SKUs, el proceso toma entre 30 y 90 segundos.
