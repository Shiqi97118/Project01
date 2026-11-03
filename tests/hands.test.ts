import assert from 'node:assert/strict';
import {
    Card,
    evaluate,
    freshDeck,
    hasLegalPlay,
    shuffle,
    baseChips,
} from '../assets/scripts/cards';
import {
    BLINDS,
    CHARACTER,
    JOKERS,
    Joker,
    extraPlays,
    offerJokers,
    preferredBonus,
    scoreHand,
} from '../assets/scripts/content';

function card(rank: number, suit: Card['suit'] = 'spade'): Card {
    return { rank, suit };
}

function spread(ranks: number[]): Card[] {
    const suits: Card['suit'][] = ['spade', 'heart', 'club', 'diamond', 'heart'];
    return ranks.map((rank, index) => card(rank, suits[index]));
}

function cards(ranks: number[], suit: Card['suit'] = 'spade'): Card[] {
    return ranks.map((rank) => card(rank, suit));
}

assert.equal(freshDeck().length, 52);
assert.equal(evaluate(cards([14, 14])), 'pair');
assert.equal(evaluate(cards([7, 7, 7])), 'three');
assert.equal(evaluate(spread([10, 11, 12, 13, 14])), 'straight');
assert.equal(evaluate(spread([14, 2, 3, 4, 5])), 'straight');
assert.equal(evaluate(spread([12, 13, 14, 2, 3])), null);
assert.equal(evaluate([
    card(2, 'heart'), card(9, 'heart'), card(6, 'heart'), card(13, 'heart'), card(4, 'heart'),
]), 'flush');
assert.equal(evaluate([
    card(13, 'spade'), card(13, 'heart'), card(13, 'club'), card(4, 'diamond'), card(4, 'spade'),
]), 'fullHouse');
assert.equal(evaluate([card(9, 'spade'), card(9, 'heart'), card(4, 'club'), card(4, 'diamond')]), null);
assert.equal(evaluate(cards([8, 8, 8, 8])), null);
assert.equal(evaluate(cards([14, 14, 3])), null);

const straightFlush = [
    card(10, 'heart'), card(11, 'heart'), card(12, 'heart'), card(13, 'heart'), card(14, 'heart'),
];
assert.equal(evaluate(straightFlush), 'flush');
assert.equal(preferredBonus('flush'), CHARACTER.bonus);
assert.equal(preferredBonus('straight'), CHARACTER.bonus);
assert.equal(preferredBonus('pair'), 0);

const pair = cards([14, 14]);
const pairScore = scoreHand('pair', pair, []);
assert.equal(pairScore, baseChips('pair', pair));
assert.equal(scoreHand('pair', pair, [JOKERS[0]]), pairScore + 40);
assert.equal(scoreHand('flush', straightFlush, []), baseChips('flush', straightFlush));
assert.ok(scoreHand('flush', straightFlush, []) !== baseChips('flush', straightFlush) + CHARACTER.bonus);

const owned = [JOKERS[0], JOKERS[5]];
const offer = offerJokers(owned, mulberry32(3));
assert.equal(offer.length, 3);
assert.ok(offer.every((joker) => joker.id !== 'rusty-nail' && joker.id !== 'extra-play'));
assert.equal(extraPlays([JOKERS[5]]), 1);
assert.equal(extraPlays([]), 0);

const decentClears = countOutcomes(playDecent, 40);
const weakFails = 40 - countOutcomes(playWeak, 40);
console.log(JSON.stringify({ decentClears, weakFails, blinds: BLINDS }));
assert.ok(decentClears >= 8, `decent clears ${decentClears}/40`);
assert.ok(weakFails >= 8, `weak fails ${weakFails}/40`);
assert.equal(hasLegalPlay(cards([2, 5, 9, 11])), false);
assert.equal(hasLegalPlay([card(3, 'spade'), card(3, 'heart'), card(8, 'club')]), true);

console.log('hands ok');

function countOutcomes(play: (seed: number) => boolean, seeds: number): number {
    let clears = 0;
    for (let seed = 1; seed <= seeds; seed++) {
        if (play(seed)) clears += 1;
    }
    return clears;
}

function playDecent(seed: number): boolean {
    return playRun(seed, true);
}

function playWeak(seed: number): boolean {
    return playRun(seed, false);
}

function playRun(seed: number, decent: boolean): boolean {
    const rng = mulberry32(seed);
    let jokers: Joker[] = [];
    for (let blindIndex = 0; blindIndex < BLINDS.length; blindIndex++) {
        const cleared = playBlind(BLINDS[blindIndex], jokers, rng, decent);
        if (!cleared) return false;
        if (blindIndex < BLINDS.length - 1) {
            const choices = offerJokers(jokers, rng);
            jokers = jokers.concat([pickJoker(choices)]);
        }
    }
    return true;
}

function playBlind(
    blind: { target: number; plays: number; discards: number },
    jokers: Joker[],
    rng: () => number,
    decent: boolean,
): boolean {
    let deck = shuffle(freshDeck(), rng);
    let hand: Card[] = [];
    const draw = () => {
        while (hand.length < 8 && deck.length > 0) {
            const next = deck.pop();
            if (next) hand.push(next);
        }
    };
    draw();
    let score = 0;
    let plays = blind.plays + extraPlays(jokers);
    let discards = blind.discards;
    while (score < blind.target && plays > 0) {
        const move = decent ? bestMove(hand, jokers) : lowestPair(hand);
        if (move && (!decent || move.chips >= 70 || discards <= 0 || plays === 1)) {
            score += scoreHand(move.type, move.cards, jokers);
            hand = without(hand, move.cards);
            plays -= 1;
            draw();
            continue;
        }
        if (discards > 0 && hand.length > 0) {
            const dropCount = Math.min(5, hand.length);
            const junk = decent && move ? without(hand, move.cards).slice(0, dropCount) : hand.slice(0, dropCount);
            const dropped = junk.length > 0 ? junk : hand.slice(0, dropCount);
            hand = without(hand, dropped);
            discards -= 1;
            draw();
            continue;
        }
        if (move) {
            score += scoreHand(move.type, move.cards, jokers);
            hand = without(hand, move.cards);
            plays -= 1;
            draw();
            continue;
        }
        break;
    }
    return score >= blind.target;
}

function bestMove(hand: Card[], jokers: Joker[]): { cards: Card[]; type: NonNullable<ReturnType<typeof evaluate>>; chips: number } | null {
    let best: { cards: Card[]; type: NonNullable<ReturnType<typeof evaluate>>; chips: number } | null = null;
    for (const size of [5, 3, 2]) {
        if (hand.length < size) continue;
        for (const combo of combinations(hand, size)) {
            const type = evaluate(combo);
            if (!type) continue;
            const chips = scoreHand(type, combo, jokers);
            if (!best || chips > best.chips) best = { cards: combo, type, chips };
        }
    }
    return best;
}

function lowestPair(hand: Card[]): { cards: Card[]; type: 'pair'; chips: number } | null {
    const grouped = new Map<number, Card[]>();
    for (const card of hand) {
        const list = grouped.get(card.rank) || [];
        list.push(card);
        grouped.set(card.rank, list);
    }
    const ranks = Array.from(grouped.keys()).sort((left, right) => left - right);
    for (const rank of ranks) {
        const list = grouped.get(rank) || [];
        if (list.length >= 2) {
            const cards = [list[0], list[1]];
            return { cards, type: 'pair', chips: scoreHand('pair', cards, []) };
        }
    }
    return null;
}

function pickJoker(choices: Joker[]): Joker {
    const extra = choices.find((joker) => joker.kind === 'play');
    if (extra) return extra;
    return choices.slice().sort((left, right) => right.amount - left.amount)[0];
}

function without(hand: Card[], dropped: Card[]): Card[] {
    return hand.filter((card) => dropped.indexOf(card) < 0);
}

function combinations<T>(items: T[], size: number): T[][] {
    const found: T[][] = [];
    const picked: T[] = [];
    const walk = (start: number) => {
        if (picked.length === size) {
            found.push(picked.slice());
            return;
        }
        for (let index = start; index < items.length; index++) {
            picked.push(items[index]);
            walk(index + 1);
            picked.pop();
        }
    };
    walk(0);
    return found;
}

function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}
