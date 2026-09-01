---
name: JWA Engenharia Design System
version: 1.0.0
description: Design System de Alta Precisao & Engenharia Industrial para o Portal Multi-Tenant JWA
colors:
  primary: #FFE500          # Amarelo vibrante institucional JWA (Safety & Identity)
  primary-amber: #F59E0B    # Âmbar operacional para botões, foco e badges em dark
  primary-dark: #D97706     # Âmbar escuro / hover
  surface-dark: #090A0E     # Fundo master escuro (charcoal profundo)
  surface-panel: #12141C    # Fundo dos painéis e sidebar
  surface-card: #161822     # Fundo dos cards e contêineres interativos
  surface-subtle: #1C202D   # Fundo de elementos e inputs secundários
  border-technical: #1F232E # Borda técnica de alta precisão
  border-subtle: #2A2F3D    # Borda sutil ativa / hover
  ink-primary: #F9FAFB      # Texto principal de alta legibilidade (zinc-50)
  ink-muted: #9CA3AF        # Texto secundário e legendas (zinc-400)
  ink-dim: #6B7280          # Texto terciário / microcopy (zinc-500)
  success: #10B981          # Verde esmeralda (Obras no prazo / Contas Pagas / Concluído)
  success-dim: rgba(16, 185, 129, 0.12)
  danger: #EF4444           # Vermelho coral (Vencido / Parada de Obra / Bloqueado)
  danger-dim: rgba(239, 68, 68, 0.12)
  info: #3B82F6             # Azul engenharia (Medições / Em Andamento / Clima)
  info-dim: rgba(59, 130, 246, 0.12)
  warning: #F59E0B          # Alerta / Aguardando Aprovação
  warning-dim: rgba(245, 158, 11, 0.12)
typography:
  display:
    fontFamily: Inter, Montserrat, system-ui, sans-serif
    fontSize: 24px
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 20px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.3
  h3:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.4
  body-md:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  label-caps:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 10px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: 0.08em
rounded:
  sm: 4px
  md: 6px
  lg: 10px
  xl: 14px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
components:
  badge-section:
    accentDark: #272A38
    accentYellow: #FFE500
    size: 14px x 4px
  button-primary:
    backgroundColor: {colors.primary-amber}
    textColor: #000000
    fontWeight: 700
    fontSize: 12px
    rounded: {rounded.md}
    padding: 8px 16px
  input-field:
    backgroundColor: #0B0C0E
    border: 1px solid {colors.border-technical}
    textColor: {colors.ink-primary}
    fontSize: 12px
    rounded: {rounded.sm}
    padding: 8px 12px
  card-panel:
    backgroundColor: {colors.surface-panel}
    border: 1px solid {colors.border-technical}
    rounded: {rounded.md}
    padding: 16px
---

# JWA Engenharia — Design System & Diretrizes de UI/UX

## 1. Overview & Filosofia Visual
A **JWA Engenharia** exige uma linguagem visual que transmita **robustez técnica, precisão geométrica e alta densidade operacional**. O design é feito para quem toma decisões no escritório executivo ou preenche relatórios com rapidez e clareza no canteiro de obras.

### Pilares de Design:
1. **Contraste Industrial & Clareza Absoluta:** Superfícies escuras grafite (#090A0E / #12141C) com realces em Amarelo de Segurança (#FFE500 / #F59E0B) e bordas nítidas de 1px.
2. **Assinatura Geométrica JWA:** O marcador duplo de seção (⬛ 🟨 — 14px x 4px) precede os títulos de página e cards fundamentais.
3. **Densidade & Ergonomia:** Interfaces compactas com tipografia legível, touch targets generosos (mínimo 44px em mobile) e feedback de estado imediato.
4. **Sem Efeitos Genéricos (Anti-Slop):** Proibido degradês roxos e sombras difusas. Prioridade para bordas técnicas, tipografia calculada e microinterações táteis.

---

## 2. Cores & Tokens Semânticos
* **Amarelo Institucional (#FFE500):** Elemento de assinatura e logos.
* **Âmbar Operacional (#F59E0B):** Botões principais, status ativos, destaques de KPIs e foco de navegação.
* **Preto Profundo (#090A0E):** Background geral que reduz a fadiga visual e destaca elementos de dados.
* **Grafite Técnico (#12141C / #161822):** Painéis e cards modulares.
* **Bordas Técnicas (#1F232E):** Delimitação precisa sem poluição visual.

---

## 3. Tipografia & Hierarquia
* **Display / Títulos Principais:** Inter / Montserrat em Caixa Alta, peso 800 ou 900, tracking condensado e presença marcante.
* **Seções / Subtítulos:** Peso 700, alinhamento milimétrico com ícones temáticos.
* **Labels / Microcopy:** Caixa alta, tamanho 10px, peso 800, tracking expandido (letter-spacing: 0.08em).
* **Corpo / Dados:** 12px - 13px, altura de linha 1.4 - 1.5, renderização nítida de números monetários e datas.

---

## 4. Padrão de Módulo: RDO (Diário de Obra)
O RDO é o benchmark de UI/UX do sistema. Ele reúne:
1. **Painel de Cabeçalho Executivo:** Seletor de Obra + Data + Responsável Técnico / CREA com badges de status de aprovação.
2. **Widget Climático e Solo:** Seletores visuais de clima (Manhã / Tarde - Sol, Nublado, Chuva, Impraticável) e condição do terreno.
3. **Efetivo & Recursos:** Tabela ágil de mão de obra própria e terceirizada com cálculo dinâmico de homens-hora.
4. **Equipamentos em Canteiro:** Status visual imediato (Operando / Parado / Manutenção).
5. **Avanço de Atividades & Ocorrências:** Cards de serviços planejados vs executados com validação de desvios.
6. **Galeria de Evidências Fotográficas:** Upload ágil com legendas, lightbox e impressão/exportação em PDF oficial A4 para órgãos fiscalizadores.

---

## 5. Do's and Don'ts
* ✅ **DO:** Utilizar o marcador duplo ⬛ 🟨 nos títulos de módulos e seções principais.
* ✅ **DO:** Utilizar a logo oficial JWA com o A estilo compasso.
* ✅ **DO:** Garantir suporte impecável a mobile/tablet para preenchimento no canteiro.
* ❌ **DON'T:** Usar fundos coloridos saturados em excesso ou tons roxos/violetas genéricos de templates SaaS.
* ❌ **DON'T:** Ocultar informações críticas de engenharia em dropdowns excessivamente aninhados.
