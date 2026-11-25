# Cotizador con MCP y Ollama

Chat de terminal en español que cotiza consolas y componentes de PC a partir de un catálogo local. El modelo interpreta el pedido, solicita la herramienta MCP `cotizar_compra` y usa su resultado para presentar el desglose en MXN.

## Archivos

| Archivo | Función |
| --- | --- |
| `src/chat.js` | Descubre las herramientas MCP, se comunica con Ollama y muestra la conversación. |
| `src/servidor.js` | Publica `cotizar_compra` mediante Streamable HTTP. |
| `src/cotizar.js` | Valida los artículos y calcula los subtotales y el total. |
| `datos/catalogo.json` | Contiene los productos y sus precios de referencia. |
| `pruebas/probar-mcp.js` | Comprueba el descubrimiento, una cotización válida y el error de un ID inexistente. |
| `config.example.json` | Plantilla para la configuración local del chat. |

## Instalación y ejecución en Windows

Necesitas Node.js 24, npm y Ollama. Desde la carpeta del proyecto, ejecuta en PowerShell:

```powershell
npm.cmd ci
Copy-Item .\config.example.json .\config.json
ollama pull qwen3.5:4b
```

Si ya tienes `config.json`, conserva tu archivo. Inicia Ollama y, en la primera terminal, ejecuta:

```powershell
npm.cmd run servidor
```

Deja el servidor abierto. En una segunda terminal, ejecuta:

```powershell
npm.cmd test
npm.cmd run chat
```

`npm.cmd test` llama directamente al servidor MCP. El chat usa Ollama para decidir cuándo llamar a la herramienta. El carrito se conserva mientras el chat está abierto. Escribe `/salir` para cerrar el chat.

## Configuración

Edita `config.json` para cambiar la URL de MCP, la API de Ollama, el modelo o el tamaño del contexto. Si el modelo tarda demasiado, puedes cambiar `think` a `false` y reiniciar el chat.

El servidor escucha de forma predeterminada en `http://127.0.0.1:3000/mcp`. Si ajustas `MCP_HOST`, `MCP_PORT` o `MCP_PATH` antes de arrancar el servidor, actualiza también `mcp.url` en `config.json`. La prueba directa toma su dirección de `MCP_URL` si está definida.

## Demostración

1. Al iniciar el chat, verifica que se muestren el modelo, las URLs y la herramienta `cotizar_compra`.
2. Escribe `Cotízame una RTX 3070 Ti y un Ryzen 7 5700X.` El resultado esperado es **$13,750 MXN**.
3. En el mismo chat, escribe `Agrégame dos Switch 2.` La tabla debe conservar los dos productos anteriores, sumar las consolas y mostrar **$37,150 MXN**.
4. Escribe `Cotiza una unidad del producto con ID 99.` El servidor debe indicar que el producto no existe. Una cotización con error conserva el carrito anterior.

Para la entrega, guarda la salida de arranque del servidor y las transcripciones de los casos de prueba. En el chat deben verse el descubrimiento, los argumentos de la herramienta, su resultado y la respuesta final.
