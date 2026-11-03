export type Suit = 'spade' | 'heart' | 'diamond' | 'club';

export type HandType = 'pair' | 'three' | 'straight' | 'flush' | 'fullHouse';

export interface Card {
    suit: Suit;
    rank: number;
}

export const BASE_CHIPS: Record<HandType, number> = {
    pair: 30,
    three: 70,
    straight: 100,
    flush: 110,
    fullHouse: 160,
};

const SUITS: Suit[] = ['spade', 'heart', 'diamond', 'club'];
const SUIT_ORDER: Record<Suit, number> = { spade: 0, heart: 1, club: 2, diamond: 3 };
const WHEEL = [2, 3, 4, 5, 14];

export function freshDeck(): Card[] {
    const cards: Card[] = [];
    for (let suitIndex = 0; suitIndex < SUITS.length; suitIndex++) {
        for (let rank = 2; rank <= 14; rank++) {
            cards.push({ suit: SUITS[suitIndex], rank });
        }
    }
    return cards;
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index--) {
        const swap = Math.floor(rng() * (index + 1));
        const current = copy[index];
        copy[index] = copy[swap];
        copy[swap] = current;
    }
    return copy;
}

export function sortHand(hand: Card[]): Card[] {
    return hand.slice().sort((left, right) => {
        if (left.rank !== right.rank) {
            return right.rank - left.rank;
        }
        return SUIT_ORDER[left.suit] - SUIT_ORDER[right.suit];
    });
}

export function rankLabel(rank: number): string {
    if (rank === 14) return 'A';
    if (rank === 13) return 'K';
    if (rank === 12) return 'Q';
    if (rank === 11) return 'J';
    return String(rank);
}

export function rankChip(rank: number): number {
    if (rank === 14) return 11;
    return Math.min(rank, 10);
}

export function baseChips(type: HandType, cards: Card[]): number {
    let chips = BASE_CHIPS[type];
    for (let index = 0; index < cards.length; index++) {
        chips += rankChip(cards[index].rank);
    }
    return chips;
}

export function evaluate(cards: Card[]): HandType | null {
    const matched: HandType[] = [];
    if (isPair(cards)) matched.push('pair');
    if (isThree(cards)) matched.push('three');
    if (isStraight(cards)) matched.push('straight');
    if (isFlush(cards)) matched.push('flush');
    if (isFullHouse(cards)) matched.push('fullHouse');
    if (matched.length === 0) return null;
    matched.sort((left, right) => BASE_CHIPS[right] - BASE_CHIPS[left]);
    return matched[0];
}

export function hasLegalPlay(hand: Card[]): boolean {
    const sizes = [2, 3, 5];
    for (let sizeIndex = 0; sizeIndex < sizes.length; sizeIndex++) {
        const size = sizes[sizeIndex];
        if (hand.length < size) continue;
        const found = findCombo(hand, size);
        if (found) return true;
    }
    return false;
}

function findCombo(hand: Card[], size: number): boolean {
    const picked: Card[] = [];
    const walk = (start: number): boolean => {
        if (picked.length === size) {
            return evaluate(picked) !== null;
        }
        for (let index = start; index < hand.length; index++) {
            picked.push(hand[index]);
            if (walk(index + 1)) return true;
            picked.pop();
        }
        return false;
    };
    return walk(0);
}

function isPair(cards: Card[]): boolean {
    return cards.length === 2 && cards[0].rank === cards[1].rank;
}

function isThree(cards: Card[]): boolean {
    return cards.length === 3
        && cards[0].rank === cards[1].rank
        && cards[1].rank === cards[2].rank;
}

function isFlush(cards: Card[]): boolean {
    if (cards.length !== 5) return false;
    const suit = cards[0].suit;
    for (let index = 1; index < cards.length; index++) {
        if (cards[index].suit !== suit) return false;
    }
    return true;
}

function isFullHouse(cards: Card[]): boolean {
    if (cards.length !== 5) return false;
    const counts = rankCounts(cards);
    counts.sort((left, right) => left - right);
    return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
}

function isStraight(cards: Card[]): boolean {
    if (cards.length !== 5) return false;
    const ranks = cards.map((card) => card.rank).sort((left, right) => left - right);
    if (new Set(ranks).size !== 5) return false;
    let wheel = true;
    for (let index = 0; index < WHEEL.length; index++) {
        if (ranks[index] !== WHEEL[index]) wheel = false;
    }
    if (wheel) return true;
    for (let index = 1; index < ranks.length; index++) {
        if (ranks[index] !== ranks[index - 1] + 1) return false;
    }
    return true;
}

function rankCounts(cards: Card[]): number[] {
    const counts = new Map<number, number>();
    for (let index = 0; index < cards.length; index++) {
        const rank = cards[index].rank;
        counts.set(rank, (counts.get(rank) || 0) + 1);
    }
    return Array.from(counts.values());
}
