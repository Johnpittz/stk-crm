/**
 * Opções dos formulários da aba "Propostas" do Atendimento.
 *
 * 03/10: movidas para fora de painel-contato.tsx junto com a extração da
 * aba para `aba-propostas.tsx` (o painel tem 1300+ linhas; extrair deixou
 * a aba testável de verdade).
 */

export const CONCESSIONARIAS = [
  "CEMIG", "COPEL", "CPFL PAULISTA", "ELEKTRO", "ENERGISA MT",
  "EQUATORIAL GO", "CELESC", "ENEL", "CPFL SANTA CRUZ"
];

export const CLASSES_TARIFARIAS = ["Residencial", "Comercial", "Industrial", "Rural", "Poder Público"];

export const SUBGRUPOS = ["B1", "B2", "B3", "A1", "A2", "A3", "A3a", "A4", "AS"];

export const BANDEIRAS = ["Verde", "Amarela", "Vermelha P1", "Vermelha P2"];

export const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const DISTRIBUIDORAS = ["CEMIG", "EQUATORIAL GO", "ENERGISA GO", "COPEL", "CPFL PAULISTA", "ELEKTRO"];

export const SUBGRUPOS_RECIEE = ["A1", "A2", "A3", "A3a", "A4", "AS", "B1", "B2", "B3"];

export const MODALIDADES = ["Convencional", "Horária Azul", "Horária Verde", "Branca", "Monômia"];

export const CLASSES_RECIEE = ["Residencial", "Comercial", "Industrial", "Rural", "Poder Público", "Iluminação Pública"];

export const TENSOES = ["Baixa", "Média", "Alta"];

export const REGIMES_TRIBUTARIOS = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "Isento", "Não Contribuinte"];

export const GRUPOS = ["A", "B"];
