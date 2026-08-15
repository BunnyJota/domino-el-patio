export const RULES_TEXT = {
  puntuacion: [
    "El juego se disputa con el sistema de puntuación establecido por la organización.",
    "Cada punto obtenido se suma inmediatamente al marcador de la partida.",
    "La puntuación establecida es de 30 puntos.",
    "Cuando un jugador o pareja pasa, se contabilizan 30 puntos según corresponda.",
    "El Pacho tiene un valor de 30 puntos.",
    "Todos los puntos obtenidos durante la partida son válidos y deben registrarse inmediatamente.",
    "Las salidas son válidas y todas las salidas caben.",
  ],
  jugada: [
    "Está prohibido hablar durante la jugada.",
    "El jugador en turno debe jugar sin indicaciones de compañeros, espectadores u otras personas.",
    "El paso debe tocarse en la mesa o el jugador debe decir claramente “no va”.",
    "Una vez anunciado o ejecutado el paso, la decisión queda registrada.",
    "Los jugadores deben permanecer atentos a la mesa y respetar el turno correspondiente.",
  ],
  fichas: [
    "No se permite cambiar una ficha una vez iniciada formalmente la jugada.",
    "Si el oponente identifica correctamente la ficha que el jugador pretende jugar, éste deberá jugarla.",
    "No se permite retirar, sustituir o cambiar una ficha después de iniciado el movimiento para jugarla.",
    "Cualquier duda sobre una jugada debe resolverse antes de continuar la partida.",
  ],
  conducta: [
    "Los jugadores deben mantener una conducta respetuosa durante todo el torneo.",
    "Está prohibido hacer señas, gestos o cualquier comunicación que revele información sobre las fichas.",
    "No se permite utilizar teléfonos celulares durante la partida.",
    "Los jugadores no pueden cambiarse de lugar durante una partida, salvo autorización de la organización.",
    "Está prohibido recibir ayuda o información externa.",
  ],
  espectadores: [
    "Los espectadores deben permanecer en silencio durante las jugadas.",
    "Prohibido: hablar con los jugadores, hacer señas, indicar qué ficha jugar, comentar las fichas o usar gestos para influir en una jugada.",
    "El espectador que interfiera repetidamente podrá ser retirado del área de juego.",
  ],
  faltas: [
    {
      tag: "Falta leve",
      detalle:
        "Hablar durante la jugada, seña accidental, usar el teléfono, interrumpir innecesariamente. Penalización: advertencia la primera vez; reincidencia = 30 puntos para la pareja contraria.",
    },
    {
      tag: "Falta grave (comunicación/ayuda)",
      detalle:
        "Dar o recibir indicaciones, señas intencionales, información de un compañero/espectador, influir deliberadamente. Penalización: 30 puntos para la pareja contraria.",
    },
    {
      tag: "Cambio de ficha",
      detalle:
        "Si un jugador intenta cambiar una ficha ya jugada, debe mantener y jugar la ficha originalmente seleccionada.",
    },
    {
      tag: "Intervención del espectador",
      detalle:
        "Expulsión del espectador. Si benefició a una pareja, la organización puede otorgar 30 puntos a la pareja contraria.",
    },
  ],
  arbitro: [
    "El árbitro u organizador resuelve cualquier situación no contemplada en este reglamento.",
    "Las decisiones deben respetarse para garantizar el desarrollo ordenado del torneo.",
    "Las reclamaciones deben hacerse antes de que continúe la siguiente jugada.",
    "Iniciada la siguiente jugada, no se aceptan reclamaciones sobre jugadas anteriores, salvo casos excepcionales.",
  ],
};

export const STAGE_LABEL: Record<string, string> = {
  roster: "Inscripción",
  teams_drawn: "Rifa lista",
  classification: "Ronda 1",
  pre_elim: "Repechaje",
  final: "Final",
  finished: "Campeón",
};
