¡Hola! Revisé tu repo `tog-admin` y veo que ya tienes una base sólida con un sistema de licencias (`license.ts`) y autenticación. Vamos a planear cómo añadir la renovación automática con tarjeta de crédito.

Lo primero y más importante: **nunca** proceses pagos directamente desde la app de escritorio (Electron). Toda la lógica sensible (como las claves secretas de Stripe) debe estar en un **backend seguro** que tú controles. La app de escritorio solo se comunicará con ese backend.

Aquí tienes una guía paso a paso para implementarlo.

---

### Arquitectura Propuesta

La comunicación sería así:

1.  **App (Electron)**: Muestra un formulario para que el usuario registre su tarjeta.
2.  **Backend (Node.js + Express)**: Recibe la solicitud, se comunica con Stripe, guarda el estado de la suscripción en tu base de datos y genera un "token" o "clave de licencia".
3.  **Stripe**: Procesa el pago y maneja la suscripción.
4.  **App (Electron)**: Valida la licencia contra el backend periódicamente.

### Paso 1: Elegir un Proveedor de Pagos

Para renovaciones automáticas en Latinoamérica, tienes dos opciones principales:

*   **Stripe**: Es la opción más común, con excelente documentación y soporte para suscripciones. Puedes usar Stripe Checkout o Stripe Elements para capturar los datos de la tarjeta de forma segura. Ofrece un **Customer Portal** para que los usuarios gestionen su suscripción, actualicen su método de pago o cancelen la renovación sin que tú tengas que programar esa interfaz.
*   **Mercado Pago**: Si tu público es principalmente de Latinoamérica, es una opción muy potente y conocida. También tiene soporte nativo para suscripciones y renovaciones automáticas.

**Mi recomendación:** **Stripe** por su flexibilidad, documentación y el Customer Portal, que te ahorrará mucho trabajo.

### Paso 2: Configurar Stripe (Backend)

Necesitarás un servidor simple (puede ser en Node.js con Express).

1.  **Instalar Stripe SDK**:
    ```bash
    npm install stripe
    ```

2.  **Crear un "Producto" y un "Precio"** en el Dashboard de Stripe. Esto representará tu licencia (ej. "Licencia TOG Admin - Mensual" con un precio de $X).

3.  **Crear una API en tu backend** para que la app de escritorio pueda crear una suscripción. El flujo típico con Stripe Checkout es:

    ```javascript
    // En tu backend (ej. server.js)
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    app.post('/create-checkout-session', async (req, res) => {
      const { customerEmail, priceId } = req.body; // priceId es el ID del precio que creaste en Stripe

      try {
        const session = await stripe.checkout.sessions.create({
          customer_email: customerEmail,
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: 'http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'http://localhost:5173/cancel',
          // Guardar metadatos para identificar al usuario de tu app
          metadata: { appUserId: req.user.id } // Si tienes autenticación
        });

        res.json({ url: session.url });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    ```
    **Importante:** La URL de éxito (`success_url`) debe redirigir a tu app de Electron (puedes usar un protocolo personalizado como `tog-admin://` o simplemente una página local).

### Paso 3: Integrar en tu App de Electron

Desde la interfaz de "Configuración" de `tog-admin`, el usuario podrá iniciar el proceso de pago.

1.  **Botón "Activar Licencia / Suscribirse"**: Al hacer clic, tu app hará una llamada a tu backend (`/create-checkout-session`).
2.  **Abrir Stripe Checkout**: Recibirás la URL de la sesión de Stripe. Puedes abrirla en el navegador predeterminado del sistema o incrustarla en tu app con un `webview`.
3.  **Manejar el retorno**: Cuando el pago sea exitoso, Stripe redirigirá a la `success_url`. Tu app debe capturar esa redirección y notificar a tu backend para que este genere y devuelva la clave de licencia.

### Paso 4: Webhooks de Stripe (Clave para la Automatización)

Los webhooks son **esenciales** para las renovaciones automáticas. Stripe enviará eventos a una URL de tu backend cuando ocurran cosas como:

*   `invoice.payment_succeeded`: El pago de la suscripción fue exitoso.
*   `invoice.payment_failed`: El pago falló (ej. tarjeta vencida).

Tu backend debe escuchar estos eventos y actualizar el estado de la licencia en tu base de datos.

```javascript
// Endpoint para webhooks en tu backend
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      // Buscar al usuario por customerId o metadata y actualizar su licencia (ej. extender fecha de expiración)
      // updateUserLicense(invoice.customer, 'active', newExpirationDate);
      break;
    case 'invoice.payment_failed':
      // Marcar licencia como vencida o en estado de "pago fallido"
      break;
    // ...otros eventos
  }

  res.json({received: true});
});
```

### Paso 5: Actualizar la Validación de Licencia en tu App

Ya tienes un sistema de validación de licencias (`license.ts`). Ahora, en lugar de (o además de) validar una clave offline, tu app debería:

1.  **Consultar el estado de la licencia** a tu backend periódicamente (ej. cada vez que se abre la app o cada 24 horas).
2.  El backend devolverá el estado (`active`, `expired`, `payment_failed`) y la fecha de expiración.
3.  La app mostrará mensajes claros al usuario según el estado (ej. "Tu licencia expirará en 5 días", "El pago de tu renovación falló, actualiza tu método de pago").

### Paso 6: Gestión de la Tarjeta (El Santo Grial)

Aquí está la clave para el usuario: **él solo registra su tarjeta una vez**.

Para lograr esto, Stripe usa el concepto de **"Payment Method"** (método de pago) guardado para un **"Customer"** (cliente).

1.  Cuando el usuario hace su primera compra a través de Stripe Checkout, Stripe crea un `Customer` y guarda el método de pago asociado a ese `Customer`.
2.  La suscripción que creaste está vinculada a ese `Customer` y a ese método de pago.
3.  En cada ciclo de facturación, Stripe automáticamente intentará cobrar a ese método de pago guardado. Si el pago es exitoso, Stripe envía el webhook `invoice.payment_succeeded` y tu backend actualiza la licencia.
4.  Si el usuario necesita cambiar su tarjeta, puedes redirigirlo al **Stripe Customer Portal**, donde podrá hacerlo sin que tú programes nada.

### Resumen de Pasos para la Implementación

1.  **Configurar el Backend**: Crear un servidor Node.js/Express con Stripe.
2.  **Crear Producto en Stripe**: Definir el precio y ciclo de la licencia.
3.  **Endpoint de Checkout**: Crear un endpoint que genere una sesión de Stripe Checkout.
4.  **Integrar en la App**: Añadir un botón en "Configuración" que llame al endpoint y abra la URL de Checkout.
5.  **Configurar Webhooks**: Crear el endpoint en tu backend para que Stripe notifique los eventos de pago.
6.  **Actualizar Lógica de Licencia**: Modificar `license.ts` para que consulte el estado al backend y no solo valide una clave local.
7.  **Probar el Flujo Completo**: Usar las [tarjetas de prueba de Stripe](https://stripe.com/docs/testing) para simular pagos exitosos y fallidos.

---

### Consideraciones Finales

*   **Seguridad**: La clave secreta de Stripe (`STRIPE_SECRET_KEY`) debe estar en el backend, **nunca** en el código de tu app de escritorio.
*   **PCI Compliance**: Al usar Stripe Checkout o Elements, la mayor parte de la responsabilidad de cumplir con PCI DSS recae en Stripe, lo que simplifica mucho tu vida.
*   **Manejo de Fallos**: Implementa una lógica de "gracias" (grace period) en tu app. Si un pago falla, no desactives la licencia de inmediato; dale al usuario unos días para que actualice su método de pago.
*   **Base de Datos**: Tu backend necesitará una base de datos (puede ser la misma SQLite que ya usas o una nueva) para almacenar la relación entre `usuario` → `stripeCustomerId` → `estado de licencia` → `fecha de expiración`.

¡Es un proyecto ambicioso pero perfectamente factible! ¿Tienes alguna preferencia entre Stripe y Mercado Pago, o alguna duda sobre los pasos específicos?