import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Client, StreamableHTTPClientTransport
} from '@modelcontextprotocol/client';

function leerJson(archivo) {
    const ruta = new URL(archivo, import.meta.url);
    const texto = readFileSync(ruta, 'utf8');
    return JSON.parse(texto);
}

const config = leerJson('../config.json');
const catalogo = leerJson('../datos/catalogo.json');

const urlOllama = new URL(config.llm.chatPath, config.llm.baseUrl);
const urlMcp = new URL(config.mcp.url);

const cliente = new Client({ name: 'chat-cotizador', version: '1.0.0' });
const transporte = new StreamableHTTPClientTransport(urlMcp);

// Qwen recibe los nombres e IDs para reconocer los productos del pedido.
const listaProductos = catalogo.producto
    .map((producto) => `${producto.id}: ${producto.nombre}`)
    .join('\n');

const instrucciones = `Eres un asistente de cotizaciones. Responde en español.
Para cotizar, llama a cotizar_compra con los IDs y las cantidades solicitadas.
Usa el catálogo para identificar los productos mencionados por nombre.
Si hay una coincidencia ambigua, pídele al usuario que aclare.
Si el usuario da un ID explícito, envíalo a la herramienta para validarlo.
Usa los precios y el total devueltos por la herramienta.
Si la herramienta devuelve un error, explícalo al usuario.

Catálogo de IDs y nombres:
${listaProductos}`;

async function consultarOllama(mensajes, herramientas) {
    const respuesta = await fetch(urlOllama, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        model: config.llm.model,
        messages: mensajes,
        tools: herramientas,
        stream: false,
        think: config.llm.think,
        options: { num_ctx: config.llm.numCtx }
        })
    });

    if (!respuesta.ok) {
        const detalle = await respuesta.text();
        throw new Error(`Ollama devolvió HTTP ${respuesta.status}: ${detalle}`);
    }

    const datos = await respuesta.json();
    return datos.message;
}

let carrito = [];

function mostrarCotizacion(cotizacion) {
    const moneda = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: cotizacion.moneda
    });

    console.log('\nCotización');
    const encabezados = ['Producto', 'Cantidad', 'Precio unitario', 'Subtotal'];
    const filas = cotizacion.articulos.map((articulo) => [
        articulo.nombre,
        String(articulo.cantidad),
        moneda.format(articulo.precioUnitario),
        moneda.format(articulo.subtotal)
    ]);
    const anchos = encabezados.map((titulo, columna) =>
        filas.reduce((ancho, fila) => Math.max(ancho, fila[columna].length), titulo.length)
    );

    console.log(encabezados.map((titulo, columna) => titulo.padEnd(anchos[columna])).join(' | '));
    console.log(anchos.map((ancho) => '-'.repeat(ancho)).join('-+-'));
    for (const fila of filas) {
        const celdas = fila.map((valor, columna) => columna === 0
            ? valor.padEnd(anchos[columna])
            : valor.padStart(anchos[columna]));
        console.log(celdas.join(' | '));
    }
    console.log(`Total: ${moneda.format(cotizacion.total)} ${cotizacion.moneda}`);
}

function quitarEmojis(texto) {
    return texto.replace(/\p{RGI_Emoji}/gv, '').trim();
}

async function responderPregunta(pregunta, herramientas) {
    const instruccionesCarrito = `${instrucciones}

Carrito confirmado (IDs y cantidades): ${JSON.stringify(carrito)}

Si el usuario pide agregar artículos, conserva todos los artículos confirmados.
Si agrega un ID que ya está en el carrito, suma las unidades nuevas.
Al agregar, llama a cotizar_compra con el carrito completo, incluidos los artículos anteriores.
Si el usuario solicita una cotización nueva, cotiza solo los artículos del nuevo pedido.
Si no queda claro si quiere agregar o empezar de nuevo, pregunta.
Después de una cotización exitosa, confirma el resultado en una sola frase sin emojis.
El programa imprime el desglose y el total. Evita repetirlos.
Si hay un error, explícalo brevemente y sin emojis.`;

    const mensajes = [
        { role: 'system', content: instruccionesCarrito },
        { role: 'user', content: pregunta }
    ];
    let cotizacion = null;

    for (let ronda = 0; ronda < 8; ronda++) {
        console.log('\nConsultando a Qwen...');
        const mensaje = await consultarOllama(mensajes, herramientas);
        mensajes.push(mensaje);

        const llamadas = mensaje.tool_calls ?? [];

        if (llamadas.length === 0) {
            if (cotizacion !== null) {
                carrito = cotizacion.articulos.map((articulo) => ({
                    id: articulo.id,
                    cantidad: articulo.cantidad
                }));
                mostrarCotizacion(cotizacion);
            }

            const texto = quitarEmojis(mensaje.content ?? '');
            if (texto || cotizacion === null) {
                console.log(`\nAsistente: ${texto || 'El modelo no devolvió una respuesta de texto.'}`);
            }
            return;
        }

        for (const llamada of llamadas) {
            const nombre = llamada.function.name;
            const argumentos = llamada.function.arguments;

            console.log(`\nLlamando por MCP a ${nombre}`);
            console.log('Argumentos:', JSON.stringify(argumentos));

            const resultado = await cliente.callTool({
                name: nombre,
                arguments: argumentos
            });

            if (nombre === 'cotizar_compra') {
                cotizacion = resultado.isError === true
                    ? null
                    : resultado.structuredContent ?? null;
            }

            const contenido = JSON.stringify({
                error: resultado.isError === true,
                datos: resultado.structuredContent ?? resultado.content
            });

            console.log('Resultado MCP:', contenido);
            mensajes.push({ role: 'tool', tool_name: nombre, content: contenido });
        }
    }

    throw new Error('El modelo alcanzó el límite de rondas sin dar una respuesta final.');
}

async function iniciarChat() {
    console.log(`Modelo local: ${config.llm.model}`);
    console.log(`API de Ollama: ${urlOllama}`);
    console.log(`Servidor MCP: ${urlMcp}`);

    await cliente.connect(transporte);

    const { tools } = await cliente.listTools();
    console.log('Herramientas descubiertas:', tools.map((tool) => tool.name).join(', '));

    const herramientas = tools.map((tool) => ({
        type: 'function',
        function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
        }
    }));

    const terminal = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        console.log('\nEscribe un pedido, agrega artículos al carrito o escribe /salir.');

        while (true) {
        const pregunta = (await terminal.question('\nTú: ')).trim();

        if (pregunta.toLowerCase() === '/salir') break;
        if (pregunta === '') continue;

        try {
            await responderPregunta(pregunta, herramientas);
        } catch (error) {
            console.error(`No se pudo responder: ${error.message}`);
        }
        }
    } finally {
        terminal.close();
    }
}

try {
    await iniciarChat();
} catch (error) {
    console.error(`No se pudo iniciar el chat: ${error.message}`);
    process.exitCode = 1;
} finally {
    await cliente.close();
}
