/**
 * Tabelas de códigos da e-extrato (manual v9.3.2, seção 6). Servem para mostrar
 * "REDE · Mastercard" em vez de números. Código fora da tabela aparece como
 * "cód N" (nunca chuta um nome). A Tabela VIII (≈700 produtos) não foi
 * transcrita: o retorno já traz produto C/D e o texto tipoProduto.
 */

/** Tabela I — Operadoras (adquirentes/credenciadoras). */
export const OPERADORAS: Record<number, string> = {
  1: 'AMEX', 2: 'CIELO', 3: 'CREDISHOP', 4: 'FORTBRASIL', 5: 'MAISFACIL', 6: 'REDE', 7: 'GETNET', 8: 'GOODCARD', 9: 'LIBERCARD',
  10: 'HAGANA', 11: 'BANESECARD', 12: 'TICKET', 13: 'FIRSTDATA', 15: 'TRIBANCO', 16: 'CETELEM', 17: 'SODEXO', 18: 'VR BENEFÍCIOS',
  20: 'VERO', 21: 'LOSANGO', 23: 'UP BRASIL', 24: 'VALECARD', 25: 'COMPROCARD', 26: 'FANCARD', 27: 'ECXCARD', 28: 'BANESCARD',
  29: 'CABAL', 30: 'USECRED', 31: 'FITCARD', 32: 'PLANVALE', 33: 'ABRAPETITE', 34: 'SENFF', 35: 'STONE', 36: 'USACARD', 37: 'BNB',
  38: 'REDETREL', 39: 'BENVISAVALE', 40: 'MURY', 41: 'BANRICARD', 42: 'GREENCARD', 43: 'CDCCARD', 44: 'CALCARD', 45: 'CONNECTYPAY',
  46: 'VALECON', 47: 'PAYPAL', 48: 'COOPERCARD', 49: 'MERCADO PAGO', 50: 'SOROCRED', 51: 'NETSHOES', 58: 'VOLUS', 59: 'PERSONALCARD',
  60: 'VALESHOP', 61: 'SESIMAX', 62: 'REDEUZE', 63: 'NUTRICASH', 65: 'VEROCHEQUE', 66: 'BIGCARD', 67: 'BANPARA', 69: 'MERCADO LIVRE',
  70: 'MGCARD', 71: 'COOPELIFE', 72: 'BRASILCARD', 73: 'CREDSYSTEM', 74: 'BOA ALIMENTAÇÃO', 75: 'GLOBAL PAYMENTS', 76: 'DIGIMODAS',
  77: 'VALEMAIS', 78: 'DMCARD', 79: 'PAGUE LOGO', 81: 'MAXXCARD', 84: 'PAGSEGURO', 87: 'LINXPAY', 88: 'CREDNOSSO', 95: 'LECARD',
  100: 'VERDECARD', 101: 'CNOVA', 102: 'B2W', 103: 'MAXI CARTÃO', 104: 'ONECARD', 105: 'SAFRA PAY', 106: 'FAMILLYCARD', 107: 'SEICON',
  108: 'REDETENDENCIA', 110: 'SIPAG', 112: 'VEGASCARD', 117: 'PAGOLIVRE', 118: 'GOLDENFARMA', 119: 'MAXISCARD', 127: 'GRANDCARD',
  128: 'ER CARD', 129: 'CREDZ', 130: 'SAFECARD', 131: 'PAGSIMPLES', 132: 'SOMA CONTA DIGITAL', 133: 'BRASILCONVENIOS', 136: 'SYSPROCARD',
  137: 'SICRED', 138: 'UNICA', 139: 'CONVCARD', 143: 'HAGANA UPLOAD', 149: 'PICPAY', 154: 'AMAZON', 155: 'TESTE', 156: 'TA PAGO',
  159: 'ACCREDITO', 173: 'SINDPLUS', 178: 'ITI', 193: 'ADYEN', 194: 'REDEMED', 195: 'PIX ITAU', 219: 'AME', 226: 'PAGARME',
  227: 'LAGOACRED', 228: '008CARDS', 229: 'PITCARD', 230: 'ALIMENTARE', 231: 'SEM PARAR', 233: 'IFOOD', 234: 'WEBCARD', 235: 'FACECARD',
  236: 'IBI CARTOES', 237: 'ROMCARD', 238: 'NUTRICARD', 239: 'EUCARD', 240: 'BIQ BENEFICIOS', 242: 'TRUCKPAD', 244: 'TRIOCARD',
  245: 'CROSCARD', 246: 'CARTAO PRE-DATADO', 247: 'NEUSFESTECARD', 249: 'USE BLUE', 250: 'RAPPI', 251: 'WISEPAY', 252: 'HELLOTICKET',
  253: 'PAYMEE', 254: 'UBER EATS', 255: 'BONUSCRED', 256: 'AVANCARD', 257: 'TRUCKPAG', 260: 'DAFITI', 261: 'WIZEO', 262: 'C6',
  263: 'ALELO', 264: 'SHELLBOX', 265: 'CABOS E SOLDADOS', 266: 'SERTAOCARD', 267: 'PIX SANTANDER', 268: 'PIX BRADESCO', 269: 'FIX PAY',
  270: 'PIX BB', 271: '99 FOOD', 272: 'CONVENIOSCARD', 273: 'MEGAVALE', 326: 'DESCONHECIDO', 752: 'PEDEPRONTO', 760: 'BMGCARD',
  761: 'RAPPI FARMACIA', 764: 'RVCARDS', 765: 'BKBANK', 767: 'SERVIPA', 768: 'PAGAI', 769: 'GRANITO',
}

/** Tabela II — Bandeiras. */
export const BANDEIRAS: Record<number, string> = {
  1: 'VISA', 2: 'MASTERCARD', 3: 'HIPERCARD', 4: 'CREDISHOP', 5: 'DINERS CLUB', 6: 'FORTBRASIL', 7: 'ELO', 8: 'CABAL', 9: 'AMEX',
  10: 'AGIPLAN', 11: 'AURA', 12: 'AVISTA', 13: 'BANESECARD', 14: 'CREDSYSTEM', 15: 'CREDZ', 16: 'CUP CR', 17: 'DISCOVER', 18: 'ESPLANADA',
  19: 'GOODCARD', 20: 'LIBERCARD', 21: 'SICREDI', 22: 'SODEXO', 23: 'SOROCRED', 24: 'TICKET RESTAURANT', 25: 'TICKET CAR', 26: 'TRICARD',
  27: 'DINERS', 28: 'BANESCARD', 29: 'VRBENEFICIOS', 30: 'PROTEGECARD', 31: 'FITCARD', 33: 'BANRICARD', 34: 'VERDECARD', 35: 'BANRICOMPRAS',
  36: 'LOSANGO', 37: 'DACASA', 38: 'POLICARD', 39: 'COMPROCARD', 40: 'USACARD', 41: 'TICKET ALIMENTAÇÃO', 42: 'FANCARD', 43: 'ECXCARD',
  44: 'VALECARD', 45: 'USECRED', 46: 'PLANVALE', 47: 'SENFF', 48: 'ABRAPETITE', 49: 'BNB', 51: 'TICKET CULTURA', 52: 'GREENCARD', 53: 'JCB',
  54: 'CALCARD', 55: 'CCARD', 69: 'PAYPAL', 71: 'SESIMAX', 72: 'CREDNOSSO', 74: 'PERSONALCARD', 75: 'VALESHOP', 76: 'NUTRICASH',
  77: 'IBICARTOES', 78: 'VEROCHEQUE', 79: 'BIGCARD', 80: 'REDEUZE', 81: 'UNIK', 84: 'MERCADO LIVRE', 85: 'MGCARD', 86: 'COOPELIFE',
  87: 'BRASILCARD', 88: 'BOA ALIMENTAÇÃO', 89: 'VALEMAIS', 90: 'PRIVATE LABEL', 91: 'MAIS', 93: 'VOLUS', 95: 'DMCARD', 96: 'MAXXCARD',
  97: 'PAGSEGURO', 98: 'LECARD', 100: 'CNOVA', 101: 'B2W', 102: 'MAXI CARTÃO', 103: 'ONECARD', 104: 'SAFRAPAY', 114: 'FAMILLYCARD',
  115: 'SEICON', 116: 'SOUTH AMERICA', 118: 'VEGASCARD', 119: 'GOLDENFARMA', 120: 'PAGOLIVRE', 121: 'MAXISCARD', 122: 'GRANDCARD',
  123: 'FIATCARD', 124: 'SAFECARD', 125: 'GLOBAL PAYMENTS', 127: 'PAGSIMPLES', 128: 'ERROR', 129: 'SOMA CONTA DIGITAL', 130: 'BRASILCONVENIO',
  131: 'OUROCARD', 132: 'ACIC', 133: 'FACISC', 134: 'SYSPROCARD', 135: 'CONVCARD', 136: 'ACICARD', 137: 'MURY', 138: 'MAISFACIL',
  139: 'CDCCARD', 140: 'BENVISAVALE', 141: 'COOPERCARD', 142: 'SAFRA WALLET', 145: 'ACCREDITO', 146: 'DINHEIRO EM CONTA', 147: 'GIFTCARD',
  148: 'PAGAMENTO NA LOTÉRICA', 149: 'NÃO INFORMADO', 150: 'ITI CARTEIRA DIGITAL', 151: 'LAGOACRED', 152: 'SINDPLUS', 153: 'CROSCARD',
  154: 'WISEPAY', 157: 'MERCADO PAGO', 158: 'AMEDIGITAL', 159: 'CONTALINX', 160: 'PICPAY', 161: 'BANQI', 162: 'IPIRANGA', 163: 'MAGALU',
  164: 'MERCI', 165: 'PAGBANK', 166: 'RAPPI', 167: 'LINXPAY', 168: 'MASTER', 169: 'EUCARD', 171: 'CONNECTYPAY', 172: 'TA PAGO',
  173: 'TRIOCARD', 174: 'VALECON', 175: 'PIX', 176: 'C6', 177: 'ALELO', 233: 'IFOOD',
  15465: 'REDEMED', 15466: 'HELLOTICKET', 15467: 'MAESTRO', 15468: 'BANPARA', 15469: 'UBER EATS', 15470: 'MAESTRO', 15471: 'BACEN',
  15472: 'USE BLUE', 15473: 'PAGARME', 15474: 'LINK', 15475: 'NEO', 15476: 'PRIME', 15477: 'ROMCARD', 15478: 'NEUSFESTECARD',
  15480: 'PIX PAGSEGURO', 15482: 'SEMPARAR', 15484: 'PIX SANTANDER', 15486: 'WIZEO', 15487: 'TICKET FLEX', 15489: 'BOLETO',
  15490: 'PIX BRADESCO', 15491: 'SOFTNEX', 15492: 'CIELO', 15494: 'ER CARD', 15495: 'WEBCARD', 15496: 'AVANCARD', 15497: 'PITCARD',
  15498: 'TRUCKPAG', 15499: 'DIGIMODAS', 15500: 'FACECARD', 15501: 'SERTAOCARD', 15502: 'ALIMENTARE', 15503: 'NUTRICARD', 15504: '008CARDS',
  15505: 'BONUSCRED', 15506: 'CARTAOPREDATADO', 15507: 'PAYMEE', 15508: 'PAGARME', 15509: 'PIX BB', 15510: 'CABOS E SOLDADOS',
  15511: '99 FOOD', 15512: 'ALELO', 15514: 'PAYLY', 15515: 'LTM-VISA', 15516: 'CIELO-DINERS CLUB', 15517: 'MERCADO PAGO-PIX',
  15518: 'CIELO-MASTERCARD', 15519: 'CIELO-VISA', 15520: 'STONE-ELO', 15521: 'STONE-MASTERCARD', 15522: 'STONE', 15523: 'STONE-VISA',
  15526: 'BIQBENEFICIOS', 15528: 'PAYPAL-OUTRAS', 15529: 'MEGAVALE', 15530: 'CREDSYSTEM', 15531: 'PIX QRCODE', 15536: 'SODEXO VOUCHER',
  15537: 'BMGCARD', 15538: 'RAPPI FARMACIA', 15539: 'RV CARDS', 15540: 'BKBANK', 15541: 'SINCARD', 15721: 'PIX HAGANA', 39064: 'REDE',
  45152: 'SERVIPA',
}

/** Tabela III — Motivo do ajuste ou tarifa (campo historico). */
export const MOTIVO_AJUSTE: Record<number, string> = {
  1: 'Aluguel de POS inativo', 2: 'Cancelamento de venda', 3: 'Aluguel de POS / conectividade', 4: 'Ajuste de crédito ou débito',
  5: 'Consulta de cheques', 6: 'Chargeback', 7: 'Tarifa',
}

/** Tabela IV — Tipo de arquivo. */
export const TIPO_ARQUIVO: Record<number, string> = {
  1: 'Pagamento de parcelas', 2: 'Vendas', 3: 'Antecipação de parcelas', 4: 'Ajustes e tarifas', 5: 'Cessão de recebíveis', 6: 'Gravame',
}

/** Tabela V — Tipo de venda (filtro tipoVenda). */
export const TIPO_VENDA = { todas: 1, debito: 2, credito: 3 } as const

/** Tabela VI — Status da conciliação. */
export const STATUS_CONCILIACAO: Record<number, string> = { 1: 'Conciliada', 2: 'Não conciliada' }

/** Tabela VII — Tipo de divergência (por que não conciliou). */
export const TIPO_DIVERGENCIA: Record<number, string> = {
  1: 'Venda', 2: 'Plano (parcelas)', 3: 'Status', 4: 'Bandeira', 5: 'Rede (adquirente)', 6: 'Valor', 7: 'Produto',
}

/** Situação da parcela/pagamento (manual 5.2). */
export const STATUS_PARCELA: Record<string, string> = {
  PRE: 'Prevista', PAG: 'Paga', ANT: 'Antecipada', CAN: 'Cancelada', CTP: 'Cancelamento total previsto', CPP: 'Cancelamento parcial previsto',
}

const rotulo = (tabela: Record<number, string>) => (codigo: number | null | undefined) =>
  codigo == null ? '—' : tabela[codigo] ?? `cód ${codigo}`

export const nomeOperadora = rotulo(OPERADORAS)
export const nomeBandeira = rotulo(BANDEIRAS)
export const nomeMotivoAjuste = rotulo(MOTIVO_AJUSTE)
export const nomeDivergencia = rotulo(TIPO_DIVERGENCIA)
/** 'C' → Crédito, 'D' → Débito; outro texto volta como veio. */
export const nomeProduto = (p: string | null | undefined) => (p === 'C' ? 'Crédito' : p === 'D' ? 'Débito' : p || '—')
