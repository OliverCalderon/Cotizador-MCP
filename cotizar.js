import { readFileSync } from 'node:fs';

const rutaCatalogo = new URL('./catalogo.json', import.meta.url);
const texto = readFileSync(rutaCatalogo, 'utf8');
const catalogo = JSON.parse(texto);

export function cotizarCompra(articulos){
    if(!Array.isArray(articulos) || articulos.length === 0){
        throw new Error('Agrega al menos un articulo para cotizar');
    }

    let total = 0;
    const detalle = [];

    for(const articulo of articulos){
        if(articulo === null || articulo === undefined){
            throw new Error('Falta un articulo en la lista');
        }
        const id = articulo.id;
        const cantidad = articulo.cantidad;

        if(!Number.isSafeInteger(id) || id < 1){
            throw new Error('El ID debe ser un número entero positivo');
        }
        if(!Number.isSafeInteger(cantidad) || cantidad < 1){
            throw new Error(`La cantidad del producto ${id} debe ser un número entero positivo`);
        }

        let producto;
        for(const articuloCatalogo of catalogo.producto){
            if(articuloCatalogo.id === id){
                producto = articuloCatalogo;
                break;
            }
        }
        if(!producto){
            throw new Error(`El producto con el ID ${id} no existe en el catalogo`);
        }

        const precio = Math.round(producto.precio * 100);
        const subtotal = precio * cantidad;

        if(!Number.isSafeInteger(total + subtotal)){
            throw new Error('La cantidad solicitada es demaciada grande para cotizarla.');
        }

        total += subtotal;

        detalle.push({
            id: id,
            nombre: producto.nombre,
            cantidad: cantidad,
            precioUnitario: producto.precio,
            subtotal: subtotal/100
        });
    }

    return {
        moneda: catalogo.moneda,
        articulos: detalle,
        total: total / 100
    };
}