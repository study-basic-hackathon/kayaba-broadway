export interface Character {
  id: string;
  name: string;
  image: string;
}

export const CHARACTERS: Character[] = [
  // 動物
  {
    id: 'penguin',
    name: 'ペンギン',
    image: '/assets/character/penguin.png',
  },
  {
    id: 'sparrow',
    name: 'すずめ',
    image: '/assets/character/sparrow.png',
  },
  {
    id: 'chicken',
    name: 'ニワトリ',
    image: '/assets/character/chicken.png',
  },
  {
    id: 'chick',
    name: 'ひよこ',
    image: '/assets/character/chick.png',
  },
  {
    id: 'gray-chick',
    name: 'グレーひよこ',
    image: '/assets/character/gray-chick.png',
  },
  {
    id: 'green-chick',
    name: 'グリーンひよこ',
    image: '/assets/character/green-chick.png',
  },

  // ご飯
  {
    id: 'beer',
    name: 'ビール',
    image: '/assets/character/beer.png',
  },

  // その他
  {
    id: 'moving-cardboard-box-avatar',
    name: '動く段ボール',
    image: '/assets/character/moving-cardboard-box-avatar.png',
  },
];
