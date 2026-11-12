<p align="center">
  <img src="assets/logo-final.png" alt="Logo de Yara" width="260">
</p>

<h1 align="center">Yara</h1>

<p align="center"><strong>Aprender sin límites</strong><br>
Una plataforma educativa inclusiva para aprender a tu ritmo.</p>

<p align="center">
  <a href="https://yara-4v3b.onrender.com/">Abrir Yara</a>
</p>

<p align="center">
  <a href="https://yara-4v3b.onrender.com/">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https%3A%2F%2Fyara-4v3b.onrender.com%2F" alt="Código QR para abrir Yara" width="180" height="180">
  </a>
  <br><sub>Escanea el código para entrar a la aplicación.</sub>
</p>

---

## ¿Qué es Yara?

Yara es un proyecto pedagógico que busca acercar el aprendizaje a personas de distintas edades, idiomas y experiencias educativas. Ofrece recorridos progresivos y actividades interactivas de lengua, matemáticas y tecnología, con ejercicios que se adaptan al nivel y avance de cada persona.

La experiencia está diseñada con foco en la inclusión y la accesibilidad: incorpora lectura en voz alta, soporte multilingüe, ajustes para distintas edades, recursos visuales y uso sin conexión después de la primera visita. Incluye un tutor educativo con IA como apoyo opcional; la aplicación puede funcionar sin configurar un proveedor de IA.

## Tecnologías

| <img src="https://img.shields.io/badge/Preact-673AB8?style=for-the-badge&logo=preact&logoColor=white" alt="Preact"> | <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"> | <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"> | <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"> | <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"> |
|:---:|:---:|:---:|:---:|:---:|
| <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"> | <img src="https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white" alt="SQLAlchemy"> | <img src="https://img.shields.io/badge/Alembic-333333?style=for-the-badge" alt="Alembic"> | <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"> | <img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black" alt="Render"> |

## Cómo empezar

### Requisitos

- Python 3.12 o posterior
- [uv](https://docs.astral.sh/uv/)
- Node.js 22 o posterior y [pnpm](https://pnpm.io/)
- SQLite para desarrollo local (configuración predeterminada), o PostgreSQL si defines una URL de base de datos

### 1. Configurar y ejecutar la API

Desde la raíz del repositorio:

```bash
cd apps/api
uv sync
uv run alembic upgrade head
uv run python -m yara_api.cli seed
YARA_TUTOR_PROVIDER=fake uv run uvicorn yara_api.main:create_app --factory --port 8000
```

La API queda disponible en `http://localhost:8000`. El proveedor `fake` permite probar el tutor sin una clave de servicio externo. Para desactivarlo, puedes usar `YARA_TUTOR_PROVIDER=none`.

### 2. Ejecutar la aplicación web

En otra terminal, desde la raíz del repositorio:

```bash
cd apps/web
pnpm install
pnpm dev
```

Abre la dirección que muestra Vite (normalmente `http://localhost:5173`). En desarrollo, Vite reenvía las peticiones `/v1` a la API local.

### Variables de entorno

La configuración de ejemplo está en [`apps/api/.env.example`](apps/api/.env.example). Puedes copiarla a `apps/api/.env` y modificarla según tu entorno. No compartas secretos ni claves de servicios externos.

Para usar PostgreSQL, configura `YARA_DATABASE_URL`, por ejemplo:

```dotenv
YARA_DATABASE_URL=postgresql+psycopg://usuario:contraseña@localhost:5432/yara
```

Para compilar la web y comprobar los tipos:

```bash
cd apps/web
pnpm build
```

## Arquitectura

Yara es una aplicación web con dos partes principales: un cliente Preact y una API FastAPI. En producción, el `Dockerfile` compila el cliente y lo sirve desde la misma aplicación que la API.

```mermaid
flowchart LR
    A[Persona usuaria] --> W[Cliente web<br/>Preact + TypeScript]
    W -->|API REST /v1| B[API<br/>FastAPI]
    W -->|Contenido y progreso local| C[Almacenamiento del dispositivo]
    B --> D[(Base de datos<br/>SQLite o PostgreSQL)]
    B --> E[Contenido pedagógico<br/>JSON y recursos]
    B --> F[Tutor IA opcional<br/>Anthropic]
    B --> G[Audio opcional<br/>Azure Speech]
```

- **Cliente web (`apps/web`)**: interfaz, actividades, accesibilidad, localización y almacenamiento/caché local para apoyar el uso sin conexión.
- **API (`apps/api`)**: endpoints de cuentas, contenido, progreso y tutor; valida solicitudes y aplica las políticas de seguridad.
- **Contenido (`content`)**: currículo, conceptos, preguntas, recursos, traducciones e imágenes que se cargan a la base de datos mediante el comando `seed`.
- **Persistencia**: SQLAlchemy gestiona los datos y Alembic las migraciones. El progreso también se conserva primero en el dispositivo y se sincroniza cuando hay conexión.
- **Despliegue**: Docker reúne el frontend y la API; [`render.yaml`](render.yaml) configura el servicio web y PostgreSQL en Render.

## Carpetas principales

```text
.
├── apps/
│   ├── api/                 # API FastAPI, modelos, migraciones y pruebas
│   │   ├── yara_api/        # Lógica, endpoints y tutor
│   │   ├── migrations/      # Migraciones de base de datos (Alembic)
│   │   └── tests/           # Pruebas de la API
│   └── web/                 # Aplicación Preact + TypeScript
│       └── src/             # Componentes, pantallas, lógica y estilos
├── assets/                  # Identidad visual del proyecto
├── content/                 # Currículo, imágenes, traducciones y políticas
├── docs/                    # Documentación funcional y de despliegue
├── scripts/                 # Herramientas de desarrollo
├── Dockerfile               # Imagen de producción
└── render.yaml              # Configuración de despliegue en Render
```

## Base de datos

El esquema se define mediante modelos SQLAlchemy en `apps/api/yara_api/models.py` y se actualiza con migraciones de Alembic en `apps/api/migrations/versions/`. La aplicación admite SQLite para desarrollo local y PostgreSQL para despliegues. Al iniciar el contenedor se aplican las migraciones y se cargan los datos pedagógicos.

Entre las entidades principales se encuentran cuentas y sesiones, progreso por materia y lección, uso del tutor y contenido (lecciones, conceptos, preguntas, recursos, políticas e imágenes). El contenido de origen vive en `content/` y se importa con `python -m yara_api.cli seed`.

## Fuentes y referencias pedagógicas

El currículo y los recursos educativos se mantienen en [`content/`](content/); los principios pedagógicos y de accesibilidad están documentados en [`docs/REGLAS_APRENIA.md`](docs/REGLAS_APRENIA.md) y [`docs/frontend.md`](docs/frontend.md). Las políticas de protección y uso responsable de IA incluyen referencias a:

- [Convención sobre los Derechos del Niño](https://www.ohchr.org/en/instruments-mechanisms/instruments/convention-rights-child) y [Observación general núm. 25 sobre los derechos de la infancia en el entorno digital](https://www.ohchr.org/en/documents/general-comments-and-recommendations/general-comment-no-25-2021-childrens-rights-relation).
- [Orientaciones de UNESCO sobre IA generativa en educación e investigación](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research) y [Recomendación de UNESCO sobre la ética de la inteligencia artificial](https://www.unesco.org/en/artificial-intelligence/recommendation-ethics).
- [Orientaciones de UNICEF sobre IA y niñez](https://www.unicef.org/innocenti/reports/policy-guidance-ai-children).
- [Reglamento General de Protección de Datos de la Unión Europea](https://eur-lex.europa.eu/eli/reg/2016/679/oj) y [Ley Orgánica 3/2018 de España](https://www.boe.es/eli/es/lo/2018/12/05/3/con).

El detalle de las políticas utilizadas por la aplicación se encuentra en [`content/policy.json`](content/policy.json).

## Integrantes y contribuciones

Gracias a las personas que han contribuido al proyecto:

- [yohperez](https://github.com/yohperez)
- [Isabela-Tellez](https://github.com/Isabela-Tellez)

Las contribuciones al repositorio pueden consultarse en la [página de contribuidores](https://github.com/yohperez/Yara/graphs/contributors). Si formas parte del equipo y falta tu nombre, puedes abrir un Pull Request para actualizar esta sección.

## Proyecto pedagógico y licencia

Yara es un proyecto pedagógico y tecnológico sin fines de lucro orientado a facilitar el acceso inclusivo al aprendizaje. El tutor de IA es una herramienta de apoyo y no sustituye el acompañamiento docente ni la revisión pedagógica de los contenidos.

El código de este repositorio se distribuye bajo la [licencia MIT](LICENSE).
