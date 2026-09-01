# 📐 Manual de Identidade Visual & Design System — JWA Engenharia

> **Documento baseado na análise do arquivo oficial:** `Portfólio JWA v16.pdf`  
> **Objetivo:** Estabelecer a ponte oficial entre a identidade da marca JWA e os tokens de design do sistema web.

---

## 1. O Logotipo & Geometria da Marca

* **Estrutura Tipográfica:** O logotipo **`JWA`** possui um desenho geométrico, moderno e minimalista.
* **O `A` Característico:** A letra **`A`** é o elemento de assinatura da marca — desenhada **sem a barra horizontal** (estilo compasso/vértice de engenharia `/\`).
* **Tagline Complementar:** `PORTFÓLIO` ou `SISTEMA / ENGENHARIA` em caixa alta com **tracking expandido** (`letter-spacing: 0.35em`).
* **Grafismos & Formas Angulares:** Uso de máscaras poligonais/triangulares sobrepostas em fotografias monocromáticas.

---

## 2. Paleta Cromática Oficial (Brand Tokens)

```scss
// 🟡 Amarelo JWA (Safety & Energy)
$jwa-yellow-vibrant: #FFE500; // Amarelo vibrante institucional
$jwa-yellow-amber:   #F59E0B; // Âmbar de contraste para UI digital e botões
$jwa-yellow-light:   #FFFBEB; // Fundo suave para alertas e badges no modo claro

// ⚫ Pretos e Grafites Institucionais
$jwa-black:          #090A0E; // Preto profundo do fundo e da capa
$jwa-charcoal:       #12141C; // Superfície dos cards e painéis
$jwa-dark-gray:      #1F232E; // Bordas e divisores de alta definição

// ⚪ Brancos e Neutros
$jwa-white:          #FFFFFF; // Branco puro das lâminas e textos contrastantes
$jwa-gray-body:      #4B5563; // Texto de leitura no modo claro
$jwa-gray-soft:      #9CA3AF; // Textos secundários no modo escuro

// 🚥 Cores Semânticas de Apoio (Engenharia & Finanças)
$jwa-green-success:  #10B981; // Obras no prazo / Contas pagas / Concluído
$jwa-red-danger:     #EF4444; // Vencidos / Bloqueios / Paradas de obra
$jwa-blue-info:      #3B82F6; // Em cotação / Andamento / Medições
```

---

## 3. Padrões Gráficos & Assinaturas Visuais

### 3.1. O Marcador Duplo de Seção (`⬛ 🟨`)
Em todas as lâminas do portfólio, antes de cada título de seção, há a assinatura geométrica:
* Um pequeno retângulo preto/escuro (`16px x 4px`) seguido de um retângulo amarelo (`16px x 4px`).
* **Aplicação no Sistema Web:** Usar no topo de cada página (`Dashboard`, `Financeiro`, `RH`, `RDO`, `Suprimentos`).

### 3.2. Blocos de Alto Contraste (Missão / Visão / Valores)
* Grid 2x2 com inversão cromática:
  * Bloco 1: Fundo Preto com Tipografia Branca / Amarela.
  * Bloco 2: Fundo Amarelo com Tipografia Preta.
* Numeração elegante em dois dígitos (`01`, `02`, `03`, `04`).

### 3.3. Estilo Fotográfico Industrial
* Imagens de canteiro, maquinário pesado e estruturas em **preto e branco de alto contraste** ou cores reais super saturadas com céu azul e capacetes de segurança amarelos em destaque.

---

## 4. Tipografia & Hierarquia de Texto

* **Fonte Recomendada para o Figma / Web:** `Montserrat`, `Syne` ou `Inter`.
* **Títulos (Headings):**
  * Estilo: Caixa Alta (**UPPERCASE**).
  * Peso: `Light 300` alternado com palavras-chave em **`Bold 700`** ou **`Black 900`**.
  * Exemplo: `ENGENHARIA DE VALOR` / `ÁREAS DE ATUAÇÃO`.
* **Corpo de Texto (Body):**
  * Peso: `Regular 400`, altura de linha `1.6`, com termos chave destacados em **Bold**.
