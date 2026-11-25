import {
    Client,
    StreamableHTTPClientTransport
} from '@modelcontextprotocol/client';

const url = process.env.MCP_URL ?? 'http://127.0.0.1:3000/mcp';
const cliente = new Client({ name: 'prueba-cotizador', version: '1.0.0' });
const transporte = new StreamableHTTPClientTransport(new URL(url));

try {
    await cliente.connect(transporte);

    const resultado = await cliente.listTools();
    console.log('Herramientas descubiertas:', resultado.tools.map((herramienta) => herramienta.name));

    for (const articulos of [
        [{ id: 9, cantidad: 1 }, { id: 10, cantidad: 1 }],
        [{ id: 99, cantidad: 1 }]
    ]) {
        console.log('\nLlamando a cotizar_compra con:', articulos);

        const respuesta = await cliente.callTool({
        name: 'cotizar_compra',
        arguments: { articulos: articulos }
        });

        console.dir(respuesta, { depth: null });
    }
} finally {
    await cliente.close();
}