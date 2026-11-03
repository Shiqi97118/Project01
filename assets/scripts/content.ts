import { Card, HandType, baseChips, shuffle } from './cards';

export interface Blind {
    name: string;
    target: number;
    plays: number;
    discards: number;
}

export interface Joker {
    id: string;
    name: string;
    detail: string;
    kind: 'chips' | 'play';
    hand?: HandType;
    amount: number;
}

export const HAND_NAME: Record<HandType, string> = {
    pair: '对子',
    three: '三条',
    straight: '顺子',
    flush: '同花',
    fullHouse: '葫芦',
};

export const BLINDS: Blind[] = [
    { name: '锈门', target: 100, plays: 4, discards: 4 },
    { name: '沙桌', target: 200, plays: 4, discards: 3 },
    { name: '赌桌', target: 280, plays: 4, discards: 2 },
];

export const JOKERS: Joker[] = [
    { id: 'rusty-nail', name: '锈钉', detail: '对子额外 +40', kind: 'chips', hand: 'pair', amount: 40 },
    { id: 'three-nails', name: '三钉', detail: '三条额外 +50', kind: 'chips', hand: 'three', amount: 50 },
    { id: 'straight-road', name: '直路', detail: '顺子额外 +60', kind: 'chips', hand: 'straight', amount: 60 },
    { id: 'same-cloth', name: '同色布', detail: '同花额外 +60', kind: 'chips', hand: 'flush', amount: 60 },
    { id: 'full-table', name: '满座', detail: '葫芦额外 +80', kind: 'chips', hand: 'fullHouse', amount: 80 },
    { id: 'extra-play', name: '加一手', detail: '之后每关出牌 +1', kind: 'play', amount: 1 },
];

export const CHARACTER = {
    name: '沙狐',
    prefers: ['straight', 'flush'] as HandType[],
    bonus: 25,
};

export function scoreHand(type: HandType, cards: Card[], jokers: Joker[]): number {
    let chips = baseChips(type, cards);
    for (let index = 0; index < jokers.length; index++) {
        const joker = jokers[index];
        if (joker.kind === 'chips' && joker.hand === type) {
            chips += joker.amount;
        }
    }
    return chips;
}

export function extraPlays(jokers: Joker[]): number {
    let extra = 0;
    for (let index = 0; index < jokers.length; index++) {
        if (jokers[index].kind === 'play') extra += jokers[index].amount;
    }
    return extra;
}

export function preferredBonus(type: HandType): number {
    for (let index = 0; index < CHARACTER.prefers.length; index++) {
        if (CHARACTER.prefers[index] === type) return CHARACTER.bonus;
    }
    return 0;
}

export function offerJokers(owned: Joker[], rng: () => number = Math.random): Joker[] {
    const pool = JOKERS.filter((joker) => !owned.some((kept) => kept.id === joker.id));
    return shuffle(pool, rng).slice(0, Math.min(3, pool.length));
}
