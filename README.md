# Dominó El Patio

App web de **apuntes de dominó** para un patio o sala. Una sola mesa a la vez, todos se enfrentan, y al final se juega pre-eliminatoria y final de forma justa.

Inspirada en anotadores como [ANOTE](https://anotedomino.com/) y [DominApp](https://chivopost.itch.io/dominapp), pero pensada para un torneo en vivo con código de sala.

## Cómo funciona el torneo

1. **Crear el torneo**  
   El dueño abre una sala (código de 4 letras) y comparte el código. Quien entra escribe su nombre y, si ya hay parejas, **elige su grupo**.

2. **Rifa de equipos**  
   Jugadores A (más experiencia) + jugadores B (menos experiencia). Cada pareja sale 1A + 1B al azar. Si el dueño ya trae las parejas, las anota directo.

3. **Todos contra todos, una mesa a la vez**  
   Con 3 parejas, por ejemplo:
   - Mesa 1: B vs C (A descansa)
   - Mesa 2: A vs C (B descansa)
   - Mesa 3: A vs B (C descansa)

   Cada grupo anota **sus** puntos en el teléfono. El dueño ve ambos marcadores en vivo.

4. **Pre-eliminatoria justa**
   - 3 equipos: el 1° espera en la final; 2° vs 3° en pre-elim.
   - 4 o más: clasifican los 4 primeros. Pre-elim **1° vs 4°** y **2° vs 3°**.

5. **Final**  
   Los ganadores de la pre-elim (o el 1° de la liguilla + el ganador de la pre-elim, si hay 3) juegan el título.

El ranking de la liguilla ordena por victorias, luego diferencia de puntos, luego puntos a favor y, si hace falta, el cara a cara.

## Arranque local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). En local las salas se guardan en `.data/rooms.json` (no hace falta base de datos).

## Subir a Vercel

En Vercel el disco no se comparte entre visitas: hay que conectar un almacén.

### Opción recomendada: Neon Postgres

1. En el proyecto de Vercel: **Integrations → Neon**.
2. Crea la base. Vercel deja `DATABASE_URL` sola.
3. Redeploy.

La app crea la tabla `rooms` en el primer request.

### Alternativa: Upstash Redis

Define:

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Variables

Ver `.env.example`. No subas `.env` al repo.

## Logo

El archivo `public/logo.svg` es la marca Dominó El Patio. Si quieres usar el PNG original, colócalo en `public/logo.png` y cambia el `src` del logo en `components/DominoApp.tsx`.
