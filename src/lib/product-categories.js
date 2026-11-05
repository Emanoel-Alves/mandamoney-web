const categoryKeywords = {
  'Frutas e Legumes': [
    'abacate',
    'abacaxi',
    'acerola',
    'ameixa',
    'banana',
    'caju',
    'caqui',
    'carambola',
    'cereja',
    'coco',
    'figo',
    'framboesa',
    'goiaba',
    'jabuticaba',
    'kiwi',
    'laranja',
    'limao',
    'maca',
    'mamao',
    'manga',
    'maracuja',
    'melancia',
    'melao',
    'mexerica',
    'morango',
    'pera',
    'pessego',
    'pitaya',
    'tangerina',
    'uva',
    'abobora',
    'abobrinha',
    'berinjela',
    'beterraba',
    'cenoura',
    'chuchu',
    'pepino',
    'pimentao',
    'tomate',
    'mandioca',
    'macaxeira',
  ],
  Proteína: [
    'carne',
    'frango',
    'peito de frango',
    'coxa',
    'sobrecoxa',
    'bovina',
    'suina',
    'porco',
    'costela',
    'patinho',
    'acém',
    'alcatra',
    'picanha',
    'linguica',
    'salsicha',
    'bacon',
    'peixe',
    'tilapia',
    'camarao',
    'ovo',
    'ovos',
  ],
  Cereais: [
    'arroz',
    'feijao',
    'milho',
    'aveia',
    'farinha',
    'macarrao',
    'massa',
    'trigo',
    'granola',
    'lentilha',
    'grao de bico',
    'ervilha',
    'pipoca',
    'quinoa',
  ],
  Higiene: [
    'sabonete',
    'shampoo',
    'condicionador',
    'creme dental',
    'pasta de dente',
    'escova de dente',
    'fio dental',
    'desodorante',
    'papel higienico',
    'absorvente',
    'fralda',
    'detergente',
    'sabao',
    'amaciante',
    'desinfetante',
    'agua sanitaria',
    'limpador',
    'esponja',
  ],
  Alimentícios: [
    'leite',
    'queijo',
    'iogurte',
    'manteiga',
    'margarina',
    'requeijao',
    'pao',
    'biscoito',
    'bolacha',
    'cafe',
    'acucar',
    'sal',
    'oleo',
    'azeite',
    'suco',
    'refrigerante',
    'agua mineral',
    'chocolate',
    'molho',
    'extrato de tomate',
    'tempero',
    'farofa',
    'geleia',
    'mel',
    'doce',
  ],
};

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function guessProductCategory(product, categories) {
  const normalizedProduct = normalize(product);
  if (!normalizedProduct) return '';

  for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
    const category = categories.find((entry) => normalize(entry.name) === normalize(categoryName));
    if (!category) continue;

    const matches = keywords.some((keyword) => {
      const normalizedKeyword = normalize(keyword);
      return ` ${normalizedProduct} `.includes(` ${normalizedKeyword} `);
    });
    if (matches) return category.name;
  }

  return '';
}
