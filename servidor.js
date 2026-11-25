import { createServer } from 'node:http';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import {
    localhostHostValidation,
    localhostOriginValidation,
    toNodeHandler
} from '@modelcontextprotocol/node';
import { z } from 'zod/v4';
import { cotizarCompra } from './cotizar.js';

const host = process.env.MCP_HOST ?? '127.0.0.1';
const puerto = Number(process.env.MCP_PORT ?? '3000');
const ruta = process.env.MCP_PATH ?? '/mcp';

const manejadorMcp = createMcpHandler(() => {
    const servidor = new McpServer({
        name: 'cotizador-mcp',
        version: '1.0.0'
    });

    servidor.registerTool(
        'cotizar_compra',
        {
        description: 'Cotiza una compra en MXN a partir de IDs y cantidades.',
        inputSchema: z.object({
            articulos: z.array(
            z.object({
                id: z.int().positive().describe('ID del producto en el catálogo'),
                cantidad: z.int().positive().describe('Número de unidades')
            })
            ).min(1)
        })
        },
        async ({ articulos }) => {
        try {
            const cotizacion = cotizarCompra(articulos);

            return {
            content: [{ type: 'text', text: JSON.stringify(cotizacion) }],
            structuredContent: cotizacion
            };
        } catch (error) {
            return {
            isError: true,
            content: [{ type: 'text', text: error.message }]
            };
        }
        }
    );

    return servidor;
});

const responderMcp = toNodeHandler(manejadorMcp);
const validarHost = localhostHostValidation();
const validarOrigen = localhostOriginValidation();

const servidorHttp = createServer((peticion, respuesta) => {
    if (!validarHost(peticion, respuesta) || !validarOrigen(peticion, respuesta)) {
        return;
    }

    if (peticion.url !== ruta) {
        respuesta.writeHead(404);
        respuesta.end('Ruta no encontrada');
        return;
    }

    void responderMcp(peticion, respuesta);
});

servidorHttp.listen(puerto, host, () => {
    console.log(`Servidor MCP disponible en http://${host}:${puerto}${ruta}`);
});