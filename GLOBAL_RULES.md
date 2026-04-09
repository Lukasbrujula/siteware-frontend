# REGLAS GLOBALES DE DESARROLLO

> **IDE:** Google Antigravity  
> **AI Models:** Claude Opus 4.5 + Sonnet 4.5 Thinking  
> **Stack Principal:** Next.js + TypeScript + Tailwind CSS  
> **Versión:** 1.0  
> **Fecha:** Enero 2026

---

## 📐 FUNDAMENTOS: RESPONSIVE DESIGN

### Principio Rector

El diseño responsive es la práctica de construir interfaces que se adaptan de forma fluida y coherente a cualquier tamaño de pantalla, **sin romper jerarquía visual, usabilidad ni objetivos de negocio**. No consiste en "hacer que se vea bien en móvil y desktop", sino en **diseñar sistemas que reorganicen contenido, espacio y prioridad según el contexto del usuario**.

**El mismo producto, múltiples condiciones reales de uso.**

---

### Ecosistema Correcto

El diseño responsive parte siempre de una **base estable**:

✅ **Tokens de diseño bien definidos**  
✅ **Tipografía escalable**  
✅ **Escala de espaciado consistente**  
✅ **Breakpoints claros**  
✅ **Sistema de layout predecible**

**Sin esto, el responsive se convierte en parches.**

---

### Mobile-First es Obligatorio

```
FLUJO CORRECTO:
1. Definir versión mínima funcional (mobile)
2. Escalar progresivamente hacia tamaños mayores
3. Reorganizar por reflow, no por ocultamiento

❌ NO: Esconder contenido crítico
❌ NO: Duplicar componentes por breakpoint
✅ SÍ: Reorganizar jerarquía visual
✅ SÍ: Ajustar densidad de información
```

---

### Auditoría Antes de Escribir

**Antes de escribir una sola clase o regla, audita la configuración actual:**

```typescript
// Verifica en tailwind.config.ts:
□ Breakpoints definidos y consistentes
□ Theme completo (colors, spacing, typography)
□ Escalas de espaciado coherentes
□ Border radius consistentes
□ Shadows y efectos predefinidos
□ Patrones de layout establecidos
```

**Regla de Oro:**

- Si la configuración es **consistente** → Respétala al 100%
- Si la configuración tiene **inconsistencias** → Modifica solo lo mínimo indispensable para corregirlas
- **Nunca** modifiques por gustos personales o atajos rápidos
- Todo cambio debe **fortalecer el sistema**, no fragmentarlo

---

### Identidad Visual Preservada

Un buen diseño responsive **mantiene identidad visual en todos los tamaños:**

```
DESKTOP:
- No es una versión "más grande"
- Es una versión con más espacio para respirar
- Permite mayor complejidad visual

MÓVIL:
- No es una versión "recortada"
- Es una versión más enfocada
- Prioriza acciones principales
```

**Los componentes no cambian de personalidad entre pantallas, solo de distribución y prioridad.**

---

### Breakpoints Estándar Tailwind

```typescript
// Usa siempre estos breakpoints (mobile-first):
sm:   640px  // Móvil grande / Tablet pequeña
md:   768px  // Tablet
lg:   1024px // Laptop
xl:   1280px // Desktop
2xl:  1536px // Desktop grande

// Ejemplo correcto:
<div className="
  px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16
  text-base sm:text-lg md:text-xl lg:text-2xl
  grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
">
```

---

### Targets Táctiles y Accesibilidad

```typescript
// ✅ Mínimo 44x44px para elementos táctiles
<button className="min-w-[44px] min-h-[44px] p-3">

// ✅ Espaciado adecuado entre elementos interactivos
<nav className="flex gap-4"> // Mínimo 16px entre botones

// ✅ Tipografía legible en móvil (16px base mínimo)
<p className="text-base md:text-lg">

// ✅ Contraste adecuado (WCAG AA: 4.5:1 para texto)
// Verifica siempre en theme de Tailwind
```

---

### Reglas de Implementación Responsive

```typescript
// ❌ NUNCA hagas esto:
<div className="w-[342px]"> // Valor arbitrario
<div className="text-[18.5px]"> // No está en scale
<div className="hidden md:block lg:hidden xl:block"> // Lógica confusa

// ✅ SIEMPRE haz esto:
<div className="w-full max-w-md"> // Sistema de contenedores
<div className="text-lg md:text-xl"> // Escala tipográfica
<div className="hidden lg:block"> // Lógica clara

// ✅ Uso correcto de containers:
<div className="container mx-auto px-4 md:px-6 lg:px-8">
  {/* Contenido centrado con padding responsivo */}
</div>

// ✅ Grid responsivo predecible:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
  {/* Las gaps también escalan */}
</div>

// ✅ Flexbox con wrap inteligente:
<div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
  {/* Vertical en móvil, horizontal en desktop */}
</div>
```

---

### Objetivo Final: Sistema Escalable

**Un sistema responsive bien hecho permite:**

✅ Crecer el producto sin deuda visual  
✅ Agregar features sin rediseños constantes  
✅ Mantener consistencia sin esfuerzo manual  
✅ Onboarding rápido de nuevos desarrolladores  
✅ Testing predecible en todos los tamaños

**Todo se adapta porque todo fue pensado como sistema desde el inicio.**

---

## 🎨 REVALIDACIÓN DE UI

### Rol: Auditor Senior de UI

**Actúa como un auditor senior de UI y sistemas de diseño.** Revisa cuidadosamente toda la interfaz y valida que el diseño responsive cumpla exactamente con lo solicitado.

---

### Proceso de Auditoría

#### 1. Validación de Breakpoints

```typescript
// Verifica en TODOS los breakpoints:
□ Mobile (< 640px)
□ Mobile Large / Tablet Small (640px - 767px)
□ Tablet (768px - 1023px)
□ Laptop (1024px - 1279px)
□ Desktop (1280px - 1535px)
□ Desktop Large (≥ 1536px)

// Confirma:
✓ Enfoque mobile-first implementado
✓ Prefijos responsive correctos (sm:, md:, lg:, xl:, 2xl:)
✓ Uso consistente de prefijos
✓ No hay saltos visuales bruscos entre breakpoints
```

#### 2. Validación del Sistema de Diseño

```typescript
// Confirma que TODOS los estilos provienen de:
✓ tailwind.config.ts (theme extendido)
✓ Clases utilitarias de Tailwind
✓ Componentes del sistema de diseño

// Detecta y rechaza:
❌ Valores arbitrarios: className="w-[342px]"
❌ CSS custom innecesario: style={{ width: '342px' }}
❌ Overrides fuera del sistema
❌ Inline styles sin justificación
❌ Magic numbers

// Si encuentras inconsistencias en el sistema:
1. Documenta la inconsistencia
2. Verifica si fue corregida en tailwind.config
3. Confirma que la corrección fortalece el sistema
4. Valida que sea el cambio mínimo necesario
```

#### 3. Análisis por Componentes

```typescript
// Para cada componente, verifica:

□ IDENTIDAD VISUAL
  - ¿Mantiene personalidad en todos los tamaños?
  - ¿Los cambios son de layout/orden/espaciado?
  - ¿No cambia de estilo entre pantallas?

□ JERARQUÍA TIPOGRÁFICA
  - ¿Respeta la escala tipográfica del sistema?
  - ¿Es legible en todos los tamaños?
  - ¿Los headings mantienen proporción relativa?

□ ESPACIADO
  - ¿Usa la escala de spacing del theme?
  - ¿El espaciado escala proporcionalmente?
  - ¿No hay espacios colapsados en móvil?

□ ESTADOS INTERACTIVOS
  - ¿Hover/focus/active funcionan en desktop?
  - ¿Touch targets son ≥44x44px en móvil?
  - ¿Estados visibles y predecibles?

□ ACCESIBILIDAD BÁSICA
  - ¿Contraste WCAG AA cumplido?
  - ¿Elementos interactivos tienen área táctil adecuada?
  - ¿Orden de tabulación lógico?
  - ¿Etiquetas y aria-labels presentes?

□ CONTENIDO CRÍTICO
  - ¿Nada crítico está oculto?
  - ¿CTAs principales visibles en todos los tamaños?
  - ¿Información esencial accesible?
```

#### 4. Validación de Flujos

```typescript
// Prueba los flujos principales en cada breakpoint:

□ Navegación principal
□ Búsqueda (si aplica)
□ Formularios
□ Checkout / Conversión
□ Login / Signup
□ Carrito / Cart
□ Filtros / Sorting

// Confirma:
✓ Flujos no se rompen en ningún tamaño
✓ Pasos siguen siendo intuitivos
✓ No hay dead-ends
✓ CTAs accesibles en todo momento
```

---

### Formato de Reporte

````markdown
## AUDITORÍA UI - [Nombre del Componente/Página]

### VEREDICTO: ✅ APROBADO / ⚠️ REQUIERE AJUSTES / ❌ NO CUMPLE

### HALLAZGOS

#### Breakpoints

- Mobile: [Estado]
- Tablet: [Estado]
- Desktop: [Estado]

#### Sistema de Diseño

- Fidelidad al theme: [Porcentaje]
- Valores arbitrarios encontrados: [Cantidad]
- Overrides innecesarios: [Lista]

#### Componentes Específicos

**[Componente 1]**

- ✅ Mantiene identidad visual
- ⚠️ Espaciado inconsistente en mobile (usa px-3 en lugar de px-4)
- ❌ CTA principal se oculta en tablet

**[Componente 2]**

- ✅ Cumple todas las validaciones

### DESVIACIONES CRÍTICAS

1. **[Descripción]**
   - Impacto: [Alto/Medio/Bajo]
   - Ubicación: [Componente/Página]
   - Corrección: [Acción mínima requerida]

### CORRECCIONES REQUERIDAS

```typescript
// ANTES (incorrecto):
<div className="w-[342px] px-3">

// DESPUÉS (correcto):
<div className="w-full max-w-sm px-4">
```
````

### CONCLUSIÓN

[Resumen ejecutivo del estado del diseño responsive]

```

---

### Objetivo de la Revalidación

**Confirmar:**
1. Fidelidad al sistema de diseño
2. Consistencia responsive en todos los breakpoints
3. Ausencia de deuda visual o técnica
4. Experiencia de usuario coherente

---

## 🧬 SYSTEM DESIGN: ARQUITECTURA ATÓMICA

### Principio: Diseño Atómico

Organiza **toda la interfaz** siguiendo el modelo de **Atomic Design**. Divide todo en cinco niveles claros y reutilizables.

```

ÁTOMOS
↓
MOLÉCULAS
↓
ORGANISMOS
↓
TEMPLATES
↓
PAGES

````

---

### Nivel 1: Átomos

**Elementos básicos e indivisibles de la UI.**

```typescript
// src/components/atoms/

// Button.tsx - Botón base
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
}

// Input.tsx - Campo de entrada base
// Label.tsx - Etiqueta de texto
// Icon.tsx - Iconos (Lucide React)
// Badge.tsx - Insignias/tags
// Avatar.tsx - Avatar de usuario
// Spinner.tsx - Loading spinner
// Divider.tsx - Línea divisoria

// ✅ Características:
- Una sola responsabilidad
- No contienen otros componentes (excepto primitivos HTML)
- Altamente reutilizables
- Variantes definidas por props
- Estilos 100% del theme
````

---

### Nivel 2: Moléculas

**Combinan átomos para cumplir una función concreta.**

```typescript
// src/components/molecules/

// FormField.tsx
export const FormField = ({ label, error, ...inputProps }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input {...inputProps} />
    {error && <ErrorMessage>{error}</ErrorMessage>}
  </div>
);

// SearchBar.tsx - Input + Button + Icon
// ProductPrice.tsx - Badge + Text formatting
// UserInfo.tsx - Avatar + Name + Role
// Notification.tsx - Icon + Text + Close button
// RatingDisplay.tsx - Stars + Count

// ✅ Características:
- Combinan 2-5 átomos
- Función específica y clara
- Props focalizadas en su propósito
- No conocen contexto de página
```

---

### Nivel 3: Organismos

**Agrupan moléculas para formar secciones completas y funcionales.**

```typescript
// src/components/organisms/

// Header.tsx - Logo + Navigation + SearchBar + UserMenu + Cart
// ProductCard.tsx - Image + Title + Price + Rating + AddToCartButton
// ContactForm.tsx - Multiple FormFields + SubmitButton + Success/Error states
// FilterSidebar.tsx - Multiple FilterGroups + ApplyButton
// Footer.tsx - Logo + LinkGroups + Newsletter + Social

// ✅ Características:
- Secciones completas y autosuficientes
- Combinan múltiples moléculas
- Pueden tener estado interno
- Manejo de lógica de negocio simple
- Reutilizables entre páginas
```

---

### Nivel 4: Templates

**Definen estructura y layout de página sin contenido real.**

```typescript
// src/components/templates/

// HomeTemplate.tsx
export const HomeTemplate = ({
  hero,
  featured,
  categories,
  testimonials
}) => (
  <div className="min-h-screen">
    <Header />
    <main>
      {hero}
      {featured}
      {categories}
      {testimonials}
    </main>
    <Footer />
  </div>
);

// ProductPageTemplate.tsx
// CheckoutTemplate.tsx
// DashboardTemplate.tsx

// ✅ Características:
- Define wireframe/estructura
- Recibe secciones como props/children
- Sin contenido hardcodeado
- Sin lógica de datos
- Establece jerarquía visual
```

---

### Nivel 5: Pages

**Instancias finales con contenido real.**

```typescript
// src/app/page.tsx (Next.js App Router)
export default function HomePage() {
  const products = useFeaturedProducts();

  return (
    <HomeTemplate
      hero={<HeroSection title="Welcome" cta="Shop Now" />}
      featured={<FeaturedProducts products={products} />}
      categories={<CategoryGrid categories={CATEGORIES} />}
      testimonials={<TestimonialCarousel reviews={REVIEWS} />}
    />
  );
}

// ✅ Características:
- Contenido real
- Fetch de datos
- Validación de flujos completos
- Testing de experiencia end-to-end
```

---

### Estructura de Carpetas Completa

```
src/
├── components/
│   ├── atoms/              # Nivel 1
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Label.tsx
│   │   ├── Badge.tsx
│   │   ├── Icon.tsx
│   │   ├── Avatar.tsx
│   │   ├── Spinner.tsx
│   │   └── index.ts        # Exports barrel
│   │
│   ├── molecules/          # Nivel 2
│   │   ├── FormField.tsx
│   │   ├── SearchBar.tsx
│   │   ├── ProductPrice.tsx
│   │   ├── UserInfo.tsx
│   │   ├── RatingDisplay.tsx
│   │   └── index.ts
│   │
│   ├── organisms/          # Nivel 3
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── ProductCard.tsx
│   │   ├── ContactForm.tsx
│   │   ├── FilterSidebar.tsx
│   │   └── index.ts
│   │
│   └── templates/          # Nivel 4
│       ├── HomeTemplate.tsx
│       ├── ProductTemplate.tsx
│       ├── CheckoutTemplate.tsx
│       └── index.ts
│
├── app/                    # Nivel 5 (Next.js App Router)
│   ├── page.tsx           # Homepage
│   ├── shop/
│   │   └── page.tsx       # Shop page
│   ├── product/
│   │   └── [id]/
│   │       └── page.tsx   # Dynamic product page
│   └── layout.tsx         # Root layout
│
├── lib/
│   ├── constants.ts       # Design tokens como constantes
│   ├── types.ts           # TypeScript interfaces
│   └── utils.ts           # Helper functions
│
└── styles/
    └── globals.css        # Tailwind directives + custom CSS mínimo
```

---

### Mejores Prácticas Integradas

```typescript
// 1. DISEÑA DE ABAJO HACIA ARRIBA
// Primero átomos perfectos → luego moléculas → organismos → templates → pages

// 2. UNA SOLA RESPONSABILIDAD
// ✅ Button solo renderiza un botón
// ❌ Button NO maneja lógica de checkout

// 3. PRIORIZA REUTILIZACIÓN SOBRE PERSONALIZACIÓN
// ✅ <Button variant="primary">
// ❌ <PrimaryButton> <SecondaryButton> <TertiaryButton>

// 4. ESTILOS DESACOPLADOS DEL CONTENIDO
interface CardProps {
  children: React.ReactNode; // ✅ Recibe contenido
  variant?: 'default' | 'elevated';
}
// ❌ NO hardcodear: <h2>Título fijo</h2>

// 5. TOKENS DE DISEÑO
const COLORS = {
  primary: 'magenta',
  secondary: 'cyan',
  // ...definidos en tailwind.config
};

// 6. DOCUMENTA VARIANTES Y ESTADOS
/**
 * Button component
 * @param variant - Visual style: 'primary' | 'secondary' | 'ghost'
 * @param size - Size preset: 'sm' | 'md' | 'lg'
 * @param disabled - Disables interaction
 * @example
 * <Button variant="primary" size="lg">Click me</Button>
 */

// 7. NOMBRES SEMÁNTICOS Y CONSISTENTES
// ✅ UserAvatar, ProductCard, CheckoutForm
// ❌ Avatar2, Card_v3, Form1

// 8. PRUEBA EN CONTEXTO REAL
// No des por cerrado un componente hasta probarlo en:
- Múltiples breakpoints
- Con contenido real (corto y largo)
- En diferentes contextos (light/dark, etc)
- Con estados (loading, error, success)
```

---

### Patrón de Componente Completo

```typescript
// components/organisms/ProductCard.tsx

import { Badge, Button, Icon } from '@/components/atoms';
import { ProductPrice, RatingDisplay } from '@/components/molecules';
import { Product } from '@/lib/types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => void;
  featured?: boolean;
}

export const ProductCard = ({
  product,
  onAddToCart,
  featured = false
}: ProductCardProps): JSX.Element => {
  return (
    <article
      className="
        relative
        bg-white dark:bg-gray-900
        rounded-lg
        overflow-hidden
        border border-gray-200 dark:border-gray-800
        transition-transform hover:scale-105
      "
    >
      {/* Badge */}
      {product.badge && (
        <Badge variant={product.badge} className="absolute top-4 right-4 z-10">
          {product.badge}
        </Badge>
      )}

      {/* Image */}
      <div className="aspect-square relative">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className={`
          font-bold
          ${featured ? 'text-xl' : 'text-lg'}
        `}>
          {product.name}
        </h3>

        <ProductPrice
          price={product.price}
          originalPrice={product.originalPrice}
        />

        <RatingDisplay
          rating={product.rating}
          count={product.reviewCount}
        />

        <Button
          variant="primary"
          className="w-full"
          onClick={() => onAddToCart(product.id)}
        >
          <Icon name="shopping-cart" className="mr-2" />
          Agregar al Carrito
        </Button>
      </div>
    </article>
  );
};
```

---

### Objetivo Final del System Design

**Construir interfaces que sean:**

✅ **Escalables** - Agregar features no requiere reescribir componentes  
✅ **Coherentes** - Mismo lenguaje visual en toda la app  
✅ **Mantenibles** - Cambios centralizados afectan todo el sistema  
✅ **Testeables** - Componentes aislados fáciles de probar  
✅ **Documentadas** - Nuevos devs entienden la estructura rápidamente

---

## 🔧 TECNOLOGÍAS Y STACK

### Stack Principal Obligatorio

```typescript
// ✅ SIEMPRE USA:
- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS 3+
- React 18+

// ✅ LIBRERÍAS COMPLEMENTARIAS RECOMENDADAS:
- Framer Motion (animaciones)
- Lucide React (iconos)
- React Hook Form (formularios)
- Zod (validación)
- Zustand o Jotai (estado global ligero)

// ❌ NO USAR:
- Create React App
- JavaScript puro (siempre TypeScript)
- CSS-in-JS (styled-components, emotion)
- CSS Modules
- Redux (preferir Zustand)
```

---

### Configuración Next.js

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimización de imágenes
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Experimental features
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.minimize = true;
    }
    return config;
  },
};

module.exports = nextConfig;
```

---

### Configuración TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Strict mode (obligatorio)
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    // Path aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/app/*": ["./src/app/*"]
    },

    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowJs": false,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

---

### Configuración Tailwind

```javascript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      // Define TODOS los tokens aquí
      colors: {
        // Paleta principal
      },
      fontFamily: {
        // Tipografías
      },
      fontSize: {
        // Escala tipográfica
      },
      spacing: {
        // Espaciado adicional si es necesario
      },
      // ... resto de tokens
    },
  },

  plugins: [],
};

export default config;
```

---

### Patrón de Componente Next.js

```typescript
// src/app/page.tsx

import type { Metadata } from 'next';
import { Header, Footer } from '@/components/organisms';
import { HeroSection } from '@/components/sections';

// ✅ Metadata para SEO
export const metadata: Metadata = {
  title: 'Inicio - Mi Sitio',
  description: 'Descripción optimizada para SEO',
  openGraph: {
    title: 'Inicio - Mi Sitio',
    description: 'Descripción para redes sociales',
    images: ['/og-image.jpg'],
  },
};

// ✅ Server Component (por defecto)
export default function HomePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        <HeroSection />
        {/* Más secciones */}
      </main>
      <Footer />
    </>
  );
}
```

---

## 🔍 SEO TÉCNICO Y ON-PAGE

### Rol: Auditor Senior de SEO

**Actúa siempre como un auditor senior de SEO técnico, on-page y de experiencia de usuario.** Revisa cada proyecto con **mentalidad de motor de búsqueda y de negocio**, no de checklist superficial.

---

### 1. Auditoría Técnica (Base)

```typescript
// ✅ ESTRUCTURA DE URLs
- Limpias y descriptivas: /productos/categoria/nombre-producto
- Sin parámetros innecesarios
- Consistencia en trailing slashes
- HTTPS en toda la app

// ✅ ARQUITECTURA DE INFORMACIÓN
- Máximo 3 clicks desde home a cualquier contenido
- Breadcrumbs implementados
- Sitemap.xml generado automáticamente
- Robots.txt configurado correctamente

// ✅ HTML SEMÁNTICO (CRÍTICO)
<article>       // Contenido principal
<section>       // Secciones
<nav>           // Navegación
<header>        // Encabezado
<footer>        // Pie de página
<aside>         // Contenido relacionado
<main>          // Contenido principal único

// ❌ NO usar solo <div> y <span>

// ✅ JERARQUÍA DE ENCABEZADOS
<h1>            // UNO por página (título principal)
  <h2>          // Secciones principales
    <h3>        // Subsecciones
      <h4>      // Detalles

// ✅ INDEXACIÓN
- Meta robots configurado
- Canonicals implementados
- No-index solo en páginas administrativas
- Sitemap actualizado automáticamente

// ✅ ENLACES INTERNOS
- Anchor text descriptivo
- Links a contenido relacionado
- Estructura de categorías clara
- No hay enlaces rotos
```

---

### 2. SEO On-Page

```typescript
// src/app/producto/[slug]/page.tsx

import type { Metadata } from 'next';

// ✅ METADATA DINÁMICA
export async function generateMetadata({
  params
}): Promise<Metadata> {
  const producto = await getProducto(params.slug);

  return {
    // Title: 50-60 caracteres
    title: `${producto.nombre} - ${producto.categoria} | Mi Tienda`,

    // Description: 150-160 caracteres
    description: `${producto.descripcionCorta}. Envío gratis. Compra ahora en Mi Tienda.`,

    // Open Graph
    openGraph: {
      title: producto.nombre,
      description: producto.descripcionCorta,
      images: [
        {
          url: producto.imagenPrincipal,
          width: 1200,
          height: 630,
          alt: producto.nombre,
        },
      ],
      type: 'website',
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      title: producto.nombre,
      description: producto.descripcionCorta,
      images: [producto.imagenPrincipal],
    },

    // Canonical
    alternates: {
      canonical: `https://misitiio.com/producto/${params.slug}`,
    },
  };
}

// ✅ CONTENIDO OPTIMIZADO
export default function ProductoPage({ params }) {
  return (
    <article>
      <header>
        <h1 className="text-4xl font-bold mb-4">
          {/* Título principal con keyword */}
        </h1>
      </header>

      <section>
        <h2>Descripción</h2>
        <p>
          {/* Contenido útil, escaneable, alineado con query */}
        </p>
      </section>

      <section>
        <h2>Especificaciones</h2>
        {/* Tabla o lista estructurada */}
      </section>
    </article>
  );
}
```

---

### 3. Imágenes y Multimedia

```typescript
// ✅ NEXT.JS IMAGE (OBLIGATORIO)
import Image from 'next/image';

<Image
  src="/producto.webp"                    // WebP format
  alt="Descripción detallada del producto" // Alt text SEO
  width={800}
  height={600}
  quality={85}                             // Compresión óptima
  priority={isAboveTheFold}                // LCP optimization
  placeholder="blur"                       // Better UX
  blurDataURL={blurDataURL}
/>

// ✅ ALT TEXT
- Descriptivo y específico
- Incluye keyword si es natural
- No empieces con "Imagen de..."
- Vacío solo para imágenes decorativas: alt=""

// ✅ FORMATO
- WebP para todas las imágenes
- AVIF como fallback progresivo
- SVG para iconos y logos
```

---

### 4. Core Web Vitals

```typescript
// ✅ LCP (Largest Contentful Paint) < 2.5s
- Usa next/image con priority para hero images
- Preload fonts críticos
- Optimiza CSS crítico
- Server-side rendering para contenido above-the-fold

// ✅ FID (First Input Delay) < 100ms
- Code splitting agresivo
- Lazy load componentes no críticos
- Evita JavaScript bloqueante
- Usa React.lazy() para routes

// ✅ CLS (Cumulative Layout Shift) < 0.1
- Define width/height para TODAS las imágenes
- Reserva espacio para ads/embeds
- Evita contenido dinámico above-the-fold
- Usa aspect-ratio en CSS

// ✅ INP (Interaction to Next Paint) < 200ms
- Optimiza event handlers
- Usa debouncing en inputs
- React transitions para updates pesados
```

---

### 5. Estructura de Datos (Schema.org)

```typescript
// src/app/producto/[slug]/page.tsx

export default function ProductoPage({ producto }) {
  // ✅ JSON-LD para productos
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: producto.nombre,
    image: producto.imagenes,
    description: producto.descripcion,
    brand: {
      '@type': 'Brand',
      name: 'Mi Marca',
    },
    offers: {
      '@type': 'Offer',
      price: producto.precio,
      priceCurrency: 'COP',
      availability: 'https://schema.org/InStock',
      url: `https://misitio.com/producto/${producto.slug}`,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: producto.rating,
      reviewCount: producto.reviewCount,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema),
        }}
      />
      {/* Contenido del producto */}
    </>
  );
}
```

---

### 6. Sitemap y Robots

```typescript
// src/app/sitemap.ts (Next.js)

import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const productos = await getProductos();

  const productosUrls = productos.map((producto) => ({
    url: `https://misitio.com/producto/${producto.slug}`,
    lastModified: producto.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: "https://misitio.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: "https://misitio.com/tienda",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...productosUrls,
  ];
}
```

```typescript
// src/app/robots.ts

import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/checkout/success"],
      },
    ],
    sitemap: "https://misitio.com/sitemap.xml",
  };
}
```

---

### 7. Formato de Reporte SEO

```markdown
## AUDITORÍA SEO - [Página/Sitio]

### VEREDICTO: ✅ ÓPTIMO / ⚠️ MEJORABLE / ❌ CRÍTICO

### 1. SEO TÉCNICO

#### URLs

- ✅ Estructura limpia y descriptiva
- ✅ HTTPS implementado
- ⚠️ Algunas URLs con parámetros innecesarios

#### HTML Semántico

- ✅ Tags semánticos correctos
- ❌ Múltiples H1 en algunas páginas
- ✅ Jerarquía de headings correcta

#### Indexación

- ✅ Sitemap generado y actualizado
- ✅ Robots.txt configurado
- ✅ Canonicals implementados

#### Performance

- ✅ LCP: 1.8s
- ⚠️ CLS: 0.15 (objetivo: <0.1)
- ✅ FID: 45ms

### 2. SEO ON-PAGE

#### Metadata

- ⚠️ Algunos titles >60 caracteres
- ✅ Descriptions optimizadas
- ✅ Open Graph completo

#### Contenido

- ✅ Keyword research aplicado
- ✅ Contenido útil y escaneable
- ⚠️ Falta schema markup en algunas páginas

#### Imágenes

- ✅ Alt text presente en el 95%
- ✅ Formato WebP implementado
- ⚠️ Algunas imágenes sin width/height

### 3. UX CON IMPACTO SEO

#### Mobile

- ✅ Responsive design correcto
- ✅ Touch targets adecuados
- ✅ Tipografía legible

#### Navegación

- ✅ Menú claro y accesible
- ✅ Breadcrumbs implementados
- ✅ Enlaces internos estratégicos

### ERRORES CRÍTICOS

1. **Múltiples H1 en página de producto**
   - Impacto: Alto
   - Páginas afectadas: 34
   - Corrección: Cambiar H1 secundarios a H2

### OPORTUNIDADES

1. **Implementar FAQ schema**
   - Impacto: Medio
   - Esfuerzo: Bajo
   - Beneficio: Rich snippets en búsqueda

### CONCLUSIÓN

[Resumen ejecutivo con acciones prioritarias]
```

---

## ⚡ OPTIMIZACIÓN Y PERFORMANCE

### Principios de Optimización

**El objetivo es lograr:**

- **LCP < 2.5s** (Largest Contentful Paint)
- **FID < 100ms** (First Input Delay)
- **CLS < 0.1** (Cumulative Layout Shift)
- **Bundle JS < 200KB** (gzipped)
- **Lighthouse Score > 90**

---

### 1. Optimización de Bundle

```typescript
// ✅ CODE SPLITTING AUTOMÁTICO (Next.js App Router)
// Cada página/route se genera como bundle separado

// ✅ DYNAMIC IMPORTS para componentes pesados
import dynamic from 'next/dynamic';

const VideoPlayer = dynamic(() => import('@/components/VideoPlayer'), {
  loading: () => <Spinner />,
  ssr: false, // No renderizar en server si no es necesario
});

const Chart = dynamic(() => import('@/components/Chart'), {
  loading: () => <div>Cargando gráfico...</div>,
});

// ✅ LAZY LOAD PARA MODALS Y OVERLAYS
const ContactModal = dynamic(() => import('@/components/ContactModal'));

export default function Page() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>Contacto</button>
      {showModal && <ContactModal onClose={() => setShowModal(false)} />}
    </>
  );
}

// ✅ TREE SHAKING - Importa solo lo necesario
// ❌ NO: import * as Icons from 'lucide-react';
// ✅ SÍ: import { ShoppingCart, User } from 'lucide-react';

// ✅ BARREL EXPORTS OPTIMIZADOS
// components/atoms/index.ts
export { Button } from './Button';
export { Input } from './Input';
// No exportes todo con export *
```

---

### 2. Optimización de CSS

```typescript
// ✅ TAILWIND PURGE (automático en producción)
// tailwind.config.ts

module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}', // Escanea todos los archivos
  ],
  // Tailwind eliminará clases no usadas automáticamente
};

// ✅ MINIMIZA CSS CUSTOM
// Solo usa CSS custom cuando Tailwind no puede hacerlo

// ❌ NO:
.custom-card {
  padding: 1rem;
  border-radius: 0.5rem;
  background: white;
}

// ✅ SÍ:
<div className="p-4 rounded-lg bg-white">

// ✅ CRITICAL CSS
// Next.js lo maneja automáticamente
// El CSS crítico se inline en el HTML

// ✅ EVITA @IMPORT en CSS
// Causa cascadas de requests
```

---

### 3. Optimización de JavaScript

```typescript
// ✅ REACT COMPILER (Next.js 14+)
// Optimiza automáticamente re-renders

// ✅ useMemo PARA CÁLCULOS PESADOS
const sortedProducts = useMemo(() => {
  return products.sort((a, b) => b.rating - a.rating);
}, [products]);

// ✅ useCallback PARA FUNCIONES PASADAS A CHILDREN
const handleAddToCart = useCallback((productId: string) => {
  addToCart(productId);
}, [addToCart]);

// ✅ React.memo PARA COMPONENTES PUROS
export const ProductCard = React.memo(({ product }) => {
  return <div>{/* render */}</div>;
});

// ✅ VIRTUALIZATION para listas largas
import { useVirtualizer } from '@tanstack/react-virtual';

const VirtualList = ({ items }) => {
  const parentRef = useRef();

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      {virtualizer.getVirtualItems().map((virtualRow) => (
        <div key={virtualRow.index}>
          {items[virtualRow.index]}
        </div>
      ))}
    </div>
  );
};
```

---

### 4. Optimización de Imágenes (CRÍTICO)

```typescript
// ✅ SIEMPRE USA NEXT/IMAGE
import Image from 'next/image';

// ✅ FORMATO WEBP (OBLIGATORIO)
// Next.js lo hace automáticamente
<Image
  src="/producto.jpg"  // Automáticamente servido como WebP
  alt="Producto"
  width={800}
  height={600}
  quality={85}         // Default: 75, óptimo: 80-90
/>

// ✅ RESPONSIVE IMAGES
<Image
  src="/hero.jpg"
  alt="Hero"
  fill                 // Para imágenes de fondo
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  className="object-cover"
/>

// ✅ PRIORITY para imágenes above-the-fold
<Image
  src="/hero.jpg"
  alt="Hero principal"
  priority            // Preload, evita lazy load
  width={1920}
  height={1080}
/>

// ✅ LAZY LOAD para imágenes below-the-fold
<Image
  src="/producto-1.jpg"
  alt="Producto 1"
  loading="lazy"      // Default en Next.js
  width={400}
  height={400}
/>

// ✅ PLACEHOLDER BLUR
import fs from 'fs';
import { getPlaiceholder } from 'plaiceholder';

const { base64 } = await getPlaiceholder('/image.jpg');

<Image
  src="/image.jpg"
  placeholder="blur"
  blurDataURL={base64}
  alt="Image"
  width={800}
  height={600}
/>

// ✅ CONFIGURACIÓN NEXT.JS
// next.config.js
module.exports = {
  images: {
    formats: ['image/webp', 'image/avif'], // AVIF como fallback
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
};
```

---

### 5. Optimización de Fonts

```typescript
// ✅ NEXT.JS FONT OPTIMIZATION
import { Inter, Roboto_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',        // Evita FOIT (Flash of Invisible Text)
  variable: '--font-inter',
  preload: true,
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-roboto-mono',
  display: 'swap',
});

// layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}

// ✅ TAILWIND CONFIG
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        mono: ['var(--font-roboto-mono)'],
      },
    },
  },
};

// ✅ PRELOAD CRÍTICO
// Para custom fonts:
<link
  rel="preload"
  href="/fonts/AkiraExpanded.woff2"
  as="font"
  type="font/woff2"
  crossOrigin="anonymous"
/>
```

---

### 6. Caching y CDN

```typescript
// ✅ NEXT.JS CACHING ESTRATÉGICO

// Static Generation (ISG) - Para contenido que cambia poco
export const revalidate = 3600; // Revalida cada hora

export default async function ProductPage({ params }) {
  const product = await getProduct(params.id);
  return <ProductDetail product={product} />;
}

// Incremental Static Regeneration
export async function generateStaticParams() {
  const products = await getProducts();

  return products.map((product) => ({
    id: product.id,
  }));
}

// ✅ API ROUTES CON CACHE
// src/app/api/products/route.ts
export async function GET() {
  const products = await fetchProducts();

  return Response.json(products, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

// ✅ VERCEL/CDN
// next.config.js
module.exports = {
  images: {
    domains: ['cdn.misitio.com'], // CDN para imágenes
  },
};
```

---

### 7. Bundle Analyzer

```bash
# Instalar
npm install @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ...config
});

# Analizar
ANALYZE=true npm run build

# Revisa:
# - Paquetes grandes innecesarios
# - Código duplicado
# - Dependencias no tree-shaken
```

---

### 8. Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/shop
          budgetPath: ./budget.json
          uploadArtifacts: true
```

```json
// budget.json
{
  "budgets": [
    {
      "path": "/*",
      "timings": [
        {
          "metric": "interactive",
          "budget": 3000
        },
        {
          "metric": "first-contentful-paint",
          "budget": 1000
        }
      ],
      "resourceSizes": [
        {
          "resourceType": "script",
          "budget": 200
        },
        {
          "resourceType": "total",
          "budget": 500
        }
      ]
    }
  ]
}
```

---

### 9. Checklist de Performance

```markdown
## PERFORMANCE AUDIT

### Bundle Optimization

□ Code splitting implementado
□ Dynamic imports para componentes pesados
□ Tree shaking verificado
□ Bundle < 200KB gzipped
□ No hay duplicación de código

### CSS Optimization

□ Tailwind purge configurado
□ CSS crítico inline automático
□ No hay CSS custom innecesario
□ No hay @import en CSS

### JavaScript Optimization

□ useMemo para cálculos pesados
□ useCallback para funciones en props
□ React.memo para componentes puros
□ Virtualización para listas largas

### Images

□ ALL imágenes usan next/image
□ ALL imágenes en formato WebP
□ Width/height definidos en TODAS
□ Priority en hero images
□ Lazy load en below-the-fold
□ Blur placeholders implementados

### Fonts

□ next/font para Google Fonts
□ display: swap configurado
□ Preload para fonts críticos
□ WOFF2 format para custom fonts

### Caching

□ Static generation donde es posible
□ Revalidation configurado
□ API routes con Cache-Control
□ CDN para assets estáticos

### Core Web Vitals

□ LCP < 2.5s
□ FID < 100ms
□ CLS < 0.1
□ Lighthouse score > 90

### Monitoring

□ Bundle analyzer ejecutado
□ Lighthouse CI configurado
□ Performance budgets definidos
□ Alertas de regresión configuradas
```

---

## 📊 WORKFLOW COMPLETO

### Proceso de Desarrollo

```
1. SETUP INICIAL
   ↓
   - Lee estas reglas globales completas
   - Audita configuración existente (tailwind.config, next.config)
   - Confirma que el stack es correcto

2. DISEÑO ATÓMICO
   ↓
   - Empieza por átomos
   - Construye moléculas
   - Ensambla organismos
   - Define templates
   - Instancia pages

3. RESPONSIVE DESIGN
   ↓
   - Mobile-first SIEMPRE
   - Usa breakpoints de Tailwind
   - Respeta theme 100%
   - Prueba en todos los tamaños

4. REVALIDACIÓN UI
   ↓
   - Audita cada componente
   - Verifica fidelidad al sistema
   - Confirma responsive correcto
   - Valida accesibilidad básica

5. SEO OPTIMIZATION
   ↓
   - HTML semántico
   - Metadata completa
   - Schema markup
   - Sitemap + robots
   - Core Web Vitals

6. PERFORMANCE OPTIMIZATION
   ↓
   - Bundle analysis
   - Image optimization (WebP obligatorio)
   - Code splitting
   - Caching strategy
   - Lighthouse audit

7. DEPLOY
   ↓
   - Vercel/Netlify
   - Monitoring activo
   - Performance budgets
   - SEO tracking
```

---

## ✅ CHECKLIST FINAL

```markdown
### ANTES DE CONSIDERAR COMPLETO:

#### Configuración

□ tailwind.config.ts completo y consistente
□ next.config.js optimizado
□ tsconfig.json en strict mode
□ Package.json sin dependencias innecesarias

#### Arquitectura

□ Diseño atómico implementado
□ Componentes en carpetas correctas
□ Barrel exports optimizados
□ Tipos TypeScript completos

#### Responsive

□ Mobile-first verificado
□ Breakpoints consistentes
□ No valores arbitrarios
□ Identidad visual preservada

#### SEO

□ HTML semántico
□ Metadata en todas las páginas
□ Sitemap generado
□ Schema markup implementado
□ Alt text en todas las imágenes

#### Performance

□ Bundle < 200KB
□ ALL imágenes en WebP
□ LCP < 2.5s
□ CLS < 0.1
□ Lighthouse > 90

#### Calidad

□ TypeScript sin errores
□ ESLint sin warnings
□ Prettier configurado
□ Git hooks para pre-commit

#### Documentación

□ README actualizado
□ Componentes documentados
□ Deployment guide
□ Environment variables documentadas
```

---

## 🎯 COMANDOS ÚTILES

```bash
# Desarrollo
npm run dev

# Build production
npm run build

# Start production
npm start

# Lint
npm run lint

# Format
npm run format

# Type check
npm run type-check

# Bundle analysis
ANALYZE=true npm run build

# Lighthouse local
npm install -g @lhci/cli
lhci autorun --collect.url=http://localhost:3000
```

---

## 📚 RECURSOS Y REFERENCIAS

```
DOCUMENTACIÓN OFICIAL:
- Next.js: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- TypeScript: https://www.typescriptlang.org/docs
- React: https://react.dev

HERRAMIENTAS:
- Lighthouse: https://developer.chrome.com/docs/lighthouse
- PageSpeed Insights: https://pagespeed.web.dev
- WebPageTest: https://www.webpagetest.org

SEO:
- Search Console: https://search.google.com/search-console
- Schema.org: https://schema.org
- Open Graph: https://ogp.me

PERFORMANCE:
- web.dev: https://web.dev
- Core Web Vitals: https://web.dev/vitals
```

---

## 🚨 RECORDATORIOS CRÍTICOS

```
1. MOBILE-FIRST es OBLIGATORIO
2. TODO debe venir del THEME de Tailwind
3. TODO componente sigue el DISEÑO ATÓMICO
4. TODAS las imágenes en WEBP
5. HTML SEMÁNTICO siempre
6. TypeScript STRICT mode
7. Bundle < 200KB
8. Lighthouse > 90
9. REVALIDA la UI antes de entregar
10. AUDITA SEO en cada página
```

---

## Guidelines Source - IMPORTANT

**Fetch fresh guidelines before each review:**

```markdown
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

**Fin de las Reglas Globales**

Estas reglas deben aplicarse en **cada proyecto**, **cada componente**, **cada página**. Son la base para construir productos web de **alta calidad**, **escalables**, **performantes** y **optimizados para SEO**.
