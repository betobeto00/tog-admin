# Integración de Lector de Códigos de Barras USB

## Resumen de la Solución

Los lectores de código de barras USB se comportan como un **teclado (HID Keyboard)**. Cuando escanean un código, lo "escriben" como si fuera texto del teclado, seguido de un **Enter** (tecla `\n` o `\r\n`). Por lo tanto, no necesitas drivers especiales ni comunicación serial.

---

## Estrategia de Implementación

### Opción 1: Detectar el Enter (Recomendada ⭐)

Capturar el evento `keydown` y detectar cuando se presiona `Enter`, verificando si el texto previo parece un código de barras.

```tsx
// En POSPage.tsx
const [scanBuffer, setScanBuffer] = useState<string>('');
const [scanTimeout, setScanTimeout] = useState<NodeJS.Timeout | null>(null);

const handleKeyDown = (e: KeyboardEvent) => {
  // Ignorar si el foco está en un campo de texto
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }

  // Si es Enter y tenemos un buffer, procesar el código
  if (e.key === 'Enter' && scanBuffer.length > 0) {
    e.preventDefault();
    
    const barcode = scanBuffer.trim();
    // Buscar producto por código de barras
    buscarProductoPorCodigo(barcode);
    
    // Reiniciar buffer
    setScanBuffer('');
    return;
  }

  // Si es una tecla de caracter (letra/número/símbolo)
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    // Reiniciar timeout
    if (scanTimeout) clearTimeout(scanTimeout);
    
    setScanBuffer(prev => prev + e.key);
    
    // Timeout de 50ms para detectar lectura rápida
    const timeout = setTimeout(() => {
      setScanBuffer('');
    }, 100);
    setScanTimeout(timeout);
  }
};
```

### Opción 2: Detectar velocidad de tipeo

Los lectores de barras típicamente envían caracteres con intervalos muy cortos (< 10ms entre caracteres). Puedes usar un timeout de ~50ms para distinguir entre un escaneo y tipeo manual.

```tsx
const BARCODE_TIMEOUT = 50; // ms

// En el evento keydown
if (e.key.length === 1) {
  if (scanTimeout) clearTimeout(scanTimeout);
  setScanBuffer(prev => prev + e.key);
  
  const timeout = setTimeout(() => {
    // Si pasó el timeout y hay buffer, intentar buscar
    if (scanBuffer.length > 0) {
      buscarProductoPorCodigo(scanBuffer);
      setScanBuffer('');
    }
  }, BARCODE_TIMEOUT);
  setScanTimeout(timeout);
}
```

---

## Implementación Completa en POSPage

### 1. Hook Personalizado: `useBarcodeScanner`

```tsx
// src/renderer/hooks/useBarcodeScanner.ts
import { useEffect, useState, useCallback } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  timeout?: number; // 50ms por defecto
  enabled?: boolean;
}

export function useBarcodeScanner({ 
  onScan, 
  timeout = 50, 
  enabled = true 
}: UseBarcodeScannerOptions) {
  const [buffer, setBuffer] = useState('');
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Si el foco está en un input, no interferir
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Enter = finalizar escaneo
    if (e.key === 'Enter' && buffer.length > 0) {
      e.preventDefault();
      const barcode = buffer.trim();
      if (barcode.length > 0) {
        onScan(barcode);
      }
      setBuffer('');
      if (timer) {
        clearTimeout(timer);
        setTimer(null);
      }
      return;
    }

    // Caracteres de control o teclas especiales
    if (e.key === 'Escape' || e.key === 'Tab' || e.key === 'Shift' || 
        e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
      return;
    }

    // Solo caracteres imprimibles
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (timer) {
        clearTimeout(timer);
      }

      setBuffer(prev => prev + e.key);

      const newTimer = setTimeout(() => {
        // Timeout → escaneo incompleto o tipeo manual
        if (buffer.length > 0) {
          // Opcional: si es un código válido, procesar
          // onScan(buffer);
        }
        setBuffer('');
        setTimer(null);
      }, timeout);
      setTimer(newTimer);
    }
  }, [buffer, timer, enabled, onScan, timeout]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [handleKeyDown, enabled]);

  // Limpiar buffer manualmente
  const clearBuffer = useCallback(() => {
    setBuffer('');
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
  }, [timer]);

  return { clearBuffer };
}
```

### 2. Integración en POSPage

```tsx
// src/renderer/pages/POSPage.tsx
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

function POSPage() {
  const { cart, addToCart, searchProducts } = usePOSStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Función que se ejecuta al escanear
  const handleBarcodeScan = useCallback((barcode: string) => {
    // 1. Buscar producto por código de barras
    const product = buscarProductoPorCodigo(barcode);
    
    if (product) {
      // Si existe, agregar al carrito
      addToCart(product, 1);
      toast.success(`${product.nombre} agregado`);
    } else {
      // Si no existe, opciones:
      // - Buscar por nombre
      // - Mostrar mensaje de "producto no encontrado"
      // - Abrir modal para crear producto
      setSearchQuery(barcode);
      toast.warning('Producto no encontrado. Buscando por nombre...');
    }
  }, [addToCart]);

  // Activar escáner en el POS
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    timeout: 50,
    enabled: true
  });

  // El input de búsqueda también debe funcionar con escáner
  // cuando el foco está en el campo de búsqueda
  
  return (
    <div className="pos-container">
      <Input
        placeholder="Buscar producto o escanear código..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && searchQuery.length > 0) {
            // Buscar manualmente
            buscarProductos(searchQuery);
          }
        }}
      />
      {/* ... resto del POS */}
    </div>
  );
}
```

---

### 3. Búsqueda de Producto por Código de Barras

```tsx
// src/renderer/lib/productUtils.ts
export async function buscarProductoPorCodigo(codigo: string): Promise<Producto | null> {
  try {
    // Buscar por código de barras exacto
    const resultado = await window.api.productos.buscarPorCodigo(codigo);
    
    if (resultado) {
      return resultado;
    }
    
    // Si no, buscar por SKU
    const porSku = await window.api.productos.buscarPorSku(codigo);
    if (porSku) {
      return porSku;
    }
    
    return null;
  } catch (error) {
    console.error('Error buscando producto:', error);
    return null;
  }
}
```

### 4. Handler IPC para Búsqueda por Código

```tsx
// src/main/ipc-handlers.ts
ipcMain.handle('productos:buscar-por-codigo', async (_, codigo) => {
  const db = getDatabase();
  
  // Buscar por código de barras
  let producto = db.prepare(`
    SELECT p.*, c.nombre as categoria_nombre 
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.codigo_barras = ? AND p.activo = 1
  `).get(codigo);
  
  if (!producto) {
    // Buscar por SKU
    producto = db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.sku = ? AND p.activo = 1
    `).get(codigo);
  }
  
  return producto || null;
});
```

---

## Configuración del Lector de Códigos de Barras

### A. Lectores que se comportan como teclado (la mayoría)

**No necesitas configuración especial.** Plug and Play.

### B. Lectores configurables (Zebra, Honeywell, Datalogic)

Puedes programar el lector para que:

1. **Agregue un prefijo** (ej: `@`) para identificar escaneos
2. **Agregue un sufijo** (ej: `\r` o `\n`)
3. **Use un caracter de terminación** diferente

```
Código escaneado: 1234567890
Configuración: Prefijo "BAR:" + Sufijo "\r"
Output: BAR:1234567890\r
```

### C. Configuración Recomendada para el Lector

| Parámetro | Valor | Razón |
|-----------|-------|-------|
| Suffix | CR (Enter) | Para detectar el fin del escaneo |
| Prefix | Ninguno | Simplifica el parsing |
| Keyboard Layout | US English | Evita problemas con caracteres especiales |
| Barcode Types | UPC-A, EAN-13, Code128, Code39 | Los más comunes en retail |

---

## Casos de Uso Soportados

### 1. Agregar Producto al Carrito (Escaneo)

```
Usuario escanea producto → Lector escribe código + Enter → 
Sistema busca producto → Si existe → Agrega al carrito con cantidad 1 →
Toast confirmación
```

### 2. Agregar Producto al Carrito (Escaneo en Input)

```
Usuario hace clic en input de búsqueda → Escanea producto → 
Input se llena con código → Presiona Enter automáticamente → 
Sistema busca y agrega
```

### 3. Crear Nuevo Producto (Escaneo)

```
Usuario escanea código no registrado → Sistema muestra "Producto no encontrado" →
Modal: "¿Deseas crear un nuevo producto con este código?"
→ Usuario completa nombre, precio y stock → Guarda → 
Producto creado y agregado al carrito
```

### 4. Escaneo Múltiple Rápido

```
Usuario escanea producto1 → Enter → Se agrega → 
Inmediatamente escanea producto2 → Enter → Se agrega →
Todo en menos de 1 segundo
```

---

## Manejo de Errores y Edge Cases

### A. Código de Barras con Prefijo/Sufijo

```tsx
// Si el lector agrega prefijo "BAR:" 
function parseBarcode(input: string): string {
  // Limpiar prefijos comunes
  const clean = input
    .replace(/^BAR:/i, '')
    .replace(/^SCAN:/i, '')
    .replace(/^BARC:/i, '')
    .trim();
  return clean;
}
```

### B. Códigos con Letras y Números

```tsx
// Algunos códigos (Code128, Code39) pueden incluir letras
// El input ya es string, no hay problema
const barcode = buffer.trim();
```

### C. Lecturas Incompletas

```tsx
// Si el usuario tipea lentamente o el escáner falla
// El timeout de 50ms reinicia el buffer
// Si pasa el timeout sin Enter, se descarta
```

### D. Conflicto con Inputs

```tsx
// Verificar si el foco está en un input
const isInputFocused = document.activeElement?.tagName === 'INPUT';

if (isInputFocused) {
  // Dejar que el input maneje el evento normalmente
  return;
}
```

---

## Atajos de Teclado Adicionales

```tsx
// POSPage.tsx
useEffect(() => {
  const handleKeyboard = (e: KeyboardEvent) => {
    // F2 = Enfocar búsqueda
    if (e.key === 'F2') {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    
    // F5 = Cobrar (si hay items en carrito)
    if (e.key === 'F5' && cart.length > 0) {
      e.preventDefault();
      handleCheckout();
    }
    
    // Escape = Limpiar carrito o cancelar
    if (e.key === 'Escape') {
      e.preventDefault();
      // Mostrar confirmación de limpiar carrito
    }
  };
  
  window.addEventListener('keydown', handleKeyboard);
  return () => window.removeEventListener('keydown', handleKeyboard);
}, [cart]);
```

---

## Resumen de Implementación

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| `useBarcodeScanner` | `hooks/useBarcodeScanner.ts` | Capturar escaneos globalmente |
| `POSPage` | `pages/POSPage.tsx` | Integrar escáner con POS |
| `buscarProductoPorCodigo` | `lib/productUtils.ts` | Buscar en DB por código |
| `productos:buscar-por-codigo` | `main/ipc-handlers.ts` | Handler IPC para búsqueda |
| `preload.ts` | `main/preload.ts` | Exponer API al renderer |

---

## Tiempo de Implementación Estimado

| Tarea | Horas |
|-------|-------|
| Hook `useBarcodeScanner` | 1-2 |
| Integración en POSPage | 1 |
| Handler IPC y DB query | 0.5 |
| Manejo de errores y edge cases | 1 |
| Testing con lector real | 0.5-1 |
| **Total** | **4-5 horas** |

---

## Notas Adicionales

### ⚠️ Importante: Lectores "Serial" vs "Keyboard"

- **Keyboard (HID)**: 90% de los lectores USB. Plug and Play, se integran como teclado.
- **Serial (RS-232)**: Requieren puerto COM y `serialport`. Menos comunes en retail moderno.

**El método descrito funciona para lectores Keyboard (HID).** Si tienes un lector Serial, necesitas usar `serialport` como la terminal VP800.

### ✅ Ya implementado en TOG Admin

El sistema ya tiene:
- Input de búsqueda de productos
- Agregar productos al carrito
- Búsqueda por código de barras en DB

Solo falta conectar el escáner al input.

### 🔧 Configuración del Lector (Si es necesario)

La mayoría de los lectores vienen configurados para:
- **Sufijo:** CR (Enter)
- **Velocidad:** Alta (para escaneos rápidos)

Si el lector no funciona, verificar:
1. Que esté en modo "Keyboard Wedge" (no "Serial")
2. Que el sufijo sea CR o CR+LF
3. Que el layout del teclado sea US