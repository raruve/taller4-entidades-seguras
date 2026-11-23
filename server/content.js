/**
 * Contenido del taller.
 *
 * Fuente: «Taller 4 - Entidades seguras en un mundo digital - Preparacion.docx»
 * (documento de preparación interna de Pérez-Llorca, 22/11/2026) y la
 * presentación «Taller 4 - Entidades seguras - Presentacion PLL.pptx».
 *
 * El contenido se sirve al cliente desde /api/config para que exista una
 * única fuente de verdad entre app, panel de dinamización y exportaciones.
 */

/**
 * Bloques de «Lo esencial en 15 minutos» (apartado 2 del documento de
 * preparación). Cuatro bloques de 3-4 minutos.
 *
 * Cada bloque tiene un `mensaje` pensado para la diapositiva y una `nota` con
 * la base normativa, que es material del ponente y NO se proyecta.
 */
export const BLOQUES = [
  {
    id: 'A',
    minutos: 3,
    titulo: 'Qué datos requieren especial cuidado',
    mensaje:
      'Salud, discapacidad, origen, violencia, trata, menores y antecedentes: si los tratáis, vuestra entidad está en el nivel de riesgo alto, aunque sea pequeña.',
    nota:
      'art. 9.1 RGPD (categorías especiales); art. 10 RGPD y art. 10 LOPDGDD (datos penales, incluidos los certificados de delitos sexuales). La situación social o administrativa (por ejemplo, extranjería) no es categoría especial en sí misma, pero puede revelarla y genera un riesgo elevado. El art. 9.2.d RGPD no es una exención general para ONG: se limita a entidades con finalidad política, filosófica, religiosa o sindical y a sus miembros o contactos regulares. Menores: consentimiento propio a partir de 14 años (art. 7 LOPDGDD); por debajo, el de quien tenga la patria potestad o tutela. Una autorización para participar en una actividad no cubre publicar fotos.',
    puntos: [
      'Salud, discapacidad, origen, violencia, trata y menores',
      'La situación social o administrativa no es categoría especial, pero puede revelarla',
      'El art. 9.2.d no exime a las ONG'
    ]
  },
  {
    id: 'B',
    minutos: 4,
    titulo: 'Qué exige hoy la protección de datos',
    mensaje:
      'Ser pequeño o no tener ánimo de lucro no exime. Lo que hay que poder demostrar es: qué datos tenemos, para qué, quién accede, qué proveedores los ven y qué hacemos si algo sale mal.',
    nota:
      'responsabilidad proactiva (arts. 5.2 y 24 RGPD); base jurídica (art. 6); información en capas y en lenguaje adaptado (arts. 13-14 RGPD; art. 11 LOPDGDD); registro de actividades (art. 30 RGPD; la excepción de menos de 250 empleados no opera si el tratamiento no es ocasional o incluye categorías especiales, que es lo habitual en el sector); contrato con encargados (art. 28); seguridad (art. 32); brechas: notificación a la AEPD en 72 horas si hay riesgo y a las personas afectadas si el riesgo es alto (arts. 33-34); confidencialidad de todo el que interviene, también el voluntariado (art. 5 LOPDGDD). DPD: no es obligatorio por ser ONG, sino según la actividad (art. 37 RGPD y art. 34 LOPDGDD: p. ej., centros sanitarios o docentes, o tratamiento a gran escala de categorías especiales). Entidades con menores: LOPIVI (protocolos, delegado de protección en los ámbitos que lo exigen) y certificación negativa del Registro Central de Delincuentes Sexuales para personal y voluntariado con contacto habitual (art. 57 LO 1/1996).',
    puntos: [
      'Qué datos, para qué, quién accede y qué proveedores los ven',
      'Registro de actividades (art. 30): la excepción de los 250 empleados no suele operar',
      'Brechas: 72 h a la AEPD y aviso a las personas si el riesgo es alto',
      'El DPD depende de la actividad, no de ser ONG'
    ]
  },
  {
    id: 'C',
    minutos: 4,
    titulo: 'Amenazas de ciberseguridad más frecuentes',
    mensaje:
      'Los ataques al tercer sector no suelen ser sofisticados: correos que suplantan a la dirección o a un financiador, contraseñas reutilizadas, móviles personales y ausencia de copias de seguridad.',
    habitos: [
      'Doble factor en correo y banca',
      'Copias de seguridad probadas',
      'Ningún cambio de cuenta bancaria sin confirmar por teléfono a un número ya conocido'
    ],
    nota:
      'NIS2 (Directiva (UE) 2022/2555) no se aplica por ser ONG, sino si la entidad presta servicios de sus anexos (p. ej., sanitarios) y alcanza el tamaño de mediana empresa, o es designada como crítica; si se aplica, el órgano de dirección aprueba y supervisa las medidas y debe formarse (art. 20). España no ha traspuesto NIS2: el Anteproyecto de Ley de coordinación y gobernanza de la ciberseguridad ha decaído con la convocatoria de elecciones, por lo que hoy no hay obligaciones nacionales de transposición exigibles y sigue vigente el marco anterior (RDL 12/2018 y RD 43/2021), que solo alcanza a operadores de servicios esenciales y proveedores de servicios digitales, no a la generalidad del sector. Mensaje para la sala: no esperar a la ley; las obligaciones del RGPD ya se aplican. Las entidades que gestionan servicios o sistemas para la Administración pueden quedar sujetas al ENS (RD 311/2022). Para todas: art. 32 RGPD. Patronos: diligencia de un representante leal y responsabilidad por daños causados sin la diligencia debida (art. 17 Ley 50/2002). En asociaciones, los miembros de la junta directiva responden ante la asociación, los asociados y terceros por los daños causados por actos dolosos, culposos o negligentes y por los acuerdos que hubieran votado; si no puede imputarse a nadie en concreto, la responsabilidad es solidaria salvo para quien acredite que no participó o se opuso (art. 15.3 a 15.5 LO 1/2002).',
    puntos: [
      'Doble factor, copias probadas y confirmación por teléfono',
      'NIS2 no se aplica a las ONG; sigue vigente el marco anterior (RDL 12/2018 y RD 43/2021)',
      'El ENS (RD 311/2022) puede alcanzar a quien gestione sistemas de la Administración',
      'Responsabilidad de la junta directiva (art. 15.3 a 15.5 LO 1/2002)'
    ]
  },
  {
    id: 'D',
    minutos: 4,
    titulo: 'El nuevo marco europeo de IA para quien la utiliza',
    mensaje:
      'Si vuestra entidad usa IA para su trabajo, sois «responsables del despliegue». Ya hoy tenéis que formar a vuestros equipos, no podéis usar IA que explote la vulnerabilidad de las personas y, si un chatbot habla con usuarios, debe decir que es una máquina.',
    semaforoIA: [
      {
        estado: 'verde',
        titulo: 'Verde',
        usos:
          'Redactar borradores, traducir, resumir documentos sin datos personales, preparar memorias o convocatorias, siempre con revisión humana.'
      },
      {
        estado: 'ambar',
        titulo: 'Ámbar',
        usos:
          'Herramientas corporativas con datos personales (requieren contrato con el proveedor, sin entrenamiento con nuestros datos, minimización y, en su caso, evaluación de impacto); chatbots de atención (transparencia y opción de hablar con una persona).'
      },
      {
        estado: 'rojo',
        titulo: 'Rojo',
        usos:
          'Introducir datos de personas atendidas en herramientas gratuitas o cuentas personales; decidir ayudas, admisiones o candidaturas solo con la puntuación de una IA; herramientas que infieran emociones de trabajadores o manipulen a personas vulnerables.'
      }
    ],
    nota:
      'Reglamento (UE) 2024/1689: responsable del despliegue (art. 3.4); alfabetización en IA aplicable desde el 2 de febrero de 2025 (art. 4); prácticas prohibidas, entre ellas la explotación de vulnerabilidades por edad, discapacidad o situación social o económica (art. 5.1.b), la puntuación social (art. 5.1.c) y el reconocimiento de emociones en el trabajo (art. 5.1.f); transparencia de chatbots y contenidos sintéticos (art. 50, aplicable desde el 2 de agosto de 2026); alto riesgo en empleo y selección (anexo III.4) y acceso a prestaciones públicas esenciales (anexo III.5), con obligaciones del art. 26. Tras la modificación por el Reglamento (UE) 2026/1744 («Digital Omnibus»), las obligaciones del anexo III se aplican desde el 2 de diciembre de 2027 (ya no desde agosto de 2026). El Reglamento de IA no desplaza al RGPD (art. 2.7) ni al art. 22 RGPD sobre decisiones automatizadas.',
    puntos: [
      'Responsable del despliegue (art. 3.4) y alfabetización desde el 2/02/2025 (art. 4)',
      'Prohibiciones: art. 5.1.b, 5.1.c (puntuación social) y 5.1.f (emociones en el trabajo)',
      'Transparencia de chatbots (art. 50) desde el 2/08/2026',
      'Alto riesgo del anexo III desde el 2/12/2027 tras el «Digital Omnibus» (Reglamento (UE) 2026/1744)'
    ]
  }
];

/**
 * Objetivos y resultados esperados (apartado 1 del documento de preparación).
 */
export const OBJETIVOS = [
  'Ayudar a reconocer los riesgos más habituales al tratar datos de personas atendidas, voluntariado, donantes y equipos, y al usar herramientas digitales y de IA.',
  'Distinguir qué usos de la IA son razonables, cuáles requieren precauciones y cuáles conviene evitar.',
  'Ofrecer un conjunto de medidas mínimas, proporcionadas al tamaño y a los recursos de cada entidad.',
  'Recoger retos y necesidades comunes que puedan alimentar la agenda de la Red Solidaria para 2027.'
];

export const RESULTADOS_ESPERADOS = [
  'Cada entidad sale con un autodiagnóstico básico y tres acciones prioritarias adaptadas a su realidad.',
  'Pautas sencillas para el uso responsable de la IA que pueden trasladarse a sus equipos y voluntariado.',
  'Un mapa de retos y necesidades comunes para la Red Solidaria y las necesidades más votadas para el cierre.'
];

/**
 * Puntos que conviene verificar antes del taller (apartado 7).
 */
export const VERIFICACIONES = [
  {
    id: 'fechas-ia',
    titulo: 'Fechas del Reglamento de IA',
    detalle:
      'Muchas presentaciones siguen diciendo «agosto de 2026» para el alto riesgo. Tras el Reglamento (UE) 2026/1744 la fecha es el 2 de diciembre de 2027 para el anexo III; el art. 50 ya se aplica desde el 2 de agosto de 2026. Confirmar con el texto consolidado en EUR-Lex.'
  },
  {
    id: 'nis2',
    titulo: 'NIS2',
    detalle:
      'Si se reactiva la tramitación tras las elecciones, actualizar el bloque C.'
  },
  {
    id: 'jurisprudencia',
    titulo: 'Jurisprudencia de 2026',
    detalle:
      'STS 787/2026 y Auto del TS de 29 de octubre de 2026, y la Advertencia AEPD AI-00009-2026: comprobar la referencia exacta si se van a mencionar en la presentación.'
  },
  {
    id: 'logistica',
    titulo: 'Logística',
    detalle:
      'Wifi para invitados, número de mesas (para asignar casos) y copias de respaldo.'
  },
  {
    id: 'acuerdos',
    titulo: 'Acuerdos con Fresno y con el alojamiento',
    detalle:
      'Acuerdo sobre el papel de cada parte (encargo del art. 28 o corresponsabilidad del art. 26 RGPD), aunque Fresno solo reciba agregados, y con el proveedor de alojamiento de la app (art. 28 RGPD).'
  }
];

/**
 * Agenda del taller.
 *
 * `vista` indica la pantalla de la app a la que salta el participante cuando
 * toca ese momento desde la pantalla de inicio. Los bloques que dirige el
 * ponente y que no tienen contenido en la app («Lo esencial» y «Puesta en
 * común») se dejan sin `vista`: aparecen en la lista, pero sin botón, porque
 * no hay a dónde saltar.
 */
export const AGENDA = [
  { min: 10, titulo: 'Termómetro digital', detalle: 'Tres preguntas desde el móvil', vista: 'termometro' },
  { min: 15, titulo: 'Lo esencial', detalle: 'Datos, ciberseguridad e IA, sin tecnicismos' },
  { min: 20, titulo: 'Casos en mesas', detalle: 'Un escenario real por mesa', vista: 'mesas' },
  { min: 25, titulo: 'Puesta en común', detalle: 'Respuesta práctica a cada caso' },
  { min: 10, titulo: 'Semáforo', detalle: '10 medidas y 3 prioridades', vista: 'semaforo' },
  { min: 10, titulo: 'Necesidades del sector', detalle: 'Publicación y votación en directo', vista: 'retos' }
];

export const TERMOMETRO = [
  {
    id: 'ia',
    pregunta: '¿Usáis ya herramientas de IA (ChatGPT, Copilot…) en el trabajo diario?',
    tipo: 'una',
    opciones: [
      'Sí, con herramientas de la entidad',
      'Sí, cada uno las suyas',
      'No',
      'No lo sé'
    ]
  },
  {
    id: 'incidentes',
    pregunta: '¿Habéis sufrido algún incidente en los dos últimos años?',
    tipo: 'varias',
    opciones: [
      'Phishing o suplantación',
      'Pérdida o robo de información o dispositivos',
      'Fraude en pagos',
      'Ninguno',
      'Prefiero no responder'
    ]
  },
  {
    id: 'pautas',
    pregunta: '¿Tenéis pautas internas sobre el uso de IA y de herramientas digitales?',
    tipo: 'una',
    opciones: [
      'Sí, escritas',
      'Informales',
      'No'
    ]
  }
];

export const CASOS = [
  {
    id: 1,
    titulo: 'Un informe social en una IA gratuita',
    escenario:
      'Una técnica sube a una herramienta de IA gratuita el informe social de una persona atendida para resumirlo.',
    preguntas: [
      { id: 'riesgo', etiqueta: '¿Qué riesgo veis?' },
      { id: 'hacer', etiqueta: '¿Qué haríais?' },
      { id: 'necesidad', etiqueta: '¿Qué necesitaría vuestra entidad para evitarlo?' }
    ],
    mensaje:
      'Herramienta gratuita = datos fuera de vuestro control. Para datos de personas atendidas, solo herramientas autorizadas por la entidad.',
    /* Guía de resolución para el dinamizador. No se muestra a los participantes. */
    resolucion: {
      riesgo: [
        'Datos de salud, violencia o familia en manos de un tercero sin contrato',
        'El proveedor puede guardarlos, entrenar con ellos y tratarlos fuera de la UE',
        'Quitar el nombre no basta: el contexto (localidad, fechas, situación) sigue identificando'
      ],
      hacer: [
        'Usar IA para resumir sí, pero con herramienta corporativa aprobada por la entidad',
        'Contrato de encargado (art. 28 RGPD) y entrenamiento desactivado',
        'Solo los datos necesarios y revisión profesional del resultado'
      ],
      siYaHaPasado: [
        'Parar y guardar evidencias; identificar qué se envió y desde qué cuenta',
        'Borrar historial y pedir supresión al proveedor',
        'Evaluar y documentar si es una brecha (AEPD en 72 h si hay riesgo)',
        'Revisar pautas y formar al equipo'
      ],
      norma: 'Arts. 5, 6, 9, 28, 32-34 y 44 y ss. RGPD; art. 5 LOPDGDD; art. 4 Reglamento de IA. Directrices 07/2020 del CEPD y Advertencia AI-00009-2026 de la AEPD.'
    }
  },
  {
    id: 2,
    titulo: 'El correo urgente para cambiar la cuenta',
    escenario:
      'Llega un correo, aparentemente de la dirección o de un financiador, pidiendo cambiar urgentemente la cuenta de pago de una subvención.',
    preguntas: [
      { id: 'riesgo', etiqueta: '¿Qué riesgo veis?' },
      { id: 'hacer', etiqueta: '¿Qué haríais?' },
      { id: 'necesidad', etiqueta: '¿Qué necesitaría vuestra entidad para evitarlo?' }
    ],
    mensaje:
      'Ningún cambio de cuenta se confirma por el mismo canal por el que se pide.',
    resolucion: {
      riesgo: [
        'Fraude de suplantación: la urgencia y la autoridad aparente son la señal de alarma',
        'Puede indicar además que la cuenta de correo de la entidad o del financiador está comprometida',
        'Riesgo de perder la subvención y de reintegro'
      ],
      hacer: [
        'No responder ni usar los datos de contacto del correo',
        'Confirmar por teléfono a un número previamente conocido',
        'Doble autorización interna para cualquier cambio de IBAN o pago urgente',
        'No ignorar el aviso de «nombre no coincidente» de la verificación del beneficiario'
      ],
      siYaHaPasado: [
        'Avisar de inmediato al banco y pedir la retrocesión; denunciar',
        'Conservar correos y encabezados; cambiar contraseñas y revisar reglas de reenvío',
        'Valorar si hay brecha de datos; comunicar el incidente al financiador por canal seguro'
      ],
      norma: 'Verificación del beneficiario obligatoria en la zona euro desde el 9/10/2025 (Reglamento 260/2012, art. 5 quater); arts. 44-46 RDL 19/2018; STS 787/2026 (reparto de responsabilidad al 50 %); art. 17 Ley 50/2002.'
    }
  },
  {
    id: 3,
    titulo: 'WhatsApp con datos y fotos de menores',
    escenario:
      'Voluntarios gestionan por WhatsApp desde sus móviles personales datos y fotografías de menores, y algunas imágenes acaban en redes sociales.',
    preguntas: [
      { id: 'riesgo', etiqueta: '¿Qué riesgo veis?' },
      { id: 'hacer', etiqueta: '¿Qué haríais?' },
      { id: 'necesidad', etiqueta: '¿Qué necesitaría vuestra entidad para evitarlo?' }
    ],
    mensaje:
      'Las fotos de menores son de la entidad, no de quien las hace: canal corporativo, autorización por escrito y revisión antes de publicar.',
    resolucion: {
      riesgo: [
        'Copias en galerías y nubes personales, reenvíos y publicación',
        'Doble plano: protección de datos y derecho a la propia imagen del menor',
        'El voluntariado actúa bajo la autoridad de la entidad y la entidad responde'
      ],
      hacer: [
        'Canales y dispositivos corporativos o, como mínimo, reglas escritas',
        'Autorizaciones específicas por canal y finalidades, revocables, y preferencia por imágenes no identificables',
        'Revisión antes de publicar; formación y confidencialidad del voluntariado'
      ],
      siYaHaPasado: [
        'Retirar la publicación, pedir retirada de republicaciones y documentar',
        'Informar a las familias y evaluar la brecha (72 h)',
        'Activar el protocolo de protección infantil si hay riesgo de daño'
      ],
      norma: 'Art. 29 RGPD (voluntariado); arts. 25 y 32 RGPD; art. 7 LOPDGDD; LO 1/1996 y LO 1/1982 (imagen del menor); Ley 45/2015 de Voluntariado (arts. 11.b y 8.4); LOPIVI; art. 57 LO 1/1996.'
    }
  },
  {
    id: 4,
    titulo: 'El chatbot o la IA «gratis» de un proveedor',
    escenario:
      'Un proveedor ofrece gratis un chatbot o una herramienta de IA para atender a personas usuarias o preseleccionar candidaturas.',
    preguntas: [
      { id: 'riesgo', etiqueta: '¿Qué riesgo veis?' },
      { id: 'hacer', etiqueta: '¿Qué haríais?' },
      { id: 'necesidad', etiqueta: '¿Qué necesitaría vuestra entidad para evitarlo?' }
    ],
    mensaje:
      'La IA puede ayudar a atender o a ordenar, pero no decide sola sobre personas.',
    resolucion: {
      riesgo: [
        'Si es gratis, hay que preguntarse cuál es el precio: uso de los datos o de las candidaturas para fines propios del proveedor',
        'En atención a personas usuarias: errores, falta de transparencia y datos sensibles',
        'En selección: sesgos y decisiones sin intervención humana real'
      ],
      hacer: [
        'Saber qué hace el proveedor con los datos; si los usa para sí no es un mero encargado (contrato art. 28 RGPD)',
        'Evaluación de impacto si hay datos sensibles, personas vulnerables o selección',
        'Avisar claro de que se habla con una IA y ofrecer una persona',
        'Revisión humana capaz de apartarse del resultado; descartar funciones que infieran emociones'
      ],
      siYaHaPasado: [
        'Suspender el uso y revisar el contrato',
        'Informar a las personas afectadas',
        'Revisar decisiones tomadas solo con la puntuación de la IA'
      ],
      norma: 'Arts. 22, 28 y 35 RGPD; TJUE C-634/21 (SCHUFA), C-40/17 (Fashion ID) y C-210/16 (Wirtschaftsakademie) sobre corresponsabilidad; Reglamento (UE) 2024/1689: art. 50 (chatbots), anexo III.4 y art. 26 (selección, aplicable desde el 2/12/2027), art. 5 (prohibiciones); art. 64.4.d del Estatuto de los Trabajadores (información al comité sobre los algoritmos); Ley 15/2022, art. 23.3 (deber de promoción, no obligación concreta); Advertencia AI-00009-2026 de la AEPD.'
    }
  }
];

export const SEMAFORO = [
  { n: 1, medida: 'Sabemos qué datos sensibles tratamos, dónde están y quién accede', verdeSi: 'Hay un inventario o registro de actividades actualizado' },
  { n: 2, medida: 'Cada persona usa su propia cuenta, con doble factor en correo, banca y nube', verdeSi: 'No hay contraseñas compartidas y el doble factor está activado' },
  { n: 3, medida: 'Copias de seguridad periódicas y probadas', verdeSi: 'Hay copia automática, una fuera de línea, y se ha probado restaurarla' },
  { n: 4, medida: 'Pagos: doble verificación de cualquier cambio de cuenta y doble autorización', verdeSi: 'Existe una regla escrita y la verificación del beneficiario del banco está activa' },
  { n: 5, medida: 'Los proveedores que nos ven datos los conocemos y tienen contrato de encargado', verdeSi: 'Sabemos cuáles nos ven datos y todos tienen contrato: nube, CRM, gestoría, donaciones, IA' },
  { n: 6, medida: 'Pauta escrita de uso de IA', verdeSi: 'Hay herramientas autorizadas y una lista de datos que nunca se introducen' },
  { n: 7, medida: 'Formación anual en datos, ciberseguridad e IA', verdeSi: 'Incluye a equipo, voluntariado y patronato, y queda registrada' },
  { n: 8, medida: 'Imágenes y comunicaciones con menores y personas atendidas', verdeSi: 'Autorizaciones específicas por escrito y canales corporativos, no móviles personales' },
  { n: 9, medida: 'Tenemos un protocolo de actuación definido en caso de incidentes', verdeSi: 'Está escrito, el equipo lo conoce y sabemos a quién avisar y con qué plazo' },
  { n: 10, medida: 'Altas y bajas de accesos', verdeSi: 'Cuando alguien entra o sale (también voluntariado), se dan o retiran permisos ese mismo día' }
];

export const ESTADOS_SEMAFORO = [
  { valor: 'verde', etiqueta: 'Lo tenemos', corto: 'Verde' },
  { valor: 'ambar', etiqueta: 'A medias o sin documentar', corto: 'Ámbar' },
  { valor: 'rojo', etiqueta: 'No lo tenemos', corto: 'Rojo' }
];

export const CATEGORIAS_RETO = [
  'Formación',
  'Recursos técnicos',
  'Asesoramiento jurídico',
  'Proveedores',
  'Financiación',
  'Cultura interna'
];

/**
 * Áreas del sector: las propuestas iniciales que se votan desde el
 * principio, junto con las necesidades que escriben los asistentes.
 *
 * No son una categoría obligatoria de la necesidad: la necesidad se publica
 * tal cual, al mismo nivel que estas áreas. Lo que se vota es el conjunto.
 */
export const AREAS_SECTOR = [
  {
    id: 'area-formacion',
    titulo: 'Formación',
    propuesta: 'Formación práctica para el equipo y el voluntariado: IA, datos y ciberseguridad'
  },
  {
    id: 'area-recursos',
    titulo: 'Recursos técnicos',
    propuesta: 'Herramientas y servicios digitales a un precio asumible para entidades pequeñas'
  },
  {
    id: 'area-juridico',
    titulo: 'Asesoramiento jurídico',
    propuesta: 'Asesoramiento jurídico accesible y adaptado a la realidad de las entidades pequeñas'
  },
  {
    id: 'area-proveedores',
    titulo: 'Proveedores',
    propuesta: 'Modelos de contrato y condiciones claras con los proveedores que ven nuestros datos (nube, CRM, IA)'
  },
  {
    id: 'area-financiacion',
    titulo: 'Financiación',
    propuesta: 'Financiación para proyectos de tecnología, datos y formación del voluntariado'
  },
  {
    id: 'area-cultura',
    titulo: 'Cultura interna',
    propuesta: 'Que la protección de datos y el uso responsable de la IA formen parte del día a día de la entidad'
  }
];

export const IDEAS_INICIALES = [
  { texto: 'Formación práctica en IA para equipos y voluntariado', categoria: 'Formación' },
  { texto: 'Asesoría jurídica accesible para entidades pequeñas', categoria: 'Asesoramiento jurídico' },
  { texto: 'Modelo de contrato con proveedores de IA que sea reutilizable', categoria: 'Proveedores' }
];

export const MENSAJES_CIERRE = [
  'Herramienta gratuita = datos fuera de vuestro control',
  'Ningún cambio de cuenta se confirma por el mismo canal por el que se pide',
  'Las fotos de menores son de la entidad, no de quien las hace',
  'La IA ayuda, pero no decide sola sobre personas'
];

export const AVISO_TEXTO_LIBRE =
  'No escribáis nombres, datos de contacto, el nombre de vuestra entidad ni detalles que permitan identificar a personas o incidentes concretos.';

export const AVISO_TEXTO_LIBRE_UI =
  'No escribas nombres, datos de contacto, el nombre de tu entidad ni detalles de incidentes concretos.';

export const INFO_LEGAL_CORTA =
  'Esta app se usa solo para las actividades del taller. No hace falta registrarse ni dar datos personales. No escribas nombres, datos de contacto, el nombre de tu entidad ni detalles de incidentes concretos. Las respuestas se guardan con seudónimo, se borran a los 10 días y los resultados agregados podrán compartirse con la Fundación Fresno para una publicación.';

/** Texto largo (capa 2) de la información del art. 13 RGPD. */
export function infoLegalLarga(legal, evento, retentionDays, enlace) {
  return [
    {
      titulo: 'Responsable del tratamiento',
      texto: `${legal.responsable} — ${legal.responsableCargo}. Contacto: ${legal.contacto}.`
    },
    {
      titulo: 'Finalidades',
      texto:
        'a) Dinámica de la sesión del taller: termómetro digital, respuestas de los casos en mesas, autodiagnóstico «semáforo» y recogida de las necesidades del sector. b) Elaboración de la pieza de conocimiento agregada de la Red Solidaria.'
    },
    {
      titulo: 'Base jurídica',
      texto: legal.baseLegal
    },
    {
      titulo: 'No hace falta dar datos personales',
      texto:
        'No hay registro, ni cuentas, ni formulario de identificación. Cada sesión recibe un código aleatorio que no está ligado a ninguna persona y que solo se guarda en el navegador mientras dura la sesión. No se piden ni el nombre, ni el de la entidad, ni datos de contacto.'
    },
    {
      titulo: 'Datos que se guardan',
      texto:
        'Un identificador seudónimo por sesión, tus respuestas al cuestionario, tus respuestas a los casos, la valoración de las 10 medidas del semáforo, las prioridades elegidas y las categorías de reto que marques. Las respuestas de texto libre se guardan para que la dinamización las revise, y no se exportan nunca sin depuración previa.'
    },
    {
      titulo: 'Destinatarios',
      texto: `${legal.entidadAlojamiento}, que trata por cuenta propia. ${legal.destinatarioExterno} recibirá únicamente resultados agregados, sin seudónimos, sin respuestas individuales y sin los textos originales.`
    },
    {
      titulo: 'Conservación',
      texto: `Los datos brutos se borran automáticamente ${retentionDays} días después de la fecha del taller. En ese momento solo se conservan los recuentos agregados, que no son datos personales.`
    },
    {
      titulo: 'Cookies, analítica y terceros',
      texto:
        'La app no utiliza cookies, ni analítica, ni píxeles, ni fuentes o recursos de terceros. No se guardan direcciones IP ni identificadores de dispositivo: el servidor está configurado para no registrarlos.'
    },
    {
      titulo: 'Tus derechos',
      texto:
        'Puedes pedir el acceso, la rectificación, la supresión, la limitación y la oposición sobre tus respuestas (arts. 15 a 22 RGPD) escribiendo a ' + legal.contacto + '. No hay decisiones automatizadas ni elaboración de perfiles.'
    }
  ];
}
