export const obras = [
  { id: '1', nome: 'Residencial Bela Vista', progresso: 68, status: 'Em dia' },
  { id: '2', nome: 'Edifício Horizonte',     progresso: 34, status: 'Atenção' },
  { id: '3', nome: 'Condomínio Parque Sul',  progresso: 91, status: 'Em dia'  },
]

export const lancamentos = [
  { descricao: 'Fornecedor — Cimento Bela Vista',     valor: -12400, tipo: 'despesa' },
  { descricao: 'Medição — Edifício Horizonte',         valor: 38000,  tipo: 'receita' },
  { descricao: 'Folha de pagamento — Equipe campo',   valor: -54200, tipo: 'despesa' },
  { descricao: 'Adiantamento cliente — Parque Sul',   valor: 60000,  tipo: 'receita' },
]

export const suprimentos = [
  { titulo: 'Cimento CP-II — 200 sacos',    lista: 'Pedido',    obra: 'Bela Vista' },
  { titulo: 'Aço CA-50 — 3 ton',            lista: 'Aprovação', obra: 'Horizonte'  },
  { titulo: 'Tijolo cerâmico — 15.000 un',  lista: 'Entregue',  obra: 'Parque Sul' },
]

export const equipe = [
  { nome: 'Carlos Eduardo',  funcao: 'Mestre de obras', ponto: '07:02 — entrada' },
  { nome: 'João Pedro',      funcao: 'Pedreiro',        ponto: '06:58 — entrada' },
  { nome: 'Marcos Vinícius', funcao: 'Eletricista',     ponto: 'Ausente'         },
]

export const rdos = [
  { obra: 'Residencial Bela Vista', data: '30/06', resumo: 'Concretagem do bloco B finalizada. Clima firme. 12 colaboradores em campo.' },
  { obra: 'Edifício Horizonte',     data: '29/06', resumo: 'Atraso na entrega de aço. Estrutura do 8º pavimento aguardando material.' },
  { obra: 'Condomínio Parque Sul',  data: '29/06', resumo: 'Início do acabamento da fachada lateral. Sem intercorrências.' },
]

export const fotos = [
  { obra: 'Bela Vista', legenda: 'Fundação — Bloco B',        quando: '05/04/2026 08:30', imagem: '/obra_fundacao.png',    dataISO: '2026-04-05' },
  { obra: 'Bela Vista', legenda: 'Estrutura — Pilares',       quando: '20/05/2026 11:00', imagem: '/obra_fundacao.png',    dataISO: '2026-05-20' },
  { obra: 'Bela Vista', legenda: 'Instalações elétricas',     quando: '10/06/2026 09:15', imagem: '/obra_finalizada.png',  dataISO: '2026-06-10' },
  { obra: 'Bela Vista', legenda: 'Fachada Concluída',         quando: '30/06/2026 14:20', imagem: '/obra_finalizada.png',  dataISO: '2026-06-30' },
  { obra: 'Horizonte',  legenda: 'Escavação Terreno',         quando: '10/02/2026 07:00', imagem: '/obra_fundacao.png',    dataISO: '2026-02-10' },
  { obra: 'Horizonte',  legenda: 'Estrutura — 8º pavimento',  quando: '01/07/2026 11:05', imagem: '/obra_finalizada.png',  dataISO: '2026-07-01' },
  { obra: 'Parque Sul', legenda: 'Limpeza do Terreno',        quando: '15/01/2026 08:00', imagem: '/obra_fundacao.png',    dataISO: '2026-01-15' },
  { obra: 'Parque Sul', legenda: 'Acabamento — Fachada',      quando: '29/06/2026 16:40', imagem: '/obra_finalizada.png',  dataISO: '2026-06-29' },
]

export const apps = [
  { id: 'financeiro',   nome: 'Financeiro',      sub: 'Total ERP',    status: 'atalho',    icone: 'DollarSign', url: 'https://totalerp.com.br'    },
  { id: 'ponto',        nome: 'Ponto & RH',      sub: 'FacePonto',    status: 'atalho',    icone: 'Clock',      url: 'https://faceponto.com.br'   },
  { id: 'suprimentos',  nome: 'Suprimentos',     sub: 'Portal Nativo', status: 'novo',      icone: 'Package'    },
  { id: 'obras',        nome: 'Galeria de Obras', sub: 'Google Drive', status: 'integrado', icone: 'Camera'     },
  { id: 'rdo',          nome: 'Diário de Obra',  sub: 'Escout',       status: 'novo',      icone: 'FileText'   },
  { id: 'frota',        nome: 'Frota & GPS',     sub: 'Infleet',      status: 'atalho',    icone: 'Truck'      },
]

// Historical data for Recharts interactive dashboard (Scope: Works, RDOs, Supplies, Photos)
export const chartHistory = [
  { data: 'Jan', obras: 1, rdos: 12, suprimentos: 15, fotos: 8 },
  { data: 'Fev', obras: 2, rdos: 18, suprimentos: 22, fotos: 14 },
  { data: 'Mar', obras: 2, rdos: 24, suprimentos: 19, fotos: 20 },
  { data: 'Abr', obras: 3, rdos: 28, suprimentos: 25, fotos: 25 },
  { data: 'Mai', obras: 3, rdos: 32, suprimentos: 30, fotos: 32 },
  { data: 'Jun', obras: 3, rdos: 35, suprimentos: 28, fotos: 40 },
]
